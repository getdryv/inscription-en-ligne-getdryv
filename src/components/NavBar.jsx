// src/components/NavBar.jsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { logout } from "../auth";

export default function NavBar() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex items-center justify-between px-4 py-3" style={{maxWidth: "1024px"}}>
        <Link to="/" className="text-xl font-extrabold text-indigo-600">GETdryv</Link>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Bonjour, <strong>{user.displayName || user.email}</strong></span>
            <button
              onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
              className="text-sm font-medium rounded-full border px-4 py-2 hover:bg-gray-50"
            >
              Se déconnecter
            </button>
          </div>
        ) : (
          <Link to="/login" className="text-sm font-medium rounded-full border px-4 py-2 hover:bg-gray-50">
            Se connecter
          </Link>
        )}
      </div>
    </nav>
  );
}
