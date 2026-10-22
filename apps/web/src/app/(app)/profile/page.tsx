import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import {
  CalendarDays,
  History,
  Library,
  Monitor,
  Smartphone,
} from "lucide-react";
import {
  browseHistory,
  deviceHeartbeats,
  publicApiKeys,
  userLibrary,
  userProgress,
  users,
} from "@ambl/database";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate, libraryStatusLabel, relativeTime } from "@/lib/format";
import { HistoryTimeline } from "@/components/history-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export default async function ProfilePage() {
  const user = await requireUser();
  const db = getDb();

  const [profile, statusCounts, favs, totals, heartbeatsRows, lastVisitedRows, recentSites] =
    await Promise.all([
      db
        .select({ createdAt: users.createdAt, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
        .then((r) => r[0]),
      db
        .select({ status: userLibrary.status, count: sql<number>`count(*)::int` })
        .from(userLibrary)
        .where(eq(userLibrary.userId, user.id))
        .groupBy(userLibrary.status),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userLibrary)
        .where(
          sql`${userLibrary.userId} = ${user.id} and ${userLibrary.isFavorite} = true`,
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
        .then((r) => r[0] ?? { chapters: 0, episodes: 0 }),
      db
        .select({
          platform: deviceHeartbeats.platform,
          lastSeenAt: deviceHeartbeats.lastSeenAt,
        })
        .from(deviceHeartbeats)
        .innerJoin(
          publicApiKeys,
          eq(deviceHeartbeats.apiKeyId, publicApiKeys.id),
        )
        .where(eq(publicApiKeys.userId, user.id)),
      db.execute<{ last_visited: string | null }>(sql`
        select greatest(
          (select max(last_seen_at) from sessions where user_id = ${user.id}),
          (select max(visited_at) from browse_history where user_id = ${user.id}),
          (select max(created_at) from progress_history where user_id = ${user.id})
        ) as last_visited
      `),
      db
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
        .limit(6),
    ]);

  const heartbeats = heartbeatsRows.filter((h) => h.platform !== "web");
  const now = Date.now();
  const onlineByPlatform = new Map(
    heartbeats.map((h) => [
      h.platform,
      now - h.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
    ]),
  );
  const extensionOnline = onlineByPlatform.get("extension") ?? false;
  const appOnline = onlineByPlatform.get("android") ?? false;
  const lastVisited = lastVisitedRows[0]?.last_visited ?? null;

  const statusNames = new Map(statusCounts.map((s) => [s.status, s.count]));
  const libraryCount = statusCounts.reduce((a, s) => a + s.count, 0);
  const initials = (user.displayName || user.email || "?").slice(0, 2).toUpperCase();

  const providers = user.oauthProvider ? [user.oauthProvider] : [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="noise-overlay relative overflow-hidden border-border/70 bg-card/80">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-brand-gradient opacity-[0.14]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-gradient opacity-20 blur-3xl"
        />
        <CardContent className="relative flex flex-col items-center gap-4 pt-10 text-center">
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={user.displayName || "Avatar"}
              referrerPolicy="no-referrer"
              className="h-24 w-24 rounded-full object-cover shadow-xl ring-4 ring-background"
            />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/5 text-3xl font-bold text-primary shadow-xl ring-4 ring-background">
              {initials}
            </span>
          )}
          <h1 className="truncate font-display text-2xl font-bold tracking-tight">
            {user.displayName || "Unnamed"}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {providers.map((provider) => (
              <span
                key={provider}
                className="rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs text-muted-foreground"
              >
                {provider === "google" ? "Google" : "MyAnimeList"}
              </span>
            ))}
            {profile?.createdAt && (
              <span className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Joined {formatDate(new Date(profile.createdAt))}
              </span>
            )}
            {lastVisited && (
              <span className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs text-muted-foreground">
                Last visited {relativeTime(new Date(lastVisited))}
              </span>
            )}
          </div>

          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <DeviceStatus
              icon={<Monitor className="h-4 w-4 text-primary" />}
              label="Extension"
              online={extensionOnline}
            />
            <DeviceStatus
              icon={<Smartphone className="h-4 w-4 text-primary" />}
              label="Android app"
              online={appOnline}
            />
          </div>

          <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
            <Link
              href="/library"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:scale-[1.02] hover:bg-primary/90"
            >
              <Library className="h-4 w-4" /> My Library
            </Link>
            <Link
              href="/history"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/50 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <History className="h-4 w-4" /> History
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Library className="h-4 w-4" />
            </span>
            <span className="font-display font-bold tracking-tight">Library at a glance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="In library" value={libraryCount} />
            <Stat label="Favorites" value={favs} />
            <Stat label="Watched" value={totals.episodes} />
            <Stat label="Read" value={totals.chapters} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {STATUS_ORDER.map((status) => {
              const count = statusNames.get(status) ?? 0;
              if (count === 0) return null;
              return (
                <span
                  key={status}
                  className="rounded-full border border-border/70 bg-background/50 px-3 py-1 text-xs font-medium"
                >
                  {libraryStatusLabel(status)}
                  <span className="ml-1 opacity-60">{count}</span>
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {recentSites.length > 0 && (
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <History className="h-4 w-4" />
              </span>
              <span className="font-display font-bold tracking-tight">Sites visited</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HistoryTimeline
              items={recentSites.map((r) => ({
                ...r,
                visitedAt: r.visitedAt.toISOString(),
              }))}
            />
            <div className="mt-4 text-center">
              <Link href="/history" className="text-sm font-medium text-primary hover:underline">
                View full timeline
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeviceStatus({
  icon,
  label,
  online,
}: {
  icon: React.ReactNode;
  label: string;
  online: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2">
      {icon}
      <div className="text-left">
        <p className="text-sm font-medium">{label}</p>
        <p className={online ? "text-xs text-emerald-500" : "text-xs text-muted-foreground"}>
          {online ? "Online" : "Offline"}
        </p>
      </div>
      <span
        className={
          online
            ? "h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/60"
            : "h-2 w-2 rounded-full bg-muted-foreground/40"
        }
      />
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

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2.5 transition-colors hover:border-primary/30">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-gradient">{value}</p>
    </div>
  );
}