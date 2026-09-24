"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
  LibraryStatus,
  MediaType,
  ProgressKind,
  ProgressUnit,
} from "@ambl/types";
import {
  titles,
  titleAliases,
  titleRelations,
  userLibrary,
  userProgress,
  progressHistory,
  ratings as ratingsTable,
  notes as notesTable,
  tags,
  userTags,
  externalLinks,
} from "@ambl/database";
import { getMetadataProvider } from "@ambl/providers";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { defaultStatusForType } from "@/lib/format";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

const statusSchema = z.enum([
  "CURRENTLY_WATCHING",
  "CURRENTLY_READING",
  "PLAN_TO_WATCH",
  "PLAN_TO_READ",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
]);

const mediaTypeSchema = z.enum([
  "ANIME",
  "MANGA",
  "MANHWA",
  "MANHUA",
  "LIGHT_NOVEL",
  "WEB_NOVEL",
]);

function now() {
  return new Date();
}

export async function addTitleAction(input: {
  malId: number;
  mediaType: MediaType;
  status?: LibraryStatus;
}): Promise<ActionResult<{ titleId: string }>> {
  const user = await requireUser();
  const malId = z.number().int().positive().safeParse(input.malId);
  const mediaType = mediaTypeSchema.safeParse(input.mediaType);
  if (!malId.success || !mediaType.success) {
    return { ok: false, error: "Invalid title data." };
  }
  const provider = getMetadataProvider();
  const item = await provider.getById(malId.data, mediaType.data);
  if (!item) {
    return { ok: false, error: "Could not fetch metadata for this title." };
  }
  if (!item.malId) {
    return { ok: false, error: "Title has no provider id." };
  }

  const source = provider.name.toUpperCase();
  const db = getDb();

  let titleId: string | undefined;
  try {
    const existing = await db
      .select({ id: titles.id })
      .from(titles)
      .where(and(eq(titles.source, source), eq(titles.malId, item.malId)))
      .limit(1);
    titleId = existing[0]?.id;
    if (!titleId) {
      const inserted = await db
        .insert(titles)
        .values({
          source,
          malId: item.malId,
          primaryTitle: item.title,
          englishTitle: item.englishTitle,
          japaneseTitle: item.japaneseTitle,
          mediaType: item.mediaType,
          synopsis: item.synopsis,
          status: item.status,
          startDate: item.startDate,
          endDate: item.endDate,
          season: item.season,
          year: item.year,
          episodeCount: item.episodeCount,
          chapterCount: item.chapterCount,
          volumeCount: item.volumeCount,
          coverUrl: item.coverUrl,
          score: item.score,
          genres: item.genres,
          metadataRefreshedAt: now(),
        })
        .returning({ id: titles.id });
      titleId = inserted[0]!.id;

      const aliases = [item.englishTitle, item.japaneseTitle, ...item.synonyms]
        .filter((a): a is string => Boolean(a) && a !== item.title)
        .filter((a, i, arr) => arr.indexOf(a) === i)
        .slice(0, 20);
      if (aliases.length > 0) {
        await db
          .insert(titleAliases)
          .values(aliases.map((alias) => ({ titleId: titleId!, alias })));
      }
    }

    const status = input.status ?? defaultStatusForType(item.mediaType);
    await db
      .insert(userLibrary)
      .values({ userId: user.id, titleId, status, isFavorite: false })
      .onConflictDoUpdate({
        target: [userLibrary.userId, userLibrary.titleId],
        set: { status, updatedAt: now() },
      });

    await db
      .insert(userProgress)
      .values({ userId: user.id, titleId })
      .onConflictDoNothing({ target: [userProgress.userId, userProgress.titleId] });

    revalidatePath("/");
    revalidatePath("/library");
    return { ok: true, data: { titleId } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateStatusAction(input: {
  titleId: string;
  status: LibraryStatus;
}): Promise<ActionResult> {
  const user = await requireUser();
  const status = statusSchema.safeParse(input.status);
  if (!status.success) return { ok: false, error: "Invalid status." };
  await getDb()
    .update(userLibrary)
    .set({ status: status.data, updatedAt: now() })
    .where(
      and(eq(userLibrary.userId, user.id), eq(userLibrary.titleId, input.titleId)),
    );
  revalidatePath("/library");
  revalidatePath(`/title/${input.titleId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function setFavoriteAction(input: {
  titleId: string;
  favorite: boolean;
}): Promise<ActionResult> {
  const user = await requireUser();
  await getDb()
    .update(userLibrary)
    .set({ isFavorite: input.favorite, updatedAt: now() })
    .where(
      and(eq(userLibrary.userId, user.id), eq(userLibrary.titleId, input.titleId)),
    );
  revalidatePath("/library");
  revalidatePath(`/title/${input.titleId}`);
  return { ok: true };
}

export async function removeFromLibraryAction(input: {
  titleId: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  await getDb()
    .delete(userLibrary)
    .where(
      and(eq(userLibrary.userId, user.id), eq(userLibrary.titleId, input.titleId)),
    );
  revalidatePath("/library");
  revalidatePath(`/title/${input.titleId}`);
  return { ok: true };
}

type ProgressPatch = {
  lastOpenedChapter?: number;
  lastCompletedChapter?: number;
  lastOpenedEpisode?: number;
  lastCompletedEpisode?: number;
};

export async function updateProgressAction(input: {
  titleId: string;
  unit: ProgressUnit;
  kind: ProgressKind;
  value: number;
  sourceUrl?: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const value = z.number().int().min(0).safeParse(input.value);
  const unit = z.enum(["CHAPTER", "EPISODE"]).safeParse(input.unit);
  const kind = z.enum(["OPENED", "COMPLETED"]).safeParse(input.kind);
  if (!value.success) return { ok: false, error: "Progress must be a non-negative number." };
  if (!unit.success || !kind.success) return { ok: false, error: "Invalid progress unit/kind." };

  const patch: ProgressPatch =
    unit.data === "EPISODE"
      ? kind.data === "OPENED"
        ? { lastOpenedEpisode: value.data }
        : { lastCompletedEpisode: value.data }
      : kind.data === "OPENED"
        ? { lastOpenedChapter: value.data }
        : { lastCompletedChapter: value.data };

  const db = getDb();
  await db
    .insert(userProgress)
    .values({
      userId: user.id,
      titleId: input.titleId,
      ...patch,
      updatedBy: "MANUAL",
    })
    .onConflictDoUpdate({
      target: [userProgress.userId, userProgress.titleId],
      set: { ...patch, updatedBy: "MANUAL", updatedAt: now() },
    });

  await db.insert(progressHistory).values({
    userId: user.id,
    titleId: input.titleId,
    unit: unit.data,
    kind: kind.data,
    value: value.data,
    source: "manual",
    sourceUrl: input.sourceUrl,
  });

  revalidatePath(`/title/${input.titleId}`);
  revalidatePath("/library");
  revalidatePath("/");
  return { ok: true };
}

export async function saveNotesAction(input: {
  titleId: string;
  content: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const content = z.string().max(10000).safeParse(input.content.trim());
  if (!content.success) return { ok: false, error: "Note is too long." };
  await getDb()
    .insert(notesTable)
    .values({ userId: user.id, titleId: input.titleId, content: content.data })
    .onConflictDoUpdate({
      target: [notesTable.userId, notesTable.titleId],
      set: { content: content.data, updatedAt: now() },
    });
  revalidatePath(`/title/${input.titleId}`);
  return { ok: true };
}

export async function rateTitleAction(input: {
  titleId: string;
  score: number;
}): Promise<ActionResult> {
  const user = await requireUser();
  const score = z.number().int().min(1).max(10).safeParse(input.score);
  if (!score.success) return { ok: false, error: "Rating must be between 1 and 10." };
  await getDb()
    .insert(ratingsTable)
    .values({ userId: user.id, titleId: input.titleId, score: score.data })
    .onConflictDoUpdate({
      target: [ratingsTable.userId, ratingsTable.titleId],
      set: { score: score.data, updatedAt: now() },
    });
  revalidatePath(`/title/${input.titleId}`);
  return { ok: true };
}

export async function addTagAction(input: {
  titleId: string;
  name: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const db = getDb();
  const name = z.string().trim().min(1).max(40).safeParse(input.name);
  if (!name.success) return { ok: false, error: "Invalid tag name." };

  let tagId: string | undefined;
  const existingTag = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, user.id), eq(tags.name, name.data)))
    .limit(1);
  tagId = existingTag[0]?.id;

  if (!tagId) {
    const inserted = await db
      .insert(tags)
      .values({ userId: user.id, name: name.data })
      .returning({ id: tags.id });
    tagId = inserted[0]!.id;
  }

  await db
    .insert(userTags)
    .values({ userId: user.id, titleId: input.titleId, tagId })
    .onConflictDoNothing({
      target: [userTags.userId, userTags.titleId, userTags.tagId],
    });
  revalidatePath(`/title/${input.titleId}`);
  return { ok: true };
}

export async function removeTagAction(input: {
  titleId: string;
  tagId: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  await getDb()
    .delete(userTags)
    .where(
      and(
        eq(userTags.userId, user.id),
        eq(userTags.titleId, input.titleId),
        eq(userTags.tagId, input.tagId),
      ),
    );
  revalidatePath(`/title/${input.titleId}`);
  return { ok: true };
}

export async function syncRelationsAction(input: {
  titleId: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const db = getDb();
  const row = await db
    .select()
    .from(titles)
    .where(eq(titles.id, input.titleId))
    .limit(1);
  const title = row[0];
  if (!title || !title.malId) {
    return { ok: false, error: "Title has no provider id to sync from." };
  }

  const provider = getMetadataProvider();
  const relations = await provider.getRelations(title.malId, title.mediaType);
  const malIds = relations.map((r) => r.malId).filter((m): m is number => m !== null);
  const known = malIds.length
    ? await db
        .select({ malId: titles.malId, id: titles.id })
        .from(titles)
        .where(
          and(
            inArray(titles.malId, malIds),
            eq(titles.source, provider.name.toUpperCase()),
          ),
        )
    : [];
  const byMal = new Map(known.map((k) => [k.malId, k.id]));

  for (const rel of relations) {
    if (!rel.malId || !rel.mediaType) continue;
    const targetId = byMal.get(rel.malId);
    if (!targetId) continue;
    await db
      .insert(titleRelations)
      .values({
        fromTitleId: title.id,
        toTitleId: targetId,
        relationType: rel.relationType,
      })
      .onConflictDoNothing({
        target: [titleRelations.fromTitleId, titleRelations.toTitleId, titleRelations.relationType],
      });
    if (title.source === provider.name.toUpperCase() && title.malId) {
      await db
        .insert(titleRelations)
        .values({ fromTitleId: targetId, toTitleId: title.id, relationType: rel.relationType })
        .onConflictDoNothing({
          target: [titleRelations.fromTitleId, titleRelations.toTitleId, titleRelations.relationType],
        });
    }
  }
  revalidatePath(`/title/${input.titleId}`);
  return { ok: true };
}

export async function saveExternalLinkAction(input: {
  titleId: string;
  provider: string;
  url: string;
  linkType: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const url = z.string().url().safeParse(input.url);
  const provider = z.string().trim().min(1).max(40).safeParse(input.provider);
  const linkType = z
    .enum(["MAL", "OFFICIAL", "READ", "STREAM", "USER_SAVED"])
    .safeParse(input.linkType);
  if (!url.success || !provider.success || !linkType.success) {
    return { ok: false, error: "Invalid link." };
  }
  await getDb()
    .insert(externalLinks)
    .values({
      titleId: input.titleId,
      provider: provider.data,
      url: url.data,
      linkType: linkType.data,
      lastVerifiedAt: now(),
    })
    .onConflictDoUpdate({
      target: [externalLinks.titleId, externalLinks.provider, externalLinks.linkType],
      set: { url: url.data, lastVerifiedAt: now() },
    });
  revalidatePath(`/title/${input.titleId}`);
  return { ok: true };
}

export async function removeExternalLinkAction(input: { linkId: string; titleId: string }): Promise<ActionResult> {
  const user = await requireUser();
  const db = getDb();
  const [link, owned] = await Promise.all([
    db.select({ id: externalLinks.id }).from(externalLinks).where(eq(externalLinks.id, input.linkId)).limit(1),
    db
      .select({ id: userLibrary.id })
      .from(userLibrary)
      .where(
        and(eq(userLibrary.userId, user.id), eq(userLibrary.titleId, input.titleId)),
      )
      .limit(1),
  ]);
  if (!link[0] || !owned[0]) return { ok: false, error: "Not found." };
  await db.delete(externalLinks).where(eq(externalLinks.id, input.linkId));
  revalidatePath(`/title/${input.titleId}`);
  return { ok: true };
}