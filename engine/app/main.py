import threading
import time
from typing import Any

from fastapi import Body, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from scrapy.crawler import CrawlerProcess

from . import config
from .resolver import media_hint, ollama_available, ollama_normalize, search_mal
from .spiders import PageSpider
from .store import url_in_cooldown
from .webfwd import forwarder, get_bearer

app = FastAPI(
    title="AniManga BuckList Engine",
    description="Scrapy + MAL detection engine for the tracker extension and Android app.",
    version="1.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_spider_lock = threading.Lock()


def run_spider(url: str) -> dict:
    with _spider_lock:
        process = CrawlerProcess(
            {
                "LOG_LEVEL": "ERROR",
                "TELNETCONSOLE_ENABLED": False,
                "ROBOTSTXT_OBEY": False,
            }
        )
        spider = PageSpider(url=url)
        process.crawl(spider)
        process.start()
        return spider.head


def _pick_title(scrape: dict, payload: dict) -> tuple[str, list[str]]:
    hints = [t for t in (payload.get("titleCandidates") or []) if t]
    hint_title = payload.get("title") or (hints[0] if hints else "")
    scraped_title = scrape.get("title") or ""
    primary = scraped_title or hint_title
    alternates: list[str] = []
    for t in [scraped_title] + (scrape.get("titleCandidates") or []) + [hint_title] + hints:
        if t and t not in alternates:
            alternates.append(t)
    return primary, alternates


@app.get("/")
def root() -> dict:
    return {
        "service": "ambl-engine",
        "version": app.version,
        "site": config.SITE_URL,
        "endpoints": ["/health", "/scrape", "/ping", "/api/extension/*"],
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True, "ts": int(time.time()), "service": "ambl-engine"}


@app.get("/resolve")
def resolve(request: Request, q: str = "", unit: str = "CHAPTER") -> Response:
    bearer = get_bearer(request.headers.get("authorization"))
    status, data = forwarder.call(
        "GET", "/api/extension/resolve", bearer=bearer, params={"q": q, "unit": unit}
    )
    return JSONResponse(data, status_code=status)


@app.post("/ping")
def ping(request: Request, payload: dict = Body(default={})) -> Response:
    bearer = get_bearer(request.headers.get("authorization"))
    if not forwarder.check_key(bearer):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    platform = (payload or {}).get("platform") or "extension"
    if platform not in ("extension", "android", "web"):
        return JSONResponse({"error": "invalid platform"}, status_code=400)
    status, data = forwarder.call(
        "POST", "/api/extension/heartbeat", bearer=bearer, body={"platform": platform}
    )
    return JSONResponse(data if data else {}, status_code=status)


@app.post("/scrape")
def scrape(request: Request, payload: dict = Body(default={})) -> Response:
    bearer = get_bearer(request.headers.get("authorization"))
    if not forwarder.check_key(bearer):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    platform = str(payload.get("platform") or "extension")
    if platform not in ("extension", "android", "web"):
        platform = "extension"
    forwarder.call(
        "POST", "/api/extension/heartbeat", bearer=bearer, body={"platform": platform}
    )

    url = str(payload.get("sourceUrl") or "").strip()
    if not url or not url.startswith(("http://", "https://")):
        return JSONResponse({"error": "sourceUrl is required"}, status_code=400)

    host = payload.get("host") or payload.get("source") or ""
    unit = payload.get("unit")
    value = int(payload.get("value") or 0)

    if url_in_cooldown(url):
        status, data = forwarder.call(
            "POST", "/api/extension/progress", bearer=bearer, body=payload
        )
        return JSONResponse(data if data else {}, status_code=status)

    scrape_state: dict[str, Any] = {"fetch": None}
    try:
        scrape_state["fetch"] = run_spider(url)
    except Exception as exc:  # scrapy/reactor hiccups must never break tracking
        scrape_state["fetch"] = {"ok": False, "error": str(exc)}
    scrape = scrape_state["fetch"] or {}

    primary, alternates = _pick_title(scrape, payload)

    if not unit and scrape.get("unit"):
        unit = scrape["unit"]
    if not value and scrape.get("value"):
        value = scrape["value"]

    media = media_hint(unit, host)

    mal_match = None
    if primary:
        mal_match = search_mal(primary, media, alternates)
        if not mal_match and ollama_available():
            normalized = ollama_normalize(primary, alternates)
            if normalized:
                mal_match = search_mal(normalized, media, [primary])

    final_title = primary or str(payload.get("title") or "")
    title_candidates: list[str] = []
    for t in ([final_title] + alternates[:8]):
        if t and t not in title_candidates:
            title_candidates.append(t)
    if mal_match and mal_match.get("title") and mal_match["title"] not in title_candidates:
        title_candidates.append(mal_match["title"])

    tracked: dict[str, Any] = {
        "title": final_title,
        "titleCandidates": title_candidates[:10],
        "unit": unit or "CHAPTER",
        "value": value or 1,
        "kind": payload.get("kind") or "OPENED",
        "source": payload.get("source") or host or "",
        "sourceUrl": url,
        "host": host,
    }
    if mal_match and mal_match.get("malId"):
        tracked["malId"] = mal_match["malId"]

    progress_status, progress_data = forwarder.call(
        "POST", "/api/extension/progress", bearer=bearer, body=tracked
    )

    browse_payload = {
        "url": url,
        "title": final_title,
        "site": (payload.get("source") or host or "").strip(),
        "malId": mal_match.get("malId") if mal_match else None,
        "mediaType": (mal_match or {}).get("mediaType") or media,
        "coverUrl": (mal_match or {}).get("coverUrl") or "",
        "unit": tracked["unit"],
        "value": tracked["value"],
    }
    forwarder.call("POST", "/api/extension/browse", bearer=bearer, body=browse_payload)

    body: dict[str, Any] = dict(progress_data or {})
    body["engine"] = {
        "scraped": bool(scrape.get("ok")),
        "title": final_title,
        "mal": bool(mal_match),
        "platform": "extension|scrape",
    }
    return JSONResponse(body, status_code=progress_status)


@app.api_route("/api/extension/{path:path}", methods=["GET", "POST", "OPTIONS"])
async def proxy(request: Request, path: str) -> Response:
    if request.method == "OPTIONS":
        return Response(status_code=204)
    bearer = get_bearer(request.headers.get("authorization"))
    qs = request.url.query
    target = "/api/extension/" + path
    if qs:
        target += "?" + qs
    body = None
    if request.method == "POST":
        try:
            body = await request.json()
        except Exception:
            body = None
    status, data = forwarder.call(request.method, target, bearer=bearer, body=body)
    return JSONResponse(data if data is not None else {}, status_code=status)