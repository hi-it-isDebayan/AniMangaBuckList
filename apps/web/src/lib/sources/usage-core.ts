/**
 * Pure helpers for per-source usage statistics.
 *
 * Kept free of database/`@/*` imports so they can be unit-tested directly from
 * the repo root (where `tsx` does not resolve the app's path aliases).
 */
import { canonicalDomain } from "./domain";
import { normalizeHost } from "./extractors";

export const USAGE_MONTHS_BACK = 6;

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The ordered month keys we render, ending with the current month. */
export function recentMonths(now = new Date(), months = USAGE_MONTHS_BACK): string[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

/**
 * Canonical key for a raw `browse_history.site` value (a bare host) or a full
 * URL (as stored in `progress_history.source_url`). Variants of the same site
 * collapse together; anything unparseable returns null.
 */
export function usageKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Full URLs land here from source_url; pull the hostname out first.
  let candidate = trimmed;
  if (trimmed.includes("://") || trimmed.startsWith("//")) {
    try {
      candidate = new URL(trimmed.includes("://") ? trimmed : `https:${trimmed}`).hostname;
    } catch {
      return null;
    }
  } else if (trimmed.includes("/")) {
    // A path without a scheme, e.g. "asuracomic.net/series/one".
    candidate = trimmed.slice(0, trimmed.indexOf("/"));
  }

  const host = normalizeHost(candidate);
  if (!host) return null;
  return canonicalDomain(host) ?? host;
}

/**
 * Every usage key a source row should be matched by. Both the canonical domain
 * and the homepage host are considered so historical rows recorded under either
 * form still count.
 */
export function sourceUsageKeys(source: { domain: string; homepageUrl: string }): string[] {
  const keys = new Set<string>();
  const domain = usageKey(source.domain);
  if (domain) keys.add(domain);
  const homepage = usageKey(source.homepageUrl);
  if (homepage) keys.add(homepage);
  return [...keys];
}

export interface MonthlyUsage {
  /** `YYYY-MM`, oldest first. */
  month: string;
  count: number;
}

export interface SourceUsage {
  /** Total recorded visits across the whole window. */
  total: number;
  /** Visits in the most recent calendar month. */
  currentMonth: number;
  /** Visits in the previous calendar month (used for the trend delta). */
  previousMonth: number;
  /** Fixed-length monthly histogram, oldest first. */
  monthly: MonthlyUsage[];
}

export function emptyUsage(months: string[]): SourceUsage {
  return {
    total: 0,
    currentMonth: 0,
    previousMonth: 0,
    monthly: months.map((month) => ({ month, count: 0 })),
  };
}

/**
 * Fold `(host -> month -> count)` buckets onto an existing usage record. Exposed
 * separately from the SQL so both the global and per-user loaders share it.
 */
export function applyBuckets(
  usage: SourceUsage,
  keys: string[],
  byHost: Map<string, Map<string, number>>,
): void {
  const merged = new Map<string, number>();
  for (const key of keys) {
    const bucket = byHost.get(key);
    if (!bucket) continue;
    for (const [month, count] of bucket) merged.set(month, (merged.get(month) ?? 0) + count);
  }

  let total = 0;
  for (const point of usage.monthly) {
    const count = merged.get(point.month) ?? 0;
    point.count = count;
    total += count;
  }
  usage.total = total;
  usage.currentMonth = merged.get(usage.monthly[usage.monthly.length - 1]!.month) ?? 0;
  usage.previousMonth = usage.monthly[usage.monthly.length - 2]
    ? (merged.get(usage.monthly[usage.monthly.length - 2]!.month) ?? 0)
    : 0;
}

/** Increment a `host -> month -> count` bucket map. */
export function bumpBucket(
  byHost: Map<string, Map<string, number>>,
  rawHost: string | null | undefined,
  month: string,
  count: number,
): void {
  const key = usageKey(rawHost);
  if (!key) return;
  const bucket = byHost.get(key) ?? new Map<string, number>();
  bucket.set(month, (bucket.get(month) ?? 0) + count);
  byHost.set(key, bucket);
}
