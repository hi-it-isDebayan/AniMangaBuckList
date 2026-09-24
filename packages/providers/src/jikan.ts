import type {
  MediaRelation,
  MediaStatus,
  MediaType,
  SearchResultItem,
} from "@ambl/types";
import type { MetadataProvider, SearchOptions } from "./types";

const BASE = "https://api.jikan.moe/v4";

function mapStatus(status?: string | null): MediaStatus | null {
  switch (status?.toLowerCase()) {
    case "finished_airing":
    case "finished":
      return "FINISHED";
    case "currently_airing":
    case "publishing":
      return "ONGOING";
    case "not_yet_aired":
    case "not_yet_published":
      return "NOT_YET_RELEASED";
    case "on_hiatus":
      return "HIATUS";
    case "cancelled":
      return "CANCELLED";
    default:
      return null;
  }
}

function mapMediaType(jikanType?: string | null): MediaType | null {
  switch (jikanType?.toLowerCase()) {
    case "anime":
    case "tv":
    case "movie":
    case "ova":
    case "ona":
    case "special":
    case "music":
      return "ANIME";
    case "manga":
      return "MANGA";
    case "manhwa":
      return "MANHWA";
    case "manhua":
      return "MANHUA";
    case "light_novel":
    case "light novel":
      return "LIGHT_NOVEL";
    case "novel":
      return "WEB_NOVEL";
    default:
      return null;
  }
}

function toSeason(str?: string | null): string | null {
  const s = str?.toLowerCase();
  if (!s) return null;
  return s === "summer" || s === "fall" || s === "winter" || s === "spring"
    ? s.toUpperCase()
    : null;
}

function mapRelation(relation: string): MediaRelation["relationType"] {
  const r = relation.toLowerCase();
  if (r.includes("prequel")) return "PREQUEL";
  if (r.includes("sequel")) return "SEQUEL";
  if (r.includes("side story")) return "SIDE_STORY";
  if (r.includes("spin-off")) return "SPIN_OFF";
  if (r.includes("alternative version")) return "ALTERNATIVE_VERSION";
  if (r.includes("adaptation")) return "ADAPTATION";
  if (r.includes("character")) return "CHARACTER";
  if (r.includes("summary")) return "ALTERNATIVE_VERSION";
  return "OTHER";
}

function isAnime(mediaType: MediaType): boolean {
  return mediaType === "ANIME";
}

interface JikanAnimeEntry {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  title_synonyms: string[];
  synopsis: string | null;
  type: string | null;
  episodes: number | null;
  status: string | null;
  score: number | null;
  season: string | null;
  year: number | null;
  aired?: { from: string | null; to: string | null } | null;
  images?: {
    jpg?: { large_image_url?: string | null; image_url?: string | null };
  };
}

interface JikanMangaEntry {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  title_synonyms: string[];
  synopsis: string | null;
  type: string | null;
  chapters: number | null;
  volumes: number | null;
  status: string | null;
  score: number | null;
  published?: { from: string | null; to: string | null } | null;
  images?: {
    jpg?: { large_image_url?: string | null; image_url?: string | null };
  };
}

async function jikanGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": "AniMangaBuckList/0.1" },
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Jikan rate limit reached. Try again in a moment.");
    }
    throw new Error(`Jikan request failed with status ${res.status}`);
  }
  return (await res.json()) as T;
}

export class JikanProvider implements MetadataProvider {
  readonly name = "jikan" as const;

  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResultItem[]> {
    const limit = Math.min(options.limit ?? 18, 24);
    const type = options.type;

    const results: SearchResultItem[] = [];

    if (type !== "MANGA" && type !== "BOOK") {
      const url = `/anime?q=${encodeURIComponent(query)}&limit=${limit}&order_by=popularity&sfw=true`;
      const data = await jikanGet<{ data: JikanAnimeEntry[] }>(url);
      for (const e of data.data) {
        const item = toItem(e);
        if (item) results.push(item);
      }
    }

    if (type !== "ANIME") {
      const typeParam = type === "BOOK" ? "" : "&type=manga";
      const url = `/manga?q=${encodeURIComponent(query)}&limit=${limit}${typeParam}&order_by=popularity&sfw=true`;
      const data = await jikanGet<{ data: JikanMangaEntry[] }>(url);
      for (const e of data.data) {
        const item = toItem(e);
        if (item) results.push(item);
      }
    }

    return results.slice(0, limit);
  }

  async getById(
    malId: number,
    mediaType: MediaType,
  ): Promise<SearchResultItem | null> {
    try {
      const url = isAnime(mediaType)
        ? `/anime/${malId}`
        : `/manga/${malId}`;
      const data = await jikanGet<{ data: JikanMangaEntry | JikanAnimeEntry }>(url);
      const item = toItem(data.data);
      if (!item) return null;
      return isAnime(mediaType) ? item : item;
    } catch {
      return null;
    }
  }

  async getRelations(
    malId: number,
    mediaType: MediaType,
  ): Promise<MediaRelation[]> {
    try {
      const url = isAnime(mediaType)
        ? `/anime/${malId}/relations`
        : `/manga/${malId}/relations`;
      const data = await jikanGet<{
        data: {
          relation: string;
          entry: { mal_id: number; type: string; name: string }[];
        }[];
      }>(url);
      const out: MediaRelation[] = [];
      for (const rel of data.data) {
        for (const entry of rel.entry) {
          const m = mapMediaType(entry.type);
          out.push({
            relationType: mapRelation(rel.relation),
            malId: entry.mal_id,
            title: entry.name ?? null,
            mediaType: m,
          });
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}

function toItem(e: JikanAnimeEntry | JikanMangaEntry): SearchResultItem | null {
  const mediaType = mapMediaType(e.type);
  return {
    malId: e.mal_id,
    title: e.title,
    englishTitle: e.title_english ?? null,
    japaneseTitle: e.title_japanese ?? null,
    synonyms: e.title_synonyms ?? [],
    mediaType: mediaType ?? "MANGA",
    synopsis: e.synopsis ?? null,
    status: mapStatus(e.status),
    episodeCount: "episodes" in e ? e.episodes : null,
    chapterCount: "chapters" in e ? e.chapters : null,
    volumeCount: "volumes" in e ? e.volumes : null,
    startDate: getStart(e) ?? null,
    endDate: getEnd(e) ?? null,
    season: toSeason("season" in e ? e.season : null),
    year: "year" in e ? e.year ?? null : null,
    coverUrl: e.images?.jpg?.large_image_url ?? e.images?.jpg?.image_url ?? null,
    score: e.score ?? null,
  };
}

function getStart(e: JikanAnimeEntry | JikanMangaEntry): string | null {
  const aired = "aired" in e ? e.aired : null;
  const published = "published" in e ? e.published : null;
  return aired?.from ?? published?.from ?? null;
}

function getEnd(e: JikanAnimeEntry | JikanMangaEntry): string | null {
  const aired = "aired" in e ? e.aired : null;
  const published = "published" in e ? e.published : null;
  return aired?.to ?? published?.to ?? null;
}