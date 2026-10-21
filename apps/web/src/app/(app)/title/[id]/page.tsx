import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  BookOpenText,
  Building2,
  ExternalLink,
  Flame,
  History,
  Layers,
  Link2,
  NotebookPen,
  Star,
  Tags,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LinkType, ProgressUnit } from "@ambl/types";
import {
  titles,
  userLibrary,
  userProgress,
  ratings,
  notes,
  tags,
  userTags,
  titleRelations,
  externalLinks,
  progressHistory,
  titleExternalIds,
  mangabakaSeries,
} from "@ambl/database";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { TitleHero } from "@/components/title/title-hero";
import {
  Contributor,
  DetailItem,
  Stat,
  TitleSection,
} from "@/components/title/title-section";
import { StatusSelect } from "@/components/status-select";
import { FavoriteButton } from "@/components/favorite-button";
import { RemoveTitleButton } from "@/components/remove-title-button";
import { ProgressControl } from "@/components/progress-control";
import { RatingControl } from "@/components/rating-control";
import { NotesEditor } from "@/components/notes-editor";
import { TagsManager } from "@/components/tags-manager";
import { ExternalLinksManager } from "@/components/external-links-manager";
import { SyncRelationsButton } from "@/components/sync-relations-button";
import { AddToLibraryButton } from "@/components/add-to-library-button";
import { TitleActionBar } from "@/components/title-action-bar";
import { Sparkline } from "@/components/sparkline";
import { Badge } from "@/components/ui/badge";
import {
  formatDate,
  mediaStatusBadge,
  mediaStatusLabel,
  mediaTypeLabel,
  progressUnitForType,
  relationTypeLabel,
  relativeTime,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const db = getDb();
  const row = await db
    .select({ title: titles.primaryTitle })
    .from(titles)
    .where(eq(titles.id, id))
    .limit(1);
  return { title: row[0]?.title ?? "Title" };
}

export default async function TitlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const db = getDb();

  const [titleRow] = await db.select().from(titles).where(eq(titles.id, id)).limit(1);
  if (!titleRow) notFound();
  const title = titleRow;

  const [lib] = await db
    .select()
    .from(userLibrary)
    .where(and(eq(userLibrary.userId, user.id), eq(userLibrary.titleId, id)))
    .limit(1);

  const [progress] = await db
    .select()
    .from(userProgress)
    .where(and(eq(userProgress.userId, user.id), eq(userProgress.titleId, id)))
    .limit(1);

  const [rating] = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.userId, user.id), eq(ratings.titleId, id)))
    .limit(1);

  const [note] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, user.id), eq(notes.titleId, id)))
    .limit(1);

  const tagRows = await db
    .select({ id: tags.id, name: tags.name })
    .from(userTags)
    .innerJoin(tags, eq(userTags.tagId, tags.id))
    .where(and(eq(userTags.userId, user.id), eq(userTags.titleId, id)))
    .orderBy(asc(tags.name));

  const relatedRows = await db
    .select({
      id: titleRelations.id,
      relationType: titleRelations.relationType,
      toId: titleRelations.toTitleId,
      primaryTitle: titles.primaryTitle,
      mediaType: titles.mediaType,
    })
    .from(titleRelations)
    .innerJoin(titles, eq(titleRelations.toTitleId, titles.id))
    .where(eq(titleRelations.fromTitleId, id))
    .orderBy(asc(titleRelations.relationType));

  const linkRows = await db
    .select()
    .from(externalLinks)
    .where(eq(externalLinks.titleId, id))
    .orderBy(asc(externalLinks.linkType));

  const extIdRows = await db
    .select({ provider: titleExternalIds.provider, externalId: titleExternalIds.externalId })
    .from(titleExternalIds)
    .where(eq(titleExternalIds.titleId, id));

  const mangabakaIdRaw = extIdRows.find((r) => r.provider === "mangabaka")?.externalId ?? null;
  const mangabakaId =
    mangabakaIdRaw && /^\d+$/.test(mangabakaIdRaw) ? Number(mangabakaIdRaw) : null;
  // Prefer the MangaBaka series linked by id; fall back to matching the MAL id
  // so MAL-added manga still pick up MangaBaka chapters, credits and stats.
  let [mangaMeta] =
    mangabakaId != null
      ? await db.select().from(mangabakaSeries).where(eq(mangabakaSeries.id, mangabakaId)).limit(1)
      : [];
  if (!mangaMeta && title.mediaType !== "ANIME" && title.malId != null) {
    [mangaMeta] = await db
      .select()
      .from(mangabakaSeries)
      .where(
        and(eq(mangabakaSeries.malId, title.malId), eq(mangabakaSeries.mediaType, title.mediaType)),
      )
      .limit(1);
  }

  const anilistId = extIdRows.find((r) => r.provider === "anilist")?.externalId ?? null;
  const malId =
    extIdRows.find((r) => r.provider.startsWith("mal:"))?.externalId ??
    (title.malId != null ? String(title.malId) : null);
  const mediaPath = title.mediaType === "ANIME" ? "anime" : "manga";
  const malUrl = malId ? `https://myanimelist.net/${mediaPath}/${malId}` : null;
  const anilistUrl = anilistId ? `https://anilist.co/${mediaPath}/${anilistId}` : null;
  const mangabakaUrl =
    mangaMeta?.canonicalUrl ??
    (mangaMeta?.id != null
      ? `https://mangabaka.org/${mangaMeta.id}`
      : mangabakaId != null
        ? `https://mangabaka.org/${mangabakaId}`
        : null);

  const genres =
    title.genres && title.genres.length > 0 ? title.genres : (mangaMeta?.genres ?? []);
  const themes = mangaMeta?.tags ?? [];
  const authors = mangaMeta?.authors ?? [];
  const artists = mangaMeta?.artists ?? [];
  const publishers = (mangaMeta?.publishers ?? []).map((p) => p.name).filter(Boolean);
  const hasContributors = authors.length > 0 || artists.length > 0 || publishers.length > 0;

  // MangaBaka: `popularity` is a global rank (1 = most popular) and the
  // snapshot columns hold the same rank in the past â€” used for the trend curve.
  const chapters = mangaMeta?.totalChapters ?? title.chapterCount;
  const volumes = mangaMeta?.finalVolume ?? title.volumeCount;
  const mangabakaRating = mangaMeta?.rating != null ? Math.round(mangaMeta.rating) / 10 : null;
  const rank = mangaMeta?.popularity ?? null;
  const rank1mo = mangaMeta?.popularity1mo ?? null;
  const rankDelta = rank != null && rank1mo != null ? rank - rank1mo : null;
  const rankSeries = mangaMeta
    ? [
        mangaMeta.popularity1y,
        mangaMeta.popularity6mo,
        mangaMeta.popularity3mo,
        mangaMeta.popularity1mo,
        mangaMeta.popularity1w,
        mangaMeta.popularity1d,
        mangaMeta.popularity,
      ].filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : [];

  const history = lib
    ? await db
        .select()
        .from(progressHistory)
        .where(
          and(
            eq(progressHistory.userId, user.id),
            eq(progressHistory.titleId, id),
          ),
        )
        .orderBy(desc(progressHistory.createdAt))
        .limit(12)
    : [];

  const unit: ProgressUnit = progressUnitForType(title.mediaType);
  const opened = unit === "EPISODE" ? progress?.lastOpenedEpisode : progress?.lastOpenedChapter;
  const completed =
    unit === "EPISODE" ? progress?.lastCompletedEpisode : progress?.lastCompletedChapter;
  const total = unit === "EPISODE" ? title.episodeCount : title.chapterCount;
  const score =
    title.score != null
      ? title.score
      : mangaMeta?.rating != null
        ? Math.round(mangaMeta.rating) / 10
        : null;

  const providerLinks = [
    malUrl ? { href: malUrl, label: "MyAnimeList" } : null,
    anilistUrl ? { href: anilistUrl, label: "AniList" } : null,
    mangabakaUrl ? { href: mangabakaUrl, label: "MangaBaka" } : null,
  ].filter((link): link is { href: string; label: string } => link != null);

  return (
    <div className="space-y-5 pb-28 sm:pb-32">
      <TitleHero
        data={{
          title: title.primaryTitle,
          englishTitle: title.englishTitle,
          japaneseTitle: title.japaneseTitle,
          coverUrl: title.coverUrl,
          mediaType: title.mediaType,
          status: title.status,
          year: title.year,
          startDate: title.startDate,
          endDate: title.endDate,
          score,
          rank,
          chapters,
          volumes,
          episodes: title.episodeCount,
          genres,
          links: providerLinks,
          libraryStatus: lib ? <StatusBadge status={lib.status} /> : null,
        }}
      />

      <TitleActionBar>
        {lib ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusSelect titleId={id} status={lib.status} />
            <FavoriteButton titleId={id} favorite={lib.isFavorite} />
            <span className="ml-auto" />
            {progress?.lastSourceUrl && (
              <a
                href={progress.lastSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Flame className="h-4 w-4" /> Continue
              </a>
            )}
            <RemoveTitleButton titleId={id} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <AddToLibraryButton titleId={id} />
            <p className="text-xs text-muted-foreground">Not in your library yet.</p>
          </div>
        )}
      </TitleActionBar>

      {lib && (
        <TitleSection title="Progress" icon={<Flame className="h-4 w-4" />}>
          <ProgressControl
            titleId={id}
            unit={unit}
            label={unit === "EPISODE" ? "Episode" : "Chapter"}
            opened={opened ?? null}
            completed={completed ?? null}
            total={total ?? null}
          />
        </TitleSection>
      )}

      <TitleSection title="Overview" icon={<BookOpenText className="h-4 w-4" />}>
        {title.synopsis ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{title.synopsis}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No synopsis available.</p>
        )}
        {themes.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Themes</p>
            <div className="flex flex-wrap gap-1.5">
              {themes.slice(0, 16).map((theme) => (
                <span
                  key={theme}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}
      </TitleSection>

      {mangaMeta && (rank != null || mangabakaRating != null) && (
        <TitleSection title="Statistics" icon={<TrendingUp className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {rank != null && (
              <Stat label="Global rank" value={`#${rank.toLocaleString()}`} trend={rankDelta} />
            )}
            {mangabakaRating != null && (
              <Stat label="MangaBaka score" value={mangabakaRating.toFixed(1)} hint="/ 10" />
            )}
            {chapters != null && <Stat label="Chapters" value={String(chapters)} />}
            {volumes != null && <Stat label="Volumes" value={String(volumes)} />}
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
            </div>
          )}
        </TitleSection>
      )}

      <TitleSection title="Details" icon={<Layers className="h-4 w-4" />}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <DetailItem label="Type">{mediaTypeLabel(title.mediaType)}</DetailItem>
          {title.status != null && (
            <DetailItem label="Status">{mediaStatusLabel(title.status)}</DetailItem>
          )}
          {title.year != null && <DetailItem label="Year">{title.year}</DetailItem>}
          {title.episodeCount != null && (
            <DetailItem label="Episodes">{title.episodeCount}</DetailItem>
          )}
          {chapters != null && <DetailItem label="Chapters">{chapters}</DetailItem>}
          {volumes != null && <DetailItem label="Volumes">{volumes}</DetailItem>}
          {(title.startDate || title.endDate) && (
            <DetailItem label="Published">
              {formatDate(title.startDate)}
              {title.endDate ? ` â€“ ${formatDate(title.endDate)}` : ""}
            </DetailItem>
          )}
          {title.score != null && (
            <DetailItem label="MAL score">{title.score.toFixed(1)}</DetailItem>
          )}
          {mangaMeta?.contentRating && (
            <DetailItem label="Content rating">{mangaMeta.contentRating}</DetailItem>
          )}
          {mangaMeta?.isLicensed && <DetailItem label="Licensed">Yes</DetailItem>}
          {mangaMeta?.hasAnime && <DetailItem label="Anime adaptation">Yes</DetailItem>}
        </dl>
      </TitleSection>

      {hasContributors && (
        <TitleSection title="Credits" icon={<Users className="h-4 w-4" />}>
          <div className="grid gap-4 sm:grid-cols-3">
            {authors.length > 0 && <Contributor label="Authors" values={authors} />}
            {artists.length > 0 && <Contributor label="Artists" values={artists} />}
            {publishers.length > 0 && (
              <Contributor
                label="Publishers"
                values={publishers}
                icon={<Building2 className="h-3.5 w-3.5" />}
              />
            )}
          </div>
        </TitleSection>
      )}

      {(relatedRows.length > 0 || title.malId != null) && (
        <TitleSection
          title="Related"
          icon={<Link2 className="h-4 w-4" />}
          action={title.malId != null ? <SyncRelationsButton titleId={id} /> : undefined}
        >
          {relatedRows.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {relatedRows.map((rel) => (
                <li key={rel.id}>
                  <Link href={`/title/${rel.toId}`}>
                    <Badge variant="outline" className="gap-1.5 py-1.5 hover:border-primary/50">
                      <span className="text-muted-foreground">
                        {relationTypeLabel(rel.relationType)}
                      </span>
                      {rel.primaryTitle}
                      <span className="text-muted-foreground">
                        ({mediaTypeLabel(rel.mediaType)})
                      </span>
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No related titles found yet.</p>
          )}
        </TitleSection>
      )}

      {lib && (
        <TitleSection title="External links" icon={<ExternalLink className="h-4 w-4" />}>
          <ExternalLinksManager
            titleId={id}
            links={linkRows.map((l) => ({
              id: l.id,
              provider: l.provider,
              url: l.url,
              linkType: l.linkType as LinkType,
            }))}
          />
        </TitleSection>
      )}

      {lib && (
        <div className="grid gap-5 lg:grid-cols-2">
          <TitleSection title="Notes" icon={<NotebookPen className="h-4 w-4" />}>
            <NotesEditor titleId={id} initial={note?.content ?? ""} />
          </TitleSection>
          <TitleSection title="Your rating" icon={<Star className="h-4 w-4" />}>
            <RatingControl titleId={id} initial={rating?.score ?? null} />
          </TitleSection>
          <TitleSection title="Your tags" icon={<Tags className="h-4 w-4" />}>
            <TagsManager titleId={id} tags={tagRows.map((t) => ({ id: t.id, name: t.name }))} />
          </TitleSection>
          {history.length > 0 && (
            <TitleSection title="Recent progress" icon={<History className="h-4 w-4" />}>
              <ul className="space-y-1.5 text-sm">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0"
                  >
                    <span>
                      Marked {h.kind === "COMPLETED" ? "completed" : "opened"}{" "}
                      {h.unit.toLowerCase()} {h.value}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(h.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </TitleSection>
          )}
        </div>
      )}
    </div>
  );
}
