import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
ENGINE_ROOT = APP_DIR.parent

SITE_URL = os.environ.get("AMBL_SITE_URL", "https://animanga.debayandas.in").rstrip("/")
ENGINE_PORT = int(os.environ.get("ENGINE_PORT", "8000"))

# Title resolution now goes through MangaBaka (Jikan/api.jikan.moe is unreachable
# from the engine host). MangaBaka is reachable and exposes source.my_anime_list.id.
MANGABAKA_BASE = os.environ.get("MANGABAKA_BASE", "https://api.mangabaka.org").rstrip("/")
MANGABAKA_API_KEY = os.environ.get("MANGABAKA_API_KEY", "").strip()

CACHE_DIR = ENGINE_ROOT / "data"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DB = os.environ.get("ENGINE_CACHE_DB", str(CACHE_DIR / "cache.sqlite3"))

URL_COOLDOWN_SECONDS = int(os.environ.get("ENGINE_URL_COOLDOWN_SECONDS", "35"))
RESOLVE_RATE_SECONDS = float(
    os.environ.get("ENGINE_RESOLVE_RATE", os.environ.get("ENGINE_JIKAN_RATE", "0.5"))
)
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)