import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { CalendarDays, History, LayoutGrid, Tag } from "lucide-react";
import {
  progressHistory,
  ratings,
  titles,
  userLibrary,
  userOauthAccounts,
  userProgress,
  users,
} from "@ambl/database";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate, libraryStatusLabel, relativeTime } from "@/lib/format";
import { MediaTypeBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const db = getDb();

  const [profile, accountsRow, statusCounts, favs, totals, ratingAgg, recent] =
    await Promise.all([
      db
        .select({ createdAt: users.createdAt, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
        .then((r) => r[0]),
      db
        .select({ provider: userOauthAccounts.provider })
        .from(userOauthAccounts)
        .where(eq(userOauthAccounts.userId, user.id)),
      db
        .select({ status: userLibrary.status, count: sql<number>`count(*)::int` })
        .from(userLibrary)
        .where(eq(userLibrary.userId, user.id))
        .groupBy(userLibrary.status),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userLibrary)
        .where(
          and(eq(userLibrary.userId, user.id), eq(userLibrary.isFavorite, true)),
        )
        .then((r) => r[0]?.count ?? 0),
      db
        .select({
          chapters: sql<number>`coalesce(sum(last_completed_chapter),0)::int`,
          episodes: sql<number>`coalesce(sum(last_completed_episode),0)::int`,
        })
        .from(userProgress)
        .where(eq(userProgress.userId, user.id))
        .limit(1)
        .then((r) => r[0]),
      db
        .select({
          count: sql<number>`count(*)::int`,
          avg: sql<number>`coalesce(round(avg(score),1),0)`,
        })
        .from(ratings)
        .where(eq(ratings.userId, user.id))
        .limit(1)
        .then((r) => r[0]),
      db
        .select({
          id: progressHistory.id,
          titleId: progressHistory.titleId,
          title: titles.primaryTitle,
          mediaType: titles.mediaType,
          unit: progressHistory.unit,
          kind: progressHistory.kind,
          value: progressHistory.value,
          createdAt: progressHistory.createdAt,
        })
        .from(progressHistory)
        .innerJoin(titles, eq(progressHistory.titleId, titles.id))
        .where(eq(progressHistory.userId, user.id))
        .orderBy(desc(progressHistory.createdAt))
        .limit(6),
    ]);

  const topGenres = profile
    ? await db.execute<{ genre: string; count: number }>(sql`
        select unnest(t.genres) as genre, count(*)::int as count
        from user_library ul
        join titles t on t.id = ul.title_id
        where ul.user_id = ${user.id}
        group by genre
        order by count desc
        limit 6
      `)
    : [];

  const statusNames = new Map(statusCounts.map((s) => [s.status, s.count]));
  const providers = accountsRow.map((a) => a.provider);
  const initials =
    (user.displayName || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center sm:flex-row sm:text-left">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={user.displayName || "Avatar"}
              referrerPolicy="no-referrer"
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary ring-2 ring-border">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {user.displayName || "Unnamed"}
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              {(providers.includes("google") || user.oauthProvider === "google") && (
                <span className="rounded-full border border-input px-2.5 py-0.5 text-xs text-muted-foreground">Google</span>
              )}
              {(providers.includes("mal") || user.oauthProvider === "mal") && (
                <span className="rounded-full border border-input px-2.5 py-0.5 text-xs text-muted-foreground">MyAnimeList</span>
              )}
              {user.passwordHash && (
                <span className="rounded-full border border-input px-2.5 py-0.5 text-xs text-muted-foreground">Email + password</span>
              )}
              {profile?.createdAt && (
                <span className="flex items-center gap-1 rounded-full border border-input px-2.5 py-0.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" /> Joined {formatDate(new Date(profile.createdAt))}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" /> Your stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="In library" value={statusCounts.reduce((a, s) => a + s.count, 0)} />
            <Stat label="Favorites" value={favs} />
            <Stat label="Episodes watched" value={totals?.episodes ?? 0} />
            <Stat label="Chapters read" value={totals?.chapters ?? 0} />
            <Stat label="Ratings" value={ratingAgg?.count ?? 0} />
            <Stat label="Avg rating" value={String(ratingAgg?.avg ?? "—")} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(STATUS_ORDER) as LibraryStatusKey[]).map((status) => {
              const count = statusNames.get(status) ?? 0;
              if (count === 0) return null;
              return (
                <div key={status} className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm">
                  {libraryStatusLabel(status as LibraryStatusDashKey)}
                  <span className="ml-1.5 font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {topGenres.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Top genres
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(topGenres as { genre: string; count: number }[]).map((g) => (
              <span
                key={g.genre}
                className="rounded-full border border-input px-3 py-1 text-xs font-medium"
              >
                {g.genre} <span className="opacity-60">{g.count}</span>
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50">
                <MediaTypeBadge type={r.mediaType} />
                <Link
                  href={`/title/${r.titleId}`}
                  className="line-clamp-1 flex-1 text-sm font-medium hover:text-primary"
                >
                  {r.title}
                </Link>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {r.unit === "EPISODE" ? "Episode" : "Chapter"} {r.value}{" "}
                  {r.kind === "COMPLETED" ? "✓" : "opened"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(r.createdAt)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const STATUS_ORDER = [
  "CURRENTLY_WATCHING",
  "CURRENTLY_READING",
  "COMPLETED",
  "ON_HOLD",
  "PLAN_TO_WATCH",
  "PLAN_TO_READ",
  "DROPPED",
] as const;
type LibraryStatusKey = (typeof STATUS_ORDER)[number];

type LibraryStatusDashKey =
  | "CURRENTLY_WATCHING"
  | "CURRENTLY_READING"
  | "PLAN_TO_WATCH"
  | "PLAN_TO_READ"
  | "COMPLETED"
  | "ON_HOLD"
  | "DROPPED";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}