import { sql, type SQL } from "drizzle-orm";
import { mangabakaSeries, mediaTypeEnum } from "./schema";
import { getDb } from "./db";

type MediaTypeKey = Exclude<(typeof mediaTypeEnum.enumValues)[number], "ANIME">;

const MB_TYPE_TO_MEDIA: Record<string, MediaTypeKey> = {
  manga: "MANGA",
  manhwa: "MANHWA",
  manhua: "MANHUA",
  novel: "LIGHT_NOVEL",
  light_novel: "LIGHT_NOVEL",
  web_novel: "WEB_NOVEL",
  oel: "MANGA",
  other: "MANGA",
};

const MB_STATUS_TO_STATUS: Record<
  string,
  "FINISHED" | "ONGOING" | "HIATUS" | "CANCELLED" | "NOT_YET_RELEASED"
> = {
  releasing: "ONGOING",
  ongoing: "ONGOING",
  publishing: "ONGOING",
  completed: "FINISHED",
  finished: "FINISHED",
  hiatus: "HIATUS",
  on_hiatus: "HIATUS",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  announced: "NOT_YET_RELEASED",
  upcoming: "NOT_YET_RELEASED",
  unreleased: "NOT_YET_RELEASED",
  not_yet_released: "NOT_YET_RELEASED",
  planned: "NOT_YET_RELEASED",
};

export interface MangabakaSeries {
  id?: number;
  type?: string;
  state?: string;
  status?: string;
  year?: number | null;
  title?: string;
  native_title?: string;
  romanized_title?: string;
  secondary_titles?: string[];
  titles?: {
    language?: string;
    title?: string;
    is_primary?: boolean;
    traits?: string[];
  }[];
  description?: string | null;
  published?: {
    start_date?: string | null;
    end_date?: string | null;
  } | null;
  content_rating?: string | null;
  is_licensed?: boolean;
  has_anime?: boolean;
  original_language?: string | null;
  rating?: number | null;
  popularity?: {
    global?: {
      current?: number | null;
      history?: {
        "1d"?: number | null;
        "1w"?: number | null;
        "1mo"?: number | null;
        "3mo"?: number | null;
        "6mo"?: number | null;
        "1y"?: number | null;
      } | null;
    } | null;
  } | null;
  source?: Record<string, { id?: number | string | null } | null> | null;
  cover?: { raw?: { url?: string } | string | null } | null;
  canonical_url?: string | null;
  genres?: string[] | null;
  tags?: string[] | null;
  authors?: string[] | null;
  artists?: string[] | null;
  publishers?: { id?: number; name?: string; language?: string | null }[] | null;
  total_chapters?: number | string | null;
  final_volume?: number | string | null;
  final_chapter?: number | string | null;
  last_updated_at?: string | null;
}

export type MangabakaSeriesInsert = typeof mangabakaSeries.$inferInsert;

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export function toMangabakaSeriesRow(root: MangabakaSeries): MangabakaSeriesInsert {
  const mediaType =
    (MB_TYPE_TO_MEDIA[root.type?.toLowerCase() ?? ""] as MediaTypeKey | undefined) ??
    null;
  const status =
    (MB_STATUS_TO_STATUS[root.status?.toLowerCase() ?? ""] as
      | "FINISHED"
      | "ONGOING"
      | "HIATUS"
      | "CANCELLED"
      | "NOT_YET_RELEASED"
      | undefined) ?? null;

  const titles = (root.titles ?? []).filter((t) => t?.title);
  const english =
    titles.find((t) => (t.language ?? "").toLowerCase().startsWith("en"))?.title ??
    root.romanized_title ??
    null;
  const primary =
    root.title ??
    titles.find((t) => t.is_primary)?.title ??
    titles[0]?.title ??
    null;
  const native =
    root.native_title ??
    titles.find((t) => (t.traits ?? []).includes("native"))?.title ??
    null;
  const japanese =
    titles.find((t) => (t.language ?? "").toLowerCase().startsWith("ja"))?.title ??
    null;

  const coverRaw =
    typeof root.cover?.raw === "string"
      ? root.cover.raw
      : (root.cover?.raw as { url?: string } | undefined)?.url ?? null;

  const global = root.popularity?.global;
  const history = global?.history ?? {};

  const year = num(root.year) ? Number(root.year) : null;

  return {
    id: num(root.id) ?? 0,
    mediaType,
    state: root.state || "active",
    primaryTitle: primary ?? `MangaBaka #${root.id}`,
    englishTitle: english && english !== primary ? english : null,
    nativeTitle: native && native !== primary ? native : null,
    japaneseTitle: japanese && japanese !== primary ? japanese : null,
    synopsis: root.description?.trim() || null,
    status,
    startDate: root.published?.start_date || null,
    endDate: root.published?.end_date || null,
    year: year ?? (root.published?.start_date ? Number(root.published.start_date.slice(0, 4)) : null),
    coverUrl: coverRaw,
    rating:
      root.rating != null && Number.isFinite(Number(root.rating))
        ? Number(root.rating)
        : null,
    popularity: num(global?.current),
    popularity1d: num(history["1d"]),
    popularity1w: num(history["1w"]),
    popularity1mo: num(history["1mo"]),
    popularity3mo: num(history["3mo"]),
    popularity6mo: num(history["6mo"]),
    popularity1y: num(history["1y"]),
    genres: root.genres?.filter(Boolean) ?? [],
    tags: root.tags?.length ? root.tags : null,
    authors: root.authors?.filter(Boolean) ?? [],
    artists: root.artists?.filter(Boolean) ?? [],
    publishers: root.publishers?.length
      ? root.publishers.map((p) => ({
          id: num(p.id) ?? 0,
          name: p.name ?? "",
          language: p.language ?? null,
        }))
      : null,
    malId: num(root.source?.my_anime_list?.id),
    anilistId: num(root.source?.anilist?.id),
    totalChapters: num(root.total_chapters),
    finalVolume: num(root.final_volume),
    contentRating: root.content_rating || null,
    isLicensed: !!root.is_licensed,
    hasAnime: !!root.has_anime,
    canonicalUrl: root.canonical_url || null,
    lastUpdatedAt: root.last_updated_at ? new Date(root.last_updated_at) : null,
  };
}

const UPSERT_COLUMNS = [
  "mediaType",
  "state",
  "primaryTitle",
  "englishTitle",
  "nativeTitle",
  "japaneseTitle",
  "synopsis",
  "status",
  "startDate",
  "endDate",
  "year",
  "coverUrl",
  "rating",
  "popularity",
  "popularity1d",
  "popularity1w",
  "popularity1mo",
  "popularity3mo",
  "popularity6mo",
  "popularity1y",
  "genres",
  "tags",
  "authors",
  "artists",
  "publishers",
  "malId",
  "anilistId",
  "totalChapters",
  "finalVolume",
  "contentRating",
  "isLicensed",
  "hasAnime",
  "canonicalUrl",
  "lastUpdatedAt",
] as const;

function snakeCase(col: string): string {
  return col.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

type InsertKey = keyof MangabakaSeriesInsert;

const upsertSet = Object.fromEntries(
  UPSERT_COLUMNS.map((col) => [col, sql`excluded.${sql.raw(snakeCase(col))}`]),
) as Partial<Record<InsertKey, SQL<unknown>>>;

export async function upsertMangabakaSeries(
  db: ReturnType<typeof getDb>,
  rows: MangabakaSeriesInsert[],
): Promise<number> {
  if (!rows.length) return 0;
  await db
    .insert(mangabakaSeries)
    .values(rows)
    .onConflictDoUpdate({
      target: mangabakaSeries.id,
      set: upsertSet,
    });
  return rows.length;
}