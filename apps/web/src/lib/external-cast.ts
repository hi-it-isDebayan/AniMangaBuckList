/**
 * Runtime-only cast & crew enrichment.
 *
 * Characters (with art) and staff/authors (with portraits) are fetched from
 * AniList's public GraphQL API, falling back to Jikan (the unofficial MAL REST
 * API) when only a MAL id is known. Nothing here is ever written to Neon — the
 * only persistence is Next's fetch cache plus a small in-process memo so repeat
 * page views within a process are free.
 *
 * The whole module degrades quietly: any network error, bad payload or missing
 * id resolves to `null`, and the caller simply hides the section.
 */

const ANILIST_GRAPHQL = "https://graphql.anilist.co";
const JIKAN_BASE = "https://api.jikan.moe/v4";
/** AniList allows 90 req/min unauthenticated; stay well under it. */
const REVALIDATE_SECONDS = 60 * 60 * 24; // 24h — cast data rarely changes
const TIMEOUT_MS = 6000;

export type CastRole = "MAIN" | "SUPPORTING" | "BACKGROUND";

export interface CastCharacter {
  id: number;
  name: string;
  /** Native/script name when the API provides one. */
  nativeName?: string | null;
  imageUrl: string | null;
  role: CastRole;
  /** Dub actors for anime; empty for print media. */
  voiceActors: CastMember[];
}

export interface CastMember {
  id: number;
  name: string;
  imageUrl: string | null;
  /** e.g. "Story & Art", "Director", "Japanese". */
  detail?: string | null;
}

export interface CastResult {
  characters: CastCharacter[];
  /** Staff/authors, authors-first (AniList marks "Story & Art" as a Writer). */
  staff: CastMember[];
  source: "anilist" | "jikan";
}

/* ------------------------------------------------------------------ *
 * In-process memo (NOT a database — cleared on cold start)
 * ------------------------------------------------------------------ */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h in-process; fetch revalidates for 24h
const cache = new Map<string, { value: CastResult | null; expires: number }>();

/** Exported for tests. */
export function castCacheSize(): number {
  return cache.size;
}

/** Exported for tests / ops. */
export function clearCastCache(): void {
  cache.clear();
}

/* ------------------------------------------------------------------ *
 * Pure helpers (unit tested)
 * ------------------------------------------------------------------ */

/** Normalises a display name: collapses whitespace, trims, caps length. */
export function normaliseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return null;
  return name.length > 80 ? `${name.slice(0, 77)}...` : name;
}

/** Accepts an image URL only if it is a plausible http(s) URL. */
export function safeImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

export function normaliseRole(raw: unknown): CastRole {
  if (typeof raw !== "string") return "BACKGROUND";
  const value = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (value === "MAIN" || value === "MAIN_CHARACTER") return "MAIN";
  if (value === "SUPPORTING" || value === "SUPPORTING_CHARACTER") return "SUPPORTING";
  return "BACKGROUND";
}

/**
 * Case- and punctuation-insensitive match used to line MangaBaka author names
 * up with the portraits AniList returns. "Oda Eiichiro" matches "Eiichiro Oda"
 * only when the token sets are identical, so ordering does not matter.
 */
export function namesMatch(a: string, b: string): boolean {
  const tokenise = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter(Boolean)
      .sort();
  const left = tokenise(a);
  const right = tokenise(b);
  return left.length > 0 && left.length === right.length && left.every((t, i) => t === right[i]);
}

/* ------------------------------------------------------------------ *
 * AniList
 * ------------------------------------------------------------------ */

interface AniListPayload {
  data?: {
    Media?: {
      characters?: {
        edges?: {
          role?: string | null;
          node?: {
            id?: number | null;
            name?: { full?: string | null; native?: string | null } | null;
            image?: { large?: string | null; medium?: string | null } | null;
          } | null;
          voiceActors?: {
            id?: number | null;
            name?: { full?: string | null } | null;
            image?: { large?: string | null } | null;
            language?: string | null;
          }[] | null;
        }[] | null;
      } | null;
      staff?: {
        edges?: {
          role?: string | null;
          node?: {
            id?: number | null;
            name?: { full?: string | null } | null;
            image?: { large?: string | null; medium?: string | null } | null;
          } | null;
        }[] | null;
      } | null;
    } | null;
  } | null;
}

const ANILIST_QUERY = `
  query CastAndCrew($id: Int, $type: MediaType) {
    Media(id: $id, type: $type) {
      characters(sort: [ROLE, RELEVANCE], perPage: 14) {
        edges {
          role
          node {
            id
            name { full native }
            image { large medium }
          }
          voiceActors(language: JAPANESE, sort: [RELEVANCE]) {
            id
            name { full }
            image { large }
            language
          }
        }
      }
      staff(sort: [RELEVANCE], perPage: 14) {
        edges {
          role
          node {
            id
            name { full }
            image { large medium }
          }
        }
      }
    }
  }
`;

/** Parses an AniList GraphQL response into a CastResult. Pure + tested. */
export function parseAniList(payload: unknown): CastResult | null {
  const body = payload as AniListPayload;
  const media = body?.data?.Media;
  if (!media) return null;

  const characters: CastCharacter[] = [];
  for (const edge of media.characters?.edges ?? []) {
    const node = edge?.node;
    if (!node?.id || !normaliseName(node.name?.full)) continue;
    characters.push({
      id: node.id,
      name: normaliseName(node.name?.full)!,
      nativeName: normaliseName(node.name?.native),
      imageUrl: safeImageUrl(node.image?.large) ?? safeImageUrl(node.image?.medium),
      role: normaliseRole(edge.role),
      voiceActors: (edge.voiceActors ?? [])
        .filter((va) => va?.id && normaliseName(va.name?.full))
        .map((va) => ({
          id: va.id!,
          name: normaliseName(va.name?.full)!,
          imageUrl: safeImageUrl(va.image?.large),
          detail: normaliseName(va.language),
        })),
    });
  }

  const staff: CastMember[] = [];
  const seen = new Set<number>();
  for (const edge of media.staff?.edges ?? []) {
    const node = edge?.node;
    if (!node?.id || seen.has(node.id) || !normaliseName(node.name?.full)) continue;
    seen.add(node.id);
    staff.push({
      id: node.id,
      name: normaliseName(node.name?.full)!,
      imageUrl: safeImageUrl(node.image?.large) ?? safeImageUrl(node.image?.medium),
      detail: normaliseName(edge.role),
    });
  }

  if (characters.length === 0 && staff.length === 0) return null;
  return { characters, staff, source: "anilist" };
}

async function fetchAniList(
  anilistId: number,
  mediaType: "ANIME" | "MANGA",
): Promise<CastResult | null> {
  const res = await fetch(ANILIST_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: { id: anilistId, type: mediaType },
    }),
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return parseAniList(await res.json());
}

/* ------------------------------------------------------------------ *
 * Jikan (MyAnimeList, unofficial)
 * ------------------------------------------------------------------ */

interface JikanCharacter {
  character?: { mal_id?: number | null; name?: string | null; images?: { jpg?: { image_url?: string | null } } | null } | null;
  role?: string | null;
  voice_actors?: {
    person?: { mal_id?: number | null; name?: string | null; images?: { jpg?: { image_url?: string | null } } | null } | null;
    language?: string | null;
  }[] | null;
}

interface JikanStaff {
  people?: {
    mal_id?: number | null;
    name?: string | null;
    images?: { jpg?: { image_url?: string | null } } | null;
    positions?: string[] | null;
  }[] | null;
}

/** Top-level shape of every Jikan v4 response. */
interface JikanEnvelope<T> {
  data?: T | null;
}

/** Parses a Jikan /characters payload. Pure + tested. */
export function parseJikanCharacters(payload: unknown): CastCharacter[] {
  const data = (payload as JikanEnvelope<JikanCharacter[]>)?.data;
  if (!Array.isArray(data)) return [];
  const out: CastCharacter[] = [];
  for (const entry of data) {
    const c = entry?.character;
    const name = normaliseName(c?.name);
    if (!c?.mal_id || !name) continue;
    const japaneseVas = (entry.voice_actors ?? []).filter(
      (va) => va?.person?.mal_id && normaliseName(va.person?.name) && /japanese/i.test(va.language ?? ""),
    );
    out.push({
      id: c.mal_id,
      name,
      imageUrl: safeImageUrl(c.images?.jpg?.image_url),
      role: normaliseRole(entry.role),
      voiceActors: japaneseVas.map((va) => ({
        id: va.person!.mal_id!,
        name: normaliseName(va.person!.name)!,
        imageUrl: safeImageUrl(va.person!.images?.jpg?.image_url),
        detail: "Japanese",
      })),
    });
  }
  return out;
}

interface JikanStaffResponse {
  people?: JikanStaff["people"];
}

/** Parses a Jikan /people/{id}/voices-style staff payload for one entry. Pure + tested. */
export function parseJikanStaff(payload: unknown): CastMember[] {
  const people = (payload as JikanEnvelope<JikanStaffResponse>)?.data?.people;
  if (!Array.isArray(people)) return [];
  const out: CastMember[] = [];
  const seen = new Set<number>();
  for (const person of people) {
    const name = normaliseName(person?.name);
    if (!person?.mal_id || !name || seen.has(person.mal_id)) continue;
    seen.add(person.mal_id);
    out.push({
      id: person.mal_id,
      name,
      imageUrl: safeImageUrl(person.images?.jpg?.image_url),
      detail: normaliseName((person.positions ?? []).join(", ") || null),
    });
  }
  return out;
}

async function fetchJikanCharacters(malId: number): Promise<CastCharacter[]> {
  const res = await fetch(`${JIKAN_BASE}/anime/${malId}/characters`, {
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!res?.ok) return [];
  return parseJikanCharacters(await res.json().catch(() => null));
}

async function fetchJikanMangaCharacters(malId: number): Promise<CastCharacter[]> {
  const res = await fetch(`${JIKAN_BASE}/manga/${malId}/characters`, {
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!res?.ok) return [];
  return parseJikanCharacters(await res.json().catch(() => null));
}

async function fetchJikanStaff(malId: number, mediaType: "ANIME" | "MANGA"): Promise<CastMember[]> {
  const res = await fetch(`${JIKAN_BASE}/${mediaType === "ANIME" ? "anime" : "manga"}/${malId}/staff`, {
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!res?.ok) return [];
  return parseJikanStaff(await res.json().catch(() => null));
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

export interface ExternalIds {
  anilistId?: number | null;
  malId?: number | null;
  mediaType: "ANIME" | "MANGA";
}

/**
 * Fetches characters + staff for a title. Returns `null` when there is nothing
 * to show, so callers can hide the whole section. Never throws.
 */
export async function getExternalCast(ids: ExternalIds): Promise<CastResult | null> {
  const { anilistId, malId, mediaType } = ids;
  if (!anilistId && !malId) return null;

  const key = `${mediaType}:${anilistId ?? "-"}:${malId ?? "-"}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const value = await loadCast(anilistId, malId, mediaType).catch(() => null);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

async function loadCast(
  anilistId: number | null | undefined,
  malId: number | null | undefined,
  mediaType: "ANIME" | "MANGA",
): Promise<CastResult | null> {
  // 1. AniList gives both cast and staff in one round trip.
  if (anilistId) {
    const result = await fetchAniList(anilistId, mediaType).catch(() => null);
    if (result) return result;
  }

  // 2. Jikan: two calls, and rate-limited to ~3 req/s, so keep it to the pair.
  if (malId) {
    const [characters, staff] = await Promise.all([
      mediaType === "ANIME"
        ? fetchJikanCharacters(malId)
        : fetchJikanMangaCharacters(malId),
      fetchJikanStaff(malId, mediaType),
    ]);
    if (characters.length > 0 || staff.length > 0) {
      return { characters, staff, source: "jikan" };
    }
  }

  return null;
}

/**
 * Orders staff so credited authors come first and dedupes by name. Pure.
 * Jikan/AniList list directors and composers alongside writers; on a manga page
 * the reader cares about the author/artist first.
 */
export function orderStaffForDisplay(staff: CastMember[]): CastMember[] {
  const authorRe = /(story|art|author|writer|illustrat|mangaka)/i;
  const authors = staff.filter((m) => authorRe.test(m.detail ?? ""));
  const rest = staff.filter((m) => !authorRe.test(m.detail ?? ""));
  return [...authors, ...rest];
}
