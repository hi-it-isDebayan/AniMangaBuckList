# AniManga BuckList Engine

Self-hosted detection engine for the tracker extension and Android app. Fetches
the page you are viewing with httpx, parses title/chapter with the Scrapy
`PageSpider`, cross-checks the title against MangaBaka (which maps to a
MyAnimeList id), and reports progress + browse history to the web app.

Note: Scrapy 2.19 never installs a Twisted reactor under uvicorn on this Windows
setup, so crawls do not start via `CrawlerProcess`. `app/crawl_once.py` downloads
with httpx and feeds an `HtmlResponse` to the spider instead.

Title resolution uses MangaBaka (`api.mangabaka.org`, reachable from this host)
rather than Jikan (`api.jikan.moe`, currently times out here). MangaBaka returns
`source.my_anime_list.id` in search results, which the pipeline uses for
`malId`. Optional `x-api-key` header via `MANGABAKA_API_KEY`; search works
without it.

## Run (persistent background)

Prepared as Windows Scheduled Tasks so it survives tool sessions and reboots:

```powershell
# Engine on port 8000
schtasks /create /tn "ambl-engine" /tr "`"E:\MyProject\AniMangaBuckList\engine\.venv\Scripts\python.exe`" -m uvicorn --app-dir E:\MyProject\AniMangaBuckList\engine app.main:app --host 0.0.0.0 --port 8000" /sc once /st 00:02 /f
schtasks /run /tn "ambl-engine"

# Public tunnel to the engine
$ng = (Get-Command ngrok).Source
schtasks /create /tn "ambl-ngrok" /tr "`"$ng`" http 8000 --log stdout" /sc once /st 00:02 /f
schtasks /run /tn "ambl-ngrok"
```

Get the live public URL: `Invoke-RestMethod http://127.0.0.1:4040/api/tunnels`

Stop: `schtasks /end /tn "ambl-engine"`. If the code changes, kill the uvicorn
python process before re-running the task.

## Endpoints

- `GET /health` — liveness
- `GET /resolve?q=&unit=` — proxy to web title resolver
- `POST /ping` `{platform: extension|android|web}` — device heartbeat
- `POST /scrape` — main call (payload is the extension's corpus detection body)
  - returns the web app's progress response plus an `engine` object
- `*/api/extension/*` — proxy pass-through for resolve/library/confirm/progress

## Config (env)

| Variable | Default |
| --- | --- |
| `AMBL_SITE_URL` | `https://animanga.debayandas.in` |
| `ENGINE_PORT` | `8000` |
| `MANGABAKA_BASE` | `https://api.mangabaka.org` |
| `MANGABAKA_API_KEY` | *(optional)* PAT for `x-api-key` header |
| `AMBL_USE_OLLAMA` | `1` |
| `OLLAMA_URL` | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | `llama3.2:3b` |
| `ENGINE_RESOLVE_RATE` | `0.5` (requests/sec to MangaBaka) |

MangaBaka search results are cached 24h in `engine/data/cache.sqlite3`. The same URL
is skipped (35s cooldown) on repeat visits so episodes/chapters do not double-count.