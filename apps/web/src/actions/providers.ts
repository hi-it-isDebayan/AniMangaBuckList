"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  deleteProviderTokens,
  getProviderTokens,
  saveProviderTokens,
} from "@/lib/provider-tokens";
import {
  deleteProviderRows,
  syncProviderEntries,
  type TokenProvider,
} from "@/lib/provider-sync";

export interface ProviderActionResult {
  success?: boolean;
  error?: string;
  count?: number;
}

const tokenSchema = z.string().trim().min(8).max(512);

export async function connectMangabakaAction(input: {
  token: string;
}): Promise<ProviderActionResult> {
  const user = await requireUser();
  const parsed = tokenSchema.safeParse(input.token);
  if (!parsed.success) {
    return { error: "Enter your MangaBaka personal access token." };
  }
  const token = parsed.data;
  if (!token.startsWith("mb-")) {
    return {
      error: "That doesn't look like a MangaBaka token (it should start with mb-).",
    };
  }

  const res = await fetch("https://api.mangabaka.org/v1/my/library?limit=1", {
    headers: { "x-api-key": token, "Accept": "application/json" },
    cache: "no-store",
  });
  if (res.status === 401) {
    return {
      error:
        "That token was rejected. It needs library.read scope and must not be expired.",
    };
  }
  if (!res.ok) {
    return { error: `Could not reach MangaBaka (status ${res.status}). Try again.` };
  }

  await saveProviderTokens(user.id, "mangabaka", {
    accessToken: token,
    refreshToken: null,
    expiresAt: null,
  });
  const sync = await syncProviderEntries(user.id, "mangabaka");
  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true, count: sync.count };
}

export async function disconnectMangabakaAction(): Promise<ProviderActionResult> {
  const user = await requireUser();
  await deleteProviderTokens(user.id, "mangabaka");
  await deleteProviderRows(user.id, "mangabaka");
  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true };
}

export async function resyncProviderAction(input: {
  provider: TokenProvider;
}): Promise<ProviderActionResult> {
  const user = await requireUser();
  const has = await getProviderTokens(user.id, input.provider);
  if (!has) return { error: "That tracker isn't connected." };
  const sync = await syncProviderEntries(user.id, input.provider);
  if (!sync.ok) return { error: sync.error ?? "Sync failed." };
  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true, count: sync.count };
}