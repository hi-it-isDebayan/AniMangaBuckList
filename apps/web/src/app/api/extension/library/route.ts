import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { titles, userProgress } from "@ambl/database";
import { getDb } from "@/lib/db";
import {
  extensionCorsHeaders,
  getBearerToken,
  unauthorized,
  verifyApiKey,
} from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: extensionCorsHeaders(),
  });
}

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  const auth = token ? await verifyApiKey(token) : null;
  if (!auth) return unauthorized();

  const db = getDb();
  const rows = await db
    .select({
      titleId: userProgress.titleId,
      lastOpenedChapter: userProgress.lastOpenedChapter,
      lastCompletedChapter: userProgress.lastCompletedChapter,
      lastOpenedEpisode: userProgress.lastOpenedEpisode,
      lastCompletedEpisode: userProgress.lastCompletedEpisode,
      malId: titles.malId,
      primaryTitle: titles.primaryTitle,
      englishTitle: titles.englishTitle,
      mediaType: titles.mediaType,
      coverUrl: titles.coverUrl,
    })
    .from(userProgress)
    .innerJoin(titles, eq(userProgress.titleId, titles.id))
    .where(eq(userProgress.userId, auth.userId));

  const items = rows.map((row) => ({
    titleId: row.titleId,
    progress: {
      lastOpenedChapter: row.lastOpenedChapter,
      lastCompletedChapter: row.lastCompletedChapter,
      lastOpenedEpisode: row.lastOpenedEpisode,
      lastCompletedEpisode: row.lastCompletedEpisode,
    },
    title: {
      malId: row.malId,
      primaryTitle: row.primaryTitle,
      englishTitle: row.englishTitle,
      mediaType: row.mediaType,
      coverUrl: row.coverUrl,
    },
  }));

  return NextResponse.json({ items }, { headers: extensionCorsHeaders() });
}