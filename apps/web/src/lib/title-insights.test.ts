import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateRemainingTime,
  quickFacts,
  releasePace,
  summariseProgress,
  summariseRankHistory,
} from "./title-insights";

test("summariseRankHistory returns empty shape for no samples", () => {
  const s = summariseRankHistory([{ label: "1d", value: null }]);
  assert.equal(s.best, null);
  assert.equal(s.change1y, null);
  assert.equal(s.samples, 0);
});

test("summariseRankHistory treats a falling number as improving", () => {
  const s = summariseRankHistory([
    { label: "1y", value: 500 },
    { label: "6mo", value: 420 },
    { label: "now", value: 300 },
  ]);
  assert.equal(s.best, 300);
  assert.equal(s.change1y, -200);
  assert.equal(s.improving, true);
  assert.equal(s.samples, 3);
});

test("summariseRankHistory flags regression", () => {
  const s = summariseRankHistory([
    { label: "1y", value: 200 },
    { label: "now", value: 260 },
  ]);
  assert.equal(s.change1y, 60);
  assert.equal(s.improving, false);
});

test("summariseProgress computes percent and remaining", () => {
  assert.deepEqual(summariseProgress(25, 100), {
    percent: 25,
    remaining: 75,
    complete: false,
  });
});

test("summariseProgress marks completion and clamps overflow", () => {
  assert.equal(summariseProgress(120, 100).percent, 100);
  assert.equal(summariseProgress(120, 100).remaining, 0);
  assert.equal(summariseProgress(100, 100).complete, true);
});

test("summariseProgress handles unknown totals", () => {
  assert.deepEqual(summariseProgress(5, null), {
    percent: null,
    remaining: null,
    complete: false,
  });
});

test("estimateRemainingTime scales by unit", () => {
  assert.equal(estimateRemainingTime(6, "CHAPTER"), "~30 min");
  assert.equal(estimateRemainingTime(3, "EPISODE"), "~1 h");
  assert.equal(estimateRemainingTime(2, "EPISODE"), "~48 min");
  assert.equal(estimateRemainingTime(60, "CHAPTER"), "~5 h");
  assert.equal(estimateRemainingTime(0, "CHAPTER"), null);
  assert.equal(estimateRemainingTime(null, "CHAPTER"), null);
});

test("releasePace averages chapters over elapsed years", () => {
  const pace = releasePace(120, "2015-01-01", "2025-01-01");
  assert.ok(pace);
  assert.equal(pace!.years, 10);
  assert.equal(pace!.perYear, 12);
});

test("releasePace declines when too new or missing total", () => {
  assert.equal(releasePace(null, "2020-01-01", null), null);
  assert.equal(releasePace(3, "2026-09-01", "2026-10-01"), null);
});

test("quickFacts omits unknown values", () => {
  const facts = quickFacts({
    mediaType: "MANGA",
    status: "Ongoing",
    year: 2020,
    chapters: null,
    volumes: null,
    score: 8.25,
    rank: 1234,
    pace: { perYear: 12 },
  });
  assert.deepEqual(
    facts.map((f) => f.label),
    ["Status", "Year", "Score", "Global rank", "Pace"],
  );
  assert.equal(facts.find((f) => f.label === "Score")?.value, "8.3 / 10");
});
