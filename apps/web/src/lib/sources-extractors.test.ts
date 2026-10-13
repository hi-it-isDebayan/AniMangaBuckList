import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanTitle,
  extractPage,
  extractUnitValue,
  extractorLabel,
  extractorStatusFor,
  findExtractor,
  loadJsonLd,
  normalizeHost,
} from "./sources/extractors";

test("normalizeHost lowercases and strips www and trailing dots", () => {
  assert.equal(normalizeHost("WWW.MangaDex.org."), "mangadex.org");
  assert.equal(normalizeHost("  Example.com  "), "example.com");
});

test("findExtractor matches the exact host and its subdomains", () => {
  assert.equal(findExtractor("mangadex.org")?.key, "mangadex");
  assert.equal(findExtractor("www.mangadex.org")?.key, "mangadex");
  assert.equal(findExtractor("api.mangadex.org")?.key, "mangadex");
  assert.equal(findExtractor("myanimelist.net")?.key, "myanimelist");
});

test("findExtractor rejects lookalike hosts", () => {
  assert.equal(findExtractor("notmangadex.org"), null);
  assert.equal(findExtractor("mangadex.org.example.com"), null);
  assert.equal(findExtractor("example.com"), null);
});

test("unknown hosts are awaiting extractor support, never 'unsupported'", () => {
  assert.equal(extractorStatusFor("some-new-site.example"), "AWAITING_EXTRACTOR");
  assert.equal(extractorStatusFor("mangadex.org"), "SUPPORTED");
  assert.equal(extractorLabel("some-new-site.example"), "Awaiting extractor support");
  assert.equal(extractorLabel("mangadex.org"), "MangaDex");
});

test("extractUnitValue reads chapter and episode numbers", () => {
  assert.deepEqual(extractUnitValue("Solo Leveling Chapter 12"), {
    unit: "CHAPTER",
    value: 12,
  });
  assert.deepEqual(extractUnitValue("One Piece - Episode 1080 - Watch Online"), {
    unit: "EPISODE",
    value: 1080,
  });
  assert.deepEqual(extractUnitValue("series/chapter-45.5"), { unit: "CHAPTER", value: 45 });
  assert.deepEqual(extractUnitValue("Episodio 7"), { unit: "EPISODE", value: 7 });
  assert.equal(extractUnitValue("no numbers here"), null);
  assert.equal(extractUnitValue(""), null);
});

test("cleanTitle drops site suffixes, unit markers and the host", () => {
  assert.equal(cleanTitle("Solo Leveling Chapter 12 - Read Online"), "Solo Leveling");
  assert.equal(cleanTitle("One Piece | MyAnimeList.net", "myanimelist.net"), "One Piece");
  assert.equal(cleanTitle("  Extra   Spaces  "), "Extra Spaces");
  assert.equal(cleanTitle(""), "");
});

test("loadJsonLd returns the first named JSON-LD block", () => {
  const html =
    '<html><script type="application/ld+json">{not json}</script>' +
    '<script type="application/ld+json">{"@type":"Book","name":"Solo Leveling"}</script></html>';
  assert.equal(loadJsonLd(html)?.name, "Solo Leveling");
});

test("loadJsonLd walks arrays and @graph", () => {
  const html =
    '<script type="application/ld+json">{"@graph":[{"@type":"WebSite"}]}</script>' +
    '<script type="application/ld+json">[{"@type":"WebSite"},{"@type":"Book","name":"Dandadan"}]</script>';
  assert.equal(loadJsonLd(html)?.name, "Dandadan");
  assert.equal(loadJsonLd("<html></html>"), null);
});

test("extractPage prefers og:title and reports the unit/value separately", () => {
  const html =
    '<html><head><meta property="og:title" content="Solo Leveling Chapter 3" />' +
    "<title>Ignore this</title></head><body></body></html>";
  const parsed = extractPage(html, "https://example.com/series/solo-leveling");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.title, "Solo Leveling");
  assert.equal(parsed.unit, "CHAPTER");
  assert.equal(parsed.value, 3);
  assert.equal(parsed.fromJsonLd, false);
});

test("extractPage accepts <title> and attribute reordering", () => {
  const html = "<html><head><title>Solo Leveling Chapter 5</title></head></html>";
  const parsed = extractPage(html, "https://example.com/");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.title, "Solo Leveling");
  assert.equal(parsed.value, 5);
});

test("extractPage falls back to JSON-LD name", () => {
  const html =
    '<html><head><script type="application/ld+json">{"name":"Dandadan"}</script></head></html>';
  const parsed = extractPage(html, "https://example.com/");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.fromJsonLd, true);
  assert.match(parsed.title ?? "", /Dandadan/);
});

test("extractPage reports failure when there is no identifiable title", () => {
  const parsed = extractPage("<html><body><p>nothing</p></body></html>", "https://example.com/");
  assert.equal(parsed.ok, false);
  assert.equal(parsed.title, null);
  assert.equal(extractPage("", "https://example.com/").ok, false);
});
