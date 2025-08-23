import React, { useEffect } from "react";
import { Link } from "react-router-dom";

function PaymentCancelled() {
  useEffect(() => { document.title = "Paiement annulé • GETdryv"; }, []);
  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-2">Paiement annulé</h1>
        <p className="text-gray-600 mb-6">
          Vous avez annulé le paiement (ou utilisé le retour arrière). Aucun débit n’a été effectué.
        </p>
        <Link to="/" className="inline-block rounded-xl border px-4 py-2 hover:bg-gray-50">
          Revenir choisir une offre
        </Link>
      </div>
    </main>
  );
}

export default PaymentCancelled;   // ✅ export par défaut
export { PaymentCancelled };       // ✅ export nommé (au cas où)
