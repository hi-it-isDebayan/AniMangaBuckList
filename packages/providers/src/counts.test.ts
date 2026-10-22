import assert from "node:assert/strict";
import { test } from "node:test";
import type { SearchResultItem } from "@ambl/types";
import {
  candidateFromItem,
  normalizeCount,
  reconcileCount,
} from "./counts";

test("normalizeCount keeps positive integers (numbers and numeric strings)", () => {
  assert.equal(normalizeCount(12), 12);
  assert.equal(normalizeCount("12"), 12);
  assert.equal(normalizeCount(12.9), 12);
});

test("normalizeCount maps unknown sentinels to null", () => {
  for (const v of [null, undefined, "", 0, -1, -999, NaN, "abc"]) {
    assert.equal(normalizeCount(v), null, `expected ${String(v)} -> null`);
  }
});

function item(over: Partial<SearchResultItem>): SearchResultItem {
  return {
    malId: null,
    anilistId: null,
    title: "t",
    englishTitle: null,
    japaneseTitle: null,
    synonyms: [],
    mediaType: "MANGA",
    synopsis: null,
    status: null,
    episodeCount: null,
    chapterCount: null,
    volumeCount: null,
    startDate: null,
    endDate: null,
    season: null,
    year: null,
    coverUrl: null,
    score: null,
    genres: [],
    ...over,
  };
}

test("candidateFromItem normalizes the count and carries verified ids", () => {
  const c = candidateFromItem("mal", item({ malId: 42, chapterCount: 0 }), "CHAPTER");
  assert.deepEqual(c, {
    provider: "mal",
    value: null,
    malId: 42,
    anilistId: null,
    mangabakaId: null,
  });
});

test("reconcileCount prefers the higher valid count and records provenance", () => {
  const r = reconcileCount("CHAPTER", [
    { provider: "mal", value: 100, malId: 42 },
    { provider: "mangabaka", value: 120, malId: 42 },
  ]);
  assert.equal(r.value, 120);
  assert.equal(r.provider, "mangabaka");
  assert.equal(r.conflict, true);
  assert.deepEqual(
    r.sources.map((s) => s.provider),
    ["mal", "mangabaka"],
  );
});

test("reconcileCount uses the valid count when the other source is unknown", () => {
  const r = reconcileCount("CHAPTER", [
    { provider: "mal", value: null, malId: 42 },
    { provider: "mangabaka", value: 120, malId: 42 },
  ]);
  assert.equal(r.value, 120);
  assert.equal(r.provider, "mangabaka");
  assert.equal(r.conflict, false);
});

test("reconcileCount returns null when every source is unknown", () => {
  const r = reconcileCount("CHAPTER", [
    { provider: "mal", value: 0, malId: 42 },
    { provider: "mangabaka", value: null, malId: 42 },
  ]);
  assert.equal(r.value, null);
  assert.equal(r.provider, null);
  assert.deepEqual(r.sources, []);
  assert.equal(r.conflict, false);
});

test("reconcileCount only matches candidates with a shared verified id", () => {
  const r = reconcileCount(
    "CHAPTER",
    [
      { provider: "mal", value: 100, malId: 42 },
      { provider: "mangabaka", value: 999, malId: 7 }, // different series -> ignored
    ],
    { malId: 42 },
  );
  assert.equal(r.value, 100);
  assert.equal(r.provider, "mal");
  assert.equal(r.sources.length, 1);
});

test("reconcileCount matches on any shared verified id, not just malId", () => {
  const r = reconcileCount(
    "EPISODE",
    [
      { provider: "mal", value: 24, malId: 1 },
      { provider: "anilist", value: 25, anilistId: 999 },
    ],
    { anilistId: 999 },
  );
  assert.equal(r.value, 25);
  assert.equal(r.provider, "anilist");
});

test("reconcileCount keeps chapters and episodes as separate units", () => {
  const chapters = reconcileCount("CHAPTER", [{ provider: "mal", value: 300, malId: 7 }]);
  const episodes = reconcileCount("EPISODE", [{ provider: "mal", value: 12, malId: 7 }]);
  assert.equal(chapters.unit, "CHAPTER");
  assert.equal(chapters.value, 300);
  assert.equal(episodes.unit, "EPISODE");
  assert.equal(episodes.value, 12);
});
