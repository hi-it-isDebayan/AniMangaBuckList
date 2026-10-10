import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deviceHeartbeats } from "@ambl/database";
import { getDb } from "@/lib/db";
import {
  extensionCorsHeaders,
  getBearerToken,
  unauthorized,
  verifyApiKey,
} from "@/lib/api-keys";

export const dynamic = "force-dynamic";

const heartbeatSchema = z.object({
  platform: z.enum(["extension", "android", "web"]),
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

  const parsed = heartbeatSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "platform must be one of: extension, android, web" },
      { status: 400, headers: extensionCorsHeaders() },
    );
  }

  const db = getDb();
  await db
    .insert(deviceHeartbeats)
    .values({ apiKeyId: auth.keyId, platform: parsed.data.platform, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: [deviceHeartbeats.apiKeyId, deviceHeartbeats.platform],
      set: { lastSeenAt: new Date() },
    });

  return NextResponse.json({ ok: true }, { headers: extensionCorsHeaders() });
}