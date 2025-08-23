# GETdryv – Prototype (React + Vite + Tailwind)

## Lancer en local (VS Code ou Terminal)
1. Assure-toi d’avoir **Node.js LTS** installé.
2. Dans le dossier du projet :

```bash
npm install
npm run dev
```

Ouvre ensuite l’URL affichée (ex: `http://localhost:5173/`).

## Structure
- `src/App.jsx` : l’UI complète (header avec GETdryv, offres, modale, paiement)
- `src/main.jsx` : bootstrap React
- `index.html` : point d’entrée Vite
- Tailwind est déjà configuré (`tailwind.config.js`, `postcss.config.js`, `src/index.css`).

## Prochaines étapes
- Brancher **Stripe Checkout** (1× = PaymentIntent / 2×–3× = Subscription Schedule)
- Auth plus tard (Firebase)
- Bouton "Inscription en agence (RDV)" : remplacer `#` par le lien Calendly
