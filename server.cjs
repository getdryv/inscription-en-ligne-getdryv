// server.cjs
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();

// --- CONFIG ---
const FRONT = process.env.FRONT_URL || 'https://inscription-en-ligne-getdryv-1.onrender.com';
const PORT = process.env.PORT || 4242;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

// ⚠️ DOIT être une clé live en prod: sk_live_...
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquante côté serveur');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

// ---------- CORS robuste (prod + localhost)
const allowedOrigins = [
  FRONT,                           // prod (ton -1)
  'https://inscription-en-ligne-getdryv.onrender.com', // variante sans -1 (au cas où)
  'http://localhost:5173'          // dev
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl / webhooks
    try {
      const o = new URL(origin).origin;
      return allowedOrigins.includes(o) ? cb(null, true) : cb(new Error(`Not allowed by CORS: ${origin}`));
    } catch {
      return cb(new Error('Invalid Origin'));
    }
  },
  credentials: true
}));
app.options('*', cors());
app.use(express.json());

console.log('CORS allowed:', allowedOrigins);
console.log('Front URL (success/cancel):', FRONT);

// --- SANITY CHECK ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- DIAGNOSTIC (temporaire) ---
app.get('/api/_diag', async (_req, res) => {
  try {
    const acct = await stripe.accounts.retrieve();
    res.json({
      corsFront: FRONT,
      stripeKeyStartsWith: (process.env.STRIPE_SECRET_KEY || '').slice(0, 7), // sk_live/sk_test
      stripeLiveMode: !!acct.livemode,
      chargesEnabled: !!acct.charges_enabled
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'diag failed' });
  }
});

// --- CREATE CHECKOUT (1x) ---
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { offerId, mode, firstName = '', lastName = '', phone = '', promoCode = '' } = req.body;

    const OFFERS = {
      "classique-10h": { label: "Permis 10 heures",       amount1x:  64900 },
      "classique-20h": { label: "Permis 20 heures",       amount1x:  99900 },
      "classique-30h": { label: "Permis 30 heures",       amount1x: 149900 },
      "accelere-20h":  { label: "Accélérée 20 heures",    amount1x: 149900 },
      "accelere-30h":  { label: "Accélérée 30 heures",    amount1x: 179900 },
    };

    const offer = OFFERS[offerId];
    if (!offer) return res.status(400).json({ error: 'Offre inconnue' });
    if (mode !== '1x') return res.status(400).json({ error: 'Utilise /api/create-installments-session pour le paiement en plusieurs fois' });

    console.log('[1x] offerId=', offerId, 'amount1x=', offer.amount1x);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: offer.amount1x,
          product_data: { name: offer.label },
        },
        quantity: 1,
      }],
      payment_method_types: ['card'],
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,

      success_url: `${FRONT}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${FRONT}/?resume=checkout`,

      metadata: {
        offerId, mode,
        firstName, lastName, phone,
        promoCode: (promoCode || '').trim(),
      },
    });

    return res.json({ id: session.id });
  } catch (e) {
    const msg  = e?.raw?.message || e?.message || 'Erreur interne du serveur';
    const code = e?.raw?.code    || e?.code    || null;
    const type = e?.raw?.type    || e?.type    || null;
    console.error('Stripe error [1x]:', { msg, code, type });
    return res.status(500).json({ error: msg, code, type });
  }
});

// --- INSTALLMENTS (2x/3x/4x par abonnement) ---
app.post('/api/create-installments-session', async (req, res) => {
  try {
    const { offerId, cycles = 3, firstName = '', lastName = '', phone = '' } = req.body;

    const OFFERS = {
      "classique-10h": { label: "Permis 10 heures",       amountTotal:  69900 },
      "classique-20h": { label: "Permis 20 heures",       amountTotal: 109900 },
      "classique-30h": { label: "Permis 30 heures",       amountTotal: 164900 },
      "accelere-20h":  { label: "Accélérée 20 heures",    amountTotal: 159900 },
      "accelere-30h":  { label: "Accélérée 30 heures",    amountTotal: 189900 },
    };

    const offer = OFFERS[offerId];
    if (!offer) return res.status(400).json({ error: 'Offre inconnue' });

    const n = Number(cycles);
    if (![2,3,4].includes(n)) return res.status(400).json({ error: 'cycles doit être 2, 3 ou 4' });

    const perCycle = Math.floor(offer.amountTotal / n);
    console.log('[nx] offerId=', offerId, 'cycles=', n, 'perCycle=', perCycle, 'total=', offer.amountTotal);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'eur',
          recurring: { interval: 'month' },
          unit_amount: perCycle,
          product_data: { name: `${offer.label} — ${n}x` },
        },
        quantity: 1,
      }],
      payment_method_types: ['card'],
      phone_number_collection: { enabled: true },

      success_url: `${FRONT}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${FRONT}/?resume=checkout`,

      subscription_data: {
        metadata: { offerId, cycles: n, firstName, lastName, phone },
      },

      metadata: { offerId, mode: `${n}x`, firstName, lastName, phone, cycles: n },
    });

    return res.json({ id: session.id });
  } catch (e) {
    const msg  = e?.raw?.message || e?.message || 'Erreur interne du serveur';
    const code = e?.raw?.code    || e?.code    || null;
    const type = e?.raw?.type    || e?.type    || null;
    console.error('Stripe error [nx]:', { msg, code, type });
    return res.status(500).json({ error: msg, code, type });
  }
});

// --- Récupérer une session (reçu/debug) ---
app.get('/api/checkout-session/:id', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id, {
      expand: ['payment_intent', 'subscription'],
    });
    res.json(session);
  } catch (e) {
    res.status(400).json({ error: e?.raw?.message || e.message });
  }
});

// --- Webhook Stripe ---
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  let event = req.body;
  const sig = req.headers['stripe-signature'];

  try {
    if (WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const cycles = Number(session.metadata?.cycles || 0);
    if (session.mode === 'subscription' && session.subscription && [2,3,4].includes(cycles)) {
      const end = new Date();
      end.setMonth(end.getMonth() + (cycles - 1));
      stripe.subscriptions.update(session.subscription, {
        cancel_at: Math.floor(end.getTime() / 1000),
      }).then(() => {
        console.log(`Subscription ${session.subscription} auto-cancel @ ${end.toISOString()}`);
      }).catch(console.error);
    }
  }

  res.json({ received: true });
});

// --- START ---
app.listen(PORT, () => {
  console.log(`✅ API Stripe en écoute sur port ${PORT}`);
  console.log(`➡️ Success/Cancel redirigent vers: ${FRONT}`);
  if (!WEBHOOK_SECRET) console.log('ℹ️ STRIPE_WEBHOOK_SECRET non défini (OK en DEV)');
});
