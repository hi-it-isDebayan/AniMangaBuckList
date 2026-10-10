import sqlite3
import threading
import time

from . import config

_lock = threading.Lock()
_conn_holder: dict[str, sqlite3.Connection] = {}


def _conn() -> sqlite3.Connection:
    conn = _conn_holder.get("c")
    if conn is None:
        conn = sqlite3.connect(config.CACHE_DB, check_same_thread=False)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS mal_cache ("
            " key TEXT PRIMARY KEY, payload TEXT NOT NULL, ts INTEGER NOT NULL)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS url_cooldown ("
            " url TEXT PRIMARY KEY, ts INTEGER NOT NULL)"
        )
        conn.commit()
        _conn_holder["c"] = conn
    return conn


def mal_cache_get(key: str, max_age_seconds: int = 86400) -> dict | None:
    try:
        with _lock:
            conn = _conn()
            row = conn.execute(
                "SELECT payload, ts FROM mal_cache WHERE key = ?", (key,)
            ).fetchone()
            if not row:
                return None
            payload, ts = row
            if time.time() - ts > max_age_seconds:
                return None
            return {"ts": ts, "payload": payload}
    except Exception:
        return None


def mal_cache_set(key: str, payload: str) -> None:
    try:
        with _lock:
            conn = _conn()
            conn.execute(
                "INSERT INTO mal_cache (key, payload, ts) VALUES (?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, ts = excluded.ts",
                (key, payload, time.time()),
            )
            conn.commit()
    except Exception:
        pass


def url_in_cooldown(url: str, max_age_seconds: int | None = None) -> bool:
    max_age = max_age_seconds or config.URL_COOLDOWN_SECONDS
    try:
        with _lock:
            conn = _conn()
            row = conn.execute(
                "SELECT ts FROM url_cooldown WHERE url = ?", (url,)
            ).fetchone()
            if row and time.time() - row[0] < max_age:
                return True
            conn.execute(
                "INSERT INTO url_cooldown (url, ts) VALUES (?, ?) "
                "ON CONFLICT(url) DO UPDATE SET ts = excluded.ts",
                (url, time.time()),
            )
            conn.commit()
            return False
    except Exception:
        return False