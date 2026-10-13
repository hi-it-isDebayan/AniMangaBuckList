import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { listLinkedSources } from "@/lib/sources/service";
import { SourceRowActions } from "@/components/sources/source-row-actions";
import { StatusBadge } from "@/components/sources/status-badge";

export const metadata: Metadata = { title: "My linked sources" };
export const dynamic = "force-dynamic";

function formatTimestamp(value: Date | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default async function MySourcesPage() {
  const user = await requireUser();
  const links = await listLinkedSources(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-3 py-6 sm:px-4">
      <div>
        <h1 className="text-2xl font-semibold">My linked sources</h1>
        <p className="text-sm text-muted-foreground">
          Sources you follow. Test one any time; a single failure never marks it broken.
        </p>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You have no linked sources yet.{" "}
            <Link href="/sources" className="text-primary underline-offset-4 hover:underline">
              Discover sources
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div key={link.linkId} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{link.name}</p>
                  <a
                    href={link.homepageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {link.domain}
                  </a>
                </div>
                <StatusBadge status={link.status} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Last checked</dt>
                  <dd>{formatTimestamp(link.lastCheckedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last success</dt>
                  <dd>{formatTimestamp(link.lastSuccessAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Failures</dt>
                  <dd>{link.consecutiveFailures}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd>{link.lastFailureCategory}</dd>
                </div>
              </dl>

              <div className="mt-3">
                <SourceRowActions sourceId={link.id} linked />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Looking for more?{" "}
        <Link href="/sources" className="text-primary underline-offset-4 hover:underline">
          Browse the directory
        </Link>
        .
      </p>
    </div>
  );
}
