"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { users } from "@ambl/database";
import { getDb } from "@/lib/db";
import {
  createSession,
  destroyCurrentSession,
  hashPassword,
  requireUser,
  revokeAllSessionRows,
  verifyPassword,
} from "@/lib/auth";
import { consumeAuthToken, issueAuthToken } from "@/lib/tokens";
import {
  clearAttempts,
  clientKey,
  emailKey,
  rateLimitAllowed,
  recordAttempt,
  tokenKey,
} from "@/lib/rate-limit";
import { mailConfigured, sendMail } from "@/lib/mail";
import { publicBaseUrl } from "@/lib/url";

const nameSchema = z.string().trim().min(1, "Name is required.").max(120);
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email.").max(320);
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128);

export interface AuthState {
  error?: string;
  success?: boolean;
  debugLink?: string;
}

async function resetBlockedDetail(retryAfterSeconds: number): Promise<string> {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Please try again in about ${minutes} min.`;
}

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const name = nameSchema.safeParse(formData.get("name"));
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  if (!email.success) return { error: email.error.issues[0]?.message };
  if (!password.success) return { error: password.error.issues[0]?.message };

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.data))
    .limit(1);
  if (existing[0]) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(password.data);
  const inserted = await db
    .insert(users)
    .values({ email: email.data, displayName: name.data, passwordHash })
    .returning({ id: users.id, email: users.email });

  const { raw } = await issueAuthToken(inserted[0]!.id, "email_verify", 24 * 60 * 60 * 1000);
  const link = `${publicBaseUrl()}/verify-email?token=${raw}`;
  try {
    await sendMail({
      to: inserted[0]!.email,
      subject: "Verify your AniManga BuckList email",
      html: `<p>Hi ${escapeHtml(name.data)},</p><p>Welcome! Confirm your email to unlock password recovery and stay signed in everywhere:</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours. If you did not sign up, ignore this email.</p>`,
      text: `Welcome! Confirm your email here: ${link} (expires in 24 hours).`,
    });
  } catch (err) {
    console.error("Verification email failed to send.", err);
  }

  await createSession(inserted[0]!.id);
  redirect("/verify-email?sent=1");
  // eslint-disable-next-line no-unreachable
  return {};
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!email.success) return { error: email.error.issues[0]?.message };
  if (!password.success) return { error: password.error.issues[0]?.message };

  const emailBucket = emailKey("login", email.data);
  const ipBucket = await clientKey("login");
  for (const key of [emailBucket, ipBucket]) {
    const rl = await rateLimitAllowed(key);
    if (!rl.allowed) return { error: await resetBlockedDetail(rl.retryAfterSeconds) };
  }

  const db = getDb();
  const row = await db
    .select()
    .from(users)
    .where(eq(users.email, email.data))
    .limit(1);
  if (!row[0] || !row[0].passwordHash) {
    await recordAttempt(emailBucket);
    await recordAttempt(ipBucket);
    return { error: "Invalid email or password." };
  }
  const ok = await verifyPassword(password.data, row[0].passwordHash);
  if (!ok) {
    await recordAttempt(emailBucket);
    await recordAttempt(ipBucket);
    return { error: "Invalid email or password." };
  }

  await clearAttempts(emailBucket);
  await clearAttempts(ipBucket);
  await createSession(row[0].id);
  redirect("/");
  // eslint-disable-next-line no-unreachable
  return {};
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}

export async function requestPasswordResetAction(formData: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email." };

  const emailBucket = emailKey("reset", email.data);
  const ipBucket = await clientKey("reset");
  for (const key of [emailBucket, ipBucket]) {
    const rl = await rateLimitAllowed(key);
    if (!rl.allowed) return { error: await resetBlockedDetail(rl.retryAfterSeconds) };
  }

  const db = getDb();
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email.data))
    .limit(1);

  if (rows[0]) {
    const { raw } = await issueAuthToken(rows[0].id, "password_reset", 15 * 60 * 1000);
    const link = `${publicBaseUrl()}/reset-password?token=${raw}`;
    try {
      const sent = await sendMail({
        to: rows[0].email,
        subject: "Reset your AniManga BuckList password",
        html: `<p>You asked to reset your password.</p><p><a href="${link}">Choose a new password</a></p><p>This link is single-use and expires in 15 minutes. If you did not request this, ignore the email.</p>`,
        text: `Reset your password here: ${link} (single-use, expires in 15 minutes).`,
      });
      if (!sent && process.env.NODE_ENV !== "production") {
        return { success: true, debugLink: link };
      }
    } catch (err) {
      console.error("Password reset email failed to send.", err);
    }
    await recordAttempt(emailBucket);
    await recordAttempt(ipBucket);
  }

  return { success: true };
}

export async function resetPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const token = z.string().min(20).safeParse(formData.get("token"));
  const password = passwordSchema.safeParse(formData.get("password"));
  const confirm = passwordSchema.safeParse(formData.get("confirmPassword"));
  if (!token.success) return { error: "That reset link is invalid or expired." };
  if (!password.success) return { error: password.error.issues[0]?.message };
  if (!confirm.success || confirm.data !== password.data) {
    return { error: "Passwords do not match." };
  }

  const tokenBucket = tokenKey("reset:token", token.data);
  const ipBucket = await clientKey("reset");
  for (const key of [tokenBucket, ipBucket]) {
    const rl = await rateLimitAllowed(key);
    if (!rl.allowed) return { error: await resetBlockedDetail(rl.retryAfterSeconds) };
  }

  const userId = await consumeAuthToken(token.data, "password_reset");
  if (!userId) return { error: "That reset link is invalid or expired." };

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!existing[0]) return { error: "That reset link is invalid or expired." };

  const passwordHash = await hashPassword(password.data);
  await db
    .update(users)
    .set({ passwordHash, emailVerifiedAt: new Date() })
    .where(eq(users.id, userId));

  await revokeAllSessionRows(userId);
  await clearAttempts(tokenBucket);
  await createSession(userId);
  redirect("/");
  // eslint-disable-next-line no-unreachable
  return {};
}

export async function resendVerificationAction(): Promise<AuthState> {
  const user = await requireUser();
  if (user.emailVerifiedAt) return { success: true };

  if (!mailConfigured()) {
    return {
      error:
        "Email service isn't configured yet. Set RESEND_API_KEY and MAIL_FROM, then try again.",
    };
  }

  const { raw } = await issueAuthToken(user.id, "email_verify", 24 * 60 * 60 * 1000);
  const link = `${publicBaseUrl()}/verify-email?token=${raw}`;
  let sent = false;
  try {
    sent = await sendMail({
      to: user.email,
      subject: "Verify your AniManga BuckList email",
      html: `<p>Hi ${escapeHtml(user.displayName || "there")},</p><p><a href="${link}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
      text: `Verify your email here: ${link} (expires in 24 hours).`,
    });
  } catch (err) {
    console.error("Verification email failed to send.", err);
  }
  if (!sent) {
    return { error: "Could not send the verification email. Please try again." };
  }
  return { success: true };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}