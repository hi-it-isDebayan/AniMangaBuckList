import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { closeDb, titles, titleExternalIds } from "@ambl/database";
import { getDb } from "./db";
import { ensureMangabakaTitle } from "./mangabaka-library";
import type { DiscoverItem } from "./mangabaka";

/**
 * Integration test for the MangaBaka "add title" persistence path.
 *
 * It runs against an ISOLATED test database supplied via `TEST_DATABASE_URL`
 * (e.g. a throwaway Neon branch). We never fall back to `DATABASE_URL`, so the
 * suite can never write to production data. When `TEST_DATABASE_URL` is not
 * set the database-backed cases are skipped and only the pure checks run.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const hasTestDb = Boolean(testDatabaseUrl);

if (testDatabaseUrl) {
  // `getDb()` connects lazily on first use, so redirecting the env var here
  // (before any test executes) points the app's DB access at the test branch.
  process.env.DATABASE_URL = testDatabaseUrl;
}

// Close the pool so the test process can exit cleanly. No-op when skipped.
after(async () => {
  await closeDb();
});

let counter = 0;
/** A positive integer that is very unlikely to exist in the test database. */
function uniqueInt(): number {
  counter += 1;
  return 9_000_000 + Math.floor(Math.random() * 900_000) + counter;
}

function sampleItem(
  overrides: Pick<DiscoverItem, "id" | "title"> & Partial<DiscoverItem>,
): DiscoverItem {
  return {
    nativeTitle: null,
    englishTitle: null,
    japaneseTitle: null,
    mediaType: "MANGA",
    status: null,
    year: null,
    startDate: null,
    endDate: null,
    coverUrl: null,
    score: null,
    chapterCount: null,
    volumeCount: null,
    malId: null,
    anilistId: null,
    canonicalUrl: null,
    synopsis: null,
    popularity: null,
    ...overrides,
  };
}

test("inserts a genuinely new manga with source MANGABAKA", { skip: !hasTestDb }, async () => {
  const mgId = uniqueInt();
  const item = sampleItem({
    id: mgId,
    title: `ZZZ Integration Manga ${mgId}`,
    englishTitle: `ZZZ Integration Manga ${mgId}`,
    mediaType: "MANGA",
    chapterCount: 87,
    volumeCount: 17,
    malId: uniqueInt(),
    score: 8.6,
  });

  let titleId: string | undefined;
  try {
    const first = await ensureMangabakaTitle(item);
    titleId = first.titleId;
    assert.equal(first.created, true, "a brand new title should be created");
    assert.equal(first.mediaType, "MANGA");

    const [row] = await getDb()
      .select()
      .from(titles)
      .where(eq(titles.id, titleId))
      .limit(1);
    assert.ok(row, "the inserted title row should exist");
    assert.equal(row.source, "MANGABAKA", "persisted source must be MANGABAKA");
    assert.equal(row.primaryTitle, item.title);
    assert.equal(row.malId, item.malId);
    assert.equal(row.mediaType, "MANGA");
    assert.equal(row.chapterCount, 87);
    assert.equal(row.volumeCount, 17);
    assert.equal(row.score, 8.6);

    const links = await getDb()
      .select()
      .from(titleExternalIds)
      .where(eq(titleExternalIds.titleId, titleId));
    assert.ok(
      links.some(
        (l) => l.provider === "mangabaka" && l.externalId === String(mgId),
      ),
      "the MangaBaka external id should be linked to the new title",
    );

    // Adding the same MangaBaka series again is idempotent.
    const second = await ensureMangabakaTitle(item);
    assert.equal(second.created, false, "a repeat add must not create a duplicate");
    assert.equal(second.titleId, titleId);
  } finally {
    if (titleId) await getDb().delete(titles).where(eq(titles.id, titleId));
  }
});

test("reuses an existing MAL-sourced row and preserves its source", { skip: !hasTestDb }, async () => {
  const malId = uniqueInt();
  const mgId = uniqueInt();
  const title = `ZZZ MAL Seed ${malId}`;

  const seeded = await getDb()
    .insert(titles)
    .values({ source: "JIKAN", malId, primaryTitle: title, mediaType: "MANGA" })
    .returning({ id: titles.id });
  const seededId = seeded[0]!.id;

  try {
    const result = await ensureMangabakaTitle(
      sampleItem({ id: mgId, title, malId, mediaType: "MANGA" }),
    );
    assert.equal(result.created, false, "an existing MAL row should be reused");
    assert.equal(result.titleId, seededId);

    const [row] = await getDb()
      .select()
      .from(titles)
      .where(eq(titles.id, seededId))
      .limit(1);
    assert.equal(row?.source, "JIKAN", "the existing source must be preserved");
  } finally {
    await getDb().delete(titles).where(eq(titles.id, seededId));
  }
});
