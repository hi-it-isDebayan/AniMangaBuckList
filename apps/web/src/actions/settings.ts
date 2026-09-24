"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { users, sessions } from "@ambl/database";
import { getDb } from "@/lib/db";
import { requireUser, destroyCurrentSession } from "@/lib/auth";

export interface SettingsActionState {
  error?: string;
  success?: boolean;
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required.").max(120),
  notifyEpisodes: z.boolean().optional(),
  notifyChapters: z.boolean().optional(),
});

export async function updateProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    notifyEpisodes: formData.get("notifyEpisodes") === "on",
    notifyChapters: formData.get("notifyChapters") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { displayName, notifyEpisodes, notifyChapters } = parsed.data;
  const current = await getDb()
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const prefs = {
    notifications: {
      episodes: current[0]?.preferences?.notifications?.episodes ?? notifyEpisodes,
      chapters: current[0]?.preferences?.notifications?.chapters ?? notifyChapters,
    },
  };

  await getDb()
    .update(users)
    .set({ displayName, preferences: prefs })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  return { success: true };
}

export async function logoutAllSessionsAction(): Promise<void> {
  const user = await requireUser();
  await getDb().delete(sessions).where(eq(sessions.userId, user.id));
  await destroyCurrentSession();
  revalidatePath("/");
}