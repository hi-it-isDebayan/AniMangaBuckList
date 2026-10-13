import type { SearchResultItem } from "@ambl/types";

/** Metadata providers that can supply chapter/episode counts. */
export type CountProvider = "mal" | "jikan" | "anilist" | "mangabaka";

export type CountUnit = "CHAPTER" | "EPISODE";

/**
 * Normalize a provider-reported count.
 *
 * Providers commonly report `0` (and occasionally `-1`) for "unknown" — e.g. an
 * ongoing series with no announced total. Storing that verbatim makes the UI
 * render "0 chapters". Only strictly positive finite integers are meaningful, so
 * anything else is normalized to `null` (unknown) here, at the provider boundary.
 */
export function normalizeCount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Verified external ids a provider record is keyed by. */
export interface VerifiedIds {
  malId?: number | null;
  anilistId?: number | null;
  mangabakaId?: number | null;
}

export interface CountCandidate extends VerifiedIds {
  provider: CountProvider;
  /** The count in the reconciled unit, already normalized (null = unknown). */
  value: number | null;
}

export interface ReconciledCount {
  unit: CountUnit;
  /** Highest valid count, or null when every source is unknown. */
  value: number | null;
  /** Provider that supplied `value` (provenance), or null. */
  provider: CountProvider | null;
  /** Every matched source with a valid count, in input order. */
  sources: { provider: CountProvider; value: number }[];
  /** True when matched sources reported different valid counts. */
  conflict: boolean;
}

const ID_KEYS: (keyof VerifiedIds)[] = ["malId", "anilistId", "mangabakaId"];

function sharesVerifiedId(a: VerifiedIds, b: VerifiedIds): boolean {
  return ID_KEYS.some((k) => a[k] != null && b[k] != null && a[k] === b[k]);
}

/**
 * Reconcile chapter/episode counts for the SAME title across providers.
 *
 * Matching is by verified cross-provider id only (never title similarity): when
 * an `anchor` is supplied, candidates that share no verified id with it are
 * ignored. Among the remaining valid counts the highest wins, and the winning
 * provider is recorded as provenance. Callers pass the unit explicitly so manga
 * chapters and anime episodes are never mixed.
 */
export function reconcileCount(
  unit: CountUnit,
  candidates: CountCandidate[],
  anchor?: VerifiedIds,
): ReconciledCount {
  const matched = anchor ? candidates.filter((c) => sharesVerifiedId(anchor, c)) : candidates;

  const sources = matched
    .filter((c): c is CountCandidate & { value: number } => c.value != null && c.value > 0)
    .map((c) => ({ provider: c.provider, value: c.value }));

  if (sources.length === 0) {
    return { unit, value: null, provider: null, sources: [], conflict: false };
  }

  const best = sources.reduce((a, b) => (b.value > a.value ? b : a));
  return {
    unit,
    value: best.value,
    provider: best.provider,
    sources,
    conflict: new Set(sources.map((s) => s.value)).size > 1,
  };
}

/** Build a reconciliation candidate from a normalized search result item. */
export function candidateFromItem(
  provider: CountProvider,
  item: SearchResultItem,
  unit: CountUnit,
): CountCandidate {
  return {
    provider,
    value: normalizeCount(unit === "EPISODE" ? item.episodeCount : item.chapterCount),
    malId: item.malId,
    anilistId: item.anilistId,
    mangabakaId: item.mangabakaId ?? null,
  };
}
