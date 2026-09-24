import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { publicApiKeys } from "@ambl/database";
import { getDb } from "@/lib/db";

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function extensionCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: extensionCorsHeaders() },
  );
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function verifyApiKey(
  raw: string,
): Promise<{ userId: string; keyId: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ userId: publicApiKeys.userId, id: publicApiKeys.id })
    .from(publicApiKeys)
    .where(eq(publicApiKeys.keyHash, hashApiKey(raw)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  db.update(publicApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(publicApiKeys.id, row.id))
    .catch(() => {});
  return { userId: row.userId, keyId: row.id };
}

export async function generateApiKey(
  userId: string,
  name: string = "Extension",
): Promise<{
  key: string;
  id: string;
  name: string;
  lastFour: string;
  createdAt: Date;
}> {
  const db = getDb();
  const existing = await db
    .select({ name: publicApiKeys.name })
    .from(publicApiKeys)
    .where(eq(publicApiKeys.userId, userId));
  const taken = new Set(existing.map((r) => r.name));

  const baseName = name.trim().slice(0, 100) || "Extension";
  let finalName = baseName;
  let counter = 2;
  while (taken.has(finalName)) {
    finalName = `${baseName} ${counter}`;
    counter += 1;
  }

  const raw = `ambl_${randomBytes(18).toString("base64url")}`;
  const rows = await db
    .insert(publicApiKeys)
    .values({
      userId,
      name: finalName,
      keyHash: hashApiKey(raw),
      lastFour: raw.slice(-4),
    })
    .returning({
      id: publicApiKeys.id,
      name: publicApiKeys.name,
      createdAt: publicApiKeys.createdAt,
    });

  const row = rows[0]!;
  return {
    key: raw,
    id: row.id,
    name: row.name,
    lastFour: raw.slice(-4),
    createdAt: row.createdAt,
  };
}