import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { Clock } from "lucide-react";
import { browseHistory } from "@ambl/database";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HistoryTimeline } from "@/components/history-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

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
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sites visited</h1>
        <Link href="/library" className="text-sm font-medium text-primary hover:underline">
          Go to library
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 pt-5 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No visit history yet</p>
            <p className="text-sm text-muted-foreground">
              Browse anime or manga sites with the extension running and each page you open lands
              here as a timeline entry.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{rows.length} recent visits</CardTitle>
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
  );
}