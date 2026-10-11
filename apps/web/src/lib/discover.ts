import { db } from "@/lib/db";
import { mangabakaSeries } from "@ambl/database";
import { desc, asc, eq, and, gte, lte, count, sql } from "drizzle-orm";
import { discoverSeries } from "./mangabaka";
import type { DiscoverItem, DiscoverResult } from "./mangabaka";

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

  try {
    const dbInstance = db();
    
    let countResult;
    if (mediaType && options.year) {
      countResult = await dbInstance
        .select({ count: count() })
        .from(mangabakaSeries)
        .where(and(
          eq(mangabakaSeries.mediaType, mediaType),
          eq(mangabakaSeries.year, options.year)
        ));
    } else if (mediaType) {
      countResult = await dbInstance
        .select({ count: count() })
        .from(mangabakaSeries)
        .where(eq(mangabakaSeries.mediaType, mediaType));
    } else if (options.year) {
      countResult = await dbInstance
        .select({ count: count() })
        .from(mangabakaSeries)
        .where(eq(mangabakaSeries.year, options.year));
    } else {
      countResult = await dbInstance
        .select({ count: count() })
        .from(mangabakaSeries);
    }

    const totalCount = countResult[0]?.count ?? 0;
    
    if (totalCount === 0) {
      throw new Error("No records in database");
    }

    let query = dbInstance
      .select()
      .from(mangabakaSeries);

    const conditions = [];
    if (mediaType) {
      conditions.push(eq(mangabakaSeries.mediaType, mediaType));
    }
    if (options.year) {
      conditions.push(eq(mangabakaSeries.year, options.year));
    }

    const itemsQuery = dbInstance
      .select()
      .from(mangabakaSeries)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const rows = await itemsQuery;
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