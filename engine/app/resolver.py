import re
import threading
import time

import httpx

from . import config
from .store import mal_cache_get, mal_cache_set

_lock = threading.Lock()
_last_request: list[float] = [0.0]

ANIME_HOSTS = {
    "9anime",
    "aniwave",
    "aniwatch",
    "animepahe",
    "animesuge",
    "gogoanime",
    "hanime",
    "kissanime",
    "zoro",
    "zoro.to",
}

MANGA_HOSTS = {
    "arven",
    "asura",
    "batotoo",
    "lemon",
    "mangabuddy",
    "mangadex",
    "mangafox",
    "mangahub",
    "mangakakalot",
    "manganato",
    "mangapill",
    "mangareader",
    "reaperscans",
    "readm",
    "tcbscans",
    "webtoon",
}


def media_hint(unit: str | None, host: str) -> str:
    if unit == "CHAPTER":
        return "MANGA"
    if unit == "EPISODE":
        return "ANIME"
    base = (host or "").lower().replace("www.", "").split(".")[0]
    if base in MANGA_HOSTS:
        return "MANGA"
    if base in ANIME_HOSTS:
        return "ANIME"
    return "ANIME"


def _throttle() -> None:
    with _lock:
        elapsed = time.time() - _last_request[0]
        if elapsed < config.RESOLVE_RATE_SECONDS:
            time.sleep(max(0.0, config.RESOLVE_RATE_SECONDS - elapsed))
        _last_request[0] = time.time()


def _token_overlap(a: str, b: str) -> float:
    ta = set(re.findall(r"[a-z0-9']+", (a or "").lower()))
    tb = set(re.findall(r"[a-z0-9']+", (b or "").lower()))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


def _mangabaka(query: str) -> list[dict]:
    """Search the MangaBaka series DB (reachable here; Jikan is not)."""
    _throttle()
    headers = {"accept": "application/json", "User-Agent": config.USER_AGENT}
    if config.MANGABAKA_API_KEY:
        headers["x-api-key"] = config.MANGABAKA_API_KEY
    try:
        with httpx.Client(timeout=12, headers=headers) as client:
            resp = client.get(
                f"{config.MANGABAKA_BASE}/v1/series/search",
                params={"q": query},
            )
            if resp.status_code != 200:
                return []
            data = (resp.json() or {}).get("data") or []
            if isinstance(data, dict):
                data = [data]
            return [node for node in data if isinstance(node, dict)]
    except Exception:
        return []


def _series_titles(node: dict) -> list[str]:
    titles: list[str] = []
    for key in ("title", "romanized_title", "native_title"):
        val = node.get(key)
        if isinstance(val, str) and val:
            titles.append(val)
    secondary = node.get("secondary_titles")
    if isinstance(secondary, list):
        titles.extend(t for t in secondary if isinstance(t, str))
    elif isinstance(secondary, str):
        titles.append(secondary)
    for entry in node.get("titles") or []:
        if isinstance(entry, dict) and entry.get("title"):
            titles.append(entry["title"])
    return list(dict.fromkeys(t for t in titles if t))


def _to_match(node: dict | None, media: str) -> dict | None:
    if not node:
        return None
    mal_id = ((node.get("source") or {}).get("my_anime_list") or {}).get("id")
    if not mal_id:
        return None
    cover = node.get("cover") or {}
    cover_url = (
        ((cover.get("x250") or {}).get("x1"))
        or ((cover.get("raw") or {}).get("url"))
        or ((cover.get("x150") or {}).get("x1"))
        or ""
    )
    rating = node.get("rating")
    try:
        score = round(float(rating) / 10.0, 2) if rating is not None else None
    except (TypeError, ValueError):
        score = None
    media_lower = (media or "").lower()
    return {
        "malId": mal_id,
        "title": node.get("title") or node.get("romanized_title") or "",
        "mediaType": "ANIME" if media_lower == "anime" else "MANGA",
        "coverUrl": cover_url,
        "synopsis": node.get("description") or "",
        "score": score,
        "episodes": None,
        "chapters": node.get("total_chapters"),
    }


def search_series(title: str, media: str, alternates: list[str] | None = None) -> dict | None:
    """Resolve a series title to a MAL id via MangaBaka.

    Media is a loose hint ("MANGA"/"ANIME"); MangaBaka aggregates manga/novel
    metadata, so an "ANIME" hit resolves to the source manga's MAL entry.
    """
    query = re.sub(r"\s+", " ", (title or "")).strip().rstrip(".:")
    if not query:
        for alt in alternates or []:
            query = re.sub(r"\s+", " ", alt or "").strip()
            if query:
                break
    if not query or len(query) < 2:
        return None

    cache_key = media + ":" + query.lower()
    cached = mal_cache_get(cache_key)
    if cached:
        try:
            import json

            return json.loads(cached["payload"])
        except Exception:
            pass

    candidates = [query]
    candidates += [a for a in (alternates or []) if a and a != query]

    best: dict | None = None
    best_overlap = 0.0
    for cand in candidates[:4]:
        for node in _mangabaka(cand):
            match = _to_match(node, media)
            if not match:
                continue
            overlap = max(
                (_token_overlap(cand, t) for t in _series_titles(node)),
                default=0.0,
            )
            if overlap > best_overlap:
                best = match
                best_overlap = overlap
        if best_overlap >= 0.6:
            break

    if best:
        import json

        mal_cache_set(cache_key, json.dumps(best, ensure_ascii=False))
    return best


def search_mal(title: str, media: str, alternates: list[str] | None = None) -> dict | None:
    return search_series(title, media, alternates)


def ollama_available() -> bool:
    if os_use_ollama_disabled():
        return False
    try:
        with httpx.Client(timeout=2) as client:
            r = client.get(f"{config.OLLAMA_URL}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


def os_use_ollama_disabled() -> bool:
    import os

    return os.environ.get("AMBL_USE_OLLAMA", "1") == "0"


def ollama_normalize(title: str, alternates: list[str] | None = None) -> str:
    try:
        prompt = (
            "Extract ONLY the name of the anime or manga series being read/watched from the "
            f"following page text. Return just the series name, nothing else.\n\nTEXT:\n{title}"
        )
        if alternates:
            prompt += "\n\nALTERNATE CANDIDATES:\n" + "\n".join(alternates[:5])
        with httpx.Client(timeout=45) as client:
            r = client.post(
                f"{config.OLLAMA_URL}/api/generate",
                json={"model": config.OLLAMA_MODEL, "prompt": prompt, "stream": False},
            )
            if r.status_code != 200:
                return ""
            text = (r.json() or {}).get("response") or ""
            text = text.strip().strip("\"'").strip()
            if len(text) < 2 or len(text) > 160:
                return ""
            if re.search(r"chapter|episode|^\s*the\s*text", text, re.IGNORECASE):
                return ""
            return text
    except Exception:
        return ""