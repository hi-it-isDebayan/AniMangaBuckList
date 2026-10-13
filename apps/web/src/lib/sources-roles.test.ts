import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  canAdminister,
  canChangeRole,
  canManageGlobalSource,
  canModerate,
  canUnlinkOwnSource,
  isBootstrapAdminEmail,
  normalizeRole,
  roleAtLeast,
  roleChangeAction,
  shouldBootstrapAdmin,
} from "./sources/roles";

test("unknown role values default to the least privilege", () => {
  assert.equal(normalizeRole("ADMIN"), "ADMIN");
  assert.equal(normalizeRole("MODERATOR"), "MODERATOR");
  assert.equal(normalizeRole("USER"), "USER");
  assert.equal(normalizeRole("SUPERUSER"), "USER");
  assert.equal(normalizeRole(undefined), "USER");
  assert.equal(normalizeRole(null), "USER");
});

test("role ranking gates moderation and administration", () => {
  assert.equal(roleAtLeast("USER", "MODERATOR"), false);
  assert.equal(roleAtLeast("MODERATOR", "MODERATOR"), true);
  assert.equal(roleAtLeast("ADMIN", "MODERATOR"), true);
  assert.equal(canModerate("USER"), false);
  assert.equal(canModerate("MODERATOR"), true);
  assert.equal(canAdminister("MODERATOR"), false);
  assert.equal(canAdminister("ADMIN"), true);
});

test("a plain user cannot manage a global source", () => {
  assert.equal(canManageGlobalSource("USER").ok, false);
  assert.equal(canManageGlobalSource("MODERATOR").ok, true);
  assert.equal(canManageGlobalSource("ADMIN").ok, true);
});

test("only the owner may unlink their own source", () => {
  assert.equal(canUnlinkOwnSource("u1", "u1").ok, true);
  assert.equal(canUnlinkOwnSource("u1", "u2").ok, false);
});

test("only the bootstrap email is recognized, case-insensitively", () => {
  assert.equal(isBootstrapAdminEmail(BOOTSTRAP_ADMIN_EMAIL), true);
  assert.equal(isBootstrapAdminEmail(BOOTSTRAP_ADMIN_EMAIL.toUpperCase()), true);
  assert.equal(isBootstrapAdminEmail("someone@example.com"), false);
  assert.equal(isBootstrapAdminEmail(""), false);
});

test("bootstrap promotion requires a verified matching email", () => {
  const base = { email: BOOTSTRAP_ADMIN_EMAIL, emailVerified: true, currentRole: "USER" as const };
  assert.equal(shouldBootstrapAdmin(base), true);
  assert.equal(shouldBootstrapAdmin({ ...base, emailVerified: false }), false);
  assert.equal(shouldBootstrapAdmin({ ...base, email: "other@example.com" }), false);
  assert.equal(shouldBootstrapAdmin({ ...base, currentRole: "ADMIN" }), false);
});

test("role changes require an admin actor", () => {
  const decision = canChangeRole({
    actorId: "mod",
    actorRole: "MODERATOR",
    targetUserId: "u2",
    targetRole: "USER",
    nextRole: "MODERATOR",
    adminCount: 1,
  });
  assert.equal(decision.ok, false);
});

test("nobody can change their own role (no self-promotion)", () => {
  const decision = canChangeRole({
    actorId: "admin",
    actorRole: "ADMIN",
    targetUserId: "admin",
    targetRole: "ADMIN",
    nextRole: "ADMIN",
    adminCount: 2,
  });
  assert.equal(decision.ok, false);
});

test("the last administrator cannot be demoted", () => {
  const blocking = canChangeRole({
    actorId: "admin1",
    actorRole: "ADMIN",
    targetUserId: "admin2",
    targetRole: "ADMIN",
    nextRole: "MODERATOR",
    adminCount: 1,
  });
  assert.equal(blocking.ok, false);
  assert.match(blocking.error ?? "", /last administrator/i);

  const allowed = canChangeRole({
    actorId: "admin1",
    actorRole: "ADMIN",
    targetUserId: "admin2",
    targetRole: "ADMIN",
    nextRole: "MODERATOR",
    adminCount: 2,
  });
  assert.equal(allowed.ok, true);
});

test("an admin may promote and demote others", () => {
  const promote = canChangeRole({
    actorId: "admin1",
    actorRole: "ADMIN",
    targetUserId: "u2",
    targetRole: "USER",
    nextRole: "MODERATOR",
    adminCount: 1,
  });
  assert.equal(promote.ok, true);

  const demote = canChangeRole({
    actorId: "admin1",
    actorRole: "ADMIN",
    targetUserId: "mod",
    targetRole: "MODERATOR",
    nextRole: "USER",
    adminCount: 1,
  });
  assert.equal(demote.ok, true);
});

test("role change actions distinguish grants from revocations", () => {
  assert.equal(roleChangeAction("USER", "MODERATOR"), "ROLE_GRANTED");
  assert.equal(roleChangeAction("MODERATOR", "ADMIN"), "ROLE_GRANTED");
  assert.equal(roleChangeAction("MODERATOR", "USER"), "ROLE_REVOKED");
  assert.equal(roleChangeAction("ADMIN", "MODERATOR"), "ROLE_REVOKED");
});
