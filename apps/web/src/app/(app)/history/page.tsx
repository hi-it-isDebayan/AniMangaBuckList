import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Clock } from "lucide-react";
import { browseHistory } from "@ambl/database";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HistoryTimeline } from "@/components/history-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchProviderWrapper } from "@/components/search-provider-wrapper";

export const metadata: Metadata = { title: "Visit history" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireUser();
  const db = getDb();

  const rows = await db
    .select({
      id: browseHistory.id,
      title: browseHistory.title,
      site: browseHistory.site,
      coverUrl: browseHistory.coverUrl,
      malId: browseHistory.malId,
      unit: browseHistory.unit,
      value: browseHistory.value,
      visitedAt: browseHistory.visitedAt,
    })
    .from(browseHistory)
    .where(eq(browseHistory.userId, user.id))
    .orderBy(desc(browseHistory.visitedAt))
    .limit(300);

  return (
    <SearchProviderWrapper defaultType="MANGA" defaultSource="all">
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          icon={Clock}
          title="Sites visited"
          subtitle="Every page you open with the extension running lands here."
          actions={
            <Link
              href="/library"
              className="text-sm font-medium text-primary transition-colors hover:underline"
            >
              Go to library →
            </Link>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8" />}
            title="No visit history yet"
            description="Browse anime or manga sites with the extension running and each page you open lands here as a timeline entry."
          />
        ) : (
          <Card className="border-border/70 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Clock className="h-4 w-4" />
                </span>
                <span className="font-display font-bold tracking-tight">
                  {rows.length} recent visits
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTimeline
                items={rows.map((r) => ({
                  ...r,
                  visitedAt: r.visitedAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </SearchProviderWrapper>
  );
}