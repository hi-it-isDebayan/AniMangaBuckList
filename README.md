# AniMangaBuckList

A lightweight, modern, privacy-conscious personal media tracker for **anime, manga, manhwa, manhua, light novels and web novels**.

Track episodes and chapters, continue where you stopped, discover relations between adaptations, and get automatic progress detection — on **any** website — via the browser extension and the Android app.

```
AniMangaBuckList/
│
├── apps/
│   └── web/               # Next.js web app (web, API routes, /download page)
│
├── extension/             # Browser extension (Chrome/Brave) — works on any site
├── mobile/
│   └── android/           # Android app (background auto-detection, built in CI)
│
├── packages/
│   ├── types/             # Shared domain types
│   ├── database/          # Drizzle ORM schema + Neon PostgreSQL client
│   └── providers/         # Metadata/release provider abstractions
│
├── docs/
├── .github/workflows/     # CI + Android/extension builds
├── .env.example
├── license
├── README.md
└── package.json
```

## Automatic tracking (any website)

The **browser extension** and **Android app** are site-agnostic. Instead of per-site ID
mapping, they read the series name + chapter/episode number from the page (title tags,
JSON-LD, headings, URL) and send **`{ title, unit, value }`** to the backend, which
**fuzzy-matches** the title against your catalog and its aliases using PostgreSQL `pg_trgm`
similarity (media-type aware, chapter/episode-count sanity checked).

- **High-confidence match** → progress logged instantly.
- **Ambiguous / unknown** → returned as `needsConfirmation`; you pick the right title once
  (in the popup or app), and that mapping is remembered per user (`extension_title_matches`),
  so you never confirm the same site+title twice.

Relevant API (all Bearer `ambl_…` API keys, CORS-enabled):
- `POST /api/extension/progress` — `{ title?, titleCandidates?, titleId?, malId?, unit, value, kind, host, sourceUrl }`; returns `409 needsConfirmation + candidates` when unsure.
- `GET /api/extension/resolve?q=…&unit=…` — candidate search for the confirmation UI.
- `POST /api/extension/confirm` — `{ titleId, detectedTitle, unit, value, kind, host }`; logs progress and remembers the mapping.
- `GET /api/extension/library` — all your tracked titles.

### Browser extension (Chrome / Brave)

Plain MV3 HTML/JS/CSS, no build step. Load it from `chrome://extensions` →
**Developer mode** → **Load unpacked** → select `extension/`. It needs `<all_urls>` access
because it adapts to any site. Ambiguous titles appear in the popup's "Needs confirmation"
section. See [`extension/README.md`](./extension/README.md).

### Android app

A native, zero-dependency Java app (`mobile/android`) that runs a **background Accessibility
Service** to auto-detect what you are reading/watching on your phone, plus a confirmation UI
for unmatched titles. Built in CI (`.github/workflows/android.yml`) and published as a
**GitHub Release** asset — download it from **`/download`** on the deployed site
(`releases/latest/download/animanga-tracker.apk`).

```
Download .apk  →  create an API key on the site (Settings)  →  paste key in app
→  enable the accessibility service  →  done
```

Requires Android 8+ (API 26).

## Stack

- **Frontend/API:** Next.js (App Router, RSC-first), TypeScript, React, Tailwind CSS
- **Database:** Neoon PostgreSQL via Drizzle ORM
- **Metadata:** MyAnimeList (via Jikan by default, or the official MAL REST API)
- **Auth:** email + password (bcrypt), DB-backed sessions, httpOnly cookies
- **Deploy:** Render (free plan — see [Free-plan budget](#free-plan-budget))

## Getting started

```bash
npm install

# 1. Create a Neon PostgreSQL database and a project
# 2. Copy env example and set DATABASE_URL
copy .env.example apps/web/.env    # then edit apps/web/.env

# 3. Generate + apply the schema
npm run db:generate
npm run db:migrate

# 4. Run
npm run dev
```

Open http://localhost:3000, sign up, then search a title from MyAnimeList and add it to your library.

## Scripts

| Command             | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the web app                    |
| `npm run build`     | Production build                     |
| `npm run start`     | Start production server              |
| `npm run typecheck` | Type-check all workspaces            |
| `npm run db:generate` | Generate Drizzle SQL migrations    |
| `npm run db:migrate`  | Apply migrations to Neon           |

## Deploying

Production runs on **Vercel** (Hobby plan), linked to this repository: every push to `master` deploys automatically.

- **Framework preset:** Next.js
- **Root directory:** `apps/web`
- **Install / build:** defaults (Vercel detects the npm workspace and builds with the root lockfile)
- **Health check:** `/api/health`, which runs `select 1` against the database

Set the environment variables below, then add the custom domain and point its CNAME at Vercel.

Point `DATABASE_URL` at the **pooled** Neon endpoint (the host contains `-pooler`). Vercel clones and freezes function instances, so `packages/database` opens a single connection per instance when `VERCEL` is set and leaves the multiplexing to that pooler. Self-hosted runs and scripts keep the normal pool.

### Render (alternative)

Use the included [`render.yaml`](./render.yaml) blueprint, or manually create a **Web Service** with:

- **Build:** `npm ci && npm run build`
- **Start:** `npm run start`
- **Health check:** `/api/health`

Render's free plan provides **750 instance hours per calendar month per workspace**, shared by every free web service in that workspace. If the budget runs out, Render suspends **all** of them until the start of the next month.

An instance only consumes hours while it is awake, and free instances sleep after 15 minutes without traffic. So:

- Do **not** point an uptime monitor (UptimeRobot and friends) at a free service. A 5-minute ping keeps it awake around the clock, which alone is ~730 hours per month out of 750.
- Keep at most **one** free web service awake, or accept a cold start (~30–60s) on the first request after idling.
- The hour cap is removed on paid compute plans.

### Environment variables

| Variable                 | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `DATABASE_URL`           | Neon Postgres connection string                                |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in (login page)              |
| `MAL_CLIENT_ID` / `MAL_CLIENT_SECRET` | MyAnimeList OAuth (dormant backend, not shown on login) |
| `RESEND_API_KEY`         | Sends verification / password-reset email via Resend           |
| `MAIL_FROM`              | Sender for email (default `AniManga BuckList <no-reply@animanga.debayandas.in>`) |
| `METADATA_PROVIDER`      | Search provider: `mal` or `jikan` (default `jikan`)            |
| `MANGABAKA_API_KEY`      | MangaBaka PAT; auto-syncs your reading progress into search results |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` / `WEBAUTHN_ORIGINS` | Passkey sign-in                          |
| `SESSION_TTL_HOURS`      | Session lifetime (default `720`)                               |
| `APP_URL`                | Public site URL (used for email links)                         |

MangaBaka progress syncs automatically (6h TTL) the first time a signed-in user searches or opens Settings; no manual sync needed. No AniList credentials are required — the AniList metadata provider is available as a search fallback only.

## Providers

Metadata access is behind a provider abstraction (`packages/providers`):

- `jikan` — MyAnimeList via the Jikan API (no credentials, default)
- `mal` — official MyAnimeList REST API (set `METADATA_PROVIDER=mal` and `MAL_CLIENT_ID`/`MAL_CLIENT_SECRET`)
- `anilist` — AniList GraphQL (set `METADATA_PROVIDER=anilist`; used as a search fallback)

Sign-in is Google-only. MyAnimeList OAuth routes remain in the codebase but are not linked from the UI. Progress badges come from MangaBaka (auto-synced via `MANGABAKA_API_KEY`).

Release tracking (new chapter/episode notifications) will use a separate `ReleaseProvider` abstraction in Phase 3.

## Philosophy

- Free-first and cheap to run (no object storage, no image hosting, no microservices)
- Content-agnostic: your library and progress belong to AniMangaBuckList, not any one website
- Privacy-conscious: only necessary data is stored; AI (Ollama) stays optional and local by default

See [`docs/architecture.md`](./docs/architecture.md) for the current architecture and roadmap.