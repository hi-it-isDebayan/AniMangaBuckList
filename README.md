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
- **Deploy:** Render, monitored with UptimeRobot

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

## Deploying to Render

Use the included [`render.yaml`](./render.yaml) blueprint, or manually create a **Web Service** with:

- **Build:** `npm ci && npm run build`
- **Start:** `npm run start`
- **Health check:** `/api/health`

Set `DATABASE_URL` to your Neon database and monitor `/api/health` with UptimeRobot.

## Providers

Metadata access is behind a provider abstraction (`packages/providers`):

- `jikan` — MyAnimeList via the Jikan API (no credentials, default)
- `mal` — official MyAnimeList REST API (set `METADATA_PROVIDER=mal` and `MAL_ACCESS_TOKEN`)

Release tracking (new chapter/episode notifications) will use a separate `ReleaseProvider` abstraction in Phase 3.

## Philosophy

- Free-first and cheap to run (no object storage, no image hosting, no microservices)
- Content-agnostic: your library and progress belong to AniMangaBuckList, not any one website
- Privacy-conscious: only necessary data is stored; AI (Ollama) stays optional and local by default

See [`docs/architecture.md`](./docs/architecture.md) for the current architecture and roadmap.