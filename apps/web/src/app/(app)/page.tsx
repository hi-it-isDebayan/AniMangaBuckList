import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Bell, BookOpen, BookOpenText, Flame, LibraryBig, Tags } from "lucide-react";
import { titles, userLibrary, userProgress, releaseEvents, notifications as notificationsTable } from "@ambl/database";
import type { LibraryStatus } from "@ambl/types";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AddTitleDialog } from "@/components/add-title-dialog";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, MediaTypeBadge } from "@/components/status-badge";
import {
  GENRE_CHIP_COLORS,
  greetingForHour,
  progressUnitForType,
  relativeTime,
  statusAccentClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CONTINUE_STATUSES: LibraryStatus[] = [
  "CURRENTLY_WATCHING",
  "CURRENTLY_READING",
  "ON_HOLD",
];

export default async function DashboardPage() {
  const user = await requireUser();
  const db = getDb();

  const continueRows = await db
    .select({
      titleId: titles.id,
      title: titles.primaryTitle,
      mediaType: titles.mediaType,
      status: userLibrary.status,
      coverUrl: titles.coverUrl,
      lastSourceUrl: userProgress.lastSourceUrl,
      openedChapter: userProgress.lastOpenedChapter,
      completedChapter: userProgress.lastCompletedChapter,
      openedEpisode: userProgress.lastOpenedEpisode,
      completedEpisode: userProgress.lastCompletedEpisode,
    })
    .from(userLibrary)
    .innerJoin(titles, eq(userLibrary.titleId, titles.id))
    .leftJoin(
      userProgress,
      and(
        eq(userProgress.userId, user.id),
        eq(userProgress.titleId, titles.id),
      ),
    )
    .where(
      and(
        eq(userLibrary.userId, user.id),
        inArray(userLibrary.status, CONTINUE_STATUSES),
      ),
    )
    .orderBy(desc(userLibrary.updatedAt))
    .limit(6);

  const [releases, unread, activeCount, genreRows] = await Promise.all([
    db
      .select({
        id: releaseEvents.id,
        releaseType: releaseEvents.releaseType,
        number: releaseEvents.number,
        detectedAt: releaseEvents.detectedAt,
        titleId: titles.id,
        title: titles.primaryTitle,
      })
      .from(releaseEvents)
      .innerJoin(titles, eq(releaseEvents.titleId, titles.id))
      .orderBy(desc(releaseEvents.detectedAt))
      .limit(5),
    db
      .select({
        id: notificationsTable.id,
        message: notificationsTable.message,
        createdAt: notificationsTable.createdAt,
        titleId: notificationsTable.titleId,
      })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, user.id),
          eq(notificationsTable.read, false),
        ),
      )
      .orderBy(desc(notificationsTable.createdAt))
      .limit(5),
    db
      .select({ id: userLibrary.id })
      .from(userLibrary)
      .where(eq(userLibrary.userId, user.id)),
    db.execute(
      sql`select g as genre, count(*)::int as count from user_library ul join ${titles} t on t.id = ul.title_id, unnest(t.genres) as g where ul.user_id = ${user.id} and g <> '' group by g order by count desc, g asc limit 8`,
    ),
  ]);

  const genres = (
    Array.isArray(genreRows) ? genreRows : (genreRows as { rows?: unknown[] }).rows ?? []
  ) as { genre: string; count: number }[];

  const hour = new Date().getHours();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greetingForHour(hour)}
            {user.displayName ? `, ${user.displayName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {continueRows.length > 0
              ? "Pick up where you left off."
              : "Your next read is waiting in your library."}
          </p>
        </div>
        <AddTitleDialog />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <Flame className="h-4 w-4 text-primary" /> Continue
          </h2>
          {continueRows.length > 0 && (
            <Link
              href="/library"
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              View all →
            </Link>
          )}
        </div>
        {continueRows.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-8 w-8" />}
            title="Nothing in progress"
            description="Add a title to your library to start tracking chapters and episodes."
            action={<AddTitleDialog />}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {continueRows.map((row) => {
              const unit = progressUnitForType(row.mediaType);
              const opened = unit === "EPISODE" ? row.openedEpisode : row.openedChapter;
              const completed =
                unit === "EPISODE" ? row.completedEpisode : row.completedChapter;
              const current = Math.max(opened ?? 0, completed ?? 0);
              return (
                <li key={row.titleId}>
                  <Card className="group relative h-full overflow-hidden">
                    <span
                      className={cn(
                        "absolute inset-x-0 top-0 h-1",
                        statusAccentClass(row.status),
                      )}
                    />
                    <CardContent className="flex h-full gap-3 p-4 pt-5">
                      <Link
                        href={`/title/${row.titleId}`}
                        className="relative h-36 w-24 shrink-0 overflow-hidden rounded-md bg-muted"
                      >
                        {row.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.coverUrl}
                            alt={row.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <BookOpenText className="h-7 w-7" />
                          </span>
                        )}
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={row.status} />
                          <MediaTypeBadge type={row.mediaType} />
                        </div>
                        <Link
                          href={`/title/${row.titleId}`}
                          className="mt-1.5 line-clamp-2 font-medium leading-snug hover:text-primary"
                        >
                          {row.title}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {unit === "EPISODE" ? "Episode" : "Chapter"} {current}
                        </p>
                        <div className="mt-auto flex items-center gap-2 pt-3">
                          <Link
                            href={`/title/${row.titleId}`}
                            className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                          >
                            Continue
                          </Link>
                          {row.lastSourceUrl && (
                            <a
                              href={row.lastSourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Open source"
                              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm hover:bg-accent"
                            >
                              Source
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(releases.length > 0 || unread.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {releases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent releases</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {releases.map((rel) => (
                    <li key={rel.id} className="flex items-center gap-2">
                      <span>🔔</span>
                      <Link href={`/title/${rel.titleId}`} className="hover:text-primary">
                        {rel.title}
                      </Link>
                      <span className="text-muted-foreground">
                        — {rel.releaseType.toLowerCase()} {rel.number}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {relativeTime(rel.detectedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {unread.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {unread.map((n) => (
                    <li key={n.id} className="flex items-center gap-2">
                      <span>{n.message}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {relativeTime(n.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Tags className="h-4 w-4 text-primary" /> Your genres
        </h2>
        {genres.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add titles to see genre filters here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {genres.map((g, i) => (
              <Link
                key={g.genre}
                href={`/library?genre=${encodeURIComponent(g.genre)}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:brightness-110",
                  GENRE_CHIP_COLORS[i % GENRE_CHIP_COLORS.length],
                )}
              >
                {g.genre}
                <span className="opacity-60">{g.count}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <LibraryBig className="h-4 w-4 text-primary" /> Library
        </h2>
        <p className="text-sm text-muted-foreground">
          {activeCount.length} titles tracked ·{" "}
          <Link href="/library" className="text-primary hover:underline">
            Open library
          </Link>
        </p>
      </section>
    </div>
  );
}