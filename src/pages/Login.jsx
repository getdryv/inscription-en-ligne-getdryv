import React, { useState } from "react";
import { login, loginWithGoogle } from "../auth";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const doLogin = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await login(email, pass); navigate("/"); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
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
          <Link to="/signup" className="text-sm font-medium rounded-full border px-4 py-2 hover:bg-gray-50">
            Créer un compte
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Connexion</h1>
          {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <form onSubmit={doLogin} className="mt-4 grid gap-4">
            <label className="grid gap-1">
              <span className="text-sm">Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="vous@exemple.com" />
            </label>
            <label className="grid gap-1">
              <span className="text-sm">Mot de passe</span>
              <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="••••••••" />
            </label>

            <button type="submit" disabled={busy} className="mt-2 w-full rounded-2xl py-3 font-semibold text-white shadow-sm hover:shadow transition" style={{ backgroundColor: "#635bff" }}>
              {busy ? "..." : "Se connecter"}
            </button>

            <button type="button" onClick={onGoogle} disabled={busy} className="w-full rounded-2xl py-3 font-semibold border hover:bg-gray-50 transition">
              Continuer avec Google
            </button>

            <div className="text-sm text-gray-600">
              Pas de compte ? <Link className="text-indigo-600 font-medium" to="/signup">Créer un compte</Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
