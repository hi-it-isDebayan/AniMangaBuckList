import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { sessions, users } from "@ambl/database";
import { getDb } from "./db";

export const SESSION_COOKIE = "ambl_session";

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

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  try {
    await getDb().insert(sessions).values({
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      ...cookieOptions,
      expires: expiresAt,
    });
  } catch {
    redirect("/login?error=session");
  }
}

export async function getCurrentUser() {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const rows = await getDb()
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return rows[0]?.user ?? null;
  } catch {
    return null;
  }
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

export async function destroyCurrentSession(): Promise<void> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) {
      await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    }
    store.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  } catch {
    // no-op
  }
}