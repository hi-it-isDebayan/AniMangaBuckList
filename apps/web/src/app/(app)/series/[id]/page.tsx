import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  ExternalLink,
  Users,
  Star,
  TrendingUp,
} from "lucide-react";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { mangabakaSeries, titleComments, users } from "@ambl/database";
import { getMangabakaSeries, toDiscoverItem } from "@/lib/mangabaka";
import type { MediaStatus, MediaType } from "@ambl/types";
import { mediaStatusBadge, mediaStatusLabel, mediaTypeLabel } from "@/lib/format";
import { MediaTypeBadge } from "@/components/status-badge";
import { CommentSection, type CommentItem } from "@/components/comment-section";
import { AddSeriesButton } from "@/components/add-series-button";
import { Badge } from "@/components/ui/badge";

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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-2 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
      <dt className="w-40 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
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

  const displayEnglish =
    series.englishTitle && series.englishTitle !== series.title ? series.englishTitle : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/discover"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Discover
      </Link>

      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="w-full max-w-[200px] shrink-0 self-center sm:self-start">
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl border bg-muted shadow-sm">
            {series.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={series.coverUrl}
                alt={series.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="cover-fallback flex h-full w-full items-center justify-center text-muted-foreground">
                <BookOpenText className="h-10 w-10" />
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{series.title}</h1>
            {displayEnglish && (
              <p className="text-sm text-muted-foreground">{displayEnglish}</p>
            )}
            {(series.nativeTitle || series.japaneseTitle) && (
              <p className="text-sm text-muted-foreground">
                {[series.nativeTitle, series.japaneseTitle].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {series.mediaType && <MediaTypeBadge type={series.mediaType} />}
            {series.status && (
              <Badge variant={mediaStatusBadge(series.status)}>
                {mediaStatusLabel(series.status)}
              </Badge>
            )}
            {series.year && <Badge variant="outline">{series.year}</Badge>}
            {series.contentRating && <Badge variant="secondary">{series.contentRating}</Badge>}
            {series.isLicensed && <Badge variant="outline">Licensed</Badge>}
            {series.hasAnime && <Badge variant="outline">Has anime</Badge>}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {series.rating != null && (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{(series.rating / 10).toFixed(2)}</span>
                <span className="text-muted-foreground">/ 10</span>
              </span>
            )}
            {series.popularity != null && (
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> {series.popularity.toLocaleString()}
              </span>
            )}
            {series.totalChapters != null && (
              <span className="inline-flex items-center gap-1">
                <BookOpenText className="h-4 w-4" /> {series.totalChapters} chapters
              </span>
            )}
            {series.finalVolume != null && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" /> {series.finalVolume} volumes
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <AddSeriesButton mangabakaId={series.id} mediaType={series.mediaType ?? "MANGA"} />
            {series.canonicalUrl && (
              <a
                href={series.canonicalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5" /> MangaBaka
              </a>
            )}
            {series.malId != null && (
              <a
                href={`https://myanimelist.net/manga/${series.malId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5" /> MyAnimeList
              </a>
            )}
          </div>
        </div>
      </div>

      {series.synopsis && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Synopsis</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {series.synopsis}
          </p>
        </section>
      )}

      {series.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {series.genres.map((g) => (
            <Badge key={g}>{g}</Badge>
          ))}
        </div>
      )}

      {series.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {series.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-lg font-semibold">Details</h2>
        <dl>
          <InfoRow
            label="Alternative titles"
            value={
              [series.englishTitle, series.nativeTitle, series.japaneseTitle]
                .filter((v): v is string => Boolean(v) && v !== series.title)
                .join(" · ") || null
            }
          />
          <InfoRow label="Type" value={series.mediaType ? mediaTypeLabel(series.mediaType) : null} />
          <InfoRow
            label="Status"
            value={series.status ? mediaStatusLabel(series.status) : null}
          />
          <InfoRow
            label="Published"
            value={
              series.startDate || series.endDate
                ? `${series.startDate ?? "?"} → ${series.endDate ?? "ongoing"}`
                : series.year
                  ? String(series.year)
                  : null
            }
          />
          <InfoRow label="Authors" value={series.authors.join(", ") || null} />
          <InfoRow label="Artists" value={series.artists.join(", ") || null} />
          <InfoRow
            label="Publishers"
            value={series.publishers.map((p) => p.name).filter(Boolean).join(", ") || null}
          />
          <InfoRow
            label="Score"
            value={series.rating != null ? `${(series.rating / 10).toFixed(2)} / 10` : null}
          />
          <InfoRow
            label="Popularity"
            value={series.popularity != null ? series.popularity.toLocaleString() : null}
          />
          <InfoRow label="Chapters" value={series.totalChapters} />
          <InfoRow label="Volumes" value={series.finalVolume} />
          <InfoRow
            label="MAL ID"
            value={
              series.malId != null ? (
                <a
                  className="text-primary hover:underline"
                  href={`https://myanimelist.net/manga/${series.malId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {series.malId}
                </a>
              ) : null
            }
          />
          <InfoRow
            label="AniList ID"
            value={
              series.anilistId != null ? (
                <a
                  className="text-primary hover:underline"
                  href={`https://anilist.co/manga/${series.anilistId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {series.anilistId}
                </a>
              ) : null
            }
          />
          <InfoRow
            label="Last updated"
            value={
              series.lastUpdatedAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {series.lastUpdatedAt.toLocaleDateString()}
                </span>
              ) : null
            }
          />
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">Comments</h2>
        <CommentSection seriesId={series.id} comments={comments} currentUserId={user.id} />
      </section>
    </div>
  );
}
