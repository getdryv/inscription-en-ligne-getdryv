// server.cjs
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const dns = require('dns');
const dnsPromises = require('dns').promises;
const Stripe = require('stripe');

const app = express();
app.set('trust proxy', 1);

// --- CONFIG ---
const FRONT = (process.env.FRONT_URL || 'https://inscription-en-ligne-getdryv-1.onrender.com').replace(/\/+$/, '');
const PORT = process.env.PORT || 4242;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

// 🔧 Réseau: privilégier IPv4 (évite les soucis IPv6 vers api.stripe.com)
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
const agent = new https.Agent({
  keepAlive: true,
  // forcer la résolution IPv4 pour toutes les requêtes Stripe
  lookup: (hostname, options, cb) => require('dns').lookup(hostname, { family: 4 }, cb),
});

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY manquante');
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createNodeHttpClient(agent),
  maxNetworkRetries: 0,        // on laisse Stripe ne PAS réessayer pour voir l’erreur nette
  timeout: 20000,              // 20s pour être verbeux dans les logs si ça coince
});

// Helpers
const baseUrl = (req) => `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
const logStripeErr = (e, ctx) => {
  console.error(`❌ ${ctx}:`, {
    name: e.name, type: e.type, code: e.code, message: e.message,
    errno: e.errno, syscall: e.syscall,
    stack: e.stack?.split('\n').slice(0, 2).join(' | ')
  });
};

// CORS (souple)
app.use(cors());

// --- Webhook AVANT le body-parser JSON ---
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  let event = req.body;
  const sig = req.headers['stripe-signature'];

  try {
    event = WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET)
      : JSON.parse(req.body.toString());
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

// Body parser JSON pour le reste
app.use(express.json());

// --- SANITY CHECK ---
app.get('/api/health', (_req, res) => res.json({ ok: true, node: process.version, front: FRONT }));

// --- DIAG: tester la connectivité vers Stripe ---
app.get('/api/_diag', async (_req, res) => {
  try {
    const resolves = await dnsPromises.lookup('api.stripe.com', { all: true });
    const ipList = resolves.map(r => `${r.address}/${r.family}`);
    const ping = (url) => new Promise((resolve) => {
      https.get(url, (r) => resolve({ status: r.statusCode, headers: r.headers }))
        .on('error', (e) => resolve({ error: e.message, code: e.code, syscall: e.syscall }))
        .setTimeout(8000, function(){ this.destroy(new Error('Timeout')); });
    });
    const g = await ping('https://www.google.com');
    const s = await ping('https://api.stripe.com/');
    res.json({ node: process.version, stripeDns: ipList, googleHead: g, stripeHead: s });
  } catch (e) {
    res.status(500).json({ diagError: e.message });
  }
});

// --- CREATE CHECKOUT (1x) ---
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { offerId, mode, firstName = '', lastName = '', phone = '', promoCode = '' } = req.body;

    const OFFERS = {
      'classique-10h': { label: 'Permis 10 heures', amount1x:  64900 },
      'classique-20h': { label: 'Permis 20 heures', amount1x:  99900 },
      'classique-30h': { label: 'Permis 30 heures', amount1x: 149900 },
      'accelere-20h':  { label: 'Accélérée 20 heures', amount1x: 149900 },
      'accelere-30h':  { label: 'Accélérée 30 heures', amount1x: 179900 },
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
      success_url: `${baseUrl(req)}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl(req)}/?resume=checkout`,
      metadata: {
        offerId, mode, firstName, lastName, phone,
        promoCode: (promoCode || '').trim(),
      },
    });

    res.json({ id: session.id });
  } catch (e) {
    logStripeErr(e, 'create-checkout-session');
    res.status(500).json({ error: e?.raw?.message || e.message || 'Erreur interne du serveur' });
  }
});

// --- INSTALLMENTS (2x/3x/4x) ---
app.post('/api/create-installments-session', async (req, res) => {
  try {
    const { offerId, cycles = 3, firstName = '', lastName = '', phone = '' } = req.body;

    const OFFERS = {
      'classique-10h': { label: 'Permis 10 heures', amountTotal:  69900 },
      'classique-20h': { label: 'Permis 20 heures', amountTotal: 109900 },
      'classique-30h': { label: 'Permis 30 heures', amountTotal: 164900 },
      'accelere-20h':  { label: 'Accélérée 20 heures', amountTotal: 159900 },
      'accelere-30h':  { label: 'Accélérée 30 heures', amountTotal: 189900 },
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
      success_url: `${baseUrl(req)}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl(req)}/?resume=checkout`,
      subscription_data: {
        metadata: { offerId, cycles: n, firstName, lastName, phone },
      },
      metadata: { offerId, mode: `${n}x`, firstName, lastName, phone, cycles: n },
    });

    res.json({ id: session.id });
  } catch (e) {
    logStripeErr(e, 'create-installments-session');
    res.status(500).json({ error: e?.raw?.message || e.message || 'Erreur interne du serveur' });
  }
});

// --- GET session (optionnel) ---
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
  console.log(`✅ API Stripe en écoute sur port ${PORT}`);
  if (!WEBHOOK_SECRET) console.log('ℹ️ STRIPE_WEBHOOK_SECRET non défini (OK en DEV)');
});
