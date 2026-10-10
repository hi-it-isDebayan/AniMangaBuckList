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
        if elapsed < config.JIKAN_RATE_SECONDS:
            time.sleep(max(0.0, config.JIKAN_RATE_SECONDS - elapsed))
        _last_request[0] = time.time()


def _token_overlap(a: str, b: str) -> float:
    ta = set(re.findall(r"[a-z0-9']+", (a or "").lower()))
    tb = set(re.findall(r"[a-z0-9']+", (b or "").lower()))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


def _jikan(query: str, media: str) -> dict | None:
    _throttle()
    try:
        with httpx.Client(timeout=12, headers={"User-Agent": config.USER_AGENT}) as client:
            resp = client.get(
                f"{config.JIKAN_BASE}/{media}",
                params={
                    "q": query,
                    "limit": 5,
                    "order_by": "members",
                    "sort": "desc",
                },
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            results = ((data or {}).get("data") or [])
            return results[0] if results else None
    except Exception:
        return None


def _to_match(node: dict | None, media: str) -> dict | None:
    if not node:
        return None
    images = ((node.get("images") or {}).get("jpg") or {})
    return {
        "malId": node.get("mal_id"),
        "title": node.get("title_english") or node.get("title") or "",
        "mediaType": "ANIME" if media == "anime" else "MANGA",
        "coverUrl": images.get("large_image_url") or images.get("image_url") or "",
        "synopsis": node.get("synopsis") or "",
        "score": node.get("score"),
        "episodes": node.get("episodes") or node.get("num_episodes"),
        "chapters": node.get("chapters"),
    }


def search_mal(title: str, media: str, alternates: list[str] | None = None) -> dict | None:
    query = re.sub(r"\s+", " ", (title or "")).strip().rstrip(".:")
    if not query:
        for alt in alternates or []:
            query = re.sub(r"\s+", " ", alt).strip()
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
        node = _jikan(cand, media)
        match = _to_match(node, media)
        if not match:
            continue
        overlap = _token_overlap(cand, match["title"])
        if overlap > best_overlap:
            best = match
            best_overlap = overlap
        if overlap >= 0.6:
            break

    if best:
        import json

        mal_cache_set(cache_key, json.dumps(best, ensure_ascii=False))
    return best


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