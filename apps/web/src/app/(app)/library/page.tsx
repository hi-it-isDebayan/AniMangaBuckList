import type { Metadata } from "next";
import Link from "next/link";
import { and, arrayContains, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { BookMarked } from "lucide-react";
import type { LibraryStatus, MediaType } from "@ambl/types";
import {
  titles,
  userLibrary,
  userProgress,
  userTags,
  tags as tagsTable,
  titleAliases,
} from "@ambl/database";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { LibraryItemCard } from "@/components/library-item-card";
import { LibraryToolbar } from "@/components/library-toolbar";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { AddTitleDialog } from "@/components/add-title-dialog";
import { LIBRARY_STATUSES, GENRE_CHIP_COLORS, libraryStatusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

const VALID_STATUS = new Set<string>(["ALL", ...LIBRARY_STATUSES]);
const VALID_TYPE = new Set<string>([
  "ANIME",
  "MANGA",
  "MANHWA",
  "MANHUA",
  "LIGHT_NOVEL",
  "WEB_NOVEL",
]);
const VALID_SORT = new Set(["updated", "added", "title"]);
const PAGE_SIZE = 24;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const rawStatus = String(sp.status ?? "ALL");
  const status = VALID_STATUS.has(rawStatus) ? rawStatus : "ALL";
  const rawType = String(sp.type ?? "");
  const mediaType = VALID_TYPE.has(rawType) ? rawType : "";
  const tag = String(sp.tag ?? "").trim().slice(0, 40);
  const rawSort = String(sp.sort ?? "updated");
  const sort = VALID_SORT.has(rawSort) ? rawSort : "updated";
  const q = String(sp.q ?? "").trim().slice(0, 120);
  const genre = String(sp.genre ?? "").trim().slice(0, 40);
  const rawPage = Number(sp.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const db = getDb();

  const conditions = [eq(userLibrary.userId, user.id)];
  if (status !== "ALL") {
    conditions.push(eq(userLibrary.status, status as LibraryStatus));
  }
  if (mediaType) {
    conditions.push(eq(titles.mediaType, mediaType as MediaType));
  }
  if (q) {
    conditions.push(
      or(
        ilike(titles.primaryTitle, `%${q}%`),
        ilike(titles.englishTitle ?? "", `%${q}%`),
        ilike(titles.japaneseTitle ?? "", `%${q}%`),
        sql`exists (select 1 from ${titleAliases} ta where ta.title_id = ${titles.id} and ta.alias ilike ${`%${q}%`})`,
      )!,
    );
  }
  if (tag) {
    conditions.push(
      sql`exists (select 1 from ${userTags} ut join ${tagsTable} tg on tg.id = ut.tag_id where ut.user_id = ${user.id} and ut.title_id = ${titles.id} and tg.name ilike ${`%${tag}%`})`,
    );
  }
  if (genre) {
    conditions.push(arrayContains(titles.genres, [genre]));
  }

  const where = and(...conditions);

  const [statusCounts, [{ total }], genreRows] = await Promise.all([
    db
      .select({ status: userLibrary.status, count: count() })
      .from(userLibrary)
      .where(eq(userLibrary.userId, user.id))
      .groupBy(userLibrary.status),
    db
      .select({ total: count() })
      .from(userLibrary)
      .innerJoin(titles, eq(userLibrary.titleId, titles.id))
      .where(where!),
    db.execute(
      sql`select g as genre, count(*)::int as count from user_library ul join ${titles} t on t.id = ul.title_id, unnest(t.genres) as g where ul.user_id = ${user.id} and g <> '' group by g order by count desc, g asc`,
    ),
  ]);

  const genreCounts = (Array.isArray(genreRows) ? genreRows : (genreRows as { rows?: unknown[] }).rows ?? []) as {
    genre: string;
    count: number;
  }[];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const orderBy =
    sort === "title"
      ? [sql`lower(${titles.primaryTitle}) asc`]
      : sort === "added"
        ? [desc(userLibrary.addedAt)]
        : [desc(userLibrary.updatedAt)];

  const rows = await db
    .select({
      titleId: titles.id,
      title: titles.primaryTitle,
      englishTitle: titles.englishTitle,
      mediaType: titles.mediaType,
      status: userLibrary.status,
      isFavorite: userLibrary.isFavorite,
      year: titles.year,
      coverUrl: titles.coverUrl,
      openedChapter: userProgress.lastOpenedChapter,
      completedChapter: userProgress.lastCompletedChapter,
      openedEpisode: userProgress.lastOpenedEpisode,
      completedEpisode: userProgress.lastCompletedEpisode,
      lastSourceUrl: userProgress.lastSourceUrl,
      updatedAt: userLibrary.updatedAt,
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
    .where(where!)
    .orderBy(orderBy[0], sql`${titles.primaryTitle} asc`)
    .offset((currentPage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE);

  const countMap = new Map(statusCounts.map((r) => [r.status, r.count]));
  const tabs = [
    { key: "ALL", label: "All", count: total },
    ...LIBRARY_STATUSES.map((s) => ({
      key: s,
      label: libraryStatusLabel(s),
      count: countMap.get(s) ?? 0,
    })),
  ];

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (mediaType) params.set("type", mediaType);
    if (tag) params.set("tag", tag);
    if (genre) params.set("genre", genre);
    if (sort !== "updated") params.set("sort", sort);
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/library?${params.toString()}`;
  };

  const buildTypeHref = (type: string) => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (type) params.set("type", type);
    if (tag) params.set("tag", tag);
    if (genre) params.set("genre", genre);
    if (sort !== "updated") params.set("sort", sort);
    if (q) params.set("q", q);
    return `/library?${params.toString()}`;
  };

  const MEDIA_TABS: { key: string; label: string }[] = [
    { key: "", label: "All" },
    { key: "ANIME", label: "Anime" },
    { key: "MANGA", label: "Manga" },
    { key: "MANHWA", label: "Manhwa" },
    { key: "MANHUA", label: "Manhua" },
    { key: "LIGHT_NOVEL", label: "Light Novel" },
    { key: "WEB_NOVEL", label: "Web Novel" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <AddTitleDialog />
      </div>

      <LibraryToolbar
        status={status}
        mediaType={mediaType}
        tag={tag}
        sort={sort}
        query={q}
      />

      <div className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border bg-card p-1 shadow-sm">
        {MEDIA_TABS.map((tab) => (
          <Link
            key={tab.key || "all"}
            href={buildTypeHref(tab.key)}
            scroll={false}
            className={cn(
              "flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors",
              mediaType === tab.key
                ? "bg-brand-gradient text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {genreCounts.length > 0 && (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
          <GenreChip href="/library" active={!genre} label="All" />
          {genreCounts.map((g, i) => (
            <GenreChip
              key={g.genre}
              href={`/library?genre=${encodeURIComponent(g.genre)}`}
              active={genre === g.genre}
              label={g.genre}
              count={g.count}
              color={GENRE_CHIP_COLORS[i % GENRE_CHIP_COLORS.length]}
            />
          ))}
        </div>
      )}

      <div className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "ALL" ? "/library" : buildHref(1).replace(/[?&]page=\d+/, "")}
            scroll={false}
            className={cn(
              "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors",
              status === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">{tab.count}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<BookMarked className="h-8 w-8" />}
          title={
            status === "ALL" && !q && !mediaType && !tag
              ? "Your library is empty"
              : "No titles match"
          }
          description={
            status === "ALL" && !q && !mediaType && !tag
              ? "Search MyAnimeList and add anime and manga you follow."
              : "Try adjusting the filters."
          }
          action={status === "ALL" && !q && !mediaType && !tag ? <AddTitleDialog /> : undefined}
        />
      ) : (
<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {rows.map((row) => (
          <LibraryItemCard key={row.titleId} item={row} />
        ))}
      </div>
      )}

      <Pagination page={currentPage} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}

function GenreChip({
  href,
  active,
  label,
  count,
  color,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  color?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : color ?? "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {label}
      {count != null && <span className={cn(active ? "opacity-80" : "opacity-60")}>{count}</span>}
    </Link>
  );
}