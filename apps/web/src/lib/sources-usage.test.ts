/**
 * Tests for the pure helpers behind per-source usage stats. The SQL aggregation
 * itself is exercised in integration/manual testing; here we lock down the key
 * normalization, month window math, and histogram folding.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyBuckets,
  bumpBucket,
  emptyUsage,
  recentMonths,
  sourceUsageKeys,
  usageKey,
} from "./sources/usage-core";

test("usageKey canonicalizes www, casing and trailing dots", () => {
  assert.equal(usageKey("WWW.AsuraComic.net."), "asuracomic.net");
  assert.equal(usageKey("m.mangadex.org"), "mangadex.org");
  assert.equal(usageKey("https://asuracomic.net"), "asuracomic.net");
});

test("usageKey returns null for empty input", () => {
  assert.equal(usageKey(null), null);
  assert.equal(usageKey(""), null);
});

test("two variants of one site collapse to the same key", () => {
  assert.equal(usageKey("www.asuracomic.net"), usageKey("https://asuracomic.net/series/x"));
});

test("recentMonths ends on the current month and is oldest-first", () => {
  const months = recentMonths(new Date(Date.UTC(2026, 9, 21)), 6);
  assert.deepEqual(months, ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
});

test("recentMonths rolls back across a year boundary", () => {
  const months = recentMonths(new Date(Date.UTC(2026, 1, 3)), 6);
  assert.deepEqual(months, ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("sourceUsageKeys includes both the domain and the homepage host once", () => {
  const keys = sourceUsageKeys({
    domain: "asuracomic.net",
    homepageUrl: "https://www.asuracomic.net/",
  });
  assert.deepEqual(keys, ["asuracomic.net"]);
});

test("applyBuckets sums matching hosts and fills the histogram", () => {
  const months = recentMonths(new Date(Date.UTC(2026, 9, 21)), 6);
  const usage = emptyUsage(months);
  const byHost = new Map<string, Map<string, number>>();
  bumpBucket(byHost, "asuracomic.net", "2026-09", 3);
  bumpBucket(byHost, "www.asuracomic.net", "2026-09", 2);
  bumpBucket(byHost, "https://asuracomic.net/series/one", "2026-10", 4);

  applyBuckets(usage, ["asuracomic.net"], byHost);

  assert.equal(usage.total, 9);
  assert.equal(usage.currentMonth, 4);
  assert.equal(usage.previousMonth, 5);
  assert.deepEqual(
    usage.monthly.map((point) => point.count),
    [0, 0, 0, 0, 5, 4],
  );
});

test("applyBuckets ignores months outside the window", () => {
  const months = recentMonths(new Date(Date.UTC(2026, 9, 21)), 6);
  const usage = emptyUsage(months);
  const byHost = new Map<string, Map<string, number>>();
  bumpBucket(byHost, "asuracomic.net", "2020-01", 99);

  applyBuckets(usage, ["asuracomic.net"], byHost);

  assert.equal(usage.total, 0);
});

test("unrelated hosts do not leak into a source's usage", () => {
  const months = recentMonths(new Date(Date.UTC(2026, 9, 21)), 6);
  const usage = emptyUsage(months);
  const byHost = new Map<string, Map<string, number>>();
  bumpBucket(byHost, "mangadex.org", "2026-10", 7);

  applyBuckets(usage, ["asuracomic.net"], byHost);

  assert.equal(usage.total, 0);
});
