"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { webauthnCredentials } from "@ambl/database";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export interface PasskeyActionState {
  ok: boolean;
  error?: string;
}

export async function deletePasskeyAction(input: {
  credentialId: string;
}): Promise<PasskeyActionState> {
  const user = await requireUser();
  const id = z.string().min(1).max(512).safeParse(input?.credentialId);
  if (!id.success) return { ok: false, error: "Invalid credential." };
  await getDb()
    .delete(webauthnCredentials)
    .where(
      and(
        eq(webauthnCredentials.credentialId, id.data),
        eq(webauthnCredentials.userId, user.id),
      ),
    );
  revalidatePath("/settings");
  return { ok: true };
}