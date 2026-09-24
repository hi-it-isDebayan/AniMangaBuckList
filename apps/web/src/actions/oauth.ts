"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { userOauthAccounts, users } from "@ambl/database";
import { getDb } from "@/lib/db";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";

export interface OAuthActionState {
  error?: string;
  success?: boolean;
}

export interface UnlinkResult {
  ok: boolean;
  error?: string;
  data?: { provider: "mal" | "google" };
}

const providerSchema = z.enum(["mal", "google"]);

export async function unlinkProviderAction(input: { provider: "mal" | "google" }): Promise<UnlinkResult> {
  const user = await requireUser();
  const provider = providerSchema.safeParse(input.provider);
  if (!provider.success) return { ok: false, error: "Invalid provider." };
  const db = getDb();

  const [row, password] = await Promise.all([
    db
      .select({ id: userOauthAccounts.id })
      .from(userOauthAccounts)
      .where(
        and(
          eq(userOauthAccounts.userId, user.id),
          eq(userOauthAccounts.provider, provider.data),
        ),
      )
      .limit(1),
    db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
  ]);

  if (!row[0]) return { ok: false, error: "This account is not linked." };

  const otherAccounts = await db
    .select({ id: userOauthAccounts.id })
    .from(userOauthAccounts)
    .where(eq(userOauthAccounts.userId, user.id));
  const otherCount = otherAccounts.filter((a) => a.id !== row[0].id).length;
  const hasPassword = !!password[0]?.passwordHash;

  if (otherCount + (hasPassword ? 1 : 0) === 0) {
    return { ok: false, error: "You need at least one sign-in method. Set a password first." };
  }

  await db
    .delete(userOauthAccounts)
    .where(
      and(
        eq(userOauthAccounts.userId, user.id),
        eq(userOauthAccounts.provider, provider.data),
      ),
    );

  const patch: Partial<typeof users.$inferInsert> = {};
  if (user.oauthProvider === provider.data) {
    patch.oauthProvider = null;
    patch.oauthId = null;
  }
  if (Object.keys(patch).length > 0) {
    await db.update(users).set(patch).where(eq(users.id, user.id));
  }

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { ok: true, data: { provider: provider.data } };
}

const setPasswordSchema = z
  .object({
    currentPassword: z.string().max(128).optional().default(""),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128),
    confirmPassword: z.string().max(128),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function setPasswordAction(
  _prev: OAuthActionState,
  formData: FormData,
): Promise<OAuthActionState> {
  const user = await requireUser();
  const parsed = setPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (row?.passwordHash) {
    const ok = await verifyPassword(parsed.data.currentPassword, row.passwordHash);
    if (!ok) return { error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  return { success: true };
}