/**
 * Community source extractor registry + generic extraction heuristics.
 *
 * Registration is deliberately independent of extractor availability: a source
 * can be registered and linked with no compatible extractor, in which case it
 * is labelled "Awaiting extractor support".
 *
 * The parsing helpers below are a TypeScript port of the heuristics in
 * `engine/app/spiders.py` and `engine/_detect_test.js` (JSON-LD, og/twitter
 * titles, <h1>, <title>, chapter/episode numbers). They are pure so they can be
 * unit-tested without touching the network.
 */

export type MediaType = "ANIME" | "MANGA" | "MANHWA" | "MANHUA" | "LIGHT_NOVEL" | "WEB_NOVEL";

export type Unit = "CHAPTER" | "EPISODE";

export type ExtractorStatus = "SUPPORTED" | "AWAITING_EXTRACTOR" | "UNSUPPORTED";

export interface ExtractorDefinition {
  key: string;
  label: string;
  /** Canonical hosts understood by this extractor. Subdomains also match. */
  domains: string[];
  supports: MediaType[];
}

/**
 * Data-only registry. Adding extractor support is a one-line change here; no
 * stored source rows need to be rewritten.
 */
export const EXTRACTORS: ExtractorDefinition[] = [
  { key: "mangadex", label: "MangaDex", domains: ["mangadex.org"], supports: ["MANGA"] },
  {
    key: "mangakakalot",
    label: "MangaKakalot",
    domains: ["mangakakalot.com", "manganato.com"],
    supports: ["MANGA"],
  },
  { key: "mangafire", label: "MangaFire", domains: ["mangafire.to"], supports: ["MANGA"] },
  { key: "bato", label: "Bato.to", domains: ["bato.to", "batotoo.com"], supports: ["MANGA"] },
  { key: "mangapill", label: "MangaPill", domains: ["mangapill.com"], supports: ["MANGA"] },
  {
    key: "reaperscans",
    label: "Reaper Scans",
    domains: ["reaperscans.com"],
    supports: ["MANGA"],
  },
  {
    key: "asurascans",
    label: "Asura Scans",
    domains: ["asuracomic.net", "asurascans.com"],
    supports: ["MANGA", "MANHWA"],
  },
  {
    key: "webtoons",
    label: "WEBTOON",
    domains: ["webtoons.com"],
    supports: ["MANHWA", "MANGA"],
  },
  {
    key: "myanimelist",
    label: "MyAnimeList",
    domains: ["myanimelist.net"],
    supports: ["ANIME", "MANGA"],
  },
  { key: "anilist", label: "AniList", domains: ["anilist.co"], supports: ["ANIME", "MANGA"] },
  { key: "crunchyroll", label: "Crunchyroll", domains: ["crunchyroll.com"], supports: ["ANIME"] },
];

/** Lowercase, strip a leading `www.` and any trailing dots. */
export function normalizeHost(domain: string): string {
  return (domain ?? "").trim().toLowerCase().replace(/^www\./, "").replace(/\.+$/, "");
}

/** Exact-or-subdomain match against the registry. */
export function findExtractor(domain: string): ExtractorDefinition | null {
  const host = normalizeHost(domain);
  if (!host) return null;
  for (const extractor of EXTRACTORS) {
    for (const candidate of extractor.domains) {
      if (host === candidate || host.endsWith(`.${candidate}`)) return extractor;
    }
  }
  return null;
}

/**
 * Registration status for a domain. Unknown hosts are not "unsupported" — they
 * simply have no extractor yet and are labelled "Awaiting extractor support".
 */
export function extractorStatusFor(domain: string): ExtractorStatus {
  return findExtractor(domain) ? "SUPPORTED" : "AWAITING_EXTRACTOR";
}

export function extractorLabel(domain: string): string {
  return findExtractor(domain)?.label ?? "Awaiting extractor support";
}

// --- Generic extraction -----------------------------------------------------

const UNIT_TOKENS: Record<Unit, string[]> = {
  CHAPTER: ["chapter", "chapters", "chap", "ch", "capitulo", "cap", "capítulo"],
  EPISODE: ["episode", "episodes", "ep", "episodio", "episódio"],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Port of `extractFromString` in `engine/_detect_test.js`. */
export function extractUnitValue(input: string): { unit: Unit; value: number } | null {
  if (!input) return null;
  const haystack = input.toLowerCase();
  for (const unit of ["CHAPTER", "EPISODE"] as Unit[]) {
    for (const token of UNIT_TOKENS[unit]) {
      const re = new RegExp(
        `(?:^|[^a-z0-9])${escapeRegExp(token)}[.\\s\\/-]*?(\\d{1,4})(?:$|[^a-z0-9])`,
      );
      const match = re.exec(haystack);
      if (match) return { unit, value: Number(match[1]) };
    }
  }
  return null;
}

const ANY_UNIT_RE = new RegExp(
  `(?:^|[^a-z0-9])(?:${[...UNIT_TOKENS.CHAPTER, ...UNIT_TOKENS.EPISODE]
    .map(escapeRegExp)
    .join("|")})[.\\s\\/-]*?\\d{1,4}`,
  "i",
);

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Port of `clean_title` in `engine/app/spiders.py`. */
export function cleanTitle(raw: string, host = ""): string {
  if (!raw) return "";
  let title = stripTags(raw);
  if (!title) return "";

  // Prefer the first meaningful segment before a separator ("X - Site").
  for (const part of title.split(/\s[-|–_:]\s|\s-\s|\s\|\s/i)) {
    const candidate = part.trim();
    if (candidate.length >= 3) {
      title = candidate;
      break;
    }
  }

  const unitMatch = ANY_UNIT_RE.exec(title);
  if (unitMatch) title = title.slice(0, unitMatch.index).trim();

  const hostLower = normalizeHost(host);
  if (hostLower) title = title.replace(new RegExp(escapeRegExp(hostLower), "gi"), " ");

  return title.replace(/\s+/g, " ").trim();
}

interface JsonLdLike {
  name?: unknown;
  [key: string]: unknown;
}

function pickNamed(value: unknown): JsonLdLike | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = pickNamed(entry);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as JsonLdLike;
    if (typeof record.name === "string" && record.name.trim()) return record;
    if (record["@graph"]) return pickNamed(record["@graph"]);
  }
  return null;
}

/** Port of `load_json_ld`: the first JSON-LD block that carries a `name`. */
export function loadJsonLd(html: string): JsonLdLike | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      const named = pickNamed(JSON.parse(match[1].trim()));
      if (named) return named;
    } catch {
      // Ignore malformed JSON-LD blocks and keep looking.
    }
  }
  return null;
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`${escapeRegExp(name)}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
  return match ? match[1] : null;
}

/** `content` of a `<meta>` whose `name`/`property` equals `key` (any order). */
export function metaContent(html: string, key: string): string {
  const tagRe = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    const tag = match[0];
    const name = attr(tag, "name") ?? attr(tag, "property");
    if (name && name.toLowerCase() === key.toLowerCase()) return attr(tag, "content") ?? "";
  }
  return "";
}

function firstGroup(html: string, re: RegExp): string {
  const match = re.exec(html);
  return match ? match[1] : "";
}

export interface ExtractedPage {
  /** Cleaned, displayable title. */
  title: string | null;
  /** Title exactly as found on the page. */
  rawTitle: string | null;
  unit: Unit | null;
  value: number | null;
  fromJsonLd: boolean;
  /** Extraction compatibility: we identified content from the HTML. */
  ok: boolean;
}

/**
 * Best-effort extraction from a fetched page. Returns `ok: false` when nothing
 * identifiable was found, which surfaces as an extraction failure — separately
 * from reachability.
 */
export function extractPage(html: string, url = ""): ExtractedPage {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }

  const ogTitle = metaContent(html, "og:title");
  const twitterTitle = metaContent(html, "twitter:title");
  const jsonLd = loadJsonLd(html);
  const jsonLdName = typeof jsonLd?.name === "string" ? jsonLd.name : "";
  const h1 = stripTags(firstGroup(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const pageTitle = stripTags(firstGroup(html, /<title[^>]*>([\s\S]*?)<\/title>/i));

  const candidates: Array<{ value: string; fromJsonLd: boolean }> = [
    { value: ogTitle, fromJsonLd: false },
    { value: jsonLdName, fromJsonLd: true },
    { value: twitterTitle, fromJsonLd: false },
    { value: h1, fromJsonLd: false },
    { value: pageTitle, fromJsonLd: false },
  ];

  let chosen: { value: string; fromJsonLd: boolean } | null = null;
  for (const candidate of candidates) {
    if (candidate.value && candidate.value.trim().length >= 2) {
      chosen = candidate;
      break;
    }
  }

  if (!chosen) {
    return { title: null, rawTitle: null, unit: null, value: null, fromJsonLd: false, ok: false };
  }

  const rawTitle = chosen.value.trim();
  const title = cleanTitle(rawTitle, host) || rawTitle;
  const unitInfo = extractUnitValue(rawTitle) ?? extractUnitValue(url);

  return {
    title,
    rawTitle,
    unit: unitInfo?.unit ?? null,
    value: unitInfo?.value ?? null,
    fromJsonLd: chosen.fromJsonLd,
    ok: title.length >= 2,
  };
}
