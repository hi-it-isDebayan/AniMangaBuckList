"""Fetch a page and parse it with the Scrapy spider.

CrawlerProcess + Twisted is unreliable here (Scrapy 2.19 expects a reactor that
never installs under uvicorn on Windows). httpx downloads the HTML; PageSpider
still does the title/chapter extraction.
"""

from __future__ import annotations

import json
import sys

import httpx
from scrapy.http import HtmlResponse, Request

from . import config
from .spiders import PageSpider


def crawl(url: str) -> dict:
    spider = PageSpider(url=url)
    try:
        with httpx.Client(
            timeout=httpx.Timeout(20.0, connect=10.0),
            follow_redirects=True,
            headers={"User-Agent": config.USER_AGENT},
        ) as client:
            resp = client.get(url)
    except httpx.HTTPError as exc:
        spider.errback_message(str(exc))
        return spider.head

    request = Request(url=str(resp.url))
    response = HtmlResponse(
        url=str(resp.url),
        status=resp.status_code,
        headers=dict(resp.headers),
        body=resp.content,
        encoding=resp.encoding or "utf-8",
        request=request,
    )
    spider.parse_page(response)
    return spider.head


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "url required"}))
        sys.exit(2)
    print(json.dumps(crawl(sys.argv[1]), default=str))
