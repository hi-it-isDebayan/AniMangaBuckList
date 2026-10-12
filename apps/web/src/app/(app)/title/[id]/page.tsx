import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  BookOpenText,
  Building2,
  CalendarDays,
  ExternalLink,
  Flame,
  History,
  Layers,
  Link2,
  NotebookPen,
  Star,
  Tags,
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
import { MediaTypeBadge, StatusBadge } from "@/components/status-badge";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [mangaMeta] =
    mangabakaId != null
      ? await db.select().from(mangabakaSeries).where(eq(mangabakaSeries.id, mangabakaId)).limit(1)
      : [];

  const anilistId = extIdRows.find((r) => r.provider === "anilist")?.externalId ?? null;
  const malId =
    extIdRows.find((r) => r.provider.startsWith("mal:"))?.externalId ??
    (title.malId != null ? String(title.malId) : null);
  const mediaPath = title.mediaType === "ANIME" ? "anime" : "manga";
  const malUrl = malId ? `https://myanimelist.net/${mediaPath}/${malId}` : null;
  const anilistUrl = anilistId ? `https://anilist.co/${mediaPath}/${anilistId}` : null;
  const mangabakaUrl =
    mangaMeta?.canonicalUrl ?? (mangabakaId != null ? `https://mangabaka.org/${mangabakaId}` : null);

  const genres = title.genres ?? [];
  const themes = mangaMeta?.tags ?? [];
  const authors = mangaMeta?.authors ?? [];
  const artists = mangaMeta?.artists ?? [];
  const publishers = (mangaMeta?.publishers ?? []).map((p) => p.name).filter(Boolean);
  const hasContributors = authors.length > 0 || artists.length > 0 || publishers.length > 0;

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

  return (
    <div className="space-y-5 pb-28 sm:pb-32">
      <header className="relative overflow-hidden rounded-2xl border bg-card/60 shadow-sm">
        {title.coverUrl && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 scale-110 opacity-25 blur-3xl"
            style={{
              backgroundImage: `url(${title.coverUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
        <div className="relative flex flex-col gap-5 p-4 sm:flex-row sm:gap-6 sm:p-6">
          <div className="shrink-0 self-center sm:self-start">
            {title.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={title.coverUrl}
                alt={title.primaryTitle}
                loading="eager"
                referrerPolicy="no-referrer"
                className="h-56 w-40 rounded-xl border shadow-lg transition-transform duration-300 hover:scale-[1.02] sm:h-72 sm:w-52"
              />
            ) : (
              <span className="cover-fallback flex h-56 w-40 items-center justify-center rounded-xl border text-muted-foreground sm:h-72 sm:w-52">
                <BookOpenText className="h-10 w-10" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <MediaTypeBadge type={title.mediaType} />
              {title.year != null && <Badge variant="secondary">{title.year}</Badge>}
              {title.status != null && (
                <Badge variant={mediaStatusBadge(title.status)}>
                  {mediaStatusLabel(title.status)}
                </Badge>
              )}
              {lib && <StatusBadge status={lib.status} />}
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gradient sm:text-3xl">
              {title.primaryTitle}
            </h1>
            {title.englishTitle && title.englishTitle !== title.primaryTitle && (
              <p className="text-muted-foreground">{title.englishTitle}</p>
            )}
            {title.japaneseTitle && (
              <p className="text-sm text-muted-foreground">{title.japaneseTitle}</p>
            )}

            {score != null && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {score.toFixed(1)}
                  <span className="font-normal text-muted-foreground">/ 10</span>
                </span>
                {title.startDate && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(title.startDate)}
                    {title.endDate ? ` – ${formatDate(title.endDate)}` : ""}
                  </span>
                )}
              </div>
            )}

            {genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genres.slice(0, 8).map((genre) => (
                  <Badge key={genre} variant="outline">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {(malUrl || anilistUrl || mangabakaUrl) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {malUrl && <ProviderLink href={malUrl} label="MyAnimeList" />}
                {anilistUrl && <ProviderLink href={anilistUrl} label="AniList" />}
                {mangabakaUrl && <ProviderLink href={mangabakaUrl} label="MangaBaka" />}
              </div>
            )}
          </div>
        </div>
      </header>

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
        <Section title="Progress" icon={<Flame className="h-4 w-4" />}>
          <ProgressControl
            titleId={id}
            unit={unit}
            label={unit === "EPISODE" ? "Episode" : "Chapter"}
            opened={opened ?? null}
            completed={completed ?? null}
            total={total ?? null}
          />
        </Section>
      )}

      <Section title="Overview" icon={<BookOpenText className="h-4 w-4" />}>
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
      </Section>

      <Section title="Details" icon={<Layers className="h-4 w-4" />}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <DetailItem label="Type">{mediaTypeLabel(title.mediaType)}</DetailItem>
          {title.status != null && (
            <DetailItem label="Status">{mediaStatusLabel(title.status)}</DetailItem>
          )}
          {title.year != null && <DetailItem label="Year">{title.year}</DetailItem>}
          {title.episodeCount != null && (
            <DetailItem label="Episodes">{title.episodeCount}</DetailItem>
          )}
          {title.chapterCount != null && (
            <DetailItem label="Chapters">{title.chapterCount}</DetailItem>
          )}
          {title.volumeCount != null && (
            <DetailItem label="Volumes">{title.volumeCount}</DetailItem>
          )}
          {(title.startDate || title.endDate) && (
            <DetailItem label="Published">
              {formatDate(title.startDate)}
              {title.endDate ? ` – ${formatDate(title.endDate)}` : ""}
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
      </Section>

      {hasContributors && (
        <Section title="Credits" icon={<Users className="h-4 w-4" />}>
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
        </Section>
      )}

      {(relatedRows.length > 0 || title.malId != null) && (
        <Section
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
        </Section>
      )}

      {lib && (
        <Section title="External links" icon={<ExternalLink className="h-4 w-4" />}>
          <ExternalLinksManager
            titleId={id}
            links={linkRows.map((l) => ({
              id: l.id,
              provider: l.provider,
              url: l.url,
              linkType: l.linkType as LinkType,
            }))}
          />
        </Section>
      )}

      {lib && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Notes" icon={<NotebookPen className="h-4 w-4" />}>
            <NotesEditor titleId={id} initial={note?.content ?? ""} />
          </Section>
          <Section title="Your rating" icon={<Star className="h-4 w-4" />}>
            <RatingControl titleId={id} initial={rating?.score ?? null} />
          </Section>
          <Section title="Your tags" icon={<Tags className="h-4 w-4" />}>
            <TagsManager titleId={id} tags={tagRows.map((t) => ({ id: t.id, name: t.name }))} />
          </Section>
          {history.length > 0 && (
            <Section title="Recent progress" icon={<History className="h-4 w-4" />}>
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
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <ExternalLink className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm">{children}</dd>
    </div>
  );
}

function Contributor({
  label,
  values,
  icon,
}: {
  label: string;
  values: string[];
  icon?: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
