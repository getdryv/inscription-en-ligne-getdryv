import React, { useState } from "react";
import { signup, loginWithGoogle } from "../auth";
import { updateProfile } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../firebase";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const cred = await signup(email, pass);
      const displayName = [first, last].filter(Boolean).join(" ");
      if (displayName) await updateProfile(cred.user, { displayName });
      // TODO: enregistrer "phone" en Firestore si besoin
      navigate("/"); // revient sur l'app -> ira à l'étape 2 si connecté
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const onGoogle = async () => {
    setBusy(true); setError("");
    try { await loginWithGoogle(); navigate("/"); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-extrabold text-indigo-600">GETdryv</div>
          <Link to="/login" className="text-sm font-medium rounded-full border px-4 py-2 hover:bg-gray-50">
            Connexion
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 grid gap-8 md:grid-cols-2">
        <section className="order-2 md:order-1">
          <div className="text-sm uppercase text-gray-500 font-semibold">Votre inscription en 3 étapes</div>
          <h1 className="mt-2 text-3xl font-extrabold">Création de compte</h1>
          <ul className="mt-4 space-y-3 text-gray-700">
            <li>✅ 1. Création de compte</li>
            <li>✅ 2. Choix de la formule</li>
            <li>✅ 3. Paiement CB ou inscription en agence</li>
          </ul>
        </section>

        <section className="order-1 md:order-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Créez votre compte</h2>
            {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <form onSubmit={onSubmit} className="mt-4 grid gap-4">
              <label className="grid gap-1">
                <span className="text-sm">Email *</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="vous@exemple.com" />
              </label>

              <label className="grid gap-1">
                <span className="text-sm">Mot de passe *</span>
                <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="••••••••" />
                <span className="text-xs text-gray-500">8+ caractères, 1 maj, 1 chiffre</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-1">
                  <span className="text-sm">Prénom *</span>
                  <input required value={first} onChange={(e) => setFirst(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="Ex : Nicolas" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm">Nom *</span>
                  <input required value={last} onChange={(e) => setLast(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="Ex : Dumont" />
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-sm">Téléphone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="Ex : 06 12 34 56 78" />
              </label>

              <button type="submit" disabled={busy} className="mt-2 w-full rounded-2xl py-3 font-semibold text-white shadow-sm hover:shadow transition" style={{ backgroundColor: "#635bff" }}>
                {busy ? "..." : "Créer mon compte"}
              </button>

              <div className="relative my-2 text-center text-sm text-gray-500">
                <span className="bg-white px-2 relative z-10">ou</span>
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gray-200" />
              </div>

              <button type="button" onClick={onGoogle} disabled={busy} className="w-full rounded-2xl py-3 font-semibold border hover:bg-gray-50 transition">
                Continuer avec Google
              </button>

              <div className="text-sm text-gray-600">
                Vous avez déjà un compte ? <Link className="text-indigo-600 font-medium" to="/login">Se connecter</Link>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
