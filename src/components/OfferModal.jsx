// en haut du fichier
import { Checklist } from "./icons.jsx";
import { useEffect } from "react";

// ✅ icône incluse (vert)
const Check = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#16a34a" opacity="0.12"/>
    <path d="M7 12.5l3.2 3.2L17.5 8.5" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ❌ icône non inclus (gris)
const Cross = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#9ca3af" opacity="0.18"/>
    <path d="M8.5 8.5l7 7m0-7l-7 7" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export default function OfferModal({
  open,
  onClose,
  title,
  summary = "",
  included = [],
  conditions = [],
  excluded = [],
  // compat si jamais on envoie encore bullets/perks
  bullets = [],
  perks = [],
  disclaimer,
  phone = "0187654321",
}) {
  // fallback pour l'ancien flux (si included/conditions/excluded vides)
  const compat = (included.length || conditions.length || excluded.length)
    ? []
    : (bullets.length ? bullets : perks);
  const includedFinal = included.length ? included : compat;

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    if (open) { document.addEventListener("keydown", onEsc); return () => document.removeEventListener("keydown", onEsc); }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <section className="w-full max-w-xl bg-white rounded-3xl shadow-xl border p-6 md:p-8 relative">
          <button
            aria-label="Fermer"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-500 hover:text-gray-800 text-xl leading-none"
          >
            ✕
          </button>

          <h2 className="text-2xl font-bold mb-3">{title}</h2>

          {summary && <p className="text-[15px] text-gray-700 mb-4">{summary}</p>}

          {/* Inclus */}
          {!!includedFinal.length && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Inclus :</h3>
              <ul className="space-y-2">
                {includedFinal.map((item, i) => (
                  <li key={`in-${i}`} className="flex items-start gap-2">
                    <Check />
                    <span className="text-[15px] leading-5">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Conditions (🚀 violet) */}
          {!!conditions.length && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Conditions :</h3>
              <ul className="space-y-2">
                {conditions.map((item, i) => (
                  <li key={`cond-${i}`} className="flex items-start gap-2">
                    <span className="mt-0.5"><Checklist /></span>
                    <span className="text-[15px] leading-5 text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Non inclus : liste simple ❌ gris (pas de titre "Non inclus") */}
          {!!excluded.length && (
            <div className="mb-4">
              <ul className="space-y-2">
                {excluded.map((item, i) => (
                  <li key={`out-${i}`} className="flex items-start gap-2">
                    <Cross />
                    <span className="text-[15px] leading-5 text-gray-500">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {disclaimer && <p className="text-sm text-gray-500 mt-2">{disclaimer}</p>}

          {/* Bandeau rassurance + CTA (mêmes couleurs que "Voir l’offre") */}
          <div className="mt-6">
  <p className="text-sm text-gray-600 text-center mb-2">Des questions ?</p>
  <button
    className="w-full flex items-center justify-center rounded-full px-5 py-3 font-semibold
               bg-[#E8EAFF] text-[#463CFF] shadow-sm hover:shadow transition"
    onClick={() => (window.location.href = `tel:${phone}`)}
  >
    <span className="mr-2">📞</span> Appeler
  </button>
</div>


        </section>
      </div>
    </div>
  );
}
