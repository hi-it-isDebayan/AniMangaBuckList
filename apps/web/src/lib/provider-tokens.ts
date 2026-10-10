import { and, eq } from "drizzle-orm";
import { oauthTokens } from "@ambl/database";
import { getDb } from "@/lib/db";

export type TokenProvider = "mal" | "anilist" | "mangabaka";

export interface ProviderTokenRecord {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export async function saveProviderTokens(
  userId: string,
  provider: TokenProvider,
  tokens: {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
  },
): Promise<void> {
  const db = getDb();
  await db
    .insert(oauthTokens)
    .values({
      userId,
      provider,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      expiresAt: tokens.expiresAt ?? null,
    })
    .onConflictDoUpdate({
      target: [oauthTokens.userId, oauthTokens.provider],
      set: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        expiresAt: tokens.expiresAt ?? null,
      },
    });
}

export async function getProviderTokens(
  userId: string,
  provider: TokenProvider,
): Promise<ProviderTokenRecord | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
    .limit(1);
  if (!row) return null;
  return {
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
  };
}

export async function deleteProviderTokens(
  userId: string,
  provider: TokenProvider,
): Promise<void> {
  const db = getDb();
  await db
    .delete(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)));
}