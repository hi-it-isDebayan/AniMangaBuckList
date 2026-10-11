"""One-off check for the httpx fetch + Scrapy parse path.

No Twisted reactor: on this Windows setup Scrapy 2.19 never installs one, so we
download with httpx (app.crawl_once) and let PageSpider do the extraction.
Run: python _scrape_test.py [url]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.crawl_once import crawl

URLS = [
    "https://myanimelist.net/anime/21/One_Piece/episode/1",
    "https://myanimelist.net/manga/13/One_Punch-Man",
]


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else URLS[0]
    result = crawl(url)
    print(json.dumps(result, default=str, indent=2)[:3000])
