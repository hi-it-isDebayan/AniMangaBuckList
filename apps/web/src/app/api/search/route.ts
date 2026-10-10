import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getMetadataProvider } from "@ambl/providers";
import { providerEntries, titles, userLibrary } from "@ambl/database";
import type { ProviderProgressBadge, TrackerProvider } from "@ambl/types";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const searchQuery = z.object({
  q: z.string().trim().min(1, "Query required").max(120),
  type: z.enum(["ANIME", "MANGA", "BOOK"]).default("MANGA"),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

const PROVIDER_LABEL: Record<TrackerProvider, string> = {
  mal: "MyAnimeList",
  anilist: "AniList",
  mangabaka: "MangaBaka",
};

function badgeFor(entry: (typeof providerEntries.$inferSelect)[] | null): ProviderProgressBadge | null {
  const first = entry?.[0];
  if (!first) return null;
  const provider = first.provider as TrackerProvider;
  const unit = first.progressUnit ?? "CHAPTER";
  const value = first.progressValue;
  return {
    provider,
    label: PROVIDER_LABEL[provider] ?? first.provider,
    unit,
    value,
    text: value == null ? null : `${unit === "EPISODE" ? "Ep" : "Ch"} ${value}`,
    status: first.status,
  };
}

export async function GET(req: NextRequest) {
  const parsed = searchQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 },
    );
  }

  const provider = getMetadataProvider();
  let items;
  try {
    items = await provider.search(parsed.data.q, {
      type: parsed.data.type,
      limit: parsed.data.limit,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }

  const db = getDb();
  const user = await getCurrentUser();

  let libraryIds = new Set<string>();
  if (user) {
    const rows = await db
      .select({ titleId: userLibrary.titleId })
      .from(userLibrary)
      .where(eq(userLibrary.userId, user.id));
    libraryIds = new Set(rows.map((r) => r.titleId));
  }

  let byKey = new Map<string, string>();
  const malIds = items.map((i) => i.malId).filter((m): m is number => m !== null);
  if (malIds.length > 0) {
    const known = await db
      .select({ id: titles.id, malId: titles.malId, source: titles.source })
      .from(titles)
      .where(inArray(titles.malId, malIds));
    byKey = new Map(known.map((k) => [`${k.source}:${k.malId}`, k.id]));
  }

  let byMalId = new Map<number, (typeof providerEntries.$inferSelect)[]>();
  let byAnilistId = new Map<number, (typeof providerEntries.$inferSelect)[]>();
  if (user) {
    const rows = await db
      .select()
      .from(providerEntries)
      .where(eq(providerEntries.userId, user.id));
    for (const row of rows) {
      if (row.malId != null) {
        const list = byMalId.get(row.malId) ?? [];
        list.push(row);
        byMalId.set(row.malId, list);
      }
      if (row.anilistId != null) {
        const list = byAnilistId.get(row.anilistId) ?? [];
        list.push(row);
        byAnilistId.set(row.anilistId, list);
      }
    }
  }

  const sourceKey = provider.name.toUpperCase();
  const enriched = items.map((item) => {
    const titleId = item.malId === null ? null : byKey.get(`${sourceKey}:${item.malId}`) ?? null;

    const candidates = [
      ...(item.malId != null ? byMalId.get(item.malId) ?? [] : []),
      ...(item.anilistId != null ? byAnilistId.get(item.anilistId) ?? [] : []),
    ];
    const priority: TrackerProvider[] = ["mangabaka", "anilist", "mal"];
    const seen = new Set<string>();
    const ranked = priority
      .map((p) => candidates.find((c) => c.provider === p))
      .filter((c): c is (typeof providerEntries.$inferSelect) => !!c)
      .filter((c) => {
        const k = `${c.provider}:${c.externalId}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

    return {
      ...item,
      titleId,
      inLibrary: titleId !== null && (user ? libraryIds.has(titleId) : false),
      providerProgress: badgeFor(ranked),
    };
  });

  return NextResponse.json({ items: enriched });
}