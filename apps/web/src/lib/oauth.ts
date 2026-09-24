import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, or } from "drizzle-orm";
import { users } from "@ambl/database";
import { getDb } from "@/lib/db";

export type OAuthProvider = "mal" | "google";

const STATE_COOKIE = "ambl_oauth_state";
const VERIFIER_COOKIE = "ambl_mal_verifier";

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

export async function setOAuthStateCookies(): Promise<{ state: string; verifier: string }> {
  const state = randomToken();
  const verifier = randomToken(64);
  const store = await cookies();
  store.set(STATE_COOKIE, state, stateCookieOpts);
  store.set(VERIFIER_COOKIE, verifier, stateCookieOpts);
  return { state, verifier };
}

export async function consumeOAuthCookies(expected: string): Promise<{ ok: boolean; verifier?: string }> {
  const store = await cookies();
  const actual = store.get(STATE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;
  store.set(STATE_COOKIE, "", { ...stateCookieOpts, maxAge: 0 });
  store.set(VERIFIER_COOKIE, "", { ...stateCookieOpts, maxAge: 0 });
  return { ok: !!expected && expected === actual, verifier };
}

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  if (provider === "mal") {
    return !!(process.env.MAL_CLIENT_ID && process.env.MAL_CLIENT_SECRET);
  }
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function findOrCreateOAuthUser(input: {
  provider: OAuthProvider;
  providerId: string;
  email?: string;
  displayName?: string;
}): Promise<string> {
  const db = getDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.oauthProvider, input.provider),
        eq(users.oauthId, input.providerId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const providerEmail = input.email?.toLowerCase().trim();
  const email =
    providerEmail?.length
      ? providerEmail
      : `${input.provider}:${sha256Hex(Buffer.from(input.providerId)).slice(0, 24)}@oauth.local`;

  const inserted = await db
    .insert(users)
    .values({
      email,
      displayName: input.displayName?.slice(0, 120) ?? "",
      passwordHash: null,
      oauthProvider: input.provider,
      oauthId: input.providerId,
    })
    .onConflictDoNothing({
      target: [users.email],
    })
    .returning({ id: users.id });

  if (inserted[0]) return inserted[0].id;

  const retry = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        and(
          eq(users.oauthProvider, input.provider),
          eq(users.oauthId, input.providerId),
        ),
        eq(users.email, email),
      ),
    )
    .limit(1);
  return retry[0].id;
}

export function malRedirectUri(request: Request): string {
  return process.env.MAL_REDIRECT_URI ?? `${getRequestBaseUrl(request)}/api/auth/mal/callback`;
}

export function googleRedirectUri(request: Request): string {
  return process.env.GOOGLE_REDIRECT_URI ?? `${getRequestBaseUrl(request)}/api/auth/google/callback`;
}