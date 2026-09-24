import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { progressHistory, titles, userProgress } from "@ambl/database";
import { getDb } from "@/lib/db";
import {
  extensionCorsHeaders,
  getBearerToken,
  unauthorized,
  verifyApiKey,
} from "@/lib/api-keys";

export const dynamic = "force-dynamic";

const progressSchema = z
  .object({
    titleId: z.string().uuid().optional(),
    malId: z.number().int().optional(),
    unit: z.enum(["EPISODE", "CHAPTER"]),
    value: z.number().int().min(1),
    kind: z.enum(["OPENED", "COMPLETED"]).default("OPENED"),
    sourceUrl: z.string().max(2000).optional(),
    source: z.string().max(60).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.titleId && !v.malId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "titleId or malId is required.",
      });
    }
  });

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: extensionCorsHeaders(),
  });
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  const auth = token ? await verifyApiKey(token) : null;
  if (!auth) return unauthorized();

  const db = getDb();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: extensionCorsHeaders() },
    );
  }

  const parsed = progressSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400, headers: extensionCorsHeaders() },
    );
  }

  const { titleId: rawTitleId, malId, unit, value, kind } = parsed.data;
  const source = parsed.data.source ?? null;
  const sourceUrl = parsed.data.sourceUrl ?? null;

  let titleId = rawTitleId;
  if (!titleId) {
    const row = await db
      .select({ id: titles.id })
      .from(titles)
      .where(and(eq(titles.source, "JIKAN"), eq(titles.malId, malId!)))
      .limit(1);
    if (!row[0]) {
      return NextResponse.json(
        { error: "Title not found" },
        { status: 404, headers: extensionCorsHeaders() },
      );
    }
    titleId = row[0].id;
  }

  let insertPatch: Partial<typeof userProgress.$inferInsert> = {};
  let updatePatch: Record<string, SQL<unknown>> = {};
  if (unit === "EPISODE") {
    if (kind === "OPENED") {
      insertPatch = { lastOpenedEpisode: value };
      updatePatch = {
        lastOpenedEpisode: sql`GREATEST(${userProgress.lastOpenedEpisode}, ${value})`,
      };
    } else {
      insertPatch = { lastCompletedEpisode: value };
      updatePatch = {
        lastCompletedEpisode: sql`GREATEST(${userProgress.lastCompletedEpisode}, ${value})`,
      };
    }
  } else if (kind === "OPENED") {
    insertPatch = { lastOpenedChapter: value };
    updatePatch = {
      lastOpenedChapter: sql`GREATEST(${userProgress.lastOpenedChapter}, ${value})`,
    };
  } else {
    insertPatch = { lastCompletedChapter: value };
    updatePatch = {
      lastCompletedChapter: sql`GREATEST(${userProgress.lastCompletedChapter}, ${value})`,
    };
  }

  await db
    .insert(userProgress)
    .values({
      userId: auth.userId,
      titleId,
      ...insertPatch,
      updatedBy: "EXTENSION",
      ...(source ? { lastSource: source } : {}),
      ...(sourceUrl ? { lastSourceUrl: sourceUrl } : {}),
    })
    .onConflictDoUpdate({
      target: [userProgress.userId, userProgress.titleId],
      set: {
        ...updatePatch,
        updatedBy: "EXTENSION",
        updatedAt: new Date(),
        ...(source ? { lastSource: source } : {}),
        ...(sourceUrl ? { lastSourceUrl: sourceUrl } : {}),
      },
    });

  await db.insert(progressHistory).values({
    userId: auth.userId,
    titleId,
    unit,
    kind,
    value,
    source,
    sourceUrl,
  });

  return NextResponse.json(
    { ok: true },
    { headers: extensionCorsHeaders() },
  );
}