import { db } from "@/lib/db";
import { mangabakaSeries } from "@ambl/database";
import { desc, asc, eq, and, gte, lte, lt, isNull, or, count, sql } from "drizzle-orm";
import { discoverSeries } from "./mangabaka";
import type { DiscoverItem, DiscoverResult } from "./mangabaka";
import { NEW_WINDOW_YEARS, PROMOTE_CHAPTERS } from "./catalogue-policy";

const PAGE_SIZE = 24;

function parseDiscoverSort(sort: string): { orderBy: any; fallbackSort: string } {
  switch (sort) {
    case "trending":
      return { orderBy: sql`(${mangabakaSeries.popularity1mo} - ${mangabakaSeries.popularity})`, fallbackSort: "trending" };
    case "latest":
      return { orderBy: desc(mangabakaSeries.lastUpdatedAt), fallbackSort: "latest" };
    case "popular":
      return { orderBy: asc(mangabakaSeries.popularity), fallbackSort: "popular" };
    case "rating":
      return { orderBy: desc(mangabakaSeries.rating), fallbackSort: "rating" };
    default:
      return { orderBy: sql`(${mangabakaSeries.popularity1mo} - ${mangabakaSeries.popularity})`, fallbackSort: "trending" };
  }
}

function parseDiscoverFormat(format: string) {
  switch (format) {
    case "MANGA": return "MANGA";
    case "MANHWA": return "MANHWA";
    case "MANHUA": return "MANHUA";
    case "NOVEL": return "LIGHT_NOVEL";
    default: return null;
  }
}

function rowToDiscoverItem(row: any): any {
  return {
    id: row.id,
    title: row.primaryTitle,
    nativeTitle: row.nativeTitle,
    englishTitle: row.englishTitle,
    japaneseTitle: row.japaneseTitle,
    mediaType: row.mediaType,
    status: row.status,
    year: row.year,
    startDate: row.startDate,
    endDate: row.endDate,
    coverUrl: row.coverUrl,
    score: row.rating != null ? Math.round(row.rating) / 10 : null,
    chapterCount: row.totalChapters,
    volumeCount: row.finalVolume,
    malId: row.malId,
    anilistId: row.anilistId,
    canonicalUrl: row.canonicalUrl,
    synopsis: row.synopsis,
    popularity: row.popularity,
  };
}

export async function findDiscover(options: {
  format: string;
  year: number | null;
  sort: string;
  page?: number;
}): Promise<DiscoverResult> {
  const limit = options.page ? PAGE_SIZE : 24;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * limit;

  const { orderBy, fallbackSort } = parseDiscoverSort(options.sort);
  const mediaType = parseDiscoverFormat(options.format);
  const promoteYearFloor = new Date().getFullYear() - NEW_WINDOW_YEARS;

  try {
    const dbInstance = db();

    const conditions = [];
    if (mediaType) {
      conditions.push(eq(mangabakaSeries.mediaType, mediaType));
    }
    if (options.year) {
      conditions.push(eq(mangabakaSeries.year, options.year));
    }
    // Unpromoted recent titles live on /new until they reach the promotion
    // threshold (or age out of the "new" window).
    conditions.push(
      or(
        gte(sql`coalesce(${mangabakaSeries.totalChapters}, 0)`, PROMOTE_CHAPTERS),
        lt(mangabakaSeries.year, promoteYearFloor),
        isNull(mangabakaSeries.year),
      ),
    );
    const where = and(...conditions);

    const countResult = await dbInstance
      .select({ count: count() })
      .from(mangabakaSeries)
      .where(where);
    const totalCount = countResult[0]?.count ?? 0;

    if (totalCount === 0) {
      // Fall back to the live API only when the local catalogue is empty.
      const anyResult = await dbInstance
        .select({ count: count() })
        .from(mangabakaSeries);
      if ((anyResult[0]?.count ?? 0) > 0) {
        return { items: [], count: 0, page, totalPages: 1 };
      }
      throw new Error("No records in database");
    }

    const rows = await dbInstance
      .select()
      .from(mangabakaSeries)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const items = rows.map(rowToDiscoverItem);

    return {
      items,
      count: totalCount,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    };
  } catch (e) {
    console.warn("Database discover failed, falling back to API:", e);
    return discoverSeries({
      format: options.format as any,
      year: options.year,
      sort: fallbackSort as any,
      page,
      limit,
    });
  }
}

/**
 * The "New" feed: recent titles that have not yet reached the promotion
 * threshold (70+ chapters for manga-family). Promoted titles live in Discover;
 * this view exists so freshly added series are still easy to find.
 */
export async function findNewReleases(options: {
  format: string;
  page?: number;
}): Promise<DiscoverResult> {
  const limit = PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * limit;
  const mediaType = parseDiscoverFormat(options.format);
  const yearFloor = new Date().getFullYear() - NEW_WINDOW_YEARS;

  const conditions = [
    lt(sql`coalesce(${mangabakaSeries.totalChapters}, 0)`, PROMOTE_CHAPTERS),
    gte(mangabakaSeries.year, yearFloor),
  ];
  if (mediaType) conditions.push(eq(mangabakaSeries.mediaType, mediaType));
  const where = and(...conditions);

  try {
    const dbInstance = db();
    const countResult = await dbInstance
      .select({ count: count() })
      .from(mangabakaSeries)
      .where(where);
    const totalCount = countResult[0]?.count ?? 0;

    if (totalCount === 0) {
      return { items: [], count: 0, page, totalPages: 1 };
    }

    const rows = await dbInstance
      .select()
      .from(mangabakaSeries)
      .where(where)
      .orderBy(
        desc(mangabakaSeries.year),
        asc(mangabakaSeries.popularity),
        desc(mangabakaSeries.ingestedAt),
      )
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map(rowToDiscoverItem),
      count: totalCount,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    };
  } catch (e) {
    console.warn("Database new-release query failed:", e);
    return { items: [], count: 0, page, totalPages: 1 };
  }
}