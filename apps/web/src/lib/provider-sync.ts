import { and, desc, eq } from "drizzle-orm";
import { providerEntries } from "@ambl/database";
import { getDb } from "@/lib/db";
import {
  getProviderTokens,
  saveProviderTokens,
  type TokenProvider,
} from "@/lib/provider-tokens";

export type { TokenProvider };

export interface SyncResult {
  ok: boolean;
  count?: number;
  error?: string;
}

interface ListEntry {
  externalId: string;
  anilistId: number | null;
  malId: number | null;
  mediaType: "ANIME" | "MANGA" | "MANHWA" | "MANHUA" | "LIGHT_NOVEL" | "WEB_NOVEL" | null;
  title: string;
  coverUrl: string | null;
  progressValue: number | null;
  progressUnit: "EPISODE" | "CHAPTER" | null;
  status: string | null;
}

async function replaceEntries(userId: string, provider: TokenProvider, entries: ListEntry[]) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(providerEntries)
      .where(
        and(
          eq(providerEntries.userId, userId),
          eq(providerEntries.provider, provider),
        ),
      );
    if (entries.length === 0) return;
    await tx
      .insert(providerEntries)
      .values(
        entries.map((e) => ({
          userId,
          provider,
          externalId: e.externalId,
          anilistId: e.anilistId,
          malId: e.malId,
          mediaType: e.mediaType,
          title: e.title,
          coverUrl: e.coverUrl,
          progressValue: e.progressValue,
          progressUnit: e.progressUnit,
          status: e.status,
        })),
      )
      .onConflictDoNothing({
        target: [
          providerEntries.userId,
          providerEntries.provider,
          providerEntries.externalId,
        ],
      });
  });
}

function mapBookType(type?: string | null): ListEntry["mediaType"] {
  switch (type?.toLowerCase()) {
    case "manhwa":
      return "MANHWA";
    case "manhua":
      return "MANHUA";
    case "light_novel":
    case "light novel":
      return "LIGHT_NOVEL";
    case "novel":
      return "WEB_NOVEL";
    case "manga":
    case "one_shot":
    default:
      return "MANGA";
  }
}

async function refreshMalToken(userId: string, refreshToken: string): Promise<string | null> {
  const clientId = process.env.MAL_CLIENT_ID;
  const clientSecret = process.env.MAL_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const res = await fetch("https://myanimelist.net/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-MAL-CLIENT-ID": clientId,
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;
  await saveProviderTokens(userId, "mal", {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  });
  return data.access_token;
}

async function malListPage(
  accessToken: string,
  path: "animelist" | "mangalist",
  offset: number,
) {
  const fields = "list_status,node{id,title,main_picture,media_type}";
  const res = await fetch(
    `https://api.myanimelist.net/v2/users/@me/${path}?fields=${fields}&limit=100&offset=${offset}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (!res.ok) return { status: res.status, data: null };
  return { status: res.status, data: (await res.json()) as Record<string, unknown> };
}

async function syncMal(userId: string): Promise<number> {
  const tokens = await getProviderTokens(userId, "mal");
  if (!tokens) return 0;

  const entries: ListEntry[] = [];
  let accessToken = tokens.accessToken;

  const lists: Array<"animelist" | "mangalist"> = ["animelist", "mangalist"];
  for (const path of lists) {
    let offset = 0;
    for (let page = 0; page < 10; page += 1) {
      const result = await malListPage(accessToken, path, offset);
      if (result.status === 401 && tokens.refreshToken) {
        const refreshed = await refreshMalToken(userId, tokens.refreshToken);
        if (refreshed) {
          accessToken = refreshed;
          const retry = await malListPage(accessToken, path, offset);
          result.status = retry.status;
          result.data = retry.data;
        }
      }
      if (result.status !== 200 || !result.data) break;

      const data = result.data as {
        data: {
          node?: {
            id?: number;
            title?: string;
            main_picture?: { large?: string | null; medium?: string | null } | null;
            media_type?: string | null;
          } | null;
          list_status?: {
            status?: string | null;
            num_episodes_watched?: number | null;
            num_chapters_read?: number | null;
          } | null;
        }[];
        paging?: { next?: string | null } | null;
      };

      for (const item of data.data ?? []) {
        const node = item.node;
        if (!node?.id) continue;
        const isAnime = path === "animelist";
        entries.push({
          externalId: String(node.id),
          anilistId: null,
          malId: node.id,
          mediaType: isAnime ? "ANIME" : mapBookType(node.media_type),
          title: node.title?.trim() || "",
          coverUrl: node.main_picture?.large ?? node.main_picture?.medium ?? null,
          progressValue: isAnime
            ? item.list_status?.num_episodes_watched ?? null
            : item.list_status?.num_chapters_read ?? null,
          progressUnit: isAnime ? "EPISODE" : "CHAPTER",
          status: item.list_status?.status ?? null,
        });
      }

      const next = data.paging?.next;
      if (!next) break;
      const nextUrl = new URL(next);
      offset = Number(nextUrl.searchParams.get("offset") ?? offset);
    }
  }

  await replaceEntries(userId, "mal", entries);
  return entries.length;
}

interface MangabakaSeriesSource {
  anilist?: { id?: number | null } | null;
  my_anime_list?: { id?: number | null } | null;
}

interface MangabakaLibraryItem {
  series_id?: number;
  progress_chapter?: number | null;
  progress_volume?: number | null;
  state?: string | null;
  Series?: {
    title?: string;
    type?: string | null;
    cover?: {
      x250?: { x1?: string | null } | null;
      raw?: { url?: string | null } | null;
    } | null;
    source?: MangabakaSeriesSource | null;
  } | null;
}

function mangabakaApiKey(): string | null {
  return process.env.MANGABAKA_API_KEY?.trim() || null;
}

async function mangabakaLibraryPage(accessToken: string, page: number) {
  const res = await fetch(
    `https://api.mangabaka.org/v1/my/library?limit=100&page=${page}`,
    {
      headers: {
        "x-api-key": accessToken,
        "Accept": "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return { status: res.status, data: null };
  return { status: res.status, data: (await res.json()) as Record<string, unknown> };
}

async function syncMangabaka(userId: string): Promise<number> {
  const apiKey = mangabakaApiKey();
  if (!apiKey) return 0;

  const entries: ListEntry[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const result = await mangabakaLibraryPage(apiKey, page);
    if (result.status !== 200 || !result.data) break;

    const data = result.data as {
      data?: MangabakaLibraryItem[];
      pagination?: { next?: string | null } | null;
    };

    for (const item of data.data ?? []) {
      const series = item.Series;
      const title = series?.title?.trim();
      if (!item.series_id || !title) continue;
      entries.push({
        externalId: String(item.series_id),
        anilistId: series?.source?.anilist?.id ?? null,
        malId: series?.source?.my_anime_list?.id ?? null,
        mediaType: "ANIME" === series?.type ? "ANIME" : mapBookType(series?.type),
        title,
        coverUrl:
          series?.cover?.x250?.x1 ?? series?.cover?.raw?.url ?? null,
        progressValue: item.progress_chapter ?? null,
        progressUnit: "CHAPTER",
        status: item.state ?? null,
      });
    }

    if (!data.pagination?.next) break;
  }

  await replaceEntries(userId, "mangabaka", entries);
  return entries.length;
}

export async function syncProviderEntries(
  userId: string,
  provider: TokenProvider,
): Promise<SyncResult> {
  try {
    const count =
      provider === "mal" ? await syncMal(userId) : await syncMangabaka(userId);
    return { ok: true, count };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not sync provider list.",
    };
  }
}

export async function deleteProviderRows(
  userId: string,
  provider: TokenProvider,
): Promise<void> {
  const db = getDb();
  await db
    .delete(providerEntries)
    .where(
      and(eq(providerEntries.userId, userId), eq(providerEntries.provider, provider)),
    );
}

const DEFAULT_SYNC_TTL_HOURS = 6;

export async function mangabakaLastSynced(userId: string): Promise<Date | null> {
  if (!mangabakaApiKey()) return null;
  const [row] = await getDb()
    .select()
    .from(providerEntries)
    .where(and(eq(providerEntries.userId, userId), eq(providerEntries.provider, "mangabaka")))
    .orderBy(desc(providerEntries.updatedAt))
    .limit(1);
  return row ? row.updatedAt : null;
}

export async function ensureMangabakaSynced(userId: string): Promise<void> {
  if (!mangabakaApiKey()) return;
  const db = getDb();
  const [row] = await db
    .select()
    .from(providerEntries)
    .where(and(eq(providerEntries.userId, userId), eq(providerEntries.provider, "mangabaka")))
    .orderBy(desc(providerEntries.updatedAt))
    .limit(1);

  const ttlHours = Number(process.env.MANGABAKA_SYNC_TTL_HOURS ?? DEFAULT_SYNC_TTL_HOURS);
  if (row && Date.now() - row.updatedAt.getTime() < ttlHours * 60 * 60 * 1000) {
    return;
  }

  try {
    await syncMangabaka(userId);
  } catch (err) {
    // Never break the caller (search/profile) because MangaBaka is down.
    console.error("MangaBaka sync failed:", err);
  }
}

export async function countMangabakaEntries(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: providerEntries.id })
    .from(providerEntries)
    .where(and(eq(providerEntries.userId, userId), eq(providerEntries.provider, "mangabaka")));
  return rows.length;
}