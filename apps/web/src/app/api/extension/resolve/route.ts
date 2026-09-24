import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  extensionCorsHeaders,
  getBearerToken,
  unauthorized,
  verifyApiKey,
} from "@/lib/api-keys";
import { searchTitles } from "@/lib/title-resolver";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().max(500).min(1),
  unit: z.enum(["EPISODE", "CHAPTER"]).default("CHAPTER"),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

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

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query." },
      { status: 400, headers: extensionCorsHeaders() },
    );
  }

  const { q, unit, limit } = parsed.data;
  const db = getDb();
  const candidates = await searchTitles(db, q, unit);

  return NextResponse.json(
    { candidates: candidates.slice(0, limit) },
    { headers: extensionCorsHeaders() },
  );
}