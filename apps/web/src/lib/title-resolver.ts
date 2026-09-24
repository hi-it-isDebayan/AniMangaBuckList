import { and, eq, sql } from "drizzle-orm";
import { extensionTitleMatches, titleAliases, titles } from "@ambl/database";
import { getDb } from "@/lib/db";

export interface TitleCandidate {
  titleId: string;
  primaryTitle: string;
  englishTitle: string | null;
  japaneseTitle: string | null;
  mediaType: string;
  coverUrl: string | null;
  malId: number | null;
  score: number;
  matchedBy: "primary" | "english" | "japanese" | "alias";
}

export type ResolveStatus = "resolved" | "confirm" | "empty";

export interface ResolveResult {
  status: ResolveStatus;
  normalized: string;
  titleId?: string;
  primaryTitle?: string;
  candidates: TitleCandidate[];
}

type Db = ReturnType<typeof getDb>;

export const RESOLVE_CONFIDENT = 0.8;

const SITE_TOKENS = [
  "asurascans",
  "asuratoons",
  "asura scans",
  "asurascan",
  "asura",
  "kingofshojo",
  "king of shojo",
  "manhwaplus",
  "manhwa plus",
  "manhwatop",
  "manhwa top",
  "aniwave",
  "animesuge",
  "anime suge",
  "mangakakalot",
  "manganato",
  "bato.to",
  "bato",
  "toonily",
  "flamecomics",
  "fire scns",
  "firescans",
  "reaper scans",
  "reaperscans",
  "webtoon",
  "mangadex",
  "myanimelist",
  "anilist",
  "zoro.to",
  "9anime",
  "crunchyroll",
  "gogoanime",
  "kissmanga",
  "mangafire",
  "mangahere",
];

export function normalizeTitle(raw: string): string {
  let s = (raw ?? "").normalize("NFKC").toLowerCase();
  for (const site of SITE_TOKENS) {
    s = s.replace(new RegExp(site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ");
  }
  s = s.replace(/\./g, " ");
  s = s.replace(/\b(?:chapter|chap|ch)\.?\s*\d+(?:\.?\d+)?/g, " ");
  s = s.replace(/\b(?:episode|ep)\.?\s*\d+(?:\.?\d+)?/g, " ");
  s = s.replace(/\b(?:vol(?:ume)?|season|book)\s*\d+/g, " ");
  s = s.replace(
    /(?:^|\s)(?:read|reading|watch|watching|online|free|english|subbed|sub|dubbed|dub|raw)(?=\s|$)/g,
    " ",
  );
  s = s.replace(/\s*(?:manga|manhwa|manhua|webtoon|comic|comics|series)\s*$/g, " ");
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

async function scoreCandidates(
  db: Db,
  candidatesToTry: string[],
  unit: "EPISODE" | "CHAPTER",
  value?: number,
): Promise<TitleCandidate[]> {
  const allTitles = await db
    .select({
      id: titles.id,
      primaryTitle: titles.primaryTitle,
      englishTitle: titles.englishTitle,
      japaneseTitle: titles.japaneseTitle,
      mediaType: titles.mediaType,
      coverUrl: titles.coverUrl,
      malId: titles.malId,
      episodeCount: titles.episodeCount,
      chapterCount: titles.chapterCount,
    })
    .from(titles);

  const scores = new Map<string, { score: number; matchedBy: TitleCandidate["matchedBy"] }>();

  for (const cand of candidatesToTry) {
    const titleRows = (await db.execute(
      sql`
        select
          t.id as id,
          greatest(
            similarity(${cand}, lower(coalesce(t.primary_title, ''))),
            similarity(${cand}, lower(coalesce(t.english_title, ''))),
            similarity(${cand}, lower(coalesce(t.japanese_title, '')))
          ) as score
        from ${titles} t
      `,
    )) as unknown as { id: string; score: number }[];

    for (const r of titleRows) {
      const best = r.score ?? 0;
      const existing = scores.get(r.id);
      if (!existing || best > existing.score) {
        scores.set(r.id, { score: best, matchedBy: "primary" });
      }
    }

    const aliasRows = (await db.execute(
      sql`
        select
          a.title_id as id,
          max(similarity(${cand}, lower(coalesce(a.alias, '')))) as score
        from ${titleAliases} a
        group by a.title_id
      `,
    )) as unknown as { id: string; score: number }[];

    for (const r of aliasRows) {
      const best = r.score ?? 0;
      const existing = scores.get(r.id);
      if (!existing || best > existing.score) {
        scores.set(r.id, { score: best, matchedBy: "alias" });
      }
    }
  }

  const unitExpectsAnime = unit === "EPISODE";

  const result: TitleCandidate[] = [];
  for (const t of allTitles) {
    const entry = scores.get(t.id);
    if (!entry || entry.score <= 0.08) continue;

    let adj = entry.score;
    const isAnime = t.mediaType === "ANIME";
    if (unitExpectsAnime && isAnime) adj += 0.12;
    if (!unitExpectsAnime && !isAnime) adj += 0.1;
    if (value) {
      if (unitExpectsAnime && (t.episodeCount ?? 0) > 0 && value > t.episodeCount!)
        adj -= 0.5;
      if (!unitExpectsAnime && (t.chapterCount ?? 0) > 0 && value > t.chapterCount!)
        adj -= 0.5;
    }

    const cap = Math.min(adj, 1);
    result.push({
      titleId: t.id,
      primaryTitle: t.primaryTitle,
      englishTitle: t.englishTitle,
      japaneseTitle: t.japaneseTitle,
      mediaType: t.mediaType,
      coverUrl: t.coverUrl,
      malId: t.malId,
      score: Math.round(cap * 1000) / 1000,
      matchedBy: entry.matchedBy,
    });
  }

  result.sort((a, b) => b.score - a.score);
  return result;
}

export async function resolveTitle(
  db: Db,
  opts: {
    userId?: string;
    title: string;
    titleCandidates?: string[];
    unit: "EPISODE" | "CHAPTER";
    value?: number;
    host?: string;
  },
): Promise<ResolveResult> {
  const candidatesToTry = [
    opts.title,
    ...(opts.titleCandidates ?? []),
  ]
    .map(normalizeTitle)
    .filter((t) => t.length >= 2);
  const normalized = candidatesToTry[0] ?? normalizeTitle(opts.title);

  if (!normalized) {
    return { status: "empty", normalized: "", candidates: [] };
  }

  if (opts.userId) {
    const remembered = await db
      .select({ titleId: extensionTitleMatches.titleId })
      .from(extensionTitleMatches)
      .where(
        and(
          eq(extensionTitleMatches.userId, opts.userId),
          eq(extensionTitleMatches.normalizedTitle, normalized),
        ),
      )
      .limit(1);
    if (remembered[0]) {
      const row = await db
        .select({ primaryTitle: titles.primaryTitle })
        .from(titles)
        .where(eq(titles.id, remembered[0].titleId))
        .limit(1);
      if (row[0]) {
        return {
          status: "resolved",
          normalized,
          titleId: remembered[0].titleId,
          primaryTitle: row[0].primaryTitle,
          candidates: [],
        };
      }
    }
  }

  const scored = await scoreCandidates(db, candidatesToTry, opts.unit, opts.value);
  const top = scored[0];
  if (top && top.score >= RESOLVE_CONFIDENT) {
    return {
      status: "resolved",
      normalized,
      titleId: top.titleId,
      primaryTitle: top.primaryTitle,
      candidates: scored.slice(0, 6),
    };
  }

  return {
    status: "confirm",
    normalized,
    candidates: scored.slice(0, 6),
  };
}

export async function rememberTitleMatch(
  db: Db,
  opts: {
    userId: string;
    normalizedTitle: string;
    titleId: string;
    host?: string | null;
  },
) {
  await db
    .insert(extensionTitleMatches)
    .values({
      userId: opts.userId,
      normalizedTitle: opts.normalizedTitle,
      titleId: opts.titleId,
      host: opts.host ?? null,
    })
    .onConflictDoUpdate({
      target: [extensionTitleMatches.userId, extensionTitleMatches.normalizedTitle],
      set: { titleId: opts.titleId },
    });
}

export async function searchTitles(
  db: Db,
  query: string,
  unit: "EPISODE" | "CHAPTER" = "CHAPTER",
): Promise<TitleCandidate[]> {
  const candidatesToTry = [normalizeTitle(query)].filter((t) => t.length >= 2);
  if (!candidatesToTry.length) return [];
  return scoreCandidates(db, candidatesToTry, unit);
}