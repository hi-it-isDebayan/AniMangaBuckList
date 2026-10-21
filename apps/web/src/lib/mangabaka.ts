import type { MediaStatus, MediaType } from "@ambl/types";

const API = "https://api.mangabaka.org";
const REVALIDATE_SECONDS = 1800;

export type DiscoverFormat = "ALL" | "MANGA" | "MANHWA" | "MANHUA" | "NOVEL";
export type DiscoverSort = "trending" | "latest" | "popular" | "rating";

export const DISCOVER_FORMATS: { key: DiscoverFormat; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "MANGA", label: "Manga" },
  { key: "MANHWA", label: "Manhwa" },
  { key: "MANHUA", label: "Manhua" },
  { key: "NOVEL", label: "Novel" },
];

export const DISCOVER_SORTS: { key: DiscoverSort; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "latest", label: "New" },
  { key: "popular", label: "Popular" },
  { key: "rating", label: "Top rated" },
];

/** Catalogue years, newest first (2026 → 2000). */
export const DISCOVER_YEARS: readonly number[] = Array.from(
  { length: 27 },
  (_, index) => 2026 - index,
);

const FORMAT_TO_TYPE: Record<Exclude<DiscoverFormat, "ALL">, string> = {
  MANGA: "manga",
  MANHWA: "manhwa",
  MANHUA: "manhua",
  NOVEL: "novel",
};

const SORT_TO_TOKEN: Record<DiscoverSort, string> = {
  trending: "trending_7d",
  latest: "latest",
  popular: "popularity_asc",
  rating: "score_desc",
};

export interface DiscoverItem {
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

export interface DiscoverResult {
  items: DiscoverItem[];
  count: number;
  page: number;
  totalPages: number;
}

interface MangabakaTitleRow {
  language?: string | null;
  title: string;
  is_primary?: boolean | null;
  traits?: string[] | null;
}

export interface MangabakaSeries {
  id: number;
  type?: string | null;
  status?: string | null;
  original_language?: string | null;
  rating?: number | null;
  description?: string | null;
  canonical_url?: string | null;
  published?: { start_date?: string | null; end_date?: string | null } | null;
  source?: Record<string, { id?: number | string | null } | null> | null;
  cover?: {
    x150?: string | null;
    x250?: string | null;
    x350?: string | null;
    raw?: string | null;
  } | null;
  titles?: MangabakaTitleRow[] | null;
  total_chapters?: number | null;
  final_volume?: number | null;
  popularity?: { global?: { current?: number | null } | null } | null;
}

interface SearchResponse {
  data?: MangabakaSeries[];
  pagination?: { count?: number; page?: number } | null;
}

function apiHeaders(): Record<string, string> {
  const key = process.env.MANGABAKA_API_KEY?.trim();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["x-api-key"] = key;
  return headers;
}

export function formatToMediaType(format: DiscoverFormat, fallbackType?: string | null): MediaType {
  if (format !== "ALL") {
    switch (format) {
      case "MANGA":
        return "MANGA";
      case "MANHWA":
        return "MANHWA";
      case "MANHUA":
        return "MANHUA";
      case "NOVEL":
        return "WEB_NOVEL";
    }
  }
  return typeToMediaType(fallbackType);
}

export function typeToMediaType(type?: string | null): MediaType {
  switch (type?.toLowerCase()) {
    case "manhwa":
      return "MANHWA";
    case "manhua":
      return "MANHUA";
    case "novel":
      return "WEB_NOVEL";
    default:
      return "MANGA";
  }
}

function mapStatus(status?: string | null): MediaStatus | null {
  switch (status?.toLowerCase()) {
    case "releasing":
    case "ongoing":
      return "ONGOING";
    case "completed":
    case "finished":
      return "FINISHED";
    case "hiatus":
    case "on_hiatus":
      return "HIATUS";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "announced":
    case "not_yet_released":
    case "upcoming":
    case "unreleased":
      return "NOT_YET_RELEASED";
    default:
      return null;
  }
}

function parseYear(date?: string | null): number | null {
  if (!date) return null;
  const match = /^(\d{4})/.exec(date);
  return match ? Number(match[1]) : null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function toDiscoverItem(series: MangabakaSeries): DiscoverItem {
  const titles = (series.titles ?? []).filter((t) => t?.title);
  const english =
    titles.find((t) => /^en(\b|-)/i.test(t.language ?? ""))?.title ?? null;
  const native =
    titles.find((t) => (t.traits ?? []).includes("native"))?.title ??
    titles.find((t) => t.language === series.original_language)?.title ??
    null;
  const japanese = titles.find((t) => (t.language ?? "").startsWith("ja"))?.title ?? null;
  const primary = titles.find((t) => t.is_primary)?.title ?? titles[0]?.title ?? null;
  const title = english ?? primary ?? `MangaBaka #${series.id}`;

  const malId = num(series.source?.my_anime_list?.id);
  const anilistId = num(series.source?.anilist?.id);

  return {
    id: series.id,
    title,
    nativeTitle: native && native !== title ? native : null,
    englishTitle: english,
    japaneseTitle: japanese && japanese !== title ? japanese : null,
    mediaType: typeToMediaType(series.type),
    status: mapStatus(series.status),
    year: parseYear(series.published?.start_date),
    startDate: series.published?.start_date ?? null,
    endDate: series.published?.end_date ?? null,
    coverUrl:
      series.cover?.x250 ?? series.cover?.x350 ?? series.cover?.raw ?? series.cover?.x150 ?? null,
    score: series.rating != null ? Math.round(series.rating) / 10 : null,
    chapterCount: num(series.total_chapters),
    volumeCount: num(series.final_volume),
    malId,
    anilistId,
    canonicalUrl: series.canonical_url ?? null,
    synopsis: series.description?.trim() || null,
    popularity: num(series.popularity?.global?.current),
  };
}

export async function discoverSeries(options: {
  format: DiscoverFormat;
  year: number | null;
  sort: DiscoverSort;
  page?: number;
  limit?: number;
}): Promise<DiscoverResult> {
  const limit = options.limit ?? 24;
  const page = Math.max(1, options.page ?? 1);

  const params = new URLSearchParams();
  if (options.format !== "ALL") params.set("type", FORMAT_TO_TYPE[options.format]);
  params.set("sort_by", SORT_TO_TOKEN[options.sort]);
  params.set("limit", String(limit));
  params.set("page", String(page));
  if (options.year != null) {
    params.set("published_start_date_lower", String(options.year));
    params.set("published_start_date_upper", String(options.year));
  }
  params.append("content_rating", "safe");
  params.append("content_rating", "suggestive");

  try {
    const res = await fetch(`${API}/v2/series/search?${params.toString()}`, {
      headers: apiHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      return { items: [], count: 0, page, totalPages: 1 };
    }
    const json = (await res.json()) as SearchResponse;
    const count = json.pagination?.count ?? 0;
    const items = (json.data ?? []).map(toDiscoverItem);
    return {
      items,
      count,
      page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    };
  } catch {
    return { items: [], count: 0, page, totalPages: 1 };
  }
}

/**
 * Live MangaBaka text search. Used as the fallback when a query has no (or not
 * enough) matches in the local `mangabaka_series` catalogue.
 */
export async function searchMangabakaSeries(
  query: string,
  options: {
    format?: DiscoverFormat | null;
    year?: number | null;
    limit?: number;
    page?: number;
  } = {},
): Promise<DiscoverResult> {
  const limit = options.limit ?? 24;
  const page = Math.max(1, options.page ?? 1);
  const q = query.trim();
  if (!q) return { items: [], count: 0, page, totalPages: 1 };

  const params = new URLSearchParams();
  params.set("q", q);
  if (options.format && options.format !== "ALL") {
    params.set("type", FORMAT_TO_TYPE[options.format]);
  }
  params.set("limit", String(limit));
  params.set("page", String(page));
  if (options.year != null) {
    params.set("published_start_date_lower", String(options.year));
    params.set("published_start_date_upper", String(options.year));
  }
  params.append("content_rating", "safe");
  params.append("content_rating", "suggestive");

  try {
    const res = await fetch(`${API}/v2/series/search?${params.toString()}`, {
      headers: apiHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return { items: [], count: 0, page, totalPages: 1 };
    const json = (await res.json()) as SearchResponse;
    const count = json.pagination?.count ?? 0;
    return {
      items: (json.data ?? []).map(toDiscoverItem),
      count,
      page,
      totalPages: Math.max(1, Math.ceil(count / limit)),
    };
  } catch {
    return { items: [], count: 0, page, totalPages: 1 };
  }
}

export async function getMangabakaSeries(id: number): Promise<MangabakaSeries | null> {
  try {
    const res = await fetch(`${API}/v2/series/${id}`, {
      headers: apiHeaders(),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: MangabakaSeries };
    return json.data ?? null;
  } catch {
    return null;
  }
}
