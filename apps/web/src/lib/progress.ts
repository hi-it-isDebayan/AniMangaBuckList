import { sql } from "drizzle-orm";
import { progressHistory, userProgress } from "@ambl/database";
import type { getDb } from "@/lib/db";

export type RecordProgressInput = {
  userId: string;
  titleId: string;
  unit: "EPISODE" | "CHAPTER";
  value: number;
  kind: "OPENED" | "COMPLETED";
  source?: string | null;
  sourceUrl?: string | null;
};

export async function recordProgress(
  db: ReturnType<typeof getDb>,
  input: RecordProgressInput,
) {
  const { userId, titleId, unit, value, kind } = input;
  const source = input.source ?? null;
  const sourceUrl = input.sourceUrl ?? null;

  let insertPatch: Partial<typeof userProgress.$inferInsert> = {};
  let updatePatch: Record<string, ReturnType<typeof sql>> = {};
  if (unit === "EPISODE") {
    if (kind === "OPENED") {
      insertPatch = { lastOpenedEpisode: value };
      updatePatch = {
        lastOpenedEpisode: sql`GREATEST(${userProgress.lastOpenedEpisode}, ${value})`,
      };
    } else {
      insertPatch = { lastCompletedEpisode: value };
      updatePatch = {
        lastCompletedEpisode: sql`GREATEST(${userProgress.lastCompletedEpisode}, ${value})`,
      };
    }
  } else if (kind === "OPENED") {
    insertPatch = { lastOpenedChapter: value };
    updatePatch = {
      lastOpenedChapter: sql`GREATEST(${userProgress.lastOpenedChapter}, ${value})`,
    };
  } else {
    insertPatch = { lastCompletedChapter: value };
    updatePatch = {
      lastCompletedChapter: sql`GREATEST(${userProgress.lastCompletedChapter}, ${value})`,
    };
  }

  await db
    .insert(userProgress)
    .values({
      userId,
      titleId,
      ...insertPatch,
      updatedBy: "EXTENSION",
      ...(source ? { lastSource: source } : {}),
      ...(sourceUrl ? { lastSourceUrl: sourceUrl } : {}),
    })
    .onConflictDoUpdate({
      target: [userProgress.userId, userProgress.titleId],
      set: {
        ...updatePatch,
        updatedBy: "EXTENSION",
        updatedAt: new Date(),
        ...(source ? { lastSource: source } : {}),
        ...(sourceUrl ? { lastSourceUrl: sourceUrl } : {}),
      },
    });

  await db.insert(progressHistory).values({
    userId,
    titleId,
    unit,
    kind,
    value,
    source,
    sourceUrl,
  });
}