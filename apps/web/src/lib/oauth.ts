import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, or } from "drizzle-orm";
import { userOauthAccounts, users } from "@ambl/database";
import { getDb } from "@/lib/db";

export type OAuthProvider = "mal" | "google";
export type OAuthMode = "signin" | "link";

const STATE_COOKIE = "ambl_oauth_state";
const VERIFIER_COOKIE = "ambl_mal_verifier";
const MODE_COOKIE = "ambl_oauth_mode";

function b64Url(input: Buffer): string {
  return input.toString("base64url");
}

function sha256Hex(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return b64Url(randomBytes(bytes));
}

export function getRequestBaseUrl(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    return `${forwarded ?? "https"}://${host}`;
  }
  return new URL(request.url).origin;
}

const stateCookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 600,
};

export interface OAuthState {
  state: string;
  verifier: string;
  mode: OAuthMode;
}

export async function setOAuthStateCookies(mode: OAuthMode): Promise<OAuthState> {
  const state = randomToken();
  const verifier = randomToken(64);
  const store = await cookies();
  store.set(STATE_COOKIE, state, stateCookieOpts);
  store.set(VERIFIER_COOKIE, verifier, stateCookieOpts);
  store.set(MODE_COOKIE, mode, { ...stateCookieOpts, maxAge: 600 });
  return { state, verifier, mode };
}

export async function consumeOAuthCookies(
  expected: string,
): Promise<{ ok: boolean; verifier?: string; mode?: OAuthMode }> {
  const store = await cookies();
  const actual = store.get(STATE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;
  const mode = (store.get(MODE_COOKIE)?.value as OAuthMode | undefined) ?? "signin";
  store.set(STATE_COOKIE, "", { ...stateCookieOpts, maxAge: 0 });
  store.set(VERIFIER_COOKIE, "", { ...stateCookieOpts, maxAge: 0 });
  store.set(MODE_COOKIE, "", { ...stateCookieOpts, maxAge: 0 });
  return { ok: !!expected && expected === actual, verifier, mode };
}

export async function clearOAuthCookies(): Promise<void> {
  const store = await cookies();
  store.set(STATE_COOKIE, "", { ...stateCookieOpts, maxAge: 0 });
  store.set(VERIFIER_COOKIE, "", { ...stateCookieOpts, maxAge: 0 });
  store.set(MODE_COOKIE, "", { ...stateCookieOpts, maxAge: 0 });
}

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  if (provider === "mal") {
    return !!(process.env.MAL_CLIENT_ID && process.env.MAL_CLIENT_SECRET);
  }
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function providerLabel(provider: OAuthProvider): string {
  return provider === "google" ? "Google" : "MyAnimeList";
}

export interface OAuthIdentity {
  providerId: string;
  email?: string;
  displayName?: string;
  pictureUrl?: string;
}

async function refreshUserProfile(
  userId: string,
  provider: OAuthProvider,
  identity: OAuthIdentity,
): Promise<void> {
  if (!identity.displayName && !identity.pictureUrl) return;
  await getDb()
    .update(users)
    .set({
      ...(identity.displayName ? { displayName: identity.displayName.slice(0, 120) } : {}),
      ...(identity.pictureUrl ? { avatarUrl: identity.pictureUrl } : {}),
    })
    .where(eq(users.id, userId));
  await getDb()
    .update(userOauthAccounts)
    .set({
      ...(identity.displayName ? { displayName: identity.displayName.slice(0, 120) } : {}),
      ...(identity.pictureUrl ? { pictureUrl: identity.pictureUrl } : {}),
    })
    .where(
      and(
        eq(userOauthAccounts.userId, userId),
        eq(userOauthAccounts.provider, provider),
      ),
    );
}

export async function findOrCreateOAuthUser(
  provider: OAuthProvider,
  identity: OAuthIdentity,
): Promise<string> {
  const db = getDb();
  const email = identity.email?.toLowerCase().trim();

  const byIdentity = await db
    .select({ id: users.id })
    .from(userOauthAccounts)
    .innerJoin(users, eq(userOauthAccounts.userId, users.id))
    .where(
      and(
        eq(userOauthAccounts.provider, provider),
        eq(userOauthAccounts.oauthId, identity.providerId),
      ),
    )
    .limit(1);
  if (byIdentity[0]) {
    await refreshUserProfile(byIdentity[0].id, provider, identity);
    return byIdentity[0].id;
  }

  if (email) {
    const byEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (byEmail[0]) {
      const claimed = await db
        .select({ id: userOauthAccounts.id })
        .from(userOauthAccounts)
        .where(eq(userOauthAccounts.userId, byEmail[0].id))
        .limit(1);
      const canAttach = !!byEmail[0].passwordHash || claimed.length === 0;
      if (!canAttach) {
        throw new Error(
          `This ${providerLabel(provider)} account's email already belongs to a different account.`,
        );
      }
      await db
        .insert(userOauthAccounts)
        .values({
          userId: byEmail[0].id,
          provider,
          oauthId: identity.providerId,
          displayName: identity.displayName?.slice(0, 120),
          pictureUrl: identity.pictureUrl,
        })
        .onConflictDoNothing({
          target: [userOauthAccounts.provider, userOauthAccounts.oauthId],
        });
      await db
        .update(users)
        .set({
          ...(identity.pictureUrl ? { avatarUrl: identity.pictureUrl } : {}),
          oauthProvider: provider,
          oauthId: identity.providerId,
        })
        .where(eq(users.id, byEmail[0].id));
      return byEmail[0].id;
    }
  }

  const providerEmail = email?.length
    ? email
    : `${provider}:${sha256Hex(Buffer.from(identity.providerId)).slice(0, 24)}@oauth.local`;

  const inserted = await db
    .insert(users)
    .values({
      email: providerEmail,
      displayName: identity.displayName?.slice(0, 120) ?? "",
      passwordHash: null,
      avatarUrl: identity.pictureUrl,
      oauthProvider: provider,
      oauthId: identity.providerId,
    })
    .onConflictDoNothing({
      target: [users.email],
    })
    .returning({ id: users.id });

  if (inserted[0]) {
    await db
      .insert(userOauthAccounts)
      .values({
        userId: inserted[0].id,
        provider,
        oauthId: identity.providerId,
        displayName: identity.displayName?.slice(0, 120),
        pictureUrl: identity.pictureUrl,
      })
      .onConflictDoNothing({
        target: [userOauthAccounts.provider, userOauthAccounts.oauthId],
      });
    return inserted[0].id;
  }

  const retry = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        and(eq(users.oauthProvider, provider), eq(users.oauthId, identity.providerId)),
        eq(users.email, providerEmail),
      ),
    )
    .limit(1);
  if (retry[0]) return retry[0].id;
  throw new Error("Could not create account.");
}

export async function linkOAuthAccount(
  userId: string,
  provider: OAuthProvider,
  identity: OAuthIdentity,
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ userId: userOauthAccounts.userId })
    .from(userOauthAccounts)
    .where(
      and(
        eq(userOauthAccounts.provider, provider),
        eq(userOauthAccounts.oauthId, identity.providerId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    if (existing[0].userId !== userId) {
      throw new Error(
        `This ${providerLabel(provider)} account is already linked to a different user.`,
      );
    }
    return;
  }
  await db
    .insert(userOauthAccounts)
    .values({
      userId,
      provider,
      oauthId: identity.providerId,
      displayName: identity.displayName?.slice(0, 120),
      pictureUrl: identity.pictureUrl,
    })
    .onConflictDoNothing({
      target: [userOauthAccounts.provider, userOauthAccounts.oauthId],
    });
  await db
    .update(users)
    .set({
      ...(identity.pictureUrl ? { avatarUrl: identity.pictureUrl } : {}),
      oauthProvider: provider,
      oauthId: identity.providerId,
    })
    .where(eq(users.id, userId));
}

export function malRedirectUri(request: Request): string {
  return process.env.MAL_REDIRECT_URI ?? `${getRequestBaseUrl(request)}/api/auth/mal/callback`;
}

export function googleRedirectUri(request: Request): string {
  return process.env.GOOGLE_REDIRECT_URI ?? `${getRequestBaseUrl(request)}/api/auth/google/callback`;
}