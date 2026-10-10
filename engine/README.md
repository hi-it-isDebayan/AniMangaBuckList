# AniManga BuckList Engine

Self-hosted detection engine for the tracker extension and Android app. Runs a
Scrapy spider on the page you are viewing, cross-checks the title against
MyAnimeList (Jikan v4), and reports progress + browse history to the web app.

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
| `AMBL_USE_OLLAMA` | `1` |
| `OLLAMA_URL` | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | `llama3.2:3b` |
| `AMBL_JIKAN_RATE` | `1.0` (requests/sec) |

Jikan search results are cached 24h in `engine/data/cache.sqlite3`. The same URL
is skipped (35s cooldown) on repeat visits so episodes/chapters do not double-count.