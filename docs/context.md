# Rivalytics v2 — Context Project

## Aperçu général

- **Stack** : Node.js (ESM) + Express pour l’API, PostgreSQL via `pg`, frontend single-page React (UMD) servi depuis `public/index.html`.
- **Objectif produit** : agrégation multi-sources (LinkedIn, RSS, Instagram, TikTok, YouTube) pour surveiller des entreprises, avec authentification, favoris (“targets”), analyses sur demande et historique des runs.
- **Mode d’exécution** : `npm start` (node `src/server.js`) ou `npm run dev` (nodemon). L’API écoute par défaut sur `PORT` (3001 si absent).

## Arborescence clé

```
src/
  app.js              # Instancie Express, middlewares et routes
  server.js           # ensureSchema() puis app.listen()
  config/             # env, cookies, cors, rate-limit (exports via index.js)
  constants/          # limites, regex, defaults pour targets
  controllers/        # auth, targets, sources (bridges HTTP -> services)
  db/                 # pool pg + ensureSchema()
  middlewares/        # auth JWT + error handler
  routes/             # wiring Express (auth, targets, api/sources)
  services/
    auth.service.js   # register/login/logout/me + JWT
    targets.service.js# CRUD + normalisation settings
    targetRuns.service.js # lancement/stockage analyses
    collect/          # orchestrateurs / scrapers par source
  utils/              # cache, dates, linkedin, http, strings, errors
public/
  index.html          # SPA React (tailwind CDN + components inline)
docs/
  context.md          # (ce fichier)
```

## Configuration & Environnement

- `.env` variables principales :
  - `PORT`, `NODE_ENV`
  - `DATABASE_URL` (support `?sslmode=require`, SSL auto si host ≠ localhost)
  - `JWT_SECRET`, `BCRYPT_ROUNDS`
  - `CORS_ALLOWED_ORIGINS` (CSV)
  - `APIFY_TOKEN`, `YT_API_KEY`, `LI_ACCEPT_LANGUAGE`, `LI_UA`
- Cookies auth via `config/cookies.js` : `httpOnly`, `sameSite=lax`, `secure` en prod, maxAge 7j, nom `rivalytics_token`.
- Rate limiting `/auth/*` : 50 req / 15 min.

## Base de données

Tables provisionnées par `ensureSchema()` :

- `users (id uuid PK, email unique, password_hash, created_at)`
- `targets (id uuid PK, user_id FK users, name, settings jsonb, last_run_* metadata, created_at)`
- `target_runs (id uuid PK, target_id FK targets, status text, note, duration_ms, used_sources text[], items jsonb, created_at)`
- Extension `pgcrypto`, index unique `targets_user_name_idx (user_id, name)`.

## Flux API

### Auth (`/auth`)
- `POST /register` → 201 + cookie ; erreurs : `invalid_email`, `invalid_password`, `email_exists`.
- `POST /login` → 200 + cookie ; erreurs `invalid_credentials`.
- `POST /logout` → 204, efface cookie.
- `GET /me` → user public (`id,email,created_at`).

### Targets (`/targets`)
- `GET /targets` → liste avec `settings`, `last_run_status`, etc.
- `POST /targets` → crée target avec settings par défaut construits à partir du contexte courant (frontend).
- `GET /targets/:id` → target unique (require auth + ownership).
- `PATCH /targets/:id` → met à jour nom et/ou settings (normalisation et validation).
- `DELETE /targets/:id` → supprime.
- `POST /targets/:id/analyze` :
  - Normalise settings (merge patch > existant).
  - Appelle `runTargetAnalysis` : `collectSources` + stockage `target_runs`.
  - Réponse `{ run, target }` avec mise à jour `targets` (last_run infos).
- `GET /targets/:id/runs?limit=10` → historique (limité à 50 max).

### Agrégation / Sources (`/api`)
- `GET /api/linkedin?slug|url&days&limit`
- `GET /api/rss?name&days&rss=csv`
- `GET /api/instagram?username&limit`
- `GET /api/tiktok?username&limit`
- `GET /api/youtube?channel&q&days&limit`
- `GET /api/collect?name&strategy&sources=csv&days&limit&rss=...&instagram=...&linkedin_url=...`

Services utilisent `axios`, `cheerio`, Apify ou YouTube API, plus normalisations (cache TTL 5 min pour LinkedIn HTML, conversions dates/metrics).

## Côté Frontend (public/index.html)

- React 18 via UMD + Babel inline. Aucun bundler. Tailwind CDN + Chart.js.
- État principal dans `App()` :
  - `name`, `sources` (Set), `days`, `allResults`, `company`, `targets`.
  - Auth modale, cookies via fetch (`credentials: 'include'`).
  - `buildSettingsFromCurrentSearch(name)` pour persister: `strategy`, `sources[]`, `days`, `limit`, `overrides` (rss handles + guessed handles).
  - `TargetsCard` affiche `settings`, statut dernière analyse, boutons :
    - ⭐ Sauvegarder (POST /targets)
    - Analyser (POST /targets/:id/analyze)
    - Actualiser paramètres (PATCH /targets/:id)
    - Historique (toggle → GET /targets/:id/runs)
  - `runsByTarget`, `analyzingMap`, `runsLoadingMap`, `updatingMap` pour UI state.
  - Recherche (`runSearch`) interroge endpoints `/api/*`.
- Header `glassbar` sticky (taille `min(90%, 78rem)`) ; main content max `6xl`.

## Patterns & Conventions

- Tout module Node est ESM (imports relatifs `./file.js`).
- Services renvoient/throw `AppError` (status + code). Controllers catch via `next(error)`, centralisé dans `middlewares/error.js`.
- Validation :
  - Regex email/UUID dans `constants/regex.js`.
  - Targets: `MAX_TARGET_NAME=160`, `MIN_PASSWORD_LENGTH=8`.
  - Settings normalisés (sources whitelists, days 1–3650, limit 1–50).
- `collectSources` accepte overrides manuels (rss, instagram, tiktok, youtube, channel, q, linkedin_url) et fallback vers presets `COMPETITORS`.
- LinkedIn : cache HTML, JSON-LD + DOM merging, dédup via canonical key (URN/activity).
- `target_runs.items` stockés en JSON (tableau d’items normalisés), `used_sources` text[].

## Checklist opérations courantes

1. **Boot local** : copier `.env.example` → `.env`, définir `DATABASE_URL`, `JWT_SECRET`, lancer `npm install` puis `npm start`.
2. **Ajouter une source** : créer service dans `src/services/collect/`, exposer dans `collect.service.js` (jobs + dedupe + parseSources).
3. **Nouvelle donnée persistée** :
   - Étendre schema via `ensureSchema` (attention idempotence).
   - Mettre à jour services + contrôleurs + front si nécessaire.
4. **Modifier UI** :
   - `public/index.html` contient tous les composants (chercher fonction).
   - CSS custom au début du fichier (balise `<style>`).

## Réponses / Codes erreurs courants

| Code HTTP | Payload `error`            | Description                         |
|-----------|---------------------------|-------------------------------------|
| 400       | `invalid_email`           | Format email invalide               |
| 400       | `invalid_password`        | Mot de passe court                  |
| 400       | `invalid_credentials`     | Login (email/mdp) invalide          |
| 400       | `invalid_name` / `name_too_long` | Validation target             |
| 400       | `invalid_id`              | UUID non conforme                   |
| 401       | `unauthenticated`         | Cookie absent/expiré                |
| 404       | `not_found`               | Target inexistant                   |
| 409       | `email_exists` / `target_exists` | Doublons                   |
| 500       | `registration_failed`, `login_failed`, `target_*_failed`, `collect_failed` | Erreurs internes |
| 503       | `database_unavailable`    | `pool` non initialisé               |

## Ressources utiles

- **Scripts** : `npm run dev`, `npm start`.
- **Lint/format** : pas de tooling automatique (respecter style existant).
- **Tests manuels** (README) : login → CRUD target → analyse → collect endpoints.

Ce document doit être mis à jour après toute évolution majeure de l’architecture, des endpoints ou du front.***
