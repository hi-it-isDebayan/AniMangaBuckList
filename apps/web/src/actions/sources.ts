"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { normalizeRole } from "@/lib/sources/roles";
import type { SourceProbeResult } from "@/lib/sources/probe";
import * as service from "@/lib/sources/service";

export interface ActionResult {
  ok?: boolean;
  error?: string;
  message?: string;
  sourceId?: string;
}

export interface ProbeActionState extends ActionResult {
  probe?: SourceProbeResult;
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// --- Registration & links ---------------------------------------------------

const registerSchema = z.object({
  url: z.string().trim().min(1, "A source URL is required.").max(500),
  name: z.string().trim().max(120).optional(),
  contentTypes: z.array(z.string()).optional(),
});

export async function registerSourceAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = registerSchema.safeParse({
    url: readString(formData, "url"),
    name: readString(formData, "name") || undefined,
    contentTypes: formData.getAll("contentTypes").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await service.registerSource(user.id, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/sources");
  const message = result.created
    ? "Source registered."
    : "That source was already registered — you can link it now.";
  return { ok: true, message, sourceId: result.sourceId };
}

const linkSchema = z.object({ sourceId: z.string().uuid("Unknown source.") });

export async function linkSourceAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = linkSchema.safeParse({ sourceId: readString(formData, "sourceId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Unknown source." };

  const result = await service.linkSource(user.id, parsed.data.sourceId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/sources/mine");
  return { ok: true, message: "Source linked." };
}

export async function unlinkSourceAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = linkSchema.safeParse({ sourceId: readString(formData, "sourceId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Unknown source." };

  await service.unlinkSource(user.id, parsed.data.sourceId);
  revalidatePath("/sources/mine");
  return { ok: true, message: "Source unlinked." };
}

// --- Health & reports -------------------------------------------------------

export async function testSourceAction(
  _prev: ProbeActionState,
  formData: FormData,
): Promise<ProbeActionState> {
  const user = await requireUser();
  const parsed = linkSchema.safeParse({ sourceId: readString(formData, "sourceId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Unknown source." };

  const result = await service.testSource(parsed.data.sourceId, {
    trigger: "MANUAL",
    checkedBy: user.id,
  });
  if (!result.ok || !result.probe) return { error: result.error ?? "Could not run the test." };

  revalidatePath("/sources/mine");
  revalidatePath("/sources/health");
  return { ok: true, probe: result.probe };
}

const reportSchema = z.object({
  sourceId: z.string().uuid("Unknown source."),
  kind: z.enum(["BROKEN", "SLOW", "WRONG_TITLE", "OTHER"]).default("OTHER"),
  note: z.string().trim().max(500).optional(),
});

export async function reportSourceAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse({
    sourceId: readString(formData, "sourceId"),
    kind: readString(formData, "kind") || "OTHER",
    note: readString(formData, "note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid report." };

  const result = await service.reportSource(
    user.id,
    parsed.data.sourceId,
    parsed.data.kind,
    parsed.data.note ?? "",
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/sources/health");
  return { ok: true, message: "Thanks — your report was recorded." };
}

// --- Moderation -------------------------------------------------------------

const moderateSchema = z.object({
  sourceId: z.string().uuid("Unknown source."),
  action: z.enum(["DEPRECATE", "RESTORE", "DELETE"]),
  reason: z.string().trim().max(300).optional(),
});

export async function moderateSourceAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const actor = { id: user.id, role: normalizeRole(user.role) };
  const parsed = moderateSchema.safeParse({
    sourceId: readString(formData, "sourceId"),
    action: readString(formData, "action"),
    reason: readString(formData, "reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid action." };

  const result = await service.moderateSource(
    actor,
    parsed.data.sourceId,
    parsed.data.action,
    parsed.data.reason ?? "",
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/sources");
  revalidatePath("/sources/health");
  return { ok: true, message: "Moderation action applied." };
}

export async function resolveReportAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const actor = { id: user.id, role: normalizeRole(user.role) };
  const parsed = z
    .object({
      reportId: z.string().uuid("Unknown report."),
      reason: z.string().trim().max(300).optional(),
    })
    .safeParse({
      reportId: readString(formData, "reportId"),
      reason: readString(formData, "reason") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid report." };

  const result = await service.resolveReport(actor, parsed.data.reportId, parsed.data.reason ?? "");
  if (!result.ok) return { error: result.error };

  revalidatePath("/sources/health");
  return { ok: true, message: "Report resolved." };
}

const roleSchema = z.object({
  userId: z.string().uuid("Unknown user."),
  role: z.enum(["USER", "MODERATOR", "ADMIN"]),
  reason: z.string().trim().max(300).optional(),
});

export async function setUserRoleAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const actor = { id: user.id, role: normalizeRole(user.role) };
  const parsed = roleSchema.safeParse({
    userId: readString(formData, "userId"),
    role: readString(formData, "role"),
    reason: readString(formData, "reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid role change." };

  const result = await service.setUserRole(
    actor,
    parsed.data.userId,
    parsed.data.role,
    parsed.data.reason ?? "",
  );
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/roles");
  return { ok: true, message: "Role updated." };
}
