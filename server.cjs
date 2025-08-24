// server.cjs
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const StripeLib = require('stripe');

const app = express();

/* =========================
   CONFIG
========================= */
const FRONT = process.env.FRONT_URL || 'https://inscription-en-ligne-getdryv-1.onrender.com';
const PORT = process.env.PORT || 4242;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

/* =========================
   Stripe (init protégée)
========================= */
let stripe;
try {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY manquante (sk_live_... attendu en prod)');
  }
  stripe = new StripeLib(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
} catch (err) {
  console.error('❌ Stripe init failed:', err.message);
  // On n’arrête pas le process pour éviter un “Deploy failed” si la variable est temporairement absente.
  // Mais toute requête Stripe échouera tant que la clé n’est pas définie.
}

/* =========================
   CORS robuste (prod + variante + localhost)
========================= */
const allowedOrigins = [
  FRONT, // prod (ton domaine actuel)
  'https://inscription-en-ligne-getdryv.onrender.com', // variante sans -1 si tu changes plus tard
  'http://localhost:5173' // dev local
].filter(Boolean);

// normalise une origin (retire les slashs finaux et force le format scheme://host[:port])
function normalizeOrigin(origin) {
  try {
    // si origin valide type https://xxx
    return new URL(origin).origin;
  } catch {
    return String(origin || '').replace(/\/+$/, '');
  }
}

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/postman/webhooks…
    const norm = normalizeOrigin(origin);
    const ok = allowedOrigins.map(normalizeOrigin).includes(norm);
    return ok ? cb(null, true) : cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true
}));
app.options('*', cors());

/* =========================
   Webhook Stripe (RAW body) — DOIT être avant express.json()
========================= */
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  let event = req.body;
  const sig = req.headers['stripe-signature'];

  try {
    if (WEBHOOK_SECRET && stripe) {
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } else {
      // Mode “souple” si pas de secret : accepter JSON tel quel
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const cycles = Number(session.metadata?.cycles || 0);
    if (session.mode === 'subscription' && session.subscription && [2, 3, 4].includes(cycles) && stripe) {
      const end = new Date();
      end.setMonth(end.getMonth() + (cycles - 1));
      stripe.subscriptions.update(session.subscription, {
        cancel_at: Math.floor(end.getTime() / 1000)
      }).then(() => {
        console.log(`Subscription ${session.subscription} auto-cancel @ ${end.toISOString()}`);
      }).catch(console.error);
    }
  }

  res.json({ received: true });
});

/* =========================
   JSON parser pour les autres routes
========================= */
app.use(express.json());

/* =========================
   Sanity & Diagnostic
========================= */
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/_diag', async (_req, res) => {
  try {
    if (!stripe) throw new Error('Stripe non initialisé');
    const acct = await stripe.accounts.retrieve();
    res.json({
      corsFront: FRONT,
      stripeKeyStartsWith: (process.env.STRIPE_SECRET_KEY || '').slice(0, 7), // sk_live / sk_test
      stripeLiveMode: !!acct.livemode,
      chargesEnabled: !!acct.charges_enabled
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'diag failed' });
  }
});

/* =========================
   Offres (centralisées)
========================= */

// Paiement 1x – montants en CENTIMES
const OFFERS_1X = {
  "classique-10h": { label: "Permis 10 heures",       amount1x:  64900 },
  "classique-20h": { label: "Permis 20 heures",       amount1x:  99900 },
  "classique-30h": { label: "Permis 30 heures",       amount1x: 149900 },
  "accelere-20h":  { label: "Accélérée 20 heures",    amount1x: 149900 },
  "accelere-30h":  { label: "Accélérée 30 heures",    amount1x: 179900 }
};

// Paiement en plusieurs fois – TOTAL en CENTIMES (réparti sur n mois)
const OFFERS_NX = {
  "classique-10h": { label: "Permis 10 heures",       amountTotal:  69900 },
  "classique-20h": { label: "Permis 20 heures",       amountTotal: 109900 },
  "classique-30h": { label: "Permis 30 heures",       amountTotal: 164900 },
  "accelere-20h":  { label: "Accélérée 20 heures",    amountTotal: 159900 },
  "accelere-30h":  { label: "Accélérée 30 heures",    amountTotal: 189900 }
};

/* =========================
   Routes Stripe Checkout
========================= */

// 1) Paiement 1x
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe non initialisé côté serveur');
    const { offerId, mode, firstName = '', lastName = '', phone = '', promoCode = '' } = req.body;

    const offer = OFFERS_1X[offerId];
    if (!offer) return res.status(400).json({ error: 'Offre inconnue' });
    if (mode !== '1x') return res.status(400).json({ error: 'Utilise /api/create-installments-session pour le paiement en plusieurs fois' });

    console.log('[1x] offerId=', offerId, 'amount1x=', offer.amount1x);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: offer.amount1x,
          product_data: { name: offer.label }
        },
        quantity: 1
      }],
      payment_method_types: ['card'],
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,

      success_url: `${FRONT}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${FRONT}/?resume=checkout`,

      metadata: {
        offerId, mode,
        firstName, lastName, phone,
        promoCode: (promoCode || '').trim()
      }
    });

    res.json({ id: session.id });
  } catch (e) {
    const msg  = e?.raw?.message || e?.message || 'Erreur interne du serveur';
    const code = e?.raw?.code    || e?.code    || null;
    const type = e?.raw?.type    || e?.type    || null;
    console.error('Stripe error [1x]:', { msg, code, type });
    res.status(500).json({ error: msg, code, type });
  }
});

// 2) Paiement en plusieurs fois (2x/3x/4x via subscription)
app.post('/api/create-installments-session', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe non initialisé côté serveur');
    const { offerId, cycles = 3, firstName = '', lastName = '', phone = '' } = req.body;

    const offer = OFFERS_NX[offerId];
    if (!offer) return res.status(400).json({ error: 'Offre inconnue' });

    const n = Number(cycles);
    if (![2, 3, 4].includes(n)) return res.status(400).json({ error: 'cycles doit être 2, 3 ou 4' });

    const perCycle = Math.floor(offer.amountTotal / n);
    console.log('[nx] offerId=', offerId, 'cycles=', n, 'perCycle=', perCycle, 'total=', offer.amountTotal);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'eur',
          recurring: { interval: 'month' },
          unit_amount: perCycle,
          product_data: { name: `${offer.label} — ${n}x` }
        },
        quantity: 1
      }],
      payment_method_types: ['card'],
      phone_number_collection: { enabled: true },

      success_url: `${FRONT}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${FRONT}/?resume=checkout`,

      subscription_data: {
        metadata: { offerId, cycles: n, firstName, lastName, phone }
      },

      metadata: { offerId, mode: `${n}x`, firstName, lastName, phone, cycles: n }
    });

    res.json({ id: session.id });
  } catch (e) {
    const msg  = e?.raw?.message || e?.message || 'Erreur interne du serveur';
    const code = e?.raw?.code    || e?.code    || null;
    const type = e?.raw?.type    || e?.type    || null;
    console.error('Stripe error [nx]:', { msg, code, type });
    res.status(500).json({ error: msg, code, type });
  }
});

// 3) Récupérer une session (debug/reçu)
app.get('/api/checkout-session/:id', async (req, res) => {
  try {
    if (!stripe) throw new Error('Stripe non initialisé côté serveur');
    const session = await stripe.checkout.sessions.retrieve(req.params.id, {
      expand: ['payment_intent', 'subscription']
    });
    res.json(session);
  } catch (e) {
    res.status(400).json({ error: e?.raw?.message || e.message });
  }
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log(`✅ API Stripe en écoute sur port ${PORT}`);
  console.log(`➡️ Success/Cancel redirigent vers: ${FRONT}`);
  console.log('CORS allowed:', allowedOrigins.map(normalizeOrigin));
  if (!WEBHOOK_SECRET) console.log('ℹ️ STRIPE_WEBHOOK_SECRET non défini (OK en DEV)');
});
