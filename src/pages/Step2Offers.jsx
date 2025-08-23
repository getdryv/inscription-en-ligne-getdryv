import { useEffect, useMemo, useRef, useState } from "react";
import Stepper from "../components/Stepper.jsx";
import OfferCard from "../components/OfferCard.jsx";
import OfferModal from "../components/OfferModal.jsx";
import { OFFERS } from "../lib/offers.js";
import { Gift, Calendar } from "../components/icons.jsx";

export default function Step2Offers(){
  const [formule, setFormule] = useState('classique');
  const [heures, setHeures] = useState(10);
  const cfg = useMemo(()=> OFFERS[formule]?.[heures], [formule, heures]);
  const [open, setOpen] = useState(false);
  const payAnchor = useRef(null);

  // Badges : Classique
  const badgesClassique = [
    {icon:<Gift/>, label:"E-learning offert"},
    {icon:<Gift/>, label:"Évaluation départ offerte"},
    {icon:<Calendar/>, label:"Planning flexible"}
  ];
  // Badges : Accélérée
  const badgesAcceleree = [
    {icon:<Gift/>, label:"E-learning offert"},
    {icon:<Gift/>, label:"Évaluation"},
    {icon:<Calendar/>, label:"Convocation examen sous 30 jours"}
  ];

  const onSee = ()=> setOpen(true);
  const onUse = ()=> payAnchor.current?.scrollIntoView({behavior:'smooth'});

  useEffect(()=>{ document.title = "GETdryv — Étape 2"; },[]);

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <Stepper/>
        {/* Onglets + badges heures à droite */}
        <header className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            <button onClick={()=>setFormule('classique')} className={`rounded-full border px-4 py-2 ${formule==='classique'?'bg-gray-900 text-white border-transparent':'bg-gray-100'}`}>Classique</button>
            <button onClick={()=>setFormule('accelere')} className={`rounded-full border px-4 py-2 ${formule==='accelere'?'bg-gray-900 text-white border-transparent':'bg-gray-100'}`}>Accélérée</button>
          </div>
          <div className="flex gap-2">
            {[10,20,30].map(h=> (
              OFFERS[formule]?.[h] && (
                <button key={h} onClick={()=>setHeures(h)} className={`px-3 py-1 rounded-full border ${heures===h?'bg-gray-900 text-white border-transparent':'bg-gray-100 text-gray-700'}`}>{h} h</button>
              )
            ))}
          </div>
        </header>

        {/* La carte (avec 2 boutons) */}
        {cfg && (
          <OfferCard
            title={formule==='classique' ? 'Permis' : 'Accélérée'}
            hours={heures}
            oneTime={cfg.oneTime}
            installment={cfg.installment}
            badges={formule==='classique' ? badgesClassique : badgesAcceleree}
            onSee={onSee}
            onUse={onUse}
          />
        )}

        {/* Ancre pour le scroll de “J'en profite” */}
        <div ref={payAnchor} className="mt-8" />
      </div>

      {/* Modale (uniquement “Appeler”) */}
      <OfferModal
        open={open}
        onClose={()=>setOpen(false)}
        title={`${formule==='classique'?'Permis':'Accélérée'} ${heures}h`}
        bullets={[
          'E-learning offert',
          formule==='classique' ? "Évaluation départ offerte" : "Évaluation",
          formule==='classique' ? "Planning flexible" : "Convocation d'examen moins de 30 jours"
        ]}
        phone="0465848325"
      />
    </main>
  );
}
