import { and, desc, eq, isNull } from "drizzle-orm";
import { webauthnChallenges, webauthnCredentials } from "@ambl/database";
import { getDb } from "./db";

export type PasskeyKind = "register" | "authenticate";

export async function saveChallenge(
  userId: string | null,
  kind: PasskeyKind,
  challenge: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(webauthnChallenges)
    .where(
      userId === null
        ? and(eq(webauthnChallenges.kind, kind), isNull(webauthnChallenges.userId))
        : and(eq(webauthnChallenges.userId, userId), eq(webauthnChallenges.kind, kind)),
    );
  await db.insert(webauthnChallenges).values({
    userId,
    kind,
    challenge,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
}

export async function findChallenge(
  kind: PasskeyKind,
  challenge: string,
  userId?: string | null,
) {
  const db = getDb();
  const row = await db
    .select()
    .from(webauthnChallenges)
    .where(and(eq(webauthnChallenges.kind, kind), eq(webauthnChallenges.challenge, challenge)))
    .limit(1)
    .then((r) => r[0]);
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  if (userId !== undefined && row.userId !== userId) return null;
  return row;
}

export async function deleteChallenge(id: string): Promise<void> {
  await getDb().delete(webauthnChallenges).where(eq(webauthnChallenges.id, id));
}

export async function getCredentialByCredentialId(credentialId: string) {
  const row = await getDb()
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.credentialId, credentialId))
    .limit(1)
    .then((r) => r[0]);
  return row ?? null;
}

export async function getCredentialsForUser(userId: string) {
  return getDb()
    .select({
      id: webauthnCredentials.id,
      credentialId: webauthnCredentials.credentialId,
      name: webauthnCredentials.name,
      lastUsedAt: webauthnCredentials.lastUsedAt,
      createdAt: webauthnCredentials.createdAt,
    })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId))
    .orderBy(desc(webauthnCredentials.createdAt));
}

export function publicKeyFromBase64Url(b64: string): Uint8Array<ArrayBuffer> {
  return Buffer.from(b64, "base64url") as unknown as Uint8Array<ArrayBuffer>;
}