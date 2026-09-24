import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getMetadataProvider } from "@ambl/providers";
import { titles, userLibrary } from "@ambl/database";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const searchQuery = z.object({
  q: z.string().trim().min(1, "Query required").max(120),
  type: z.enum(["ANIME", "MANGA", "BOOK"]).default("MANGA"),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

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

  const sourceKey = provider.name.toUpperCase();
  const enriched = items.map((item) => {
    const titleId = item.malId === null ? null : byKey.get(`${sourceKey}:${item.malId}`) ?? null;
    return {
      ...item,
      titleId,
      inLibrary: titleId !== null && (user ? libraryIds.has(titleId) : false),
    };
  });

  return NextResponse.json({ items: enriched });
}