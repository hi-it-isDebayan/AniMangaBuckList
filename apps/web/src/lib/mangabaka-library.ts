import { and, eq, sql } from "drizzle-orm";
import { titles } from "@ambl/database";
import type { MediaType } from "@ambl/types";
import { getDb } from "./db";
import {
  anilistLink,
  findTitleIdByAnyLink,
  linkExternalIds,
  malProviderKey,
  mangabakaLink,
  type ExternalIdLink,
} from "./external-ids";
import type { DiscoverItem } from "./mangabaka";

export interface EnsureTitleResult {
  titleId: string;
  /** True when this call created a brand new `titles` row. */
  created: boolean;
  mediaType: MediaType;
}

type LinkableItem = Pick<
  DiscoverItem,
  "id" | "mediaType" | "malId" | "anilistId"
>;

/** External-id links that identify a MangaBaka discover item everywhere. */
export function mangabakaExternalLinks(item: LinkableItem): ExternalIdLink[] {
  return [
    mangabakaLink(item.id),
    { provider: malProviderKey(item.mediaType), externalId: item.malId },
    anilistLink(item.anilistId),
  ];
}

/**
 * Resolve a MangaBaka discover item to a local `titles` row, creating the row
 * when it does not exist yet.
 *
 * New rows are persisted with `source = "MANGABAKA"` so later metadata
 * refreshes keep flowing through the MangaBaka provider instead of MAL.
 * Resolution order:
 *   1. any known external id (mangabaka/mal/anilist),
 *   2. an existing row with the same MAL id,
 *   3. an existing MangaBaka row with the same normalised title + media type,
 *   4. otherwise insert a new MangaBaka-sourced row.
 */
export async function ensureMangabakaTitle(
  item: DiscoverItem,
): Promise<EnsureTitleResult> {
  const db = getDb();
  const links = mangabakaExternalLinks(item);

  let titleId: string | null = await findTitleIdByAnyLink(links);
  let created = false;

  if (!titleId && item.malId != null) {
    const existing = await db
      .select({ id: titles.id })
      .from(titles)
      .where(eq(titles.malId, item.malId))
      .limit(1);
    titleId = existing[0]?.id ?? null;
  }

  if (!titleId) {
    const existing = await db
      .select({ id: titles.id })
      .from(titles)
      .where(
        and(
          eq(titles.source, "MANGABAKA"),
          eq(titles.mediaType, item.mediaType),
          sql`lower(${titles.primaryTitle}) = lower(${item.title})`,
        ),
      )
      .limit(2);
    if (existing.length === 1) titleId = existing[0]!.id;
  }

  if (!titleId) {
    const inserted = await db
      .insert(titles)
      .values({
        source: "MANGABAKA",
        malId: item.malId,
        primaryTitle: item.title,
        englishTitle: item.englishTitle,
        japaneseTitle: item.japaneseTitle,
        mediaType: item.mediaType,
        synopsis: item.synopsis,
        status: item.status,
        startDate: item.startDate,
        endDate: item.endDate,
        year: item.year,
        chapterCount: item.chapterCount,
        volumeCount: item.volumeCount,
        coverUrl: item.coverUrl,
        score: item.score,
        metadataRefreshedAt: new Date(),
      })
      .returning({ id: titles.id });
    titleId = inserted[0]!.id;
    created = true;
  }

  await linkExternalIds(titleId, links);

  return { titleId, created, mediaType: item.mediaType };
}
