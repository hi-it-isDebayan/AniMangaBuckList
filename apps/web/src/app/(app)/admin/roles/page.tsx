import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { canAdminister, normalizeRole } from "@/lib/sources/roles";
import { listAuditLog, listUsers } from "@/lib/sources/service";
import { RoleControls } from "@/components/sources/role-controls";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Roles" };
export const dynamic = "force-dynamic";

function formatTimestamp(value: Date | string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function AdminRolesPage() {
  const user = await requireUser();
  const role = normalizeRole(user.role);

  if (!canAdminister(role)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-10 sm:px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Not available</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Only administrators can manage roles.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [users, audit] = await Promise.all([listUsers(200), listAuditLog(40)]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-3 py-6 sm:px-4">
      <PageHeader
        icon={ShieldCheck}
        title="Roles"
        subtitle="Only administrators can assign or revoke roles. You cannot change your own role, and the last administrator cannot be removed."
      />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Users</h2>
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/70">
          {users.map((account) => (
            <li
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {account.displayName || account.email}
                  {account.id === user.id ? (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {account.email} · {account.role}
                  {account.emailVerifiedAt ? " · verified" : " · unverified"}
                </p>
              </div>
              <RoleControls
                userId={account.id}
                currentRole={account.role}
                isSelf={account.id === user.id}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Audit log</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No moderation actions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/70">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
              >
                <span className="font-medium">{entry.action}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.sourceId ? `source ${entry.sourceId.slice(0, 8)}… · ` : ""}
                  {entry.targetUserId ? `user ${entry.targetUserId.slice(0, 8)}… · ` : ""}
                  {entry.reason ? `${entry.reason} · ` : ""}
                  {formatTimestamp(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
