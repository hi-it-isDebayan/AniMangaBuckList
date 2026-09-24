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
  verifyPassword,
} from "@/lib/auth";

const nameSchema = z.string().trim().min(1, "Name is required.").max(120);
const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email.").max(320);
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128);

export interface AuthState {
  error?: string;
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
    .returning({ id: users.id });
  await createSession(inserted[0]!.id);
  redirect("/");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!email.success) return { error: email.error.issues[0]?.message };
  if (!password.success) return { error: password.error.issues[0]?.message };

  const db = getDb();
  const row = await db
    .select()
    .from(users)
    .where(eq(users.email, email.data))
    .limit(1);
  if (!row[0]) {
    return { error: "Invalid email or password." };
  }
  const ok = await verifyPassword(password.data, row[0].passwordHash);
  if (!ok) {
    return { error: "Invalid email or password." };
  }
  await createSession(row[0].id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}