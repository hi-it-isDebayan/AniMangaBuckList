import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { sessions, users } from "@ambl/database";
import { getDb } from "./db";

export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-ambl_session" : "ambl_session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionTtlMs(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? 720);
  if (!Number.isFinite(hours) || hours <= 0) return 720 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export interface SessionMeta {
  ua?: string;
  ip?: string;
}

export async function requestMeta(): Promise<SessionMeta> {
  let ua: string | undefined;
  let ip: string | undefined;
  try {
    const h = await headers();
    ua = h.get("user-agent") ?? undefined;
    const fwd = h.get("x-forwarded-for");
    ip = fwd?.split(",")[0]?.trim() ?? undefined;
  } catch {
    // no headers context available
  }
  return { ua, ip };
}

export function deviceLabelFromUA(ua?: string): string {
  if (!ua) return "Unknown device";
  const u = ua.toLowerCase();
  let device = "Computer";
  if (/ipad|tablet/.test(u) || /android/.test(u)) {
    device = /ipad|tablet/.test(u) || (/android/.test(u) && !/mobile/i.test(u)) ? "Tablet" : "Phone";
  } else if (/iphone|ipod/.test(u)) {
    device = "Phone";
  } else if (/windows phone/.test(u)) {
    device = "Phone";
  }
  let browser = "Browser";
  if (/edg\//.test(u)) browser = "Edge";
  else if (/opr\/|opera\//.test(u)) browser = "Opera";
  else if (/samsungbrowser/.test(u)) browser = "Samsung Internet";
  else if (/chrome\//.test(u)) browser = "Chrome";
  else if (/firefox\/|fxios/.test(u)) browser = "Firefox";
  else if (/safari\//.test(u)) browser = "Safari";
  return `${browser} on ${device}`;
}

async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    ...cookieOptions,
    expires: expiresAt,
  });
}

async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

export async function createSession(userId: string, meta?: SessionMeta): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  const { ua, ip } = meta ?? (await requestMeta());
  try {
    await getDb().insert(sessions).values({
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      deviceLabel: deviceLabelFromUA(ua),
      ipAddress: ip,
      lastSeenAt: expiresAt,
    });
    await setSessionCookie(token, expiresAt);
  } catch {
    redirect("/login?error=session");
  }
}

export async function getCurrentSession() {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const row = await getDb()
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1)
      .then((r) => r[0]);
    if (!row) return null;

    const now = Date.now();
    const ttl = sessionTtlMs();
    const remaining = row.session.expiresAt.getTime() - now;
    const lastSeenAt = row.session.lastSeenAt;
    const shouldSlide = remaining < ttl / 2;
    const shouldTouch = !lastSeenAt || now - lastSeenAt.getTime() > 15 * 60 * 1000;

    if (shouldSlide) {
      const newExpiresAt = new Date(now + ttl);
      await getDb()
        .update(sessions)
        .set({
          expiresAt: newExpiresAt,
          ...(shouldTouch ? { lastSeenAt: new Date(now) } : {}),
        })
        .where(eq(sessions.id, row.session.id));
      await setSessionCookie(token, newExpiresAt);
    } else if (shouldTouch) {
      await getDb()
        .update(sessions)
        .set({ lastSeenAt: new Date(now) })
        .where(eq(sessions.id, row.session.id));
    }

    return { session: row.session, user: row.user, sessionId: row.session.id };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const current = await getCurrentSession();
  return current?.user ?? null;
}

export async function getCurrentSessionId(): Promise<string | null> {
  const current = await getCurrentSession();
  return current?.sessionId ?? null;
}

export function unwrap<T>(maybe: T | null | undefined, msg = "Not found"): T {
  if (maybe === null || maybe === undefined) redirect(`/login?error=${encodeURIComponent(msg)}`);
  return maybe;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function redirectIfAuthed() {
  const user = await getCurrentUser();
  if (user) redirect("/");
}

export function listSessions(userId: string) {
  return getDb()
    .select({
      id: sessions.id,
      deviceLabel: sessions.deviceLabel,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.lastSeenAt));
}

export async function revokeSessionRow(userId: string, sessionId: string): Promise<void> {
  await getDb()
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
}

export async function revokeOtherSessionRows(userId: string, keepSessionId: string): Promise<void> {
  await getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
}

export async function revokeAllSessionRows(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export async function destroyCurrentSession(): Promise<void> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) {
      await getDb()
        .delete(sessions)
        .where(eq(sessions.tokenHash, hashToken(token)));
    }
    await clearSessionCookie();
  } catch {
    // no-op
  }
}