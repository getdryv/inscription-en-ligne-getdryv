const res = await fetch('/api/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ offerId: selection.offerId, mode: selection.mode })
});

const text = await res.text();
const data = text ? JSON.parse(text) : null;
if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status} - ${text || 'réponse vide'}`);

if (data?.alma) {
  // 👉 Paiement en plusieurs fois : on sort vers Alma
  window.location.href = data.url; // remplace par l’URL Alma réelle plus tard
  return;
}

// Sinon (1×), Stripe Checkout
const stripe = await stripePromise;
const { error } = await stripe.redirectToCheckout({ sessionId: data.id });
if (error) alert(error.message);
