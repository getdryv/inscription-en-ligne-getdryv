// src/components/AuthBar.jsx
import React from "react";
import useAuth from "../hooks/useAuth";
import { login, signup, logout, loginWithGoogle } from "../auth";

export default function AuthBar() {
  const { user, loading } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const doLogin = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await login(email, password); setEmail(""); setPassword(""); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const doSignup = async () => {
    setBusy(true); setError("");
    try { await signup(email, password); setEmail(""); setPassword(""); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const doGoogle = async () => {
    setBusy(true); setError("");
    try { await loginWithGoogle(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (loading) return null;

  return (
    <div style={{
      position: "fixed", top: 12, right: 12, zIndex: 1000,
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: 10, display: "flex", alignItems: "center", gap: 8,
      boxShadow: "0 2px 10px rgba(0,0,0,.06)", fontFamily: "system-ui, sans-serif"
    }}>
      {user ? (
        <>
          <span style={{ fontSize: 13 }}>
            Connecté : <strong>{user.displayName || user.email}</strong>
          </span>
          <button
            onClick={logout}
            style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
          >
            Se déconnecter
          </button>
        </>
      ) : (
        <form onSubmit={doLogin} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="email" required placeholder="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }}
          />
          <input
            type="password" required placeholder="mot de passe" value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8, fontSize: 12 }}
          />
          <button type="submit" disabled={busy}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}>
            {busy ? "..." : "Se connecter"}
          </button>
          <button type="button" disabled={busy} onClick={doSignup}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}>
            {busy ? "..." : "Créer un compte"}
          </button>
          <button type="button" disabled={busy} onClick={doGoogle} title="Connexion Google"
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}>
            Google
          </button>
          {error && <span style={{ color: "#b91c1c", fontSize: 12 }}>{error}</span>}
        </form>
      )}
    </div>
  );
}
