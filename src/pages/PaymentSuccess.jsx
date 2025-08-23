import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState("loading");
  const [amount, setAmount] = useState(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    document.title = "Paiement réussi • GETdryv";
    if (!sessionId) { setStatus("ok"); return; }
    fetch(`/api/checkout-session/${sessionId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(s => {
        setStatus("ok");
        setAmount(s?.amount_total ?? s?.amount_subtotal ?? null);
        setLabel(s?.metadata?.offerId || "");
      })
      .catch(() => setStatus("ok"));
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-2">🎉 Paiement confirmé</h1>
        <p className="text-gray-600 mb-6">Merci ! Votre commande a bien été enregistrée.</p>
        {amount != null && (
          <p className="mb-4">
            Montant: <strong>{(amount/100).toFixed(2)} €</strong>
            {label ? <> — <span className="text-gray-600">{label}</span></> : null}
          </p>
        )}
        <Link to="/" className="inline-block rounded-xl border px-4 py-2 hover:bg-gray-50">
          Revenir à l’accueil
        </Link>
      </div>
    </main>
  );
}
