import type {
  MediaRelation,
  MediaStatus,
  MediaType,
  SearchResultItem,
} from "@ambl/types";
import type { MetadataProvider, SearchOptions } from "./types";

const BASE = "https://api.myanimelist.net/v2";

const ANIME_FIELDS =
  "id,title,main_picture,alternative_titles,media_type,synopsis,status,start_date,end_date,num_episodes,start_season,mean_score,genres,related_anime,related_manga";
const MANGA_FIELDS =
  "id,title,main_picture,alternative_titles,media_type,synopsis,status,start_date,end_date,num_chapters,num_volumes,mean_score,genres,related_anime,related_manga";

function mapStatus(status?: string | null): MediaStatus | null {
  switch (status) {
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

function mapMediaType(malType?: string | null): MediaType | null {
  switch (malType) {
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
      return "LIGHT_NOVEL";
    case "novel":
      return "WEB_NOVEL";
    default:
      return null;
  }
}

interface MalAltTitles {
  synonyms?: string[];
  en?: string;
  ja?: string;
}

interface MalNode {
  id: number;
  title: string;
  main_picture?: { large?: string | null; medium?: string | null } | null;
  alternative_titles?: MalAltTitles;
  media_type?: string | null;
  synopsis?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  num_episodes?: number | null;
  num_chapters?: number | null;
  num_volumes?: number | null;
  mean_score?: number | null;
  genres?: { id: number; name: string }[] | null;
  start_season?: { season?: string | null; year?: number | null } | null;
  related_anime?: MalRelated[];
  related_manga?: MalRelated[];
}

interface MalRelated {
  node: MalNode;
  relation_type: string;
  relation_type_formatted?: string;
}

interface MalResponse {
  data: { node: MalNode }[];
}

class MALError extends Error {}

export function malAuthHeaders(): Record<string, string> {
  const token = process.env.MAL_ACCESS_TOKEN;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  const clientId = process.env.MAL_CLIENT_ID;
  if (clientId) {
    return { "X-MAL-CLIENT-ID": clientId };
  }
  throw new MALError(
    "No MAL credentials configured. Set MAL_ACCESS_TOKEN (or MAL_CLIENT_ID) in apps/web/.env.",
  );
}

function mapRelation(rel: string, formatted?: string): MediaRelation["relationType"] {
  const r = (formatted ?? rel ?? "").toLowerCase();
  if (r.includes("prequel")) return "PREQUEL";
  if (r.includes("sequel")) return "SEQUEL";
  if (r.includes("side story")) return "SIDE_STORY";
  if (r.includes("spin-off")) return "SPIN_OFF";
  if (r.includes("alternative version") || r.includes("summary")) {
    return "ALTERNATIVE_VERSION";
  }
  if (r.includes("adaptation")) return "ADAPTATION";
  if (r.includes("character")) return "CHARACTER";
  return "OTHER";
}

function toItem(node: MalNode, isAnime: boolean): SearchResultItem {
  const alternatives = node.alternative_titles;
  const season = node.start_season?.season ?? null;
  return {
    malId: node.id,
    title: node.title,
    englishTitle: alternatives?.en ?? null,
    japaneseTitle: alternatives?.ja ?? null,
    synonyms: alternatives?.synonyms ?? [],
    mediaType: isAnime ? "ANIME" : mapMediaType(node.media_type) ?? "MANGA",
    synopsis: node.synopsis ?? null,
    status: mapStatus(node.status),
    episodeCount: isAnime ? node.num_episodes ?? null : null,
    chapterCount: isAnime ? null : node.num_chapters ?? null,
    volumeCount: isAnime ? null : node.num_volumes ?? null,
    startDate: node.start_date ?? null,
    endDate: node.end_date ?? null,
    season: season ? season.toUpperCase() : null,
    year: node.start_season?.year ?? null,
    coverUrl: node.main_picture?.large ?? node.main_picture?.medium ?? null,
    score: node.mean_score ?? null,
    genres: (node.genres ?? []).map((g) => g.name),
  };
}

async function malGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...malAuthHeaders(), "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new MALError(`MAL request failed with status ${res.status}`);
  }
  return (await res.json()) as T;
}

export class MALProvider implements MetadataProvider {
  readonly name = "mal" as const;

  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResultItem[]> {
    const limit = Math.min(options.limit ?? 12, 24);
    const type = options.type;
    const items: SearchResultItem[] = [];

    if (type !== "MANGA" && type !== "BOOK") {
      const res = await malGet<MalResponse>(
        `/anime?q=${encodeURIComponent(query)}&limit=${limit}&fields=${ANIME_FIELDS}`,
      );
      for (const { node } of res.data) items.push(toItem(node, true));
    }

    if (type !== "ANIME") {
      const res = await malGet<MalResponse>(
        `/manga?q=${encodeURIComponent(query)}&limit=${limit}&fields=${MANGA_FIELDS}`,
      );
      for (const { node } of res.data) items.push(toItem(node, false));
    }

    return items.slice(0, limit);
  }

  async getById(
    malId: number,
    mediaType: MediaType,
  ): Promise<SearchResultItem | null> {
    try {
      const isAnime = mediaType === "ANIME";
      const path = isAnime
        ? `/anime/${malId}?fields=${ANIME_FIELDS}`
        : `/manga/${malId}?fields=${MANGA_FIELDS}`;
      const node = await malGet<MalNode>(path);
      return toItem(node, isAnime);
    } catch {
      return null;
    }
  }

  async getRelations(
    malId: number,
    mediaType: MediaType,
  ): Promise<MediaRelation[]> {
    try {
      const isAnime = mediaType === "ANIME";
      const path = isAnime
        ? `/anime/${malId}?fields=${ANIME_FIELDS}`
        : `/manga/${malId}?fields=${MANGA_FIELDS}`;
      const node = await malGet<MalNode>(path);
      const out: MediaRelation[] = [];
      for (const rel of node.related_anime ?? []) {
        if (!rel.node) continue;
        out.push({
          relationType: mapRelation(rel.relation_type, rel.relation_type_formatted),
          malId: rel.node.id,
          title: rel.node.title ?? null,
          mediaType: "ANIME",
        });
      }
      for (const rel of node.related_manga ?? []) {
        if (!rel.node) continue;
        out.push({
          relationType: mapRelation(rel.relation_type, rel.relation_type_formatted),
          malId: rel.node.id,
          title: rel.node.title ?? null,
          mediaType: mapMediaType(rel.node.media_type),
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}