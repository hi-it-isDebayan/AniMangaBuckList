import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { titles, userLibrary } from "@ambl/database";
import { getMetadataProvider } from "@ambl/providers";
import type { MediaType } from "@ambl/types";
import { getDb } from "./db";

/** How long title metadata is considered fresh. */
export const METADATA_TTL_HOURS = 6;

/** Keep one refresh bounded so opening the site stays fast. */
const MAX_TITLES_PER_RUN = 8;

/** Jikan allows ~3 requests/second; stay comfortably below it. */
const REQUEST_GAP_MS = 350;

export interface MetadataRefreshResult {
  /** Titles whose metadata was stale and scheduled for a refresh. */
  checked: number;
  /** Titles successfully updated from the provider. */
  refreshed: number;
  /** Titles the provider could not resolve (kept as-is). */
  failed: number;
}

function dateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Refresh metadata for a bounded batch of the user's stale library titles.
 *
 * Called when the app opens (see `MetadataRefresher`). This keeps chapter and
 * episode counts in sync with the upstream providers, so numbers do not drift
 * between visits. It never throws for a single failed title.
 */
export async function refreshStaleLibraryMetadata(
  userId: string,
  options: {
    maxTitles?: number;
    ttlHours?: number;
    mediaTypes?: MediaType[];
  } = {},
): Promise<MetadataRefreshResult> {
  const db = getDb();
  const ttlHours = options.ttlHours ?? METADATA_TTL_HOURS;
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
  const maxTitles = options.maxTitles ?? MAX_TITLES_PER_RUN;

  const libraryTitleIds = db
    .select({ id: userLibrary.titleId })
    .from(userLibrary)
    .where(eq(userLibrary.userId, userId));

  const conditions = [
    inArray(titles.id, libraryTitleIds),
    or(isNull(titles.metadataRefreshedAt), lt(titles.metadataRefreshedAt, cutoff)),
  ];
  if (options.mediaTypes?.length) {
    conditions.push(inArray(titles.mediaType, options.mediaTypes));
  }

  const stale = await db
    .select()
    .from(titles)
    .where(and(...conditions))
    .orderBy(asc(sql`coalesce(${titles.metadataRefreshedAt}, 'epoch')`))
    .limit(maxTitles);

  if (stale.length === 0) {
    return { checked: 0, refreshed: 0, failed: 0 };
  }

  const provider = getMetadataProvider();
  const now = new Date();
  let refreshed = 0;
  let failed = 0;

  for (const title of stale) {
    // Titles without a MAL id can't be refreshed by the configured provider.
    // Mark them checked so they rotate out of the stale queue.
    if (title.malId == null) {
      await db
        .update(titles)
        .set({ metadataRefreshedAt: now, updatedAt: now })
        .where(eq(titles.id, title.id));
      failed += 1;
      continue;
    }

    try {
      const item = await provider.getById(title.malId, title.mediaType);
      if (!item) {
        failed += 1;
        await db
          .update(titles)
          .set({ metadataRefreshedAt: now, updatedAt: now })
          .where(eq(titles.id, title.id));
        continue;
      }

      await db
        .update(titles)
        .set({
          primaryTitle: item.title || title.primaryTitle,
          englishTitle: item.englishTitle ?? undefined,
          japaneseTitle: item.japaneseTitle ?? undefined,
          synopsis: item.synopsis ?? undefined,
          status: item.status ?? undefined,
          startDate: dateOnly(item.startDate),
          endDate: dateOnly(item.endDate),
          season: item.season ?? undefined,
          year: item.year ?? undefined,
          episodeCount: item.episodeCount ?? undefined,
          chapterCount: item.chapterCount ?? undefined,
          volumeCount: item.volumeCount ?? undefined,
          coverUrl: item.coverUrl ?? undefined,
          score: item.score ?? undefined,
          genres: item.genres.length > 0 ? item.genres : undefined,
          metadataRefreshedAt: now,
          updatedAt: now,
        })
        .where(eq(titles.id, title.id));

      refreshed += 1;
    } catch {
      failed += 1;
    }

    await delay(REQUEST_GAP_MS);
  }

  return { checked: stale.length, refreshed, failed };
}
