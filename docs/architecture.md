# Architecture

Current state (Phase 1 MVP shipped). This document is a living record; update it as we build.

## Data flow

```
                    MyAnimeList API
                         |  (metadata only)
                         v
             packages/providers (JikanProvider / MALProvider)
                         |
                         v
  apps/web (Next.js, RSC-first)  <-----> packages/database (Drizzle + Neon Postgres)
                         |
                         v
               User library + progress
```

## Provider design

- `MetadataProvider` — title search + details + relations (used by Phase 1).
- `ReleaseProvider` — planned for Phase 3 (new chapter/episode detection, RSS/API-based).
- All website/reading-source specifics stay isolated in their own adapters (Phase 2 extension) and are never baked into core logic.

## Schema notes

The MVP schema has one `chapters` table and one `episodes` table keyed to a title (with `season`),
rather than separate `manga_series`/`anime_seasons` tables. This avoids over-normalization while
still separating anime episodes from manga/novel chapters. `last_opened_*` and `last_completed_*`
are stored separately on `user_progress`.

`ratings` live in their own table; favorites are a boolean on `user_library`.

## Roadmap

- **Phase 2** — browser extension with adapter architecture (weebcentral + generic fallback), API auth
- **Phase 3** — release system: providers, scheduled checks, notifications, calendar
- **Phase 4** — relations UX, statistics, discovery
- **Phase 5** — optional Ollama AI (natural-language search, recommendations)
- **Phase 6** — optional local `manga-tui` workflow
- **Phase 7** — public deployment hardening (rate limiting, privacy policy, backups)

## Boundaries

AniMangaBuckList is a tracking app, not a content host. Never store manga/anime files, images,
or copyrighted media. The extension collects only the minimum progress data needed.