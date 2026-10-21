/**
 * Per-source usage statistics.
 *
 * "Usage" is derived from `browse_history` (the extension/Android apps record a
 * row for every page a signed-in user opens) and `progress_history.source_url`.
 * Both carry a site/host, so we can bucket activity by the canonical source
 * domain and month without any extra tracking tables.
 *
 * Pure bucketing helpers live in `./usage-core`; this module only does the SQL.
 * Server-only — do not import it into client components.
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { browseHistory, progressHistory, sources } from "@ambl/database";
import { getDb } from "@/lib/db";
import {
  applyBuckets,
  bumpBucket,
  emptyUsage,
  recentMonths,
  sourceUsageKeys,
  USAGE_MONTHS_BACK,
  type SourceUsage,
} from "./usage-core";

export type { MonthlyUsage, SourceUsage } from "./usage-core";
export { recentMonths, usageKey } from "./usage-core";

/** First day of the oldest month in the window (UTC). */
function windowStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (USAGE_MONTHS_BACK - 1), 1));
}

type UsageRow = { id: string; domain: string; homepageUrl: string };

/**
 * Load monthly usage for a set of sources in two grouped queries total,
 * regardless of how many sources exist.
 */
export async function loadSourceUsage(
  sourceRows: UsageRow[],
  now = new Date(),
): Promise<Map<string, SourceUsage>> {
  const months = recentMonths(now);
  const since = windowStart(now);
  const result = new Map<string, SourceUsage>();
  for (const row of sourceRows) result.set(row.id, emptyUsage(months));
  if (sourceRows.length === 0) return result;

  const db = getDb();
  const [browseBuckets, progressBuckets] = await Promise.all([
    db
      .select({
        site: browseHistory.site,
        url: browseHistory.url,
        month: sql<string>`to_char(date_trunc('month', ${browseHistory.visitedAt}), 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(browseHistory)
      .where(gte(browseHistory.visitedAt, since))
      .groupBy(
        browseHistory.site,
        browseHistory.url,
        sql`date_trunc('month', ${browseHistory.visitedAt})`,
      ),
    db
      .select({
        sourceUrl: progressHistory.sourceUrl,
        month: sql<string>`to_char(date_trunc('month', ${progressHistory.createdAt}), 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(progressHistory)
      .where(gte(progressHistory.createdAt, since))
      .groupBy(progressHistory.sourceUrl, sql`date_trunc('month', ${progressHistory.createdAt})`),
  ]);

  const byHost = new Map<string, Map<string, number>>();
  for (const bucket of browseBuckets) {
    // Prefer the explicit site column, fall back to the URL host when it is null.
    bumpBucket(byHost, bucket.site ?? bucket.url, bucket.month, Number(bucket.count));
  }
  for (const bucket of progressBuckets) {
    bumpBucket(byHost, bucket.sourceUrl, bucket.month, Number(bucket.count));
  }

  for (const source of sourceRows) {
    const usage = result.get(source.id);
    if (usage) applyBuckets(usage, sourceUsageKeys(source), byHost);
  }
  return result;
}

/** Number of visits a single signed-in user logged against each source. */
export async function loadUserSourceUsage(
  userId: string,
  sourceRows: UsageRow[],
  now = new Date(),
): Promise<Map<string, SourceUsage>> {
  const months = recentMonths(now);
  const since = windowStart(now);
  const result = new Map<string, SourceUsage>();
  for (const row of sourceRows) result.set(row.id, emptyUsage(months));
  if (sourceRows.length === 0) return result;

  const rows = await getDb()
    .select({
      site: browseHistory.site,
      url: browseHistory.url,
      month: sql<string>`to_char(date_trunc('month', ${browseHistory.visitedAt}), 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
    })
    .from(browseHistory)
    .where(and(eq(browseHistory.userId, userId), gte(browseHistory.visitedAt, since)))
    .groupBy(
      browseHistory.site,
      browseHistory.url,
      sql`date_trunc('month', ${browseHistory.visitedAt})`,
    );

  const byHost = new Map<string, Map<string, number>>();
  for (const bucket of rows) {
    bumpBucket(byHost, bucket.site ?? bucket.url, bucket.month, Number(bucket.count));
  }

  for (const source of sourceRows) {
    const usage = result.get(source.id);
    if (usage) applyBuckets(usage, sourceUsageKeys(source), byHost);
  }
  return result;
}

/** Convenience wrapper that also fetches the visible source rows. */
export async function loadAllSourceUsage(now = new Date()): Promise<Map<string, SourceUsage>> {
  const rows = await getDb()
    .select({ id: sources.id, domain: sources.domain, homepageUrl: sources.homepageUrl })
    .from(sources)
    .orderBy(desc(sources.updatedAt))
    .limit(500);
  return loadSourceUsage(rows, now);
}
