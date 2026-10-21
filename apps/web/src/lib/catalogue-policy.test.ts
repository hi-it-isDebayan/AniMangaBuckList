import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOGUE_LIMIT,
  PROMOTE_CHAPTERS,
  PROMOTE_EPISODES,
  isPromoted,
  retentionScore,
  sectionFor,
  selectForPrune,
  type CatalogueCandidate,
} from "./catalogue-policy";

const NOW = 2026;

test("manga is promoted at the chapter threshold", () => {
  assert.equal(isPromoted({ mediaType: "MANGA", totalChapters: 69 }), false);
  assert.equal(isPromoted({ mediaType: "MANGA", totalChapters: 70 }), true);
  assert.equal(PROMOTE_CHAPTERS, 70);
});

test("anime is promoted at the episode threshold", () => {
  assert.equal(isPromoted({ mediaType: "ANIME", episodeCount: 4 }), false);
  assert.equal(isPromoted({ mediaType: "ANIME", episodeCount: 5 }), true);
  assert.equal(PROMOTE_EPISODES, 5);
});

test("recent unpromoted titles are NEW, everything else is MAIN", () => {
  assert.equal(sectionFor({ mediaType: "MANGA", totalChapters: 10, year: NOW }, NOW), "NEW");
  assert.equal(
    sectionFor({ mediaType: "MANGA", totalChapters: 10, year: NOW - 1 }, NOW),
    "NEW",
  );
  assert.equal(
    sectionFor({ mediaType: "MANGA", totalChapters: 10, year: NOW - 2 }, NOW),
    "MAIN",
  );
  assert.equal(sectionFor({ mediaType: "MANGA", totalChapters: 90, year: NOW }, NOW), "MAIN");
  assert.equal(sectionFor({ mediaType: "MANGA", totalChapters: 1, year: null }, NOW), "MAIN");
});

test("popular titles outrank old obscure ones", () => {
  const popular = retentionScore({ mediaType: "MANGA", popularity: 100, year: 2001 }, NOW);
  const obscure = retentionScore({ mediaType: "MANGA", popularity: 50_000, year: 2001 }, NOW);
  assert.ok(popular > obscure);
});

test("promoted titles score above everything else", () => {
  const promoted = retentionScore({ mediaType: "MANGA", totalChapters: 200, popularity: 400_000 }, NOW);
  const popular = retentionScore({ mediaType: "MANGA", popularity: 1, totalChapters: 5 }, NOW);
  assert.ok(promoted > popular);
});

test("prune keeps protected and promoted rows", () => {
  const rows: Array<CatalogueCandidate & { id: number }> = [
    { id: 1, mediaType: "MANGA", totalChapters: 120, popularity: 900_000, year: 2000 },
    { id: 2, mediaType: "MANGA", totalChapters: 12, popularity: 900_000, year: 2000 },
    { id: 3, mediaType: "MANGA", totalChapters: 10, popularity: 5000, year: 2024 },
    { id: 4, mediaType: "MANGA", totalChapters: 3, popularity: 700_000, year: 2003 },
    { id: 5, mediaType: "MANGA", totalChapters: 1, popularity: 800_000, year: 2002 },
  ];

  const deleted = selectForPrune(rows, { limit: 3, protectIds: [5], currentYear: NOW });

  assert.deepEqual(deleted.sort((a, b) => a - b), [2, 4]);
});

test("prune is a no-op under the cap", () => {
  const rows = [{ id: 1, mediaType: "MANGA", totalChapters: 1, year: 2000 }];
  assert.deepEqual(selectForPrune(rows, { limit: CATALOGUE_LIMIT, currentYear: NOW }), []);
});
