# AniMangaBuckList

A lightweight, modern, privacy-conscious personal media tracker for **anime, manga, manhwa, manhua, light novels and web novels**.

Track episodes and chapters, continue where you stopped, discover relations between adaptations, and (in later phases) get automatic progress detection via a browser extension.

```
AniMangaBuckList/
│
├── apps/
│   ├── web/               # Next.js web app (Phase 1: MVP)
│   └── extension/         # Browser extension (Phase 2 - upcoming)
│
├── packages/
│   ├── types/             # Shared domain types
│   ├── database/          # Drizzle ORM schema + Neon PostgreSQL client
│   └── providers/         # Metadata/release provider abstractions
│
├── docs/
├── .github/workflows/     # CI
├── .env.example
├── license
├── README.md
└── package.json
```

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