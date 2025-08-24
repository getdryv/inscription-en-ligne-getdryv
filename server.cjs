// server.cjs
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const path = require('path');
const fs = require('fs'); // <- ajouté pour tester l'existence d'admin.html

const app = express();

// --- CONFIG ---
const FRONT = process.env.FRONT_URL || 'http://localhost:5173';
const PORT = process.env.PORT || 4242;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

// --- HEALTH CHECK ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- Webhook Stripe (⚠️ doit être défini AVANT express.json) ---
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  let event = req.body;
  const sig = req.headers['stripe-signature'];

  try {
    if (WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } else {
      event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString() : req.body);
    }
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
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

  res.json({ received: true });
});

// --- Middlewares (après webhook) ---
app.use(cors({ origin: FRONT, credentials: true }));
app.use(express.json());

// --- CREATE CHECKOUT (1x) ---
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { offerId, mode, firstName = '', lastName = '', phone = '', promoCode = '' } = req.body;

    const OFFERS = {
      "classique-10h": { label: "Permis 10 heures", amount1x: 64900 },
      "classique-20h": { label: "Permis 20 heures", amount1x: 99900 },
      "classique-30h": { label: "Permis 30 heures", amount1x: 149900 },
      "accelere-20h":  { label: "Accélérée 20 heures", amount1x: 149900 },
      "accelere-30h":  { label: "Accélérée 30 heures", amount1x: 179900 },
    };

    const offer = OFFERS[offerId];
    if (!offer) return res.status(400).json({ error: 'Offre inconnue' });
    if (mode !== '1x') return res.status(400).json({ error: 'Utilise /api/create-installments-session pour le paiement en plusieurs fois' });

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
      cancel_url: `${FRONT}/?resume=checkout`,
      metadata: { offerId, mode, firstName, lastName, phone, promoCode: (promoCode || '').trim() },
    });

    res.json({ id: session.id });
  } catch (e) {
    res.status(500).json({ error: e?.raw?.message || e.message || 'Erreur interne du serveur' });
  }
});

// --- INSTALLMENTS (2x/3x/4x) ---
app.post('/api/create-installments-session', async (req, res) => {
  try {
    const { offerId, cycles = 3, firstName = '', lastName = '', phone = '' } = req.body;

    const OFFERS = {
      "classique-10h": { label: "Permis 10 heures", amountTotal: 69900 },
      "classique-20h": { label: "Permis 20 heures", amountTotal: 109900 },
      "classique-30h": { label: "Permis 30 heures", amountTotal: 164900 },
      "accelere-20h":  { label: "Accélérée 20 heures", amountTotal: 159900 },
      "accelere-30h":  { label: "Accélérée 30 heures", amountTotal: 189900 },
    };

    const offer = OFFERS[offerId];
    if (!offer) return res.status(400).json({ error: 'Offre inconnue' });

    const n = Number(cycles);
    if (![2, 3, 4].includes(n)) return res.status(400).json({ error: 'cycles doit être 2, 3 ou 4' });

    const perCycle = Math.floor(offer.amountTotal / n);

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
      cancel_url: `${FRONT}/?resume=checkout`,
      subscription_data: { metadata: { offerId, cycles: n, firstName, lastName, phone } },
      metadata: { offerId, mode: `${n}x`, firstName, lastName, phone, cycles: n },
    });

    res.json({ id: session.id });
  } catch (e) {
    res.status(500).json({ error: e?.raw?.message || e.message || 'Erreur interne du serveur' });
  }
});

// --- GET SESSION (reçu) ---
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

// === Static files (Vite build) ===
app.use(express.static(path.join(__dirname, 'dist')));

// /admin.html et /admin — fallback si admin.html supprimé
app.get(['/admin.html', '/admin'], (req, res) => {
  const adminFile = path.join(__dirname, 'dist', 'admin.html');
  if (fs.existsSync(adminFile)) {
    return res.sendFile(adminFile);
  }
  return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Catch-all pour l'app publique (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- START ---
app.listen(PORT, () => {
  console.log(`✅ API Stripe sur http://localhost:${PORT}`);
  if (!WEBHOOK_SECRET) console.log('ℹ️ STRIPE_WEBHOOK_SECRET non défini (OK en DEV)');
});
