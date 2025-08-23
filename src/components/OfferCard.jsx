import { formatEUR } from "../lib/format.js";

export default function OfferCard({title, hours, oneTime, installment, badges=[], onSee, onUse}){
  return (
    <div className="w-full rounded-2xl border p-5 md:p-6 shadow-sm bg-white">
      {/* Titre + badge heures SOUS le titre */}
      <div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <div className="flex gap-2">
          {Number.isFinite(hours) ? (
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">{hours} h</span>
          ) : null}
        </div>
      </div>

      {/* Badges de features */}
      <div className="mt-4 flex flex-wrap gap-2">
        {badges.map((b,i)=> (
          <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white text-sm" style={{borderColor:'#e5e7eb'}}>
            {b.icon}{b.label}
          </span>
        ))}
      </div>

      {/* Prix */}
      <div className="mt-4">
        <div className="text-3xl font-extrabold">{formatEUR(oneTime.amount)}</div>
        <div className="text-sm text-gray-500 mt-1">
          ou {installment.cycles}× {formatEUR(installment.per)} <span className="text-gray-400">(Total {formatEUR(installment.total)})</span>
        </div>
      </div>

      {/* 👉 Boutons alignés : “Voir l’offre” (modale) + “J’en profite” (défile) */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={onSee} className="rounded-full px-5 py-3 font-semibold bg-[#E8EAFF] text-[#463CFF]">Voir l'offre</button>
        <button onClick={onUse} className="rounded-full px-5 py-3 font-semibold text-white" style={{background:'#635bff'}}>J'en profite</button>
      </div>
    </div>
  );
}
