import json
import re
from urllib.parse import urlparse

import scrapy

from . import config

CHAPTER_RE = re.compile(
    r"(?:chapter|chap\.|ch\.|episode|ep\.|ep)\s*[-: ]?\s*#?\s*(\d{1,4}(?:\.\d+)?)",
    re.IGNORECASE,
)
VERSION_RE = re.compile(r"(?:v\.?|ver\.?)\s*(\d{1,3}(?:\.\d+)?)", re.IGNORECASE)

SITE_NOISE = [
    "Read",
    "Online",
    "Free",
    "English",
    "Sub",
    "Dub",
    "Dubbed",
    "Subbed",
    "Watch",
    "Stream",
    "Manga",
    "Novel",
    "Manhua",
    "Manhwa",
]


def load_json_ld(html: str) -> dict | None:
    try:
        for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE):
            data = json.loads(m.group(1))
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("name"):
                        return item
            if isinstance(data, dict) and data.get("name"):
                return data
    except Exception:
        pass
    return None


def clean_title(raw: str, host: str = "") -> str:
    if not raw:
        return ""
    title = re.sub(r"\s+", " ", raw).strip()
    title = re.sub(r"<[^>]+>", "", title)
    cuts = re.split(r"\s[-|–_:]\s|\s-\s|\s\|\s", title, flags=re.IGNORECASE)
    best = title
    for part in cuts:
        candidate = part.strip()
        if not candidate or len(candidate) < 3:
            continue
        best = candidate
        break
    mnum = CHAPTER_RE.search(best)
    if mnum:
        best = best[: mnum.start()].strip()
    host_lower = (host or "").lower().replace("www.", "")
    if host_lower:
        best = best.replace(host_lower, "")
    segs = [s for s in re.split(r"[\s|–—-]+", best) if s]
    if segs and segs[0].lower() in {s.lower() for s in SITE_NOISE}:
        segs = segs[1:]
    out = " ".join(segs).strip(" -|–—")
    out = re.sub(r"\b(online free|read online|watch online)\b", "", out, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", out).strip()


class PageSpider(scrapy.Spider):
    name = "ambl_page"

    custom_settings = {
        "ROBOTSTXT_OBEY": False,
        "USER_AGENT": config.USER_AGENT,
        "DOWNLOAD_TIMEOUT": 20,
        "RETRY_TIMES": 1,
        "DOWNLOAD_DELAY": 0,
        "COOKIES_ENABLED": True,
        "HTTPERROR_ALLOW_ALL": True,
        "DOWNLOAD_MAXSIZE": 8_000_000,
        "CONCURRENT_REQUESTS": 2,
        "LOG_LEVEL": "WARNING",
        "TELNETCONSOLE_ENABLED": False,
    }

    def __init__(self, url: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.url = url
        self.head = {"ok": False, "error": "unreachable"}

    def start_requests(self):
        if not self.url:
            self.head = {"ok": False, "error": "missing url"}
            return
        yield scrapy.Request(self.url, callback=self.parse_page, errback=self.errback, dont_filter=True)

    def errback_message(self, message: str) -> None:
        self.head = {"ok": False, "error": message}

    def errback(self, failure):
        self.errback_message(str(failure.getErrorMessage() or failure.value))

    def parse_page(self, response):
        html = response.text or ""
        og_title = (
            response.xpath('//meta[@property="og:title"]/@content').get()
            or response.xpath('//meta[@name="og:title"]/@content').get()
            or ""
        ).strip()
        twitter_title = (
            response.xpath('//meta[@name="twitter:title"]/@content').get() or ""
        ).strip()
        page_title = response.xpath("//title/text()").get() or ""
        h1 = (response.xpath("//h1//text()").getall() or [""])[0] or ""
        ld = load_json_ld(html)
        ld_name = (ld or {}).get("name") or ""

        title_candidates = list(
            dict.fromkeys(
                t
                for t in [
                    og_title,
                    ld_name,
                    twitter_title,
                    h1,
                    page_title,
                ]
                if t and len(t) >= 2
            )
        )
        cleaned = [clean_title(t, host=urlparse(self.url).hostname or "") for t in title_candidates]
        cleaned = [c for c in cleaned if c and len(c) >= 2]
        cleaned = list(dict.fromkeys(cleaned))

        unit = None
        value = None
        for source in [page_title, og_title, h1]:
            if not source:
                continue
            m = CHAPTER_RE.search(source)
            if m:
                mval = m.group(1)
                value = float(mval) if "." in mval else int(mval)
                unit = "EPISODE" if re.search(r"ep(?:isode)?\b", source, re.IGNORECASE) else "CHAPTER"
                break

        title = cleaned[0] if cleaned else (og_title or page_title).strip()
        self.head = {
            "ok": True,
            "finalUrl": response.url,
            "status": response.status,
            "pageTitle": page_title.strip(),
            "title": title,
            "titleCandidates": cleaned[:8],
            "unit": unit,
            "value": value,
            "ldName": ld_name.strip(),
        }