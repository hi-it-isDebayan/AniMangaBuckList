/**
 * Server-side service for the community source directory.
 *
 * Every mutation enforces authorization here (not just in the UI) and writes an
 * entry to `moderation_audit_log`. Reads are plain queries used by the three
 * views. This module is server-only; do not import it into client components.
 */
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import {
  moderationActionEnum,
  moderationAuditLog,
  sourceChecks,
  sourceCheckTriggerEnum,
  sourceLinks,
  sourceReportKindEnum,
  sourceReports,
  sources,
  users,
  type SourceExtractorStatus,
  type SourceFailureCategory,
  type SourceStatus,
  type UserRole,
} from "@ambl/database";
import { getDb } from "@/lib/db";
import { parseSourceUrl } from "./domain";
import { findExtractor, type MediaType } from "./extractors";
import { nextHealth } from "./health";
import { probeSource } from "./probe";
import type { SafeFetchOptions } from "./safe-fetch";
import {
  canChangeRole,
  canManageGlobalSource,
  normalizeRole,
  roleChangeAction,
  shouldBootstrapAdmin,
} from "./roles";

type ModerationAction = (typeof moderationActionEnum.enumValues)[number];
type SourceCheckTrigger = (typeof sourceCheckTriggerEnum.enumValues)[number];
type SourceReportKind = (typeof sourceReportKindEnum.enumValues)[number];

export interface Actor {
  id: string;
  role: UserRole;
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function logModeration(
  db: ReturnType<typeof getDb>,
  entry: {
    actorId: string | null;
    action: ModerationAction;
    sourceId?: string | null;
    targetUserId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  await db.insert(moderationAuditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    sourceId: entry.sourceId ?? null,
    targetUserId: entry.targetUserId ?? null,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? null,
  });
}

// --- Roles ------------------------------------------------------------------

/**
 * Promote the bootstrap account to ADMIN server-side, and only when the stored
 * email is verified. Idempotent; called on authenticated navigation.
 */
export async function ensureBootstrapAdmin(userId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ email: users.email, role: users.role, verified: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return;

  const shouldPromote = shouldBootstrapAdmin({
    email: row.email,
    emailVerified: row.verified !== null,
    currentRole: normalizeRole(row.role),
  });
  if (!shouldPromote) return;

  await db.update(users).set({ role: "ADMIN" }).where(eq(users.id, userId));
  await logModeration(db, {
    actorId: userId,
    action: "ROLE_GRANTED",
    targetUserId: userId,
    reason: "Bootstrap administrator (verified owner email).",
    metadata: { bootstrap: true },
  });
}

/** Admin-only: the user directory used by the role-management screen. */
export async function listUsers(limit = 100) {
  return getDb()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.role, desc(users.createdAt))
    .limit(limit);
}

export async function countAdmins(): Promise<number> {
  const rows = await getDb()
    .select({ value: count() })
    .from(users)
    .where(eq(users.role, "ADMIN"));
  return Number(rows[0]?.value ?? 0);
}

export async function setUserRole(
  actor: { id: string; role: UserRole },
  targetUserId: string,
  nextRole: UserRole,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) return fail("User not found.");

  const decision = canChangeRole({
    actorId: actor.id,
    actorRole: actor.role,
    targetUserId,
    targetRole: normalizeRole(target.role),
    nextRole,
    adminCount: await countAdmins(),
  });
  if (!decision.ok) return fail(decision.error ?? "Not allowed.");

  await db.update(users).set({ role: nextRole }).where(eq(users.id, targetUserId));
  await logModeration(db, {
    actorId: actor.id,
    action: roleChangeAction(normalizeRole(target.role), nextRole),
    targetUserId,
    reason,
    metadata: { from: normalizeRole(target.role), to: nextRole },
  });
  return { ok: true };
}

// --- Sources ----------------------------------------------------------------

const MEDIA_TYPES: readonly MediaType[] = [
  "ANIME",
  "MANGA",
  "MANHWA",
  "MANHUA",
  "LIGHT_NOVEL",
  "WEB_NOVEL",
];

function sanitizeContentTypes(input: readonly string[] | undefined): MediaType[] {
  return [
    ...new Set(
      (input ?? []).filter((t): t is MediaType => (MEDIA_TYPES as readonly string[]).includes(t)),
    ),
  ];
}

export interface RegisterSourceInput {
  url: string;
  name?: string;
  contentTypes?: string[];
}

export async function registerSource(
  actorId: string,
  input: RegisterSourceInput,
): Promise<{ ok: boolean; error?: string; sourceId?: string; created?: boolean }> {
  const parsed = parseSourceUrl(input.url);
  if (!parsed.ok) return fail(parsed.reason);
  const { domain, homepageUrl } = parsed.value;

  const db = getDb();

  // Duplicate prevention: the canonical domain is the dedupe key.
  const [existing] = await db
    .select({ id: sources.id, visibility: sources.visibility })
    .from(sources)
    .where(eq(sources.domain, domain))
    .limit(1);
  if (existing) {
    if (existing.visibility === "HIDDEN") {
      return fail("That source is registered but hidden. Ask a moderator to restore it.");
    }
    return { ok: true, sourceId: existing.id, created: false };
  }

  const extractor = findExtractor(domain);
  const [row] = await db
    .insert(sources)
    .values({
      domain,
      name: input.name?.trim() || domain,
      homepageUrl,
      contentTypes: sanitizeContentTypes(input.contentTypes),
      extractorKey: extractor?.key ?? null,
      extractorStatus: extractor ? "SUPPORTED" : "AWAITING_EXTRACTOR",
      status: "UNVERIFIED",
      visibility: "PUBLIC",
      createdBy: actorId,
    })
    .onConflictDoNothing({ target: sources.domain })
    .returning({ id: sources.id });

  if (!row) {
    const [again] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.domain, domain))
      .limit(1);
    if (again) return { ok: true, sourceId: again.id, created: false };
    return fail("Could not register that source.");
  }

  await logModeration(db, {
    actorId,
    action: "SOURCE_CREATED",
    sourceId: row.id,
    metadata: { domain },
  });
  return { ok: true, sourceId: row.id, created: true };
}

export async function listSources(filters: {
  q?: string;
  status?: string;
  extractorStatus?: string;
  contentType?: string;
  includeHidden?: boolean;
  limit?: number;
} = {}) {
  const db = getDb();
  const conditions = [];
  if (!filters.includeHidden) conditions.push(eq(sources.visibility, "PUBLIC"));
  if (filters.status) conditions.push(eq(sources.status, filters.status as SourceStatus));
  if (filters.extractorStatus) {
    conditions.push(eq(sources.extractorStatus, filters.extractorStatus as SourceExtractorStatus));
  }
  const q = filters.q?.trim();
  if (q) {
    const like = `%${q}%`;
    conditions.push(or(ilike(sources.name, like), eq(sources.domain, q.toLowerCase())));
  }

  const rows = await db
    .select()
    .from(sources)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sources.updatedAt))
    .limit(filters.limit ?? 100);

  if (filters.contentType) {
    return rows.filter((row) =>
      (row.contentTypes as string[]).includes(filters.contentType as string),
    );
  }
  return rows;
}

export async function getSource(sourceId: string) {
  const db = getDb();
  const [row] = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
  return row ?? null;
}

export async function findSourceByUrl(url: string) {
  const parsed = parseSourceUrl(url);
  if (!parsed.ok) return null;
  const [row] = await getDb()
    .select()
    .from(sources)
    .where(eq(sources.domain, parsed.value.domain))
    .limit(1);
  return row ?? null;
}

// --- Links ------------------------------------------------------------------

export async function listLinkedSources(userId: string) {
  return getDb()
    .select({
      linkId: sourceLinks.id,
      linkedAt: sourceLinks.createdAt,
      id: sources.id,
      domain: sources.domain,
      name: sources.name,
      homepageUrl: sources.homepageUrl,
      status: sources.status,
      extractorStatus: sources.extractorStatus,
      visibility: sources.visibility,
      lastCheckedAt: sources.lastCheckedAt,
      lastSuccessAt: sources.lastSuccessAt,
      consecutiveFailures: sources.consecutiveFailures,
      lastFailureCategory: sources.lastFailureCategory,
    })
    .from(sourceLinks)
    .innerJoin(sources, eq(sourceLinks.sourceId, sources.id))
    .where(eq(sourceLinks.userId, userId))
    .orderBy(desc(sourceLinks.createdAt));
}

export async function linkSource(
  userId: string,
  sourceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const [source] = await db
    .select({ id: sources.id, visibility: sources.visibility })
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);
  if (!source) return fail("Source not found.");
  if (source.visibility === "HIDDEN") return fail("That source is not available.");

  await db
    .insert(sourceLinks)
    .values({ userId, sourceId })
    .onConflictDoNothing({ target: [sourceLinks.userId, sourceLinks.sourceId] });
  return { ok: true };
}

export async function unlinkSource(
  userId: string,
  sourceId: string,
): Promise<{ ok: boolean; error?: string }> {
  await getDb()
    .delete(sourceLinks)
    .where(and(eq(sourceLinks.userId, userId), eq(sourceLinks.sourceId, sourceId)));
  return { ok: true };
}

// --- Checks -----------------------------------------------------------------

export async function getSourceHealth(sourceId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      status: sources.status,
      consecutiveFailures: sources.consecutiveFailures,
      lastFailureCategory: sources.lastFailureCategory,
      lastCheckedAt: sources.lastCheckedAt,
      lastSuccessAt: sources.lastSuccessAt,
    })
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);
  if (!row) return null;
  return {
    status: row.status,
    consecutiveFailures: row.consecutiveFailures,
    lastFailureCategory: row.lastFailureCategory,
    lastCheckedAt: row.lastCheckedAt,
    lastSuccessAt: row.lastSuccessAt,
  };
}

export async function listRecentChecks(limit = 20) {
  return getDb()
    .select({
      id: sourceChecks.id,
      sourceId: sourceChecks.sourceId,
      domain: sources.domain,
      name: sources.name,
      reachable: sourceChecks.reachable,
      extractOk: sourceChecks.extractOk,
      failureCategory: sourceChecks.failureCategory,
      httpStatus: sourceChecks.httpStatus,
      latencyMs: sourceChecks.latencyMs,
      trigger: sourceChecks.trigger,
      createdAt: sourceChecks.createdAt,
    })
    .from(sourceChecks)
    .innerJoin(sources, eq(sourceChecks.sourceId, sources.id))
    .orderBy(desc(sourceChecks.createdAt))
    .limit(limit);
}

export async function listRecentReports(limit = 20) {
  return getDb()
    .select({
      id: sourceReports.id,
      sourceId: sourceReports.sourceId,
      domain: sources.domain,
      name: sources.name,
      kind: sourceReports.kind,
      note: sourceReports.note,
      resolvedAt: sourceReports.resolvedAt,
      createdAt: sourceReports.createdAt,
    })
    .from(sourceReports)
    .innerJoin(sources, eq(sourceReports.sourceId, sources.id))
    .orderBy(desc(sourceReports.createdAt))
    .limit(limit);
}

/**
 * Persist a probe result: append a check row and move the source's health state
 * through the state machine (a single transient failure never marks BROKEN).
 */
export async function recordCheck(opts: {
  sourceId: string;
  trigger: SourceCheckTrigger;
  checkedBy: string | null;
  probe: {
    reachable: boolean;
    extractOk: boolean;
    category: SourceFailureCategory;
    httpStatus: number | null;
    latencyMs: number;
  };
}): Promise<void> {
  const db = getDb();
  const current = await getSourceHealth(opts.sourceId);
  if (!current) return;

  const next = nextHealth(current, {
    reachable: opts.probe.reachable,
    extractOk: opts.probe.extractOk,
    category: opts.probe.category,
  });

  await db.transaction(async (tx) => {
    await tx.insert(sourceChecks).values({
      sourceId: opts.sourceId,
      reachable: opts.probe.reachable,
      extractOk: opts.probe.extractOk,
      failureCategory: opts.probe.category,
      httpStatus: opts.probe.httpStatus,
      latencyMs: opts.probe.latencyMs,
      trigger: opts.trigger,
      checkedBy: opts.checkedBy,
    });
    await tx
      .update(sources)
      .set({
        status: next.status,
        consecutiveFailures: next.consecutiveFailures,
        lastFailureCategory: next.lastFailureCategory as SourceFailureCategory,
        lastCheckedAt: next.lastCheckedAt,
        lastSuccessAt: next.lastSuccessAt,
        updatedAt: new Date(),
      })
      .where(eq(sources.id, opts.sourceId));
  });
}

/**
 * Probe a source's homepage and persist the outcome. Used by the manual
 * "re-test" action and (later) a scheduled sweep.
 */
export async function testSource(
  sourceId: string,
  opts: {
    trigger: SourceCheckTrigger;
    checkedBy: string | null;
    fetchOptions?: SafeFetchOptions;
  },
): Promise<{ ok: boolean; error?: string; probe?: Awaited<ReturnType<typeof probeSource>> }> {
  const db = getDb();
  const [row] = await db
    .select({ homepageUrl: sources.homepageUrl })
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);
  if (!row) return fail("Source not found.");

  const probe = await probeSource(row.homepageUrl, opts.fetchOptions);
  await recordCheck({
    sourceId,
    trigger: opts.trigger,
    checkedBy: opts.checkedBy,
    probe,
  });
  return { ok: true, probe };
}

// --- Reports ----------------------------------------------------------------

export async function reportSource(
  userId: string,
  sourceId: string,
  kind: string,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);
  if (!source) return fail("Source not found.");

  const parsedKind: SourceReportKind = (sourceReportKindEnum.enumValues as readonly string[]).includes(
    kind,
  )
    ? (kind as SourceReportKind)
    : "OTHER";

  await db.insert(sourceReports).values({
    sourceId,
    userId,
    kind: parsedKind,
    note: note.slice(0, 500) || null,
  });
  return { ok: true };
}

export async function resolveReport(
  actor: { id: string; role: UserRole },
  reportId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  if (actor.role === "USER") return fail("Only moderators can resolve reports.");
  const db = getDb();
  const [report] = await db
    .select({ id: sourceReports.id, sourceId: sourceReports.sourceId })
    .from(sourceReports)
    .where(eq(sourceReports.id, reportId))
    .limit(1);
  if (!report) return fail("Report not found.");

  await db
    .update(sourceReports)
    .set({ resolvedAt: new Date() })
    .where(eq(sourceReports.id, reportId));
  await logModeration(db, {
    actorId: actor.id,
    action: "REPORT_RESOLVED",
    sourceId: report.sourceId,
    reason,
  });
  return { ok: true };
}

// --- Moderation -------------------------------------------------------------

export type SourceModerationAction = "DEPRECATE" | "RESTORE" | "DELETE";

const MODERATION_MAP: Record<
  SourceModerationAction,
  { audit: "SOURCE_DEPRECATED" | "SOURCE_RESTORED" | "SOURCE_DELETED"; visibility: "PUBLIC" | "HIDDEN" }
> = {
  DEPRECATE: { audit: "SOURCE_DEPRECATED", visibility: "HIDDEN" },
  DELETE: { audit: "SOURCE_DELETED", visibility: "HIDDEN" },
  RESTORE: { audit: "SOURCE_RESTORED", visibility: "PUBLIC" },
};

export async function moderateSource(
  actor: { id: string; role: UserRole },
  sourceId: string,
  action: SourceModerationAction,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const decision = canManageGlobalSource(actor.role);
  if (!decision.ok) return fail(decision.error ?? "Not allowed.");

  const db = getDb();
  const [source] = await db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);
  if (!source) return fail("Source not found.");

  const mapped = MODERATION_MAP[action];
  if (!mapped) return fail("Unknown action.");

  await db
    .update(sources)
    .set({ visibility: mapped.visibility, updatedAt: new Date() })
    .where(eq(sources.id, sourceId));
  await logModeration(db, {
    actorId: actor.id,
    action: mapped.audit,
    sourceId,
    reason,
  });
  return { ok: true };
}

export async function listAuditLog(limit = 50) {
  return getDb()
    .select({
      id: moderationAuditLog.id,
      action: moderationAuditLog.action,
      sourceId: moderationAuditLog.sourceId,
      targetUserId: moderationAuditLog.targetUserId,
      reason: moderationAuditLog.reason,
      metadata: moderationAuditLog.metadata,
      createdAt: moderationAuditLog.createdAt,
    })
    .from(moderationAuditLog)
    .orderBy(desc(moderationAuditLog.createdAt))
    .limit(limit);
}
