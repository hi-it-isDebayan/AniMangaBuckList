import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import {
  BookOpenText,
  Layers,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { mangabakaSeries, titleComments, titles, userLibrary, users } from "@ambl/database";
import { getMangabakaSeries, toDiscoverItem } from "@/lib/mangabaka";
import type { MediaStatus, MediaType } from "@ambl/types";
import { mediaStatusLabel, mediaTypeLabel } from "@/lib/format";
import { CommentSection, type CommentItem } from "@/components/comment-section";
import { AddSeriesButton } from "@/components/add-series-button";
import { StatusBadge } from "@/components/status-badge";
import { Sparkline } from "@/components/sparkline";
import { TitleHero } from "@/components/title/title-hero";
import { findTitleIdByExternalId } from "@/lib/external-ids";
import { getExternalCast, orderStaffForDisplay } from "@/lib/external-cast";
import { CastSection } from "@/components/title/cast-section";
import { CreditsGrid } from "@/components/title/credits-grid";
import {
  DetailItem,
  QuickFacts,
  Stat,
  TitleSection,
} from "@/components/title/title-section";
import { Badge } from "@/components/ui/badge";
import { quickFacts, releasePace, summariseRankHistory } from "@/lib/title-insights";

export const dynamic = "force-dynamic";

interface SeriesView {
  id: number;
  title: string;
  englishTitle: string | null;
  nativeTitle: string | null;
  japaneseTitle: string | null;
  mediaType: MediaType | null;
  status: MediaStatus | null;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
  coverUrl: string | null;
  synopsis: string | null;
  rating: number | null;
  popularity: number | null;
  popularityHistory: { label: string; value: number | null }[];
  genres: string[];
  tags: string[];
  authors: string[];
  artists: string[];
  publishers: { id: number; name: string; language: string | null }[];
  totalChapters: number | null;
  finalVolume: number | null;
  contentRating: string | null;
  isLicensed: boolean;
  hasAnime: boolean;
  malId: number | null;
  anilistId: number | null;
  canonicalUrl: string | null;
  lastUpdatedAt: Date | null;
}

async function loadSeries(id: number): Promise<SeriesView | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(mangabakaSeries)
    .where(eq(mangabakaSeries.id, id))
    .limit(1);

  if (row) {
    return {
      id: row.id,
      title: row.primaryTitle,
      englishTitle: row.englishTitle,
      nativeTitle: row.nativeTitle,
      japaneseTitle: row.japaneseTitle,
      mediaType: row.mediaType,
      status: row.status,
      year: row.year,
      startDate: row.startDate,
      endDate: row.endDate,
      coverUrl: row.coverUrl,
      synopsis: row.synopsis,
      rating: row.rating,
      popularity: row.popularity,
      popularityHistory: [
        { label: "1d", value: row.popularity1d },
        { label: "1w", value: row.popularity1w },
        { label: "1mo", value: row.popularity1mo },
        { label: "3mo", value: row.popularity3mo },
        { label: "6mo", value: row.popularity6mo },
        { label: "1y", value: row.popularity1y },
      ],
      genres: row.genres ?? [],
      tags: row.tags ?? [],
      authors: row.authors ?? [],
      artists: row.artists ?? [],
      publishers: row.publishers ?? [],
      totalChapters: row.totalChapters,
      finalVolume: row.finalVolume,
      contentRating: row.contentRating,
      isLicensed: row.isLicensed,
      hasAnime: row.hasAnime,
      malId: row.malId,
      anilistId: row.anilistId,
      canonicalUrl: row.canonicalUrl,
      lastUpdatedAt: row.lastUpdatedAt,
    };
  }

  const series = await getMangabakaSeries(id);
  if (!series) return null;
  const item = toDiscoverItem(series);
  return {
    id: item.id,
    title: item.title,
    englishTitle: item.englishTitle,
    nativeTitle: item.nativeTitle,
    japaneseTitle: item.japaneseTitle,
    mediaType: item.mediaType,
    status: item.status,
    year: item.year,
    startDate: item.startDate,
    endDate: item.endDate,
    coverUrl: item.coverUrl,
    synopsis: item.synopsis,
    rating: item.score != null ? item.score * 10 : null,
    popularity: item.popularity,
    popularityHistory: [],
    genres: [],
    tags: [],
    authors: [],
    artists: [],
    publishers: [],
    totalChapters: item.chapterCount,
    finalVolume: item.volumeCount,
    contentRating: null,
    isLicensed: false,
    hasAnime: false,
    malId: item.malId,
    anilistId: item.anilistId,
    canonicalUrl: item.canonicalUrl,
    lastUpdatedAt: null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const series = await loadSeries(Number(id));
  return { title: series?.title ?? "Title" };
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await requireUser();
  const series = await loadSeries(id);
  if (!series) notFound();

  const db = getDb();

  const [localTitle] = series.malId != null
    ? await db.select().from(titles).where(eq(titles.malId, series.malId)).limit(1)
    : [];

  // MangaBaka rows do not always expose a MAL id. Fall back to the external-id
  // link table so a title added from Discover is recognised as "in library".
  let linkedTitle = localTitle;
  if (!linkedTitle) {
    const linkedTitleId = await findTitleIdByExternalId("mangabaka", series.id);
    if (linkedTitleId) {
      [linkedTitle] = await db
        .select()
        .from(titles)
        .where(eq(titles.id, linkedTitleId))
        .limit(1);
    }
  }

  const [lib] = linkedTitle
    ? await db
        .select()
        .from(userLibrary)
        .where(
          and(
            eq(userLibrary.userId, user.id),
            eq(userLibrary.titleId, linkedTitle.id),
          ),
        )
        .limit(1)
    : [];

  const commentRows = await db
    .select({
      id: titleComments.id,
      body: titleComments.body,
      createdAt: titleComments.createdAt,
      authorId: users.id,
      authorName: users.displayName,
      authorEmail: users.email,
      authorAvatar: users.avatarUrl,
    })
    .from(titleComments)
    .innerJoin(users, eq(titleComments.userId, users.id))
    .where(eq(titleComments.seriesId, id))
    .orderBy(asc(titleComments.createdAt));

  const comments: CommentItem[] = commentRows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    authorId: c.authorId,
    authorName: c.authorName || c.authorEmail.split("@")[0],
    authorAvatar: c.authorAvatar,
  }));

  const mediaPath = series.mediaType === "ANIME" ? "anime" : "manga";
  const score = series.rating != null ? Math.round(series.rating) / 10 : null;
  const rank = series.popularity;
  const rankSeries = series.popularityHistory
    .map((point) => point.value)
    .filter((value): value is number => value != null);
  const rank1mo = series.popularityHistory.find((point) => point.label === "1mo")?.value ?? null;
  const rankDelta = rank != null && rank1mo != null ? rank - rank1mo : null;

  // Runtime-only cast enrichment (AniList → Jikan fallback). Nothing is stored
  // in Neon; results live in Next's fetch cache and an in-process memo.
  const cast = await getExternalCast({
    anilistId: series.anilistId,
    malId: series.malId,
    mediaType: series.mediaType === "ANIME" ? "ANIME" : "MANGA",
  }).catch(() => null);
  const castStaff = cast ? orderStaffForDisplay(cast.staff).slice(0, 12) : [];

  // Oldest-first rank snapshots for the insight summary (1y → now).
  const rankSummary = summariseRankHistory(
    [...series.popularityHistory].reverse().map((point) => ({
      label: point.label,
      value: point.value,
    })),
  );
  const pace = releasePace(series.totalChapters, series.startDate, series.endDate);
  const facts = quickFacts({
    mediaType: series.mediaType ?? "MANGA",
    status: series.status ? mediaStatusLabel(series.status) : null,
    year: series.year,
    chapters: series.totalChapters,
    volumes: series.finalVolume,
    score,
    rank,
    pace,
  });

  const links = [
    series.canonicalUrl ? { href: series.canonicalUrl, label: "MangaBaka" } : null,
    series.malId != null
      ? { href: `https://myanimelist.net/${mediaPath}/${series.malId}`, label: "MyAnimeList" }
      : null,
    series.anilistId != null
      ? { href: `https://anilist.co/${mediaPath}/${series.anilistId}`, label: "AniList" }
      : null,
  ].filter((link): link is { href: string; label: string } => link != null);

  const published =
    series.startDate || series.endDate
      ? `${series.startDate ?? "?"} → ${series.endDate ?? "ongoing"}`
      : series.year != null
        ? String(series.year)
        : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <TitleHero
        backHref="/discover"
        backLabel="Back to Discover"
        data={{
          title: series.title,
          englishTitle: series.englishTitle,
          nativeTitle: series.nativeTitle,
          japaneseTitle: series.japaneseTitle,
          coverUrl: series.coverUrl,
          mediaType: series.mediaType ?? "MANGA",
          status: series.status,
          year: series.year,
          startDate: series.startDate,
          endDate: series.endDate,
          score,
          rank,
          chapters: series.totalChapters,
          volumes: series.finalVolume,
          genres: series.genres,
          links,
          libraryStatus: lib ? <StatusBadge status={lib.status} /> : null,
        }}
        actions={
          lib && linkedTitle ? (
            <Link
              href={`/title/${linkedTitle.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <BookOpenText className="h-3.5 w-3.5" /> Open in library
            </Link>
          ) : (
            <AddSeriesButton
              mangabakaId={series.id}
              mediaType={series.mediaType ?? "MANGA"}
            />
          )
        }
      />

      {facts.length > 0 && (
        <TitleSection title="At a glance" icon={<Layers className="h-4 w-4" />}>
          <QuickFacts facts={facts} />
        </TitleSection>
      )}

      <TitleSection title="Overview" icon={<BookOpenText className="h-4 w-4" />}>
        {series.synopsis ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {series.synopsis}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No synopsis available.</p>
        )}

        {series.genres.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              Genres
            </p>
            <div className="flex flex-wrap gap-1.5">
              {series.genres.map((genre) => (
                <Badge key={genre}>{genre}</Badge>
              ))}
            </div>
          </div>
        )}

        {series.tags.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              Themes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {series.tags.slice(0, 16).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </TitleSection>

      {(score != null || rank != null) && (
        <TitleSection title="Statistics" icon={<TrendingUp className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {score != null && (
              <Stat label="Score" value={score.toFixed(1)} hint="/ 10" />
            )}
            {rank != null && (
              <Stat label="Global rank" value={`#${rank.toLocaleString()}`} trend={rankDelta} />
            )}
            {series.totalChapters != null && (
              <Stat label="Chapters" value={String(series.totalChapters)} />
            )}
            {series.finalVolume != null && (
              <Stat label="Volumes" value={String(series.finalVolume)} />
            )}
          </div>
          {rankSeries.length >= 3 && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Popularity rank</span>
                <span>last 12 months</span>
              </div>
              <Sparkline
                values={rankSeries}
                invert
                className="h-14 w-full text-primary"
                label="MangaBaka popularity rank over the last 12 months"
              />
              {(rankSummary.best != null || rankSummary.change1y != null) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {rankSummary.best != null && (
                    <>Best rank #{rankSummary.best.toLocaleString()}</>
                  )}
                  {rankSummary.change1y != null && (
                    <>
                      {rankSummary.best != null ? " · " : ""}
                      <span
                        className={
                          rankSummary.improving ? "text-success" : "text-muted-foreground"
                        }
                      >
                        {rankSummary.improving ? "▲" : "▼"}{" "}
                        {Math.abs(rankSummary.change1y).toLocaleString()} places over 12 months
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </TitleSection>
      )}

      <TitleSection title="Details" icon={<Layers className="h-4 w-4" />}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <DetailItem label="Type">
            {mediaTypeLabel(series.mediaType ?? "MANGA")}
          </DetailItem>
          {series.status != null && (
            <DetailItem label="Status">{mediaStatusLabel(series.status)}</DetailItem>
          )}
          {series.year != null && <DetailItem label="Year">{series.year}</DetailItem>}
          {published && <DetailItem label="Published">{published}</DetailItem>}
          {series.totalChapters != null && (
            <DetailItem label="Chapters">{series.totalChapters}</DetailItem>
          )}
          {series.finalVolume != null && (
            <DetailItem label="Volumes">{series.finalVolume}</DetailItem>
          )}
          {score != null && <DetailItem label="Score">{score.toFixed(2)} / 10</DetailItem>}
          {rank != null && (
            <DetailItem label="Popularity">{rank.toLocaleString()}</DetailItem>
          )}
          {series.contentRating && (
            <DetailItem label="Content rating">{series.contentRating}</DetailItem>
          )}
          {series.isLicensed && <DetailItem label="Licensed">Yes</DetailItem>}
          {series.hasAnime && <DetailItem label="Anime adaptation">Yes</DetailItem>}
          {series.malId != null && (
            <DetailItem label="MAL ID">
              <a
                className="text-primary hover:underline"
                href={`https://myanimelist.net/${mediaPath}/${series.malId}`}
                target="_blank"
                rel="noreferrer"
              >
                {series.malId}
              </a>
            </DetailItem>
          )}
          {series.anilistId != null && (
            <DetailItem label="AniList ID">
              <a
                className="text-primary hover:underline"
                href={`https://anilist.co/${mediaPath}/${series.anilistId}`}
                target="_blank"
                rel="noreferrer"
              >
                {series.anilistId}
              </a>
            </DetailItem>
          )}
          {series.lastUpdatedAt && (
            <DetailItem label="Last updated">
              {series.lastUpdatedAt.toLocaleDateString()}
            </DetailItem>
          )}
        </dl>
      </TitleSection>

      {(series.authors.length > 0 ||
        series.artists.length > 0 ||
        series.publishers.length > 0 ||
        castStaff.length > 0) && (
        <TitleSection title="Credits" icon={<Users className="h-4 w-4" />}>
          <CreditsGrid
            authors={series.authors}
            artists={series.artists}
            publishers={series.publishers.map((p) => p.name).filter(Boolean)}
            staff={castStaff}
          />
        </TitleSection>
      )}

      {cast && (cast.characters.length > 0 || cast.staff.length > 0) && (
        <TitleSection title="Cast & crew" icon={<Users className="h-4 w-4" />}>
          <CastSection characters={cast.characters.slice(0, 12)} staff={castStaff} />
        </TitleSection>
      )}

      <TitleSection title="Comments" icon={<Star className="h-4 w-4" />}>
        <CommentSection seriesId={series.id} comments={comments} currentUserId={user.id} />
      </TitleSection>
    </div>
  );
}
