import type { MediaStatus, MediaType } from "@ambl/types";

/**
 * A single title as rendered by the catalogue UI (Discover + Search) and by the
 * shared title-detail layout. It is intentionally provider-agnostic so a local
 * MangaBaka row, a live MangaBaka result and a MAL/Jikan result can all be
 * rendered by the same components.
 */
export type CatalogSource = "local" | "mangabaka" | "mal" | "anilist";

export interface CatalogItem {
  /** Stable client key, e.g. `mb:123` or `mal:456`. */
  key: string;
  mangabakaId: number | null;
  malId: number | null;
  anilistId: number | null;
  /** Local `titles.id`, when the item has already been saved to the library. */
  titleId: string | null;
  title: string;
  englishTitle: string | null;
  nativeTitle: string | null;
  japaneseTitle: string | null;
  mediaType: MediaType;
  status: MediaStatus | null;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
  coverUrl: string | null;
  /** 0–10. */
  score: number | null;
  chapterCount: number | null;
  volumeCount: number | null;
  episodeCount: number | null;
  synopsis: string | null;
  genres: string[];
  popularity: number | null;
  canonicalUrl: string | null;
  inLibrary: boolean;
  source: CatalogSource;
}

export interface CatalogResult {
  items: CatalogItem[];
  /** Number of local catalogue matches (may be larger than the items shown). */
  count: number;
  page: number;
  totalPages: number;
  localCount: number;
  remoteCount: number;
}

export function catalogKey(input: {
  mangabakaId?: number | null;
  malId?: number | null;
  anilistId?: number | null;
  title?: string | null;
}): string {
  if (input.mangabakaId != null) return `mb:${input.mangabakaId}`;
  if (input.malId != null) return `mal:${input.malId}`;
  if (input.anilistId != null) return `anilist:${input.anilistId}`;
  return `title:${(input.title ?? "unknown").toLowerCase()}`;
}

/** Link to the canonical detail page for an item. */
export function catalogHref(item: CatalogItem): string | null {
  if (item.mangabakaId != null) return `/series/${item.mangabakaId}`;
  if (item.titleId) return `/title/${item.titleId}`;
  return null;
}

/** Shape of a `mangabaka_series` row needed by the catalogue. */
export interface MangabakaRowLike {
  id: number;
  primaryTitle: string;
  englishTitle: string | null;
  nativeTitle: string | null;
  japaneseTitle: string | null;
  mediaType: MediaType | null;
  status: MediaStatus | null;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
  coverUrl: string | null;
  rating: number | null;
  popularity: number | null;
  totalChapters: number | null;
  finalVolume: number | null;
  synopsis: string | null;
  genres: string[] | null;
  malId: number | null;
  anilistId: number | null;
  canonicalUrl: string | null;
}

export function rowToCatalogItem(
  row: MangabakaRowLike,
  opts: { inLibrary?: boolean } = {},
): CatalogItem {
  return {
    key: catalogKey({ mangabakaId: row.id }),
    mangabakaId: row.id,
    malId: row.malId,
    anilistId: row.anilistId,
    titleId: null,
    title: row.primaryTitle,
    englishTitle: row.englishTitle,
    nativeTitle: row.nativeTitle,
    japaneseTitle: row.japaneseTitle,
    mediaType: (row.mediaType ?? "MANGA") as MediaType,
    status: row.status,
    year: row.year,
    startDate: row.startDate,
    endDate: row.endDate,
    coverUrl: row.coverUrl,
    score: row.rating != null ? Math.round(row.rating) / 10 : null,
    chapterCount: row.totalChapters,
    volumeCount: row.finalVolume,
    episodeCount: null,
    synopsis: row.synopsis,
    genres: row.genres ?? [],
    popularity: row.popularity,
    canonicalUrl: row.canonicalUrl,
    inLibrary: opts.inLibrary ?? false,
    source: "local",
  };
}

/** Shape returned by `discoverSeries` / `getMangabakaSeries` mapping. */
export interface DiscoverItemLike {
  id: number;
  title: string;
  nativeTitle: string | null;
  englishTitle: string | null;
  japaneseTitle: string | null;
  mediaType: MediaType;
  status: MediaStatus | null;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
  coverUrl: string | null;
  score: number | null;
  chapterCount: number | null;
  volumeCount: number | null;
  malId: number | null;
  anilistId: number | null;
  canonicalUrl: string | null;
  synopsis: string | null;
  popularity: number | null;
}

export function discoverItemToCatalogItem(
  item: DiscoverItemLike,
  opts: { source?: CatalogSource; inLibrary?: boolean } = {},
): CatalogItem {
  return {
    key: catalogKey({ mangabakaId: item.id }),
    mangabakaId: item.id,
    malId: item.malId,
    anilistId: item.anilistId,
    titleId: null,
    title: item.title,
    englishTitle: item.englishTitle,
    nativeTitle: item.nativeTitle,
    japaneseTitle: item.japaneseTitle,
    mediaType: item.mediaType,
    status: item.status,
    year: item.year,
    startDate: item.startDate,
    endDate: item.endDate,
    coverUrl: item.coverUrl,
    score: item.score,
    chapterCount: item.chapterCount,
    volumeCount: item.volumeCount,
    episodeCount: null,
    synopsis: item.synopsis,
    genres: [],
    popularity: item.popularity,
    canonicalUrl: item.canonicalUrl,
    inLibrary: opts.inLibrary ?? false,
    source: opts.source ?? "mangabaka",
  };
}

/** Shape of a provider `SearchResultItem`. */
export interface SearchItemLike {
  malId: number | null;
  mangabakaId?: number | null;
  anilistId: number | null;
  title: string;
  englishTitle: string | null;
  japaneseTitle: string | null;
  mediaType: MediaType;
  synopsis: string | null;
  status: MediaStatus | null;
  episodeCount: number | null;
  chapterCount: number | null;
  volumeCount: number | null;
  startDate: string | null;
  endDate: string | null;
  year: number | null;
  coverUrl: string | null;
  score: number | null;
  genres: string[];
}

export function searchItemToCatalogItem(
  item: SearchItemLike,
  opts: { source: CatalogSource; titleId?: string | null; inLibrary?: boolean },
): CatalogItem {
  return {
    key: catalogKey({
      mangabakaId: item.mangabakaId ?? null,
      malId: item.malId,
      anilistId: item.anilistId,
      title: item.title,
    }),
    mangabakaId: item.mangabakaId ?? null,
    malId: item.malId,
    anilistId: item.anilistId,
    titleId: opts.titleId ?? null,
    title: item.title,
    englishTitle: item.englishTitle,
    nativeTitle: null,
    japaneseTitle: item.japaneseTitle,
    mediaType: item.mediaType,
    status: item.status,
    year: item.year,
    startDate: item.startDate,
    endDate: item.endDate,
    coverUrl: item.coverUrl,
    score: item.score,
    chapterCount: item.chapterCount,
    volumeCount: item.volumeCount,
    episodeCount: item.episodeCount,
    synopsis: item.synopsis,
    genres: item.genres ?? [],
    popularity: null,
    canonicalUrl: null,
    inLibrary: opts.inLibrary ?? false,
    source: opts.source,
  };
}

export function dedupeCatalog(items: CatalogItem[]): CatalogItem[] {
  const seen = new Set<string>();
  const out: CatalogItem[] = [];
  for (const item of items) {
    const keys = [
      item.mangabakaId != null ? `mb:${item.mangabakaId}` : null,
      item.malId != null ? `mal:${item.malId}` : null,
      item.anilistId != null ? `anilist:${item.anilistId}` : null,
    ].filter((key): key is string => key != null);
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    out.push(item);
  }
  return out;
}
