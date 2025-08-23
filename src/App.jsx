// src/App.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';

// --- Auth / Firebase
// src/App.jsx
import { auth, db } from './firebase';
import { loginWithGoogle } from './auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// ✅ Utilise ta modale et tes icônes du dossier components
import OfferModal from './components/OfferModal.jsx';
import { Gift, Calendar, CreditCard } from './components/icons.jsx';

// Clé publique via .env du FRONT : VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
const PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
if (!PK) console.error('⚠️ VITE_STRIPE_PUBLISHABLE_KEY manquante dans le .env du front.');
const stripePromise = PK ? loadStripe(PK) : Promise.resolve(null);

// ✅ Base URL de l’API (front). Par défaut 4242 en local.
const API = import.meta.env.VITE_API_BASE || '';

// ------------------------------------------------------------------
// OFFRES (tarifs + options)
const OFFERS = {
  classique: [
    {
      id: 'classique-10h',
      label: 'Permis 10 heures',
      family: 'Classique',
      hours: 10,
      payIn1x: { amount: 649, discount: 50 },
      installments: { cycles: 3, perCycle: 233, total: 699 },
      allowedCycles: [3],
      perks: ['E-learning offert', 'Évaluation initiale', 'Planning flexible'],
    },
    {
      id: 'classique-20h',
      label: 'Permis 20 heures',
      family: 'Classique',
      hours: 20,
      payIn1x: { amount: 999, discount: 100 },
      installments: { cycles: 3, perCycle: 366.3, total: 1099 },
      allowedCycles: [3],
      perks: ['E-learning offert', 'Évaluation initiale', 'Planning flexible'],
    },
    {
      id: 'classique-30h',
      label: 'Permis 30 heures',
      family: 'Classique',
      hours: 30,
      payIn1x: { amount: 1499, discount: 150 },
      installments: { total: 1649 },
      allowedCycles: [3, 4],
      perks: ['E-learning offert', 'Évaluation initiale', 'Planning flexible'],
    },
  ],
  accelere: [
    {
      id: 'accelere-20h',
      label: 'Accélérée 20 heures',
      family: 'Accélérée',
      hours: 20,
      payIn1x: { amount: 1499, discount: 100 },
      installments: { cycles: 2, perCycle: 799.5, total: 1599 },
      allowedCycles: [2],
      perks: ['E-learning offert', 'Évaluation initiale', 'Convocation examen sous 30 jours'],
    },
    {
      id: 'accelere-30h',
      label: 'Accélérée 30 heures',
      family: 'Accélérée',
      hours: 30,
      payIn1x: { amount: 1799, discount: 100 },
      installments: { cycles: 3, perCycle: 633, total: 1899 },
      allowedCycles: [3],
      perks: ['E-learning offert', 'Évaluation initiale', 'Convocation examen sous 30 jours      '],
    },
  ],
};

// ------------------------------------------------------------------
// FICHES PACKS pour la modale
const PACK_CONTENT = {
  'classique-10h': {
    summary: "Parfait si tu as déjà avancé : 10 h ciblées pour finaliser ta préparation et être prêt le jour J.",
    included: ["10 heures de conduite", "Accès illimité au code en ligne", "Évaluation initiale offerte"],
    conditions: ["Code de la route valide", "Attester d’au moins 10h de conduite en boite manuelle ou 3 heures en boite automatique       "],
    excluded: ["Frais d'examen du code : 30 €", "Examen pratique : 55 €"],
  },
  'classique-20h': {
    summary: "La formation initiale classique pour démarrer sereinement et maîtriser les bases.",
    included: ["20 heures de conduite", "Accès illimité au code en ligne", "Évaluation initiale offerte"],
    conditions: [],
    excluded: ["Frais d'examen du code : 30 €", "Examen pratique : 55 €"],
  },
  'classique-30h': {
    summary: "La sérénité totale : 10 h de plus que le minimum pour ancrer les acquis et gagner en confiance.",
    included: ["30 heures de conduite", "Accès illimité au code en ligne", "Évaluation initiale offerte"],
    conditions: [],
    excluded: ["Frais d'examen du code : 30 €", "Examen pratique : 55 €"],
  },
  'accelere-20h': {
    summary: "Formation accélérée et passage à l'examen en moins de 2 mois, avec programme intensif.",
    included: ["20 heures de conduite en 20 jours", "Accès illimité au code en ligne", "Évaluation initiale offerte", "Examen pratique inclus"],
    conditions: ["Code de la route valide (ou en cours d'obtention)", "Disponibilité pour le planning intensif"],
    excluded: [],
    disclaimer: "Examen du code non inclus (30 €).",
  },
  'accelere-30h': {
    summary: "Intensif 30 h : prêt rapidement et examen en moins de 2 mois.",
    included: ["30 heures de conduite en 30 jours", "Accès illimité au code en ligne", "Évaluation initiale offerte", "Examen pratique inclus"],
    conditions: ["Code de la route valide (ou en cours d'obtention)", "Disponibilité pour le planning intensif"],
    excluded: [],
    disclaimer: "Examen du code non inclus (30 €).",
  },
};

const BRAND = {
  primary: '#635bff',
  font: 'Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
};

function Stepper({ step }) {
  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
      <div className="mx-auto px-4 py-3 flex items-center justify-between gap-4" style={{maxWidth:'720px'}}>
        <div className="flex items-center gap-3">
          <div className="font-extrabold text-lg" style={{ color: BRAND.primary }}>GETdryv</div>
          <div className="text-xs text-gray-700">
            Boîte manuelle ou automatique • 14 jours pour changer d&apos;avis
          </div>
        </div>
        <div className="text-sm font-medium">{step}/3</div>
      </div>
    </div>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="w-full rounded-2xl py-3 font-semibold shadow-sm hover:shadow transition border text-white"
      style={{ backgroundColor: BRAND.primary, borderColor: BRAND.primary }}
    >
      {children}
    </button>
  );
}
function OutlineButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="w-full rounded-2xl py-3 font-semibold border hover:bg-gray-50 transition flex items-center justify-center gap-2"
    >
      {children}
    </button>
  );
}

export default function App() {
  const [step, setStep] = useState(1);
  const [tab, setTab] = useState('classique');
  const [modalOffer, setModalOffer] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const payAnchorRef = useRef(null);

  // ---- Données "inscription" (sans compte)
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [leadError, setLeadError] = useState('');

  // heures dispo par famille
  const chipClass = (selected) =>
    `rounded-2xl px-4 py-2 text-sm font-medium border transition
     ${selected
       ? 'bg-[#635bff] text-white border-transparent'
       : 'bg-[#E8EAFF] text-[#463CFF] border-transparent hover:bg-[#e0e3ff]'}`;

  const hoursOptions = useMemo(() => {
    const opts = new Set(OFFERS[tab].map((o) => o.hours));
    return Array.from(opts).sort((a, b) => a - b);
  }, [tab]);

  const [selectedHours, setSelectedHours] = useState(null);
  useEffect(() => { setSelectedHours(hoursOptions[0] ?? null); setExpanded(false); }, [tab, hoursOptions]);

  // offre courante
  const currentOffer = useMemo(() => {
    if (selectedHours == null) return null;
    return OFFERS[tab].find((o) => o.hours === selectedHours) || OFFERS[tab][0];
  }, [tab, selectedHours]);

  const [selection, setSelection] = useState({});

  // helpers paiement
  const formatPrice = (x, prefer2dec = false) => {
    const digits = prefer2dec ? 2 : (Number.isInteger(x) ? 0 : 2);
    return Number(x).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };
  const perCycleAmount = (offer, n) => {
    const total = offer?.installments?.total ?? 0;
    return total / n;
  };

  // bouton RDV
  const InscriptionBouton = (
    <button
      onClick={() => window.open('https://calendly.com/hello-getdryv/nouvelle-reunion?month=2025-08', '_blank')}
      className="w-full rounded-2xl py-3 font-semibold border"
      style={{ background:'#fff', color:BRAND.primary, borderColor:BRAND.primary }}
    >
      Inscription en agence (RDV)
    </button>
  );

  // Titres
  const cardTitle = tab === 'classique' ? 'Permis B' : "Permis B - Accéléré";

  const offeredKeywords = ['e-learning', 'Évaluation initiale', 'évaluation initiale'];
  const renderPerk = (p) => {
    const lower = p.toLowerCase();
    const hasOffertWord = /\boffert(e|s)?\b/.test(lower);
    const isKeywordOffered = offeredKeywords.some(k => lower.includes(k));
    const isOffert = hasOffertWord || isKeywordOffered;
    const clean = p.replace(/\s*\b(offert|offerte|offerts|offertes)\b/gi, '').trim();
    const isPlanning = lower.includes('planning flexible');
    return (
      <span className="inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1 text-sm" key={p}>
        {isOffert ? <Gift/> : isPlanning ? <Calendar/> : null}
        {clean}
      </span>
    );
  };

  // ---------- Étape 1 handlers
  // --------- Étape 1 handlers
const saveLeadAndGo = async (lead) => {
  try {
    console.log('~ Tentative d’enregistrement du lead :', lead);

    const ref = await addDoc(collection(db, 'leads'), {
      ...lead,
      createdAt: serverTimestamp(),
    });

    console.log('✅ Lead enregistré avec succès, id =', ref.id);
  } catch (e) {
    console.error('❌ Lead non enregistré en Firestore :', e.code || e.message, e);
    alert('Erreur Firestore: ' + (e.code || e.message));
  }

  setStep(2);
};


  const handleManualContinue = async () => {
    setLeadError('');
    if (!first || !last || !email || !phone) {
      setLeadError('Merci de compléter tous les champs.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setLeadError('Email invalide.');
      return;
    }
    setBusy(true);
    await saveLeadAndGo({ first, last, email, phone, source: 'form' });
    setBusy(false);
  };

  const handleGoogleContinue = async () => {
    setBusy(true); setLeadError('');
    try {
      await loginWithGoogle();
      const u = auth.currentUser;
      const fullName = u?.displayName || '';
      const [fn, ...rest] = fullName.split(' ');
      const ln = rest.join(' ');
      await saveLeadAndGo({
        first: fn || '',
        last: ln || '',
        email: u?.email || '',
        phone: '',
        source: 'google',
        uid: u?.uid || undefined,
      });
    } catch (e) {
      console.error(e);
      setLeadError(e?.message || 'Connexion Google impossible.');
    } finally {
      setBusy(false);
    }
  };

  // ---------- Restauration quand on revient de Stripe (flèche ou bouton Retour)
  useEffect(() => {
    const url = new URL(window.location.href);
    const resume = url.searchParams.get('resume') === 'checkout';
    const wentToStripe = sessionStorage.getItem('gd:wentToStripe') === '1';
    const fromStripeRef = document.referrer && document.referrer.includes('checkout.stripe.com');

    if (wentToStripe || resume || fromStripeRef) {
      try {
        const saved = JSON.parse(sessionStorage.getItem('gd:selection') || '{}');
        if (saved && saved.offerId && saved.mode) {
          setSelection(saved);
          setStep(3);
        }
      } catch (_) {}
      // Nettoie le flag & l’URL ?resume=checkout
      sessionStorage.removeItem('gd:wentToStripe');
      url.searchParams.delete('resume');
      const newSearch = url.searchParams.toString();
      const cleanUrl = url.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', cleanUrl || '/');
    }
  }, []);

  // ---------- Paiement
  const handleCheckout = async () => {
    if (!selection?.offerId || !selection?.mode) {
      alert("Sélection invalide.");
      return;
    }

    const stripe = await stripePromise;
    if (!stripe) {
      alert("Clé publique Stripe absente : ajoute VITE_STRIPE_PUBLISHABLE_KEY dans le .env du front puis redémarre `npm run dev`.");
      return;
    }

    const isOneShot = selection.mode === '1x';
    const endpoint = isOneShot
      ? '/api/create-checkout-session'
      : '/api/create-installments-session';

    const payload = isOneShot
      ? { offerId: selection.offerId, mode: selection.mode }
      : { offerId: selection.offerId, cycles: Number(selection.mode.replace('x','')) };

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status} - ${text || 'réponse vide'}`);

      // ✅ On mémorise l’état pour restaurer la page exacte au retour
      sessionStorage.setItem('gd:selection', JSON.stringify(selection));
      sessionStorage.setItem('gd:wentToStripe', '1');

      const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
      if (error) alert(error.message);
    } catch (e) {
      console.error(e);
      alert("Impossible de lancer le paiement : " + e.message);
    }
  };

  return (
    <div style={{ fontFamily: BRAND.font }} className="min-h-screen text-gray-900">
      <Stepper step={step} />

      <main className="mx-auto px-4 py-8" style={{maxWidth:'720px'}}>
        {/* Étape 1 — Inscription (deux méthodes) */}
        {step === 1 && (
          <section className="space-y-6">
            <h1 className="text-2xl font-bold text-center">Inscription</h1>
            <p className="text-gray-600 text-center">
              Deux façons d’accéder aux tarifs et passer au paiement : remplis le formulaire rapide
              <span className="hidden sm:inline">,</span> ou continue avec Google.
            </p>
            {leadError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {leadError}
              </div>
            )}

            {/* Méthode 1 : Formulaire rapide */}
            <div className="rounded-3xl border p-5 shadow-sm bg-white">
              <div className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="grid gap-1">
                    <span className="text-sm">Prénom</span>
                    <input className="rounded-xl border px-3 py-2" value={first} onChange={e=>setFirst(e.target.value)} placeholder="Ex : Nicolas" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm">Nom</span>
                    <input className="rounded-xl border px-3 py-2" value={last} onChange={e=>setLast(e.target.value)} placeholder="Ex : Dumont" />
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-sm">Email</span>
                  <input type="email" className="rounded-xl border px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@exemple.com" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm">Téléphone</span>
                  <input className="rounded-xl border px-3 py-2" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="06 12 34 56 78" />
                </label>

                <PrimaryButton onClick={handleManualContinue} disabled={busy}>
                  {busy ? '...' : "Voir les tarifs"}
                </PrimaryButton>
              </div>
            </div>

            {/* Méthode 2 : Google */}
            <div className="rounded-3xl border p-5 shadow-sm bg-white">
              <h2 className="text-xl font-semibold mb-3 text-center">ou</h2>
              <OutlineButton onClick={handleGoogleContinue} disabled={busy}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.6 29.3 36 24 36 16.8 36 11 30.2 11 23S16.8 10 24 10c3.7 0 7 1.4 9.5 3.7l5.6-5.6C35.6 4.1 30.1 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11.9 0 21.6-8.6 21.6-22 0-1.1-.1-2.2-.3-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.9 16 19.1 13 24 13c3.7 0 7 1.4 9.5 3.7l5.6-5.6C35.6 4.1 30.1 2 24 2 15 2 7.4 7.2 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 46c6 0 11.5-2.3 15.4-6.1l-7.1-5.8C30.9 35.7 27.7 37 24 37c-5.2 0-9.7-3.4-11.3-8.1l-6.5 5.1C8.4 41 15.6 46 24 46z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.6-6.1 8-11.3 8-5.2 0-9.7-3.4-11.3-8.1l-6.5 5.1C8.4 41 15.6 46 24 46c11.9 0 21.6-8.6 21.6-22 0-1.1-.1-2.2-.3-3.5z"/>
                </svg>
                <span>Continuer avec Google</span>
              </OutlineButton>
            </div>
          </section>
        )}

        {/* Étape 2 — Offre */}
        {step === 2 && currentOffer && (
          <section className="space-y-6">
            {/* Onglets */}
            <div className="flex items-center justify-center gap-2">
              <button className={chipClass(tab === 'classique')} onClick={() => setTab('classique')}>Classique</button>
              <button className={chipClass(tab === 'accelere')} onClick={() => setTab('accelere')}>Accélérée</button>
            </div>

            <div className="rounded-3xl border p-5 shadow-sm mx-auto bg-white" style={{maxWidth:'720px'}}>
              {/* Titre */}
              <h3 className="text-xl md:text-2xl font-semibold" style={{ color: BRAND.primary }}>
                {cardTitle}
              </h3>

              {/* Badges heures */}
              <div className="mt-2 flex items-center justify-center gap-2">
                {hoursOptions.map((h) => (
                  <button
                    key={h}
                    className={chipClass(selectedHours === h)}
                    onClick={() => { setSelectedHours(h); setExpanded(false); }}
                    aria-pressed={selectedHours === h}
                  >
                    {h} h
                  </button>
                ))}
              </div>

              {/* Perks */}
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                {currentOffer.perks.map(renderPerk)}
              </div>

              {/* Prix */}
              <div className="mt-4 grid gap-1">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-extrabold">
                    {currentOffer.payIn1x.amount.toLocaleString('fr-FR')} €
                  </div>
                  <div className="text-lg line-through text-gray-400">
                    {currentOffer.installments.total.toLocaleString('fr-FR')} €
                  </div>
                  {currentOffer.allowedCycles?.length > 0 && (
                    <span className="text-xs rounded-full px-2 py-0.5 border">
                      {currentOffer.allowedCycles.slice().sort().map(n => `${n}×`).join(' / ')} possible
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600">
                  Remise {currentOffer.payIn1x.discount} € appliquée pour un paiement 1×
                </div>
              </div>

              {/* CTA */}
              <div className="mt-5 grid grid-cols-1 gap-3">
                <button
                  onClick={() => setModalOffer(currentOffer)}
                  className="rounded-full px-5 py-3 font-semibold bg-[#E8EAFF] text-[#463CFF]"
                >
                  Voir l’offre
                </button>
                <button
                  onClick={() => { setExpanded(true); setTimeout(()=> payAnchorRef.current?.scrollIntoView({behavior:'smooth'}), 0); }}
                  className="rounded-full px-5 py-3 font-semibold text-white"
                  style={{ background: BRAND.primary }}
                >
                  J&apos;en profite
                </button>
              </div>

              {/* Paiement */}
              {expanded && (
                <div
                  ref={payAnchorRef}
                  className="mt-5 rounded-2xl p-4 space-y-3"
                  style={{ background:'#E8EAFF', color:'#463CFF' }}
                >
                  <div className="grid gap-2">
                    {/* CB 1x */}
                    <button
                      onClick={() => {
                        setSelection({
                          offerId: currentOffer.id,
                          label: `${cardTitle} ${currentOffer.hours}h`,
                          hours: currentOffer.hours,
                          mode: '1x',
                          firstPayment: currentOffer.payIn1x.amount,
                          schedule: 'Aujourd’hui',
                        });
                        setStep(3);
                      }}
                      className="w-full rounded-2xl bg-white border border-[#DAD7FF] px-4 py-4 flex items-center justify-between"
                      style={{color:'#463CFF'}}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard/>
                        <span className="font-medium">CB 1×</span>
                        <span className="mx-2">-</span>
                        <div className="leading-tight">
                          <div className="font-semibold">{formatPrice(currentOffer.payIn1x.amount)} €</div>
                          <div className="text-sm opacity-90">remise appliquée</div>
                        </div>
                      </div>
                      <span className="font-semibold">→</span>
                    </button>

                    {/* CB multi */}
                    {currentOffer.allowedCycles?.slice().sort().map(n => (
                      <button
                        key={n}
                        onClick={() => {
                          const per = perCycleAmount(currentOffer, n);
                          setSelection({
                            offerId: currentOffer.id,
                            label: `${cardTitle} ${currentOffer.hours}h`,
                            hours: currentOffer.hours,
                            mode: `${n}x`,
                            firstPayment: per,
                            schedule: n === 2 ? 'Aujourd’hui / J+30' : (n === 3 ? 'Aujourd’hui / J+30 / J+60' : 'Échéances mensuelles'),
                          });
                          setStep(3);
                        }}
                        className="w-full rounded-2xl bg-white border border-[#DAD7FF] px-4 py-4 flex items-center justify-between"
                        style={{color:'#463CFF'}}
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard/>
                          <span className="font-medium">CB {n}×</span>
                          <span className="mx-2">-</span>
                          <div className="leading-tight">
                            <div className="font-semibold">{formatPrice(perCycleAmount(currentOffer, n), true)} €</div>
                            <div className="text-sm opacity-90">total {formatPrice(currentOffer.installments.total)} €</div>
                          </div>
                        </div>
                        <span className="font-semibold">→</span>
                      </button>
                    ))}
                  </div>

                  <p className="text-sm" style={{color:'#463CFF'}}>
                    Après votre inscription en ligne, vous êtes rapidement contacté par un de nos conseillers pour commencer votre formation. Vous pouvez choisir aussi l&apos;inscription en agence.
                  </p>
                </div>
              )}
            </div>

            {/* RDV */}
            <div className="mx-auto pt-4 w-full" style={{maxWidth:'720px'}}>{InscriptionBouton}</div>
          </section>
        )}

        {/* Étape 3 — Paiement */}
        {step === 3 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Paiement</h2>
            <div className="mx-auto rounded-3xl border p-5 grid gap-3" style={{maxWidth:'720px'}}>
              <div className="text-sm">Sélection :</div>
              <div className="text-lg font-semibold">
                {selection.label} — Paiement {selection.mode}
              </div>
              <div className="text-sm">
                1er versement aujourd’hui :{' '}
                <span className="font-semibold">
                  {selection.firstPayment?.toLocaleString('fr-FR')} €
                </span>
              </div>
              <div className="text-sm text-gray-600">Échéancier : {selection.schedule}</div>

              <PrimaryButton onClick={handleCheckout}>
                Continuer vers le paiement sécurisé (Stripe Checkout)
              </PrimaryButton>

              <p className="text-sm text-gray-600">
                Après votre inscription en ligne, vous serez rapidement contacté par un de nos conseillers pour commencer votre formation. Vous pouvez choisir aussi l&apos;inscription en agence.
              </p>

              <p className="text-xs text-gray-600">CB 3-D Secure • Apple Pay / Google Pay • Données protégées</p>
            </div>

            <div className="grid grid-cols-1 gap-3 mx-auto" style={{maxWidth:'720px'}}>
              <OutlineButton onClick={() => setStep(2)}>Modifier mon choix</OutlineButton>
              {InscriptionBouton}
            </div>
          </section>
        )}
      </main>

      {/* ✅ on utilise la vraie modale des components (icônes + bouton “Appeler”) */}
      <OfferModal
        open={!!modalOffer}
        onClose={() => setModalOffer(null)}
        title={modalOffer ? `${cardTitle} ${modalOffer.hours}h` : ''}

        summary={modalOffer ? PACK_CONTENT[modalOffer.id]?.summary : ''}
        included={modalOffer ? PACK_CONTENT[modalOffer.id]?.included || [] : []}
        conditions={modalOffer ? PACK_CONTENT[modalOffer.id]?.conditions || [] : []}
        excluded={modalOffer ? PACK_CONTENT[modalOffer.id]?.excluded || [] : []}
        bullets={modalOffer ? modalOffer.perks : []}

        disclaimer={modalOffer ? PACK_CONTENT[modalOffer.id]?.disclaimer : ''}
        phone="0465848325"
      />
    </div>
  );
}
