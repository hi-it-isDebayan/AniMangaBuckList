import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { loginRateLimits } from "@ambl/database";
import { getDb } from "./db";
import { requestMeta } from "./auth";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function clientKey(scope: string): Promise<string> {
  const { ip } = await requestMeta();
  return `${scope}:ip:${ip ?? "unknown"}`;
}

export function emailKey(scope: string, email: string): string {
  const h = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `${scope}:email:${h}`;
}

export function tokenKey(scope: string, token: string): string {
  const h = createHash("sha256").update(token).digest("hex").slice(0, 32);
  return `${scope}:token:${h}`;
}

export async function rateLimitAllowed(key: string): Promise<RateLimitResult> {
  await sweepStaleRateLimits();
  const db = getDb();
  const now = Date.now();
  const row = await db
    .select()
    .from(loginRateLimits)
    .where(eq(loginRateLimits.key, key))
    .limit(1)
    .then((r) => r[0]);

  if (!row) return { allowed: true, retryAfterSeconds: 0 };

  if (row.lockoutUntil && row.lockoutUntil.getTime() > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((row.lockoutUntil.getTime() - now) / 1000),
    };
  }

  if (row.windowStartAt.getTime() + WINDOW_MS < now) {
    await db
      .update(loginRateLimits)
      .set({ attempts: 0, windowStartAt: new Date(now), lockoutUntil: null })
      .where(eq(loginRateLimits.key, key));
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await db
      .update(loginRateLimits)
      .set({ lockoutUntil: new Date(now + LOCKOUT_MS), attempts: 0, windowStartAt: new Date(now + LOCKOUT_MS) })
      .where(eq(loginRateLimits.key, key));
    return { allowed: false, retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordAttempt(key: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  const row = await db
    .select()
    .from(loginRateLimits)
    .where(eq(loginRateLimits.key, key))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    await db
      .insert(loginRateLimits)
      .values({ key, attempts: 1, windowStartAt: new Date(now) })
      .onConflictDoNothing();
    return;
  }

  if (row.windowStartAt.getTime() + WINDOW_MS < now) {
    await db
      .update(loginRateLimits)
      .set({ attempts: 1, windowStartAt: new Date(now), lockoutUntil: null })
      .where(eq(loginRateLimits.key, key));
    return;
  }

  await db
    .update(loginRateLimits)
    .set({ attempts: row.attempts + 1 })
    .where(eq(loginRateLimits.key, key));
}

export async function clearAttempts(key: string): Promise<void> {
  await getDb().delete(loginRateLimits).where(eq(loginRateLimits.key, key));
}

async function sweepStaleRateLimits(): Promise<void> {
  try {
    await getDb()
      .delete(loginRateLimits)
      .where(lt(loginRateLimits.windowStartAt, new Date(Date.now() - 2 * 24 * 3600 * 1000)));
  } catch {
    // ignore sweep failures
  }
}