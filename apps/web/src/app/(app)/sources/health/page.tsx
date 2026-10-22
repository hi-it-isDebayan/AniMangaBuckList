import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { listRecentChecks, listRecentReports, listSources } from "@/lib/sources/service";
import { canModerate, normalizeRole } from "@/lib/sources/roles";
import { ExtractorBadge, StatusBadge } from "@/components/sources/status-badge";
import { ModerateControls } from "@/components/sources/moderate-controls";
import { ResolveReportButton } from "@/components/sources/resolve-report-button";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Source health & reports" };
export const dynamic = "force-dynamic";

const SEVERITY: Record<string, number> = { BROKEN: 0, DEGRADED: 1, UNVERIFIED: 2, WORKING: 3 };

function formatTimestamp(value: Date | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export default async function SourceHealthPage() {
  const user = await requireUser();
  const role = (user.role ?? "USER") as "USER" | "MODERATOR" | "ADMIN";
  const isModerator = canModerate(role);

  const [allSources, checks, reports, hiddenSources] = await Promise.all([
    listSources({ limit: 200 }),
    listRecentChecks(20),
    listRecentReports(20),
    isModerator ? listSources({ limit: 200, includeHidden: true }) : Promise.resolve([]),
  ]);

  const healthSorted = [...allSources].sort(
    (a, b) => (SEVERITY[a.status] ?? 9) - (SEVERITY[b.status] ?? 9),
  );
  const hiddenIds = new Set(
    hiddenSources.filter((source) => source.visibility === "HIDDEN").map((source) => source.id),
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-3 py-6 sm:px-4">
      <PageHeader
        icon={Activity}
        title="Health & reports"
        subtitle={
          <>
            Reachability and extraction are checked separately. You are signed in as{" "}
            <span className="font-medium text-foreground">{role}</span>.
          </>
        }
      />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Source health</h2>
        {healthSorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sources registered yet.</p>
        ) : (
          healthSorted.map((source) => (
            <div key={source.id} className="card-hover rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm shadow-black/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {source.name}
                    {hiddenIds.has(source.id) ? (
                      <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{source.domain}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={source.status} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Last checked</dt>
                  <dd>{formatTimestamp(source.lastCheckedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last success</dt>
                  <dd>{formatTimestamp(source.lastSuccessAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Failures</dt>
                  <dd>{source.consecutiveFailures}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd>{source.lastFailureCategory}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <ExtractorBadge status={source.extractorStatus} />
              </div>
              {isModerator ? (
                <div className="mt-3">
                  <ModerateControls sourceId={source.id} hidden={hiddenIds.has(source.id)} />
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Recent checks</h2>
        {checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checks recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/70">
            {checks.map((check) => (
              <li key={check.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="font-medium">{check.name}</span>
                <span className="text-muted-foreground">
                  {check.reachable ? "Reachable" : "Unreachable"} ·{" "}
                  {check.extractOk ? "extractable" : "not extractable"}
                  {check.httpStatus ? ` · HTTP ${check.httpStatus}` : ""} · {check.failureCategory} ·{" "}
                  {check.latencyMs}ms · {formatTimestamp(check.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Community reports</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card/70">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{report.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.kind}
                    {report.note ? ` — ${report.note}` : ""} · {formatTimestamp(report.createdAt)}
                    {report.resolvedAt ? " · resolved" : ""}
                  </p>
                </div>
                {isModerator && !report.resolvedAt ? (
                  <ResolveReportButton reportId={report.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
