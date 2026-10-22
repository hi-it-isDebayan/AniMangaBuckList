import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  Activity,
  Bell,
  BookOpen,
  BookOpenText,
  ExternalLink,
  Flame,
  History,
  Tags,
} from "lucide-react";
import {
  titles,
  userLibrary,
  userProgress,
  progressHistory,
  releaseEvents,
  notifications as notificationsTable,
} from "@ambl/database";
import type { LibraryStatus } from "@ambl/types";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { EmptyState } from "@/components/empty-state";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, MediaTypeBadge } from "@/components/status-badge";
import type { ActivityDay } from "@/lib/activity";
import {
  GENRE_CHIP_COLORS,
  greetingForHour,
  progressUnitForType,
  relativeTime,
  statusAccentClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/section-heading";
import { SearchProviderWrapper } from "@/components/search-provider-wrapper";

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
      and(eq(userProgress.userId, user.id), eq(userProgress.titleId, titles.id)),
    )
    .where(
      and(eq(userLibrary.userId, user.id), inArray(userLibrary.status, CONTINUE_STATUSES)),
    )
    .orderBy(desc(userLibrary.updatedAt))
    .limit(5);

  const [recentProgress, releases, unread, activeCount, genreRows, heatRows] =
    await Promise.all([
      db
        .select({
          id: progressHistory.id,
            titleId: titles.id,
            title: titles.primaryTitle,
            mediaType: titles.mediaType,
            coverUrl: titles.coverUrl,
            unit: progressHistory.unit,
            kind: progressHistory.kind,
            value: progressHistory.value,
            source: progressHistory.source,
            createdAt: progressHistory.createdAt,
          })
        .from(progressHistory)
        .innerJoin(titles, eq(progressHistory.titleId, titles.id))
        .where(eq(progressHistory.userId, user.id))
        .orderBy(desc(progressHistory.createdAt))
        .limit(8),
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
          and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false)),
        )
        .orderBy(desc(notificationsTable.createdAt))
        .limit(5),
      db.select({ id: userLibrary.id }).from(userLibrary).where(eq(userLibrary.userId, user.id)),
      db.execute(
        sql`select g as genre, count(*)::int as count from user_library ul join ${titles} t on t.id = ul.title_id, unnest(t.genres) as g where ul.user_id = ${user.id} and g <> '' group by g order by count desc, g asc limit 8`,
      ),
      db.execute<{ d: string; n: number }>(sql`
        select d, sum(n)::int as n from (
          select to_char(created_at at time zone 'UTC','YYYY-MM-DD') d, count(*) n
            from progress_history where user_id = ${user.id} and created_at >= now() - interval '182 days' group by d
          union all
          select to_char(visited_at at time zone 'UTC','YYYY-MM-DD') d, count(*) n
            from browse_history where user_id = ${user.id} and visited_at >= now() - interval '182 days' group by d
        ) t group by d
      `),
    ]);

  const genres = toRows<{ genre: string; count: number }>(genreRows);
  const heatData: ActivityDay[] = toRows<{ d: string; n: number }>(heatRows).map((r) => ({
    date: r.d,
    count: Number(r.n),
  }));

  const hour = new Date().getHours();
  const inProgress = continueRows.length;

  return (
    <SearchProviderWrapper defaultType="MANGA" defaultSource="all">
      <div className="space-y-6">
      <section className="noise-overlay relative overflow-hidden rounded-3xl border border-border/70 bg-card p-6 shadow-sm sm:p-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.10]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-brand-gradient opacity-25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-rose-500/20 to-amber-400/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="fade-in">
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <BookOpen className="h-3 w-3" /> {hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 18 ? "Good afternoon" : "Good evening"}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {greetingForHour(hour)}
              {user.displayName ? (
                <>
                  , <span className="text-gradient-animated">{user.displayName}</span>
                </>
              ) : null}
            </h1>
            <p className="mt-2 max-w-md text-sm text-balance text-muted-foreground">
              {continueRows.length > 0
                ? `${inProgress} title${inProgress === 1 ? "" : "s"} in progress — pick up right where you left off.`
                : "Your next read is waiting in your library."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/discover"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:scale-[1.03] hover:bg-primary/90"
            >
              Discover
            </Link>
            <Link
              href="/library"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border/80 bg-background/60 px-5 text-sm font-medium backdrop-blur transition-colors hover:bg-accent"
            >
              Open library
            </Link>
          </div>
        </div>
        <dl className="reveal-stagger relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Tracking" value={activeCount.length} icon={<BookOpenText className="h-3.5 w-3.5" />} />
          <Stat label="In progress" value={inProgress} icon={<Flame className="h-3.5 w-3.5" />} />
          <Stat label="Recent releases" value={releases.length} icon={<Bell className="h-3.5 w-3.5" />} />
          <Stat label="Top genres" value={genres.length} icon={<Tags className="h-3.5 w-3.5" />} />
        </dl>
      </section>

      <Card className="border-border/70 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Activity className="h-4 w-4" />
            </span>
            <span className="font-display font-bold tracking-tight">Activity</span>
            <span className="ml-auto text-xs font-normal text-muted-foreground">Last 6 months</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap data={heatData} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionHeading
          icon={Flame}
          title="Continue"
          count={continueRows.length}
          href={continueRows.length > 0 ? "/library" : undefined}
        />
        {continueRows.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-8 w-8" />}
            title="Nothing in progress"
            description="Use the search bar below to add a title and start tracking."
          />
        ) : (
          <div className="space-y-2">
            {continueRows.map((row) => {
              const unit = progressUnitForType(row.mediaType);
              const opened = unit === "EPISODE" ? row.openedEpisode : row.openedChapter;
              const completed =
                unit === "EPISODE" ? row.completedEpisode : row.completedChapter;
              const current = Math.max(opened ?? 0, completed ?? 0);
              return (
                <div
                  key={row.titleId}
                  className="card-hover group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-2.5 pr-3 shadow-sm shadow-black/[0.03] sm:gap-4 sm:p-3"
                >
                  <span
                    className={cn("absolute inset-y-0 left-0 w-1", statusAccentClass(row.status))}
                  />
                  <Link
                    href={`/title/${row.titleId}`}
                    className="relative shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60 transition-shadow group-hover:ring-primary/30"
                  >
                    {row.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.coverUrl}
                        alt={row.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-[72px] w-[52px] object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span className="cover-fallback flex h-[72px] w-[52px] items-center justify-center text-muted-foreground">
                        <BookOpenText className="h-6 w-6" />
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/title/${row.titleId}`}
                      className="line-clamp-1 font-medium leading-snug transition-colors group-hover:text-primary"
                    >
                      {row.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={row.status} />
                      <MediaTypeBadge type={row.mediaType} />
                      <span className="text-xs text-muted-foreground">
                        {unit === "EPISODE" ? "Episode" : "Chapter"} {current}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={`/title/${row.titleId}`}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:scale-[1.03] hover:bg-primary/90"
                    >
                      Continue
                    </Link>
                    {row.lastSourceUrl && (
                      <a
                        href={row.lastSourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open source"
                        className="hidden h-9 items-center justify-center rounded-xl border border-input px-2.5 transition-colors hover:bg-accent sm:inline-flex"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {recentProgress.length > 0 && (
        <section className="space-y-3">
          <SectionHeading icon={History} title="Recent progress" count={recentProgress.length} />
          <ul className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm shadow-black/[0.03]">
            {recentProgress.map((row) => (
              <li key={row.id} className="border-b border-border last:border-b-0">
                <Link
                  href={`/title/${row.titleId}`}
                  className="flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/50"
                >
                    {row.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.coverUrl}
                        alt={row.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-8 w-8 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                          row.kind === "COMPLETED"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-primary/15 text-primary",
                        )}
                      >
                        {row.unit === "EPISODE" ? "EP" : "CH"}
                      </span>
                    )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {row.kind === "COMPLETED" ? "Finished" : "Opened"}{" "}
                      {row.unit === "EPISODE" ? "episode" : "chapter"} {row.value}
                      {row.source ? ` · ${row.source}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(row.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(releases.length > 0 || unread.length > 0) && (
        <section className="grid gap-3 sm:grid-cols-2">
          {releases.length > 0 && (
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="font-display font-bold tracking-tight">Recent releases</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {releases.map((rel) => (
                    <li
                      key={rel.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60"
                    >
                      <span className="text-amber-500">🔔</span>
                      <Link href={`/title/${rel.titleId}`} className="min-w-0 truncate hover:text-primary">
                        {rel.title}
                      </Link>
                      <span className="shrink-0 text-muted-foreground">
                        — {rel.releaseType.toLowerCase()} {rel.number}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {relativeTime(rel.detectedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {unread.length > 0 && (
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2.5 text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="font-display font-bold tracking-tight">Notifications</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                    {unread.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {unread.map((n) => (
                    <li
                      key={n.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60"
                    >
                      <span className="min-w-0 flex-1">{n.message}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
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
        <SectionHeading icon={Tags} title="Your genres" count={genres.length} />
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
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:scale-105 hover:brightness-110",
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
      </div>
    </SearchProviderWrapper>
  );
}

function toRows<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as T[];
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-background/60 px-4 py-3 backdrop-blur transition-colors hover:border-primary/30">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon && <span className="text-primary">{icon}</span>}
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gradient">
        {value}
      </dd>
    </div>
  );
}
