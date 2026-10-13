import type {
  MediaRelation,
  MediaStatus,
  MediaType,
  SearchResultItem,
} from "@ambl/types";
import type { MetadataProvider, SearchOptions } from "./types";
import { normalizeCount } from "./counts";

const GRAPHQL_URL = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  idMal
  type
  format
  status
  description(asHtml: false)
  episodes
  chapters
  volumes
  season
  seasonYear
  averageScore
  genres
  synonyms
  title { romaji english native }
  startDate { year month day }
  endDate { year month day }
  coverImage { large }
`;

interface AniListTitle {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

interface AniListDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

interface AniListMedia {
  id: number;
  idMal?: number | null;
  type?: "ANIME" | "MANGA" | null;
  format?: string | null;
  status?: string | null;
  description?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  averageScore?: number | null;
  genres?: string[] | null;
  synonyms?: string[] | null;
  title?: AniListTitle | null;
  startDate?: AniListDate | null;
  endDate?: AniListDate | null;
  coverImage?: { large?: string | null } | null;
}

interface AniListRelationNode {
  id: number;
  idMal?: number | null;
  type?: "ANIME" | "MANGA" | null;
  title?: AniListTitle | null;
}

function mapStatus(status?: string | null): MediaStatus | null {
  switch (status) {
    case "FINISHED":
      return "FINISHED";
    case "RELEASING":
      return "ONGOING";
    case "NOT_YET_RELEASED":
      return "NOT_YET_RELEASED";
    case "HIATUS":
      return "HIATUS";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return null;
  }
}

function mapMediaType(type?: string | null, format?: string | null): MediaType {
  if (type === "ANIME") return "ANIME";
  switch (format) {
    case "NOVEL":
      return "LIGHT_NOVEL";
    case "ONE_SHOT":
      return "MANGA";
    case "MANGA":
    default:
      return "MANGA";
  }
}

function mapSeason(season?: string | null): string | null {
  const s = season?.toUpperCase();
  return s && ["WINTER", "SPRING", "SUMMER", "FALL"].includes(s) ? s : null;
}

function mapRelation(relation?: string | null): MediaRelation["relationType"] {
  const r = (relation ?? "").toUpperCase();
  if (r.includes("PREQUEL")) return "PREQUEL";
  if (r.includes("SEQUEL")) return "SEQUEL";
  if (r.includes("SIDE_STORY")) return "SIDE_STORY";
  if (r.includes("SPIN_OFF")) return "SPIN_OFF";
  if (r.includes("ALTERNATIVE") || r.includes("SUMMARY")) {
    return "ALTERNATIVE_VERSION";
  }
  if (r.includes("ADAPTATION")) return "ADAPTATION";
  if (r.includes("PARENT") || r.includes("SOURCE")) return "ADAPTATION";
  if (r.includes("CHARACTER")) return "CHARACTER";
  return "OTHER";
}

function toDate(d?: AniListDate | null): string | null {
  if (!d?.year) return null;
  const month = d.month ? String(d.month).padStart(2, "0") : "01";
  const day = d.day ? String(d.day).padStart(2, "0") : "01";
  return `${d.year}-${month}-${day}`;
}

function toItem(media: AniListMedia, isAnime: boolean): SearchResultItem {
  const title = media.title;
  return {
    malId: media.idMal ?? null,
    anilistId: media.id,
    title:
      title?.english?.trim() ||
      title?.romaji?.trim() ||
      title?.native?.trim() ||
      "",
    englishTitle: title?.english?.trim() || null,
    japaneseTitle: title?.native?.trim() || null,
    synonyms: media.synonyms ?? [],
    mediaType: isAnime ? "ANIME" : mapMediaType(media.type, media.format),
    synopsis: media.description?.trim() || null,
    status: mapStatus(media.status),
    episodeCount: isAnime ? normalizeCount(media.episodes) : null,
    chapterCount: isAnime ? null : normalizeCount(media.chapters),
    volumeCount: isAnime ? null : normalizeCount(media.volumes),
    startDate: toDate(media.startDate),
    endDate: toDate(media.endDate),
    season: mapSeason(media.season),
    year: media.seasonYear ?? null,
    coverUrl: media.coverImage?.large ?? null,
    score: media.averageScore != null ? Number((media.averageScore / 10).toFixed(1)) : null,
    genres: media.genres ?? [],
  };
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "AniMangaBuckList/0.1" },
    cache: "no-store",
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`AniList request failed with status ${res.status}`);
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(json.errors[0]!.message);
  }
  if (!json.data) throw new Error("AniList returned no data.");
  return json.data;
}

const SEARCH_QUERY = `
  query ($search: String, $page: Int, $perPage: Int, $type: MediaType) {
    Page(page: $page, perPage: $perPage) {
      media(search: $search, type: $type, sort: [POPULARITY_DESC], isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const BY_MAL_ID_QUERY = `
  query ($id: Int, $type: MediaType) {
    Page(page: 1, perPage: 1) {
      media(idMal: $id, type: $type, isAdult: false) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const RELATIONS_QUERY = `
  query ($id: Int, $type: MediaType) {
    Page(page: 1, perPage: 1) {
      media(idMal: $id, type: $type, isAdult: false) {
        id
        relations {
          edges {
            relationType
            node {
              id
              idMal
              type
              title { romaji english native }
            }
          }
        }
      }
    }
  }
`;

export class AniListProvider implements MetadataProvider {
  readonly name = "anilist" as const;

  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResultItem[]> {
    const limit = Math.min(options.limit ?? 12, 24);
    const type = options.type;
    const results: SearchResultItem[] = [];

    if (type !== "MANGA" && type !== "BOOK") {
      const data = await graphql<{ Page: { media: AniListMedia[] } }>(SEARCH_QUERY, {
        search: query,
        page: 1,
        perPage: limit,
        type: "ANIME",
      });
      for (const media of data.Page.media) results.push(toItem(media, true));
    }

    if (type !== "ANIME") {
      const data = await graphql<{ Page: { media: AniListMedia[] } }>(SEARCH_QUERY, {
        search: query,
        page: 1,
        perPage: limit,
        type: "MANGA",
      });
      for (const media of data.Page.media) results.push(toItem(media, false));
    }

    return results.slice(0, limit);
  }

  async getById(
    malId: number,
    mediaType: MediaType,
  ): Promise<SearchResultItem | null> {
    try {
      const isAnime = mediaType === "ANIME";
      const data = await graphql<{ Page: { media: AniListMedia[] } }>(BY_MAL_ID_QUERY, {
        id: malId,
        type: isAnime ? "ANIME" : "MANGA",
      });
      const media = data.Page.media[0];
      return media ? toItem(media, isAnime) : null;
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
      const data = await graphql<{
        Page: {
          media: {
            relations: {
              edges: {
                relationType: string | null;
                node: AniListRelationNode;
              }[];
            };
          }[];
        };
      }>(RELATIONS_QUERY, {
        id: malId,
        type: isAnime ? "ANIME" : "MANGA",
      });
      const out: MediaRelation[] = [];
      const media = data.Page.media[0];
      for (const edge of media?.relations?.edges ?? []) {
        const node = edge.node;
        if (!node) continue;
        const nodeIsAnime = node.type === "ANIME";
        out.push({
          relationType: mapRelation(edge.relationType),
          malId: node.idMal ?? null,
          title:
            node.title?.english?.trim() ||
            node.title?.romaji?.trim() ||
            node.title?.native?.trim() ||
            null,
          mediaType: nodeIsAnime ? "ANIME" : "MANGA",
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}