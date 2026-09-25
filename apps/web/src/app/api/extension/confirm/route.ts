import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { titles } from "@ambl/database";
import { getDb } from "@/lib/db";
import {
  extensionCorsHeaders,
  getBearerToken,
  unauthorized,
  verifyApiKey,
} from "@/lib/api-keys";
import { rememberTitleMatch, normalizeTitle } from "@/lib/title-resolver";
import { recordProgress } from "@/lib/progress";

export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  titleId: z.string().uuid(),
  detectedTitle: z.string().max(500).min(1),
  titleCandidates: z.array(z.string().max(500)).max(20).optional(),
  unit: z.enum(["EPISODE", "CHAPTER"]),
  value: z.number().int().min(1),
  kind: z.enum(["OPENED", "COMPLETED"]).default("OPENED"),
  sourceUrl: z.string().max(2000).optional(),
  source: z.string().max(60).optional(),
  host: z.string().max(255).optional(),
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

  const parsed = confirmSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400, headers: extensionCorsHeaders() },
    );
  }

  const {
    titleId,
    detectedTitle,
    titleCandidates,
    unit,
    value,
    kind,
    source,
    sourceUrl,
    host,
  } = parsed.data;

  const exist = await db
    .select({ id: titles.id })
    .from(titles)
    .where(eq(titles.id, titleId))
    .limit(1);
  if (!exist[0]) {
    return NextResponse.json(
      { error: "Title not found" },
      { status: 404, headers: extensionCorsHeaders() },
    );
  }

  const normalizedDetected = normalizeTitle(detectedTitle);
  if (normalizedDetected) {
    await rememberTitleMatch(db, {
      userId: auth.userId,
      normalizedTitle: normalizedDetected,
      titleId,
      host: host ?? null,
    });
  }

  await recordProgress(db, {
    userId: auth.userId,
    titleId,
    unit,
    value,
    kind,
    source,
    sourceUrl,
  });

  return NextResponse.json(
    { ok: true, titleId },
    { headers: extensionCorsHeaders() },
  );
}