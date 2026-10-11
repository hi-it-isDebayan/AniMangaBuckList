import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, ilike, or, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { browseHistory } from "@ambl/database";

export const dynamic = "force-dynamic";

const searchQuery = z.object({
  q: z.string().trim().min(1, "Query required").max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  const parsed = searchQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 },
    );
  }

  const db = getDb();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ items: [] });
  }

  const { q, limit } = parsed.data;

  const items = await db
    .select({
      id: browseHistory.id,
      title: browseHistory.title,
      site: browseHistory.site,
      coverUrl: browseHistory.coverUrl,
      malId: browseHistory.malId,
      unit: browseHistory.unit,
      value: browseHistory.value,
      visitedAt: browseHistory.visitedAt,
    })
    .from(browseHistory)
    .where(
      and(
        eq(browseHistory.userId, user.id),
        or(
          ilike(browseHistory.title, `%${parsed.data.q}%`),
          ilike(browseHistory.site ?? "", `%${parsed.data.q}%`),
        )
      )
    )
    .orderBy(desc(browseHistory.visitedAt))
    .limit(parsed.data.limit);

  return NextResponse.json({ items });
}