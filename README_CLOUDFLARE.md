# VISION FOOT — Cloudflare Workers + Durable Object temps réel

## IMPORTANT
Ce projet est conçu pour **Cloudflare Workers uniquement**.
Ne pas le déployer sur Netlify, GitHub Pages, Vercel ou un autre hébergeur statique.

## Correction principale
L'ancienne version appelait directement des méthodes (`getState`, `updateState`, etc.) sur `env.MATCH_STATE`. Or `MATCH_STATE` est un namespace Durable Objects : il faut d'abord obtenir un **stub** avec `idFromName()` + `get()`, puis lui envoyer les requêtes. Cette version corrige ce point.

Le serveur Cloudflare possède maintenant une instance Durable Object unique (`main-match-state`) qui :
- conserve l'état central du match ;
- reçoit les publications de l'administrateur ;
- diffuse chaque changement aux spectateurs par WebSocket ;
- conserve l'état même après une reconnexion.

## Déploiement recommandé

### Méthode Wrangler
Dans le dossier racine du projet :

```bash
npm install
npx wrangler login
npx wrangler secret put ADMIN_PASSWORD
npx wrangler deploy
```

Quand Cloudflare demande `ADMIN_PASSWORD`, saisir le mot de passe administrateur voulu.

### Depuis un iPhone sans terminal
Le bouton **Upload and deploy** de l'écran montré dans Safari est l'uploader statique et n'exécute pas `wrangler deploy` pour ce type de projet. Il est donc normal qu'il affiche l'avertissement sur `wrangler`.

La méthode Cloudflare adaptée sur iPhone est :
1. mettre ce dossier dans un dépôt GitHub ;
2. dans Cloudflare : **Workers & Pages → Create application → Import a repository** ;
3. sélectionner le dépôt ;
4. vérifier que le nom du Worker est `vision-foot-affichage-tv` ;
5. laisser la commande de déploiement `npx wrangler deploy` ;
6. ajouter le secret `ADMIN_PASSWORD` dans les réglages du Worker.

Workers Builds utilise alors Wrangler pour déployer le Worker et son Durable Object.

## Après déploiement
Cloudflare fournit une adresse `*.workers.dev`. C'est cette adresse qu'il faut donner à tous les téléspectateurs.

Tous les téléphones doivent utiliser **la même URL Cloudflare**. Quand l'admin publie une modification, les spectateurs connectés reçoivent immédiatement le nouvel état.

## Réglages Workers Builds (production)

Dans **Settings → Builds**, utiliser exactement :
- **Build command:** `npm run build`
- **Deploy command:** `npm run deploy`
- **Root directory:** `/` (racine du dépôt)

Le script `build` est volontairement un contrôle sans compilation : l'application n'a pas de framework frontend à compiler. Wrangler effectue le bundling du Worker au moment du déploiement.

Le script `deploy` lance `npx wrangler deploy`, qui publie le Worker, les assets `public/` et le Durable Object déclaré dans `wrangler.jsonc`.

Après le premier déploiement, créer/ajouter le secret **ADMIN_PASSWORD** dans **Settings → Variables & Secrets → Secrets**. Il ne doit pas être placé dans `worker.js` ou `package.json`.
