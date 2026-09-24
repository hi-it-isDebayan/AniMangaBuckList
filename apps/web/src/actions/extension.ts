"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { publicApiKeys } from "@ambl/database";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys";

export interface GenerateKeyState {
  key?: string;
  name?: string;
  lastFour?: string;
  createdAt?: string;
  error?: string;
}

export interface RevokeKeyState {
  error?: string;
  success?: boolean;
}

export async function generateKeyAction(
  _prev: GenerateKeyState,
  formData: FormData,
): Promise<GenerateKeyState> {
  const user = await requireUser();
  const name = z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(100)
    .optional()
    .safeParse(formData.get("name") ?? undefined);
  if (!name.success) {
    return { error: name.error.issues[0]?.message ?? "Invalid name." };
  }

  const result = await generateApiKey(user.id, name.data ?? "Extension");
  revalidatePath("/settings");
  return {
    key: result.key,
    name: result.name,
    lastFour: result.lastFour,
    createdAt: result.createdAt.toISOString(),
  };
}

export async function revokeKeyAction(
  _prev: RevokeKeyState,
  formData: FormData,
): Promise<RevokeKeyState> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("keyId"));
  if (!id.success) return { error: "Invalid key." };

  const db = getDb();
  const [row] = await db
    .select({ id: publicApiKeys.id })
    .from(publicApiKeys)
    .where(
      and(eq(publicApiKeys.id, id.data), eq(publicApiKeys.userId, user.id)),
    )
    .limit(1);
  if (!row) return { error: "Key not found." };

  await db.delete(publicApiKeys).where(eq(publicApiKeys.id, row.id));
  revalidatePath("/settings");
  return { success: true };
}