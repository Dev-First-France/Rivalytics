# Rivalytics API

Backend Node.js/Express qui expose les fonctionnalités d'authentification, de gestion des targets et d'agrégation de contenus (LinkedIn, Instagram, TikTok, YouTube). Le code a été refactoré pour adopter une architecture modulaire claire.

## Démarrage rapide

```bash
npm install
npm run dev      # nodemon src/server.js
# ou
npm start        # node src/server.js
```

Le serveur écoute par défaut sur `http://localhost:3001`.

## Configuration d'environnement

Copiez `.env.example` vers `.env` et complétez les valeurs :

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development` ou `production`. |
| `PORT` | Port HTTP écouté par Express. |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL (Render External DB -> SSL obligatoire, ajoutez `?sslmode=require`). |
| `JWT_SECRET` | Secret de signature des JWT. |
| `BCRYPT_ROUNDS` | Nombre de rounds pour bcrypt (défaut `12`). |
| `CORS_ALLOWED_ORIGINS` | Liste CSV d'origines autorisées (laisser vide pour tout accepter). |
| `APIFY_TOKEN` | Jeton Apify utilisé pour Instagram/TikTok. |
| `YT_API_KEY` | Clé API YouTube Data. |
| `LI_ACCEPT_LANGUAGE`, `LI_UA` | En-têtes utilisés pour les scrapers LinkedIn. |

## Architecture

```
src/
  app.js               # Instanciation Express + middlewares globaux
  server.js            # Bootstrap: ensureSchema() puis écoute HTTP
  config/              # Gestion env, CORS, cookies, rate-limit
  db/                  # Connexion pg et ensureSchema()
  middlewares/         # Auth JWT et gestionnaire d'erreurs
  controllers/         # Logique HTTP par ressource
  services/            # Logique métier (auth, targets, collect)
    collect/           # Scrapers et agrégateur de sources
    targetRuns.service.js # Historique et exécution d'analyses de targets
  utils/               # Helpers (cache, dates, LinkedIn, HTTP…)
  constants/           # Limites numériques et regex partagées
```

Chaque contrôleur applique la validation minimale, appelle son service dédié et laisse le middleware d'erreurs produire des réponses JSON standardisées.

## Targets & analyses

- Chaque target stocke des `settings` (strategy, sources, days, limit, overrides pour handles).
- Les paramètres peuvent être modifiés via `PATCH /targets/:id`.
- `POST /targets/:id/analyze` déclenche une collecte (synchrone) et consigne un `target_run` avec statut, note, durée et résultats.
- `GET /targets/:id/runs` retourne l'historique des analyses (limite par défaut 10, max 50).
- Les colonnes `last_run_*` sur `targets` permettent un accès direct au dernier statut dans les listes.

## Notes PostgreSQL & Render

- La connexion pg active automatiquement SSL si l'hôte n'est pas `localhost`/`127.0.0.1`.
- L'option `?sslmode=require` dans `DATABASE_URL` reste supportée (Render External DB).
- `ensureSchema()` crée les tables `users`, `targets`, `target_runs` ainsi que l'extension `pgcrypto`. Le code est prêt à accueillir des migrations ultérieures.

## Fonctionnalités principales

- Authentification via cookie httpOnly (`rivalytics_token`), JWT signé 7 jours.
- Targets enrichis (paramètres personnalisés, relance d'analyse, historique).
- Historique d'exécutions (`target_runs`) + derniers statuts stockés sur `targets`.
- Agrégateurs:
  - `/api/collect` (orchestration multi-sources + déduplication)
  - `/api/linkedin`, `/api/instagram`, `/api/tiktok`, `/api/youtube`
- CORS configurable avec `credentials: true` et logs en cas d'origine refusée.
- Rate limiting dédié aux routes `/auth`.

## Tests manuels suggérés

1. Démarrer le serveur (`npm start`) et vérifier la log `✅ Schéma PostgreSQL OK`.
2. Auth:
   - `POST /auth/register` (nouvel email) → 201 + cookie httpOnly.
   - `POST /auth/login` → 200 + cookie.
   - `GET /auth/me` → 200 avec l'utilisateur courant.
   - `POST /auth/logout` → 204 + cookie supprimé.
3. Targets:
   - `GET /targets` (auth) → 200 `[]`.
   - `POST /targets { name, settings? }` → 201 (paramètres par défaut si absent).
   - `PATCH /targets/:id { settings }` pour ajuster `strategy/sources/days/limit`.
   - `POST /targets/:id/analyze` → 200 avec `run` (status `success`), vérifie `targets/:id` mises à jour.
   - `GET /targets/:id/runs` → liste historique (status/temps/note).
   - Dupliquer le même nom → 409.
   - `DELETE /targets/:id` → 204, 404 si mauvais id.
4. Collect & scrapers (`/api/collect`, `/api/linkedin`, `/api/tiktok`, `/api/instagram`, `/api/youtube`).
5. Vérifier le comportement CORS avec les origines autorisées.
6. Tester la connexion PostgreSQL en local et sur Render (SSL automatique).

## Déploiement

Sur Render (ou tout autre PaaS) :

1. Définir les variables d'environnement listées ci-dessus.
2. Pointer le script de démarrage vers `npm start`.
3. S'assurer que la base PostgreSQL est accessible (Render External DB ou Internal avec SSL).
