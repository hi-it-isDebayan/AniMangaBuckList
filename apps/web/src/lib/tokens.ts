import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { authTokens } from "@ambl/database";
import { getDb } from "./db";

export type AuthTokenKind = "password_reset" | "email_verify";

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedAuthToken {
  raw: string;
  expiresAt: Date;
}

export async function issueAuthToken(
  userId: string,
  kind: AuthTokenKind,
  ttlMs = 15 * 60 * 1000,
): Promise<IssuedAuthToken> {
  const db = getDb();
  await db
    .delete(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.kind, kind)));
  const raw = randomToken();
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.insert(authTokens).values({
    userId,
    kind,
    tokenHash: hashToken(raw),
    expiresAt,
  });
  return { raw, expiresAt };
}

export async function consumeAuthToken(
  raw: string,
  kind: AuthTokenKind,
): Promise<string | null> {
  const db = getDb();
  if (!raw || raw.length < 20) return null;
  const row = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.kind, kind),
        eq(authTokens.tokenHash, hashToken(raw)),
        isNull(authTokens.usedAt),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, row.id));
  return row.userId;
}