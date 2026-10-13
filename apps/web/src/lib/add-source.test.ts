import assert from "node:assert/strict";
import { test } from "node:test";
import { selectAddSource } from "./add-source";

test("manga-family titles prefer MangaBaka", () => {
  for (const mediaType of [
    "MANGA",
    "MANHWA",
    "MANHUA",
    "LIGHT_NOVEL",
    "WEB_NOVEL",
  ] as const) {
    assert.equal(
      selectAddSource({ mediaType, mangabakaId: 42, malId: 7 }),
      "mangabaka",
      `${mediaType} should be sourced from MangaBaka`,
    );
  }
});

test("anime is always sourced from MAL even when MangaBaka has it", () => {
  assert.equal(
    selectAddSource({ mediaType: "ANIME", mangabakaId: 42, malId: 7 }),
    "mal",
  );
});

test("manga falls back to MAL when no MangaBaka id is known", () => {
  assert.equal(
    selectAddSource({ mediaType: "MANGA", mangabakaId: null, malId: 7 }),
    "mal",
  );
  assert.equal(selectAddSource({ mediaType: "MANGA", malId: 7 }), "mal");
});

test("MangaBaka is used as a last resort when only it knows the title", () => {
  assert.equal(
    selectAddSource({ mediaType: "MANGA", mangabakaId: 42, malId: null }),
    "mangabaka",
  );
  assert.equal(
    selectAddSource({ mediaType: "ANIME", mangabakaId: 42, malId: null }),
    "mangabaka",
  );
});

test("returns null when neither provider has an id", () => {
  assert.equal(
    selectAddSource({ mediaType: "MANGA", mangabakaId: null, malId: null }),
    null,
  );
  assert.equal(selectAddSource({ mediaType: "ANIME" }), null);
});
