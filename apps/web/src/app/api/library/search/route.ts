import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { userLibrary, titles } from "@ambl/database";

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
      titleId: titles.id,
      title: titles.primaryTitle,
      englishTitle: titles.englishTitle,
      mediaType: titles.mediaType,
      status: titles.status,
      year: titles.year,
      coverUrl: titles.coverUrl,
    })
    .from(userLibrary)
    .innerJoin(titles, eq(userLibrary.titleId, titles.id))
    .where(
      and(
        eq(userLibrary.userId, user.id),
        or(
          ilike(titles.primaryTitle, `%${parsed.data.q}%`),
          ilike(titles.englishTitle ?? "", `%${parsed.data.q}%`),
        )
      )
    )
    .limit(parsed.data.limit);

  return NextResponse.json({ items });
}