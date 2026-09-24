import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ExternalLink, Flame, History, Link2, Tags, NotebookPen } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatDate,
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
  const completed = unit === "EPISODE" ? progress?.lastCompletedEpisode : progress?.lastCompletedChapter;
  const total =
    unit === "EPISODE" ? title.episodeCount : title.chapterCount;
  const malUrl =
    title.malId != null
      ? `https://myanimelist.net/${title.mediaType === "ANIME" ? "anime" : "manga"}/${title.malId}`
      : null;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MediaTypeBadge type={title.mediaType} />
            {title.year && <Badge variant="secondary">{title.year}</Badge>}
            {title.status && <Badge variant="outline">{formatStatus(title.status)}</Badge>}
            {lib && <StatusBadge status={lib.status} />}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {title.primaryTitle}
          </h1>
          {title.englishTitle && title.englishTitle !== title.primaryTitle && (
            <p className="text-muted-foreground">{title.englishTitle}</p>
          )}
          {title.japaneseTitle && (
            <p className="text-sm text-muted-foreground">{title.japaneseTitle}</p>
          )}
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {title.episodeCount != null && (
              <div>
                <dt className="inline">Episodes:</dt> <dd className="inline">{title.episodeCount}</dd>
              </div>
            )}
            {title.chapterCount != null && (
              <div>
                <dt className="inline">Chapters:</dt> <dd className="inline">{title.chapterCount}</dd>
              </div>
            )}
            {title.volumeCount != null && (
              <div>
                <dt className="inline">Volumes:</dt> <dd className="inline">{title.volumeCount}</dd>
              </div>
            )}
            {title.score != null && (
              <div>
                <dt className="inline">MAL score:</dt> <dd className="inline">{title.score}</dd>
              </div>
            )}
            {title.startDate && (
              <div>
                <dt className="inline">Aired:</dt>{" "}
                <dd className="inline">
                  {formatDate(title.startDate)}
                  {title.endDate ? ` – ${formatDate(title.endDate)}` : ""}
                </dd>
              </div>
            )}
          </dl>
          {title.synopsis && (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {title.synopsis.slice(0, 400)}
              {title.synopsis.length > 400 ? "…" : ""}
            </p>
          )}
        </div>
      </header>

      {lib ? (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Progress</CardTitle>
              <div className="flex items-center gap-1">
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
                {malUrl && (
                  <a
                    href={malUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                    title="Open on MyAnimeList"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ProgressControl
                titleId={id}
                unit={unit}
                label={unit === "EPISODE" ? "Episode" : "Chapter"}
                opened={lib ? opened : null}
                completed={completed}
                total={total}
              />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusSelect titleId={id} status={lib.status} />
                <FavoriteButton titleId={id} favorite={lib.isFavorite} />
                <span className="ml-auto" />
                <RemoveTitleButton titleId={id} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <NotebookPen className="h-4 w-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NotesEditor titleId={id} initial={note?.content ?? ""} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <RatingControl titleId={id} initial={rating?.score ?? null} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-4 w-4" /> Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TagsManager
                  titleId={id}
                  tags={tagRows.map((t) => ({ id: t.id, name: t.name }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> External links
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExternalLinksManager
                  titleId={id}
                  links={linkRows.map((l) => ({
                    id: l.id,
                    provider: l.provider,
                    url: l.url,
                    linkType: l.linkType as LinkType,
                  }))}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Related titles</CardTitle>
              {title.malId != null && (
                <SyncRelationsButton titleId={id} />
              )}
            </CardHeader>
            <CardContent>
              {relatedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No relations linked yet. Sync them from MyAnimeList.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
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
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" /> Recent progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0">
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
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              This title isn&apos;t in your library yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}