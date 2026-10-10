import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { browseHistory } from "@ambl/database";
import { getDb } from "@/lib/db";
import {
  extensionCorsHeaders,
  getBearerToken,
  unauthorized,
  verifyApiKey,
} from "@/lib/api-keys";

export const dynamic = "force-dynamic";

const browseSchema = z.object({
  url: z.string().max(2000).min(4),
  title: z.string().max(500).optional(),
  site: z.string().max(128).optional(),
  malId: z.number().int().positive().optional().nullable(),
  mediaType: z.string().max(10).optional(),
  coverUrl: z.string().max(2000).optional(),
  unit: z.enum(["CHAPTER", "EPISODE"]).default("CHAPTER"),
  value: z.number().int().min(1).optional(),
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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: extensionCorsHeaders() },
    );
  }

  const parsed = browseSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400, headers: extensionCorsHeaders() },
    );
  }

  const db = getDb();
  await db.insert(browseHistory).values({
    userId: auth.userId,
    url: parsed.data.url,
    title: parsed.data.title,
    site: parsed.data.site,
    malId: parsed.data.malId ?? null,
    mediaType: parsed.data.mediaType,
    coverUrl: parsed.data.coverUrl,
    unit: parsed.data.unit,
    value: parsed.data.value ?? 1,
  });

  return NextResponse.json({ ok: true }, { headers: extensionCorsHeaders() });
}