// server.cjs
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const dns = require('dns');

// 🔒 Évite les soucis IPv6 : privilégie IPv4
dns.setDefaultResultOrder('ipv4first');

const app = express();

// --- CONFIG ---
const FRONT = process.env.FRONT_URL || 'https://inscription-en-ligne-getdryv.onrender.com';
const PORT = process.env.PORT || 4242;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

// ✅ Trim la clé (supprime espaces / retours de ligne)
const STRIPE_KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2024-06-20' });

// --- CORS ---
app.use(cors({ origin: FRONT, credentials: true }));

// ────────────────────────────────────────────────────────────────
//  WEBHOOK STRIPE (⚠️ corps RAW) — doit être DÉCLARÉ AVANT express.json()
// ────────────────────────────────────────────────────────────────
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  let event = req.body; // Buffer brut
  const sig = req.headers['stripe-signature'];

  try {
    if (WEBHOOK_SECRET) {
      // Vérifie la signature avec le corps brut
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } else {
      // Dev only (sans secret) : parse brut
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Traitements
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // Auto-cancel après N prélèvements pour du 2x/3x/4x (abonnement)
    const cycles = Number(session.metadata?.cycles || 0);

    if (session.mode === 'subscription' && session.subscription && [2, 3, 4].includes(cycles)) {
      const end = new Date();
      end.setMonth(end.getMonth() + (cycles - 1));
      stripe.subscriptions.update(session.subscription, {
        cancel_at: Math.floor(end.getTime() / 1000),
      }).then(() => {
        console.log(`Subscription ${session.subscription} auto-cancel @ ${end.toISOString()}`);
      }).catch(console.error);
    }
  }

  // (Tu peux ajouter ici d’autres cases : invoice.paid, payment_intent.succeeded, etc.)

  return res.json({ received: true });
});

// ────────────────────────────────────────────────────────────────
//  JSON parser pour TOUTES LES AUTRES ROUTES (après le webhook)
// ────────────────────────────────────────────────────────────────
app.use(express.json());

// --- SANITY CHECK ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- CREATE CHECKOUT (1x) ---
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { offerId, mode, firstName = '', lastName = '', phone = '', promoCode = '' } = req.body;

    // ✅ Offres 1x (CENTIMES) — alignées sur le front
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

    res.json({ id: session.id });
  } catch (e) {
    console.error('Erreur create-checkout-session:', e?.raw?.message || e.message);
    res.status(500).json({ error: e?.raw?.message || e.message || 'Erreur interne du serveur' });
  }
});

// --- INSTALLMENTS (ex: 2x/3x/4x sous forme d’abonnement) ---
app.post('/api/create-installments-session', async (req, res) => {
  try {
    const { offerId, cycles = 3, firstName = '', lastName = '', phone = '' } = req.body;

    // ✅ Offres en plusieurs fois : TOTAL (CENTIMES)
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

    res.json({ id: session.id });
  } catch (e) {
    console.error('Erreur create-installments-session:', e?.raw?.message || e.message);
    res.status(500).json({ error: e?.raw?.message || e.message || 'Erreur interne du serveur' });
  }
});

// --- (Optionnel) Récupérer une session pour afficher le reçu ---
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

// --- START ---
app.listen(PORT, () => {
  console.log(`✅ API Stripe sur port ${PORT}`);
  console.log(`➡️ FRONT_URL = ${FRONT}`);
  if (!WEBHOOK_SECRET) console.log('ℹ️ STRIPE_WEBHOOK_SECRET non défini (OK en DEV)');
});
