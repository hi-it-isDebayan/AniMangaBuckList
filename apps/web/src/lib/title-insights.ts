/**
 * Derived, presentation-only insights for the shared title detail pages.
 *
 * Everything here is computed from data already loaded for the page, so the
 * helpers add zero database work. They are pure so they can be unit tested
 * without a database or a React renderer.
 */

export type RankPoint = { label: string; value: number | null };

export interface RankSummary {
  /** Best (numerically lowest) rank seen across the snapshot window. */
  best: number | null;
  /** Current rank minus the rank 12 months ago. Negative = improving. */
  change1y: number | null;
  /** Percentage of the window spent improving, 0–100. */
  improving: boolean;
  /** Number of non-null snapshots used. */
  samples: number;
}

/**
 * Summarise a MangaBaka popularity-rank history. `rank` values are positions
 * where 1 is the most popular, so a *decrease* over time is an improvement.
 *
 * `points` is expected oldest-first (1y, 6mo, 3mo, 1mo, 1w, 1d, now); the
 * series page uses `1d … 1y` labels, so callers should normalise order before
 * calling. We only rely on the first and last non-null samples for the change.
 */
export function summariseRankHistory(points: RankPoint[]): RankSummary {
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (values.length === 0) {
    return { best: null, change1y: null, improving: false, samples: 0 };
  }

  const best = Math.min(...values);
  const first = values[0];
  const last = values[values.length - 1];
  const change1y = values.length >= 2 ? last - first : null;

  return {
    best,
    change1y,
    improving: change1y != null && change1y < 0,
    samples: values.length,
  };
}

export interface ProgressSummary {
  /** 0–100, clamped. Null when the total is unknown. */
  percent: number | null;
  /** Units still remaining, or null when the total is unknown. */
  remaining: number | null;
  /** Whether the user has finished every known unit. */
  complete: boolean;
}

/**
 * Reading/watching progress for a library row. `completed` is the highest unit
 * the user has marked; `total` is the known length (may be null from providers).
 */
export function summariseProgress(
  completed: number | null | undefined,
  total: number | null | undefined,
): ProgressSummary {
  const done = Math.max(0, completed ?? 0);
  if (total == null || total <= 0) {
    return { percent: null, remaining: null, complete: false };
  }
  const percent = Math.min(100, Math.round((done / total) * 100));
  const remaining = Math.max(0, total - done);
  return { percent, remaining, complete: remaining === 0 && total > 0 };
}

/**
 * How long the remaining material would take at a typical reading pace.
 * Returns a human string like "~6 h" or null when the estimate is unavailable.
 *
 * Defaults are deliberately conservative public averages: about 5 minutes per
 * chapter and 24 minutes per episode.
 */
export function estimateRemainingTime(
  remaining: number | null,
  unit: "CHAPTER" | "EPISODE",
): string | null {
  if (remaining == null || remaining <= 0) return null;
  const minutesPerUnit = unit === "EPISODE" ? 24 : 5;
  const minutes = remaining * minutesPerUnit;
  if (minutes < 60) return `~${minutes} min`;
  const hours = minutes / 60;
  if (hours < 24) return `~${Math.round(hours)} h`;
  const days = hours / 8; // assume ~8 h of free time per day
  if (days < 30) return `~${Math.round(days)} d`;
  return `~${Math.round(days / 30)} mo`;
}

/** Number of chapters/episodes published per year, rounded to one decimal. */
export function releasePace(
  total: number | null | undefined,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): { perYear: number; years: number } | null {
  const start = startDate ? new Date(startDate) : null;
  if (total == null || total <= 0 || !start || Number.isNaN(start.getTime())) return null;
  const end = endDate ? new Date(endDate) : now;
  if (Number.isNaN(end.getTime())) return null;
  const years = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 0.25) return null; // too new to be meaningful
  return { perYear: Math.round((total / years) * 10) / 10, years: Math.round(years * 10) / 10 };
}

export interface FactItem {
  label: string;
  value: string;
}

/**
 * Compact "at a glance" facts. Only includes entries with real values so the
 * strip never shows empty placeholders.
 */
export function quickFacts(input: {
  mediaType: string;
  status?: string | null;
  year?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  score?: number | null;
  rank?: number | null;
  pace?: { perYear: number } | null;
}): FactItem[] {
  const facts: FactItem[] = [];
  if (input.status) facts.push({ label: "Status", value: input.status });
  if (input.year != null) facts.push({ label: "Year", value: String(input.year) });
  if (input.chapters != null) facts.push({ label: "Chapters", value: String(input.chapters) });
  if (input.volumes != null) facts.push({ label: "Volumes", value: String(input.volumes) });
  if (input.score != null)
    facts.push({ label: "Score", value: `${input.score.toFixed(1)} / 10` });
  if (input.rank != null)
    facts.push({ label: "Global rank", value: `#${input.rank.toLocaleString()}` });
  if (input.pace) facts.push({ label: "Pace", value: `${input.pace.perYear}/yr` });
  return facts;
}
