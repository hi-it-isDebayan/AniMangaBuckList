/**
 * Role policy for the community source directory.
 *
 *   USER      — anyone who registers. Can add sources, report problems and
 *               manage their own linked sources.
 *   MODERATOR — admin-selected. Can review reports, mark sources broken or
 *               deprecated, and restore sources.
 *   ADMIN     — full moderation plus assigning/revoking roles. Only the
 *               bootstrap administrator starts here.
 *
 * These helpers are pure (no database, no Next.js) so the authorization rules
 * can be unit-tested directly. Every rule is ALSO enforced server-side.
 */
import type { UserRole } from "@ambl/database";

export const ROLES: readonly UserRole[] = ["USER", "MODERATOR", "ADMIN"];

export const ROLE_RANK: Record<UserRole, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
};

/**
 * Initial administrator. The role is granted server-side (and only when the
 * matching account has a verified email) — never from a client-side check.
 */
export const BOOTSTRAP_ADMIN_EMAIL = "debayan.das.work@gmail.com";

export function isUserRole(value: unknown): value is UserRole {
  return value === "USER" || value === "MODERATOR" || value === "ADMIN";
}

/** Anything unrecognized defaults to the least privileged role. */
export function normalizeRole(value: unknown): UserRole {
  return isUserRole(value) ? value : "USER";
}

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function canModerate(role: UserRole): boolean {
  return roleAtLeast(role, "MODERATOR");
}

export function canAdminister(role: UserRole): boolean {
  return roleAtLeast(role, "ADMIN");
}

export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
}

/**
 * Whether an account should be promoted to the bootstrap ADMIN. Requires a
 * matching email AND a verified email — an unverified squatter must not win.
 */
export function shouldBootstrapAdmin(opts: {
  email: string | null | undefined;
  emailVerified: boolean;
  currentRole: UserRole;
}): boolean {
  if (opts.currentRole === "ADMIN") return false;
  if (!opts.emailVerified) return false;
  return isBootstrapAdminEmail(opts.email);
}

export interface RoleDecision {
  ok: boolean;
  error?: string;
}

/** Moderators and admins may manage the global source registry. */
export function canManageGlobalSource(role: UserRole): RoleDecision {
  return canModerate(role)
    ? { ok: true }
    : { ok: false, error: "Only moderators can change a global source." };
}

/** A user may only unlink sources they linked themselves. */
export function canUnlinkOwnSource(ownerId: string, actorId: string): RoleDecision {
  return ownerId === actorId
    ? { ok: true }
    : { ok: false, error: "You can only unlink your own sources." };
}

/**
 * Guards a role change. Enforced server-side, in addition to these rules:
 *  - only an ADMIN may change roles;
 *  - nobody may change their own role (blocks self-promotion);
 *  - the last remaining admin cannot be demoted (protects against lockout).
 */
export function canChangeRole(opts: {
  actorId: string;
  actorRole: UserRole;
  targetUserId: string;
  targetRole: UserRole;
  nextRole: UserRole;
  adminCount: number;
}): RoleDecision {
  if (!canAdminister(opts.actorRole)) {
    return { ok: false, error: "Only an administrator can change roles." };
  }
  if (opts.actorId === opts.targetUserId) {
    return { ok: false, error: "You cannot change your own role." };
  }
  if (opts.targetRole === "ADMIN" && opts.nextRole !== "ADMIN" && opts.adminCount <= 1) {
    return { ok: false, error: "You cannot remove the last administrator." };
  }
  return { ok: true };
}

/** ISO-ish audit action for a role change. */
export function roleChangeAction(
  targetRole: UserRole,
  nextRole: UserRole,
): "ROLE_GRANTED" | "ROLE_REVOKED" {
  return ROLE_RANK[nextRole] > ROLE_RANK[targetRole] ? "ROLE_GRANTED" : "ROLE_REVOKED";
}
