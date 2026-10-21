/**
 * Catalogue curation policy.
 *
 * The local MangaBaka catalogue is capped at 220k rows. Measured density is
 * ~1.5 KB/row including indexes, so 220k rows is roughly 330 MB — well inside
 * Neon's Free-plan 1 GB storage allowance (which also has to cover the WAL and
 * any side branches). Newly published titles live on the "New" page until they
 * have enough material to be promoted into the main catalogue:
 *
 * - manga / manhwa / manhua / novels: 70+ chapters
 * - anime: 5+ episodes (reserved for providers that expose anime)
 *
 * When the catalogue grows past the cap, the lowest-value rows are pruned:
 * old, unpopular, still-unpromoted titles go first. Referenced titles (saved in
 * a library) and promoted titles are never pruned.
 *
 * This module is pure so the policy can be tested without a database.
 */

export const CATALOGUE_LIMIT = 220_000;

export const PROMOTE_CHAPTERS = 70;
export const PROMOTE_EPISODES = 5;

/** How many years back a not-yet-promoted title still counts as "new". */
export const NEW_WINDOW_YEARS = 1;

export type CatalogueSection = "MAIN" | "NEW";

export interface CatalogueCandidate {
  mediaType: string;
  totalChapters?: number | null;
  episodeCount?: number | null;
  year?: number | null;
  popularity?: number | null;
}

/** True once a title has enough chapters/episodes for the main catalogue. */
export function isPromoted(row: CatalogueCandidate): boolean {
  if (row.mediaType === "ANIME") {
    return (row.episodeCount ?? 0) >= PROMOTE_EPISODES;
  }
  return (row.totalChapters ?? 0) >= PROMOTE_CHAPTERS;
}

/**
 * Which list a title belongs to. Promoted titles are always MAIN; recent
 * titles that have not reached the threshold are NEW; everything else (the
 * back catalogue) is MAIN.
 */
export function sectionFor(
  row: CatalogueCandidate,
  currentYear: number = new Date().getFullYear(),
): CatalogueSection {
  if (isPromoted(row)) return "MAIN";
  if (row.year != null && row.year >= currentYear - NEW_WINDOW_YEARS) return "NEW";
  return "MAIN";
}

/**
 * Higher score = more valuable, i.e. keep longer. Popularity dominates,
 * recency and length are tie-breakers, and promoted titles are effectively
 * unpruable.
 */
export function retentionScore(
  row: CatalogueCandidate,
  currentYear: number = new Date().getFullYear(),
): number {
  if (isPromoted(row)) return Number.MAX_SAFE_INTEGER;

  // popularity is a rank: 1 = most popular. Missing popularity is the worst.
  const popularity = row.popularity ?? 1_000_000;
  const popularityScore = Math.max(0, 100_000 - popularity) * 10;

  const year = Math.max(1990, Math.min(row.year ?? 1990, currentYear));
  const recency = (year - 1990) * 500;

  const length = Math.min(row.totalChapters ?? row.episodeCount ?? 0, 500) * 4;

  return popularityScore + recency + length;
}

/**
 * Pick the ids to delete so that at most `limit` rows remain. Rows in
 * `protectIds` are skipped. Returns an empty array when already under the cap.
 */
export function selectForPrune<T extends CatalogueCandidate & { id: number }>(
  rows: T[],
  options: {
    limit?: number;
    protectIds?: Iterable<number>;
    currentYear?: number;
  } = {},
): number[] {
  const limit = options.limit ?? CATALOGUE_LIMIT;
  const excess = rows.length - limit;
  if (excess <= 0) return [];

  const protect = new Set(options.protectIds ?? []);
  const currentYear = options.currentYear ?? new Date().getFullYear();

  const candidates = rows
    .filter((row) => !protect.has(row.id))
    .sort(
      (a, b) =>
        retentionScore(a, currentYear) - retentionScore(b, currentYear) ||
        (a.year ?? 0) - (b.year ?? 0) ||
        a.id - b.id,
    );

  return candidates.slice(0, excess).map((row) => row.id);
}
