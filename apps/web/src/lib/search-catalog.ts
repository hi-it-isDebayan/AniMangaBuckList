import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { mangabakaSeries, titles } from "@ambl/database";
import type { MediaType } from "@ambl/types";
import { db } from "./db";
import {
  dedupeCatalog,
  discoverItemToCatalogItem,
  rowToCatalogItem,
  type CatalogItem,
  type CatalogResult,
} from "./catalog";
import {
  searchMangabakaSeries,
  type DiscoverFormat,
  type DiscoverSort,
} from "./mangabaka";

export const SEARCH_PAGE_SIZE = 24;

function formatToMediaType(format: DiscoverFormat): MediaType | null {
  switch (format) {
    case "MANGA":
      return "MANGA";
    case "MANHWA":
      return "MANHWA";
    case "MANHUA":
      return "MANHUA";
    case "NOVEL":
      return "LIGHT_NOVEL";
    default:
      return null;
  }
}

/** Escape Postgres LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function orderForSort(sort: DiscoverSort) {
  switch (sort) {
    case "latest":
      return desc(mangabakaSeries.lastUpdatedAt);
    case "popular":
      return asc(mangabakaSeries.popularity);
    case "rating":
      return sql`${mangabakaSeries.rating} desc nulls last`;
    case "trending":
    default:
      return sql`coalesce(${mangabakaSeries.popularity1mo} - ${mangabakaSeries.popularity}, 2147483647) asc`;
  }
}

export interface SearchCatalogOptions {
  q: string;
  format: DiscoverFormat;
  year: number | null;
  sort: DiscoverSort;
  page?: number;
  limit?: number;
  /** When false, only the local catalogue is queried. */
  includeRemote?: boolean;
}

function buildConditions(q: string, format: DiscoverFormat, year: number | null) {
  const like = `%${escapeLike(q)}%`;
  const conditions = [
    or(
      ilike(mangabakaSeries.primaryTitle, like),
      ilike(mangabakaSeries.englishTitle, like),
      ilike(mangabakaSeries.nativeTitle, like),
      ilike(mangabakaSeries.japaneseTitle, like),
    ),
  ];
  const mediaType = formatToMediaType(format);
  if (mediaType) conditions.push(eq(mangabakaSeries.mediaType, mediaType));
  if (year != null) conditions.push(eq(mangabakaSeries.year, year));
  return and(...conditions);
}

/** Search only the locally-ingested MangaBaka catalogue. */
export async function searchLocalCatalog(
  options: SearchCatalogOptions,
): Promise<CatalogResult> {
  const limit = options.limit ?? SEARCH_PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * limit;
  const q = options.q.trim();
  if (!q) {
    return {
      items: [],
      count: 0,
      page,
      totalPages: 1,
      localCount: 0,
      remoteCount: 0,
    };
  }

  try {
    const instance = db();
    const where = buildConditions(q, options.format, options.year);

    const [{ total }] = await instance
      .select({ total: count() })
      .from(mangabakaSeries)
      .where(where);

    const rows = await instance
      .select()
      .from(mangabakaSeries)
      .where(where)
      .orderBy(orderForSort(options.sort))
      .limit(limit)
      .offset(offset);

    const malIds = rows
      .map((row) => row.malId)
      .filter((id): id is number => id != null);
    const known = new Map<number, string>();
    if (malIds.length > 0) {
      const knownRows = await instance
        .select({ id: titles.id, malId: titles.malId })
        .from(titles)
        .where(inArray(titles.malId, malIds));
      for (const row of knownRows) {
        if (row.malId != null && !known.has(row.malId)) known.set(row.malId, row.id);
      }
    }

    const items = rows.map((row) => {
      const item = rowToCatalogItem(row);
      const titleId = row.malId != null ? known.get(row.malId) ?? null : null;
      return { ...item, titleId, inLibrary: titleId != null };
    });

    return {
      items,
      count: total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      localCount: total,
      remoteCount: 0,
    };
  } catch (error) {
    console.warn("Local catalogue search failed:", error);
    return {
      items: [],
      count: 0,
      page,
      totalPages: 1,
      localCount: 0,
      remoteCount: 0,
    };
  }
}

/**
 * Hybrid search: the local catalogue is authoritative, and MangaBaka's live API
 * only fills the remaining slots with titles that have not been ingested yet.
 */
export async function searchCatalog(
  options: SearchCatalogOptions,
): Promise<CatalogResult> {
  const limit = options.limit ?? SEARCH_PAGE_SIZE;
  const local = await searchLocalCatalog({ ...options, limit });

  if (options.includeRemote === false || local.items.length >= limit) {
    return local;
  }

  const remote = await searchMangabakaSeries(options.q, {
    format: options.format,
    year: options.year,
    limit: limit - local.items.length,
    page: 1,
  });
  if (remote.items.length === 0) return local;

  const merged = dedupeCatalog([
    ...local.items,
    ...remote.items.map((item) =>
      discoverItemToCatalogItem(item, { source: "mangabaka" }),
    ),
  ]);

  return {
    ...local,
    items: merged.slice(0, limit),
    remoteCount: Math.max(0, merged.length - local.items.length),
  };
}

/**
 * Convenience used by the command palette: local matches first, then live
 * MangaBaka results for anything not in the catalogue.
 */
export async function searchCatalogItems(
  q: string,
  options: { limit?: number; source?: string } = {},
): Promise<CatalogItem[]> {
  const limit = options.limit ?? 12;
  const result = await searchCatalog({
    q,
    format: "ALL",
    year: null,
    sort: "trending",
    page: 1,
    limit,
    includeRemote: options.source !== "local",
  });
  return result.items;
}
