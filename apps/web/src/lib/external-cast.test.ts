import assert from "node:assert/strict";
import test from "node:test";
import {
  namesMatch,
  normaliseName,
  normaliseRole,
  orderStaffForDisplay,
  parseAniList,
  parseJikanCharacters,
  parseJikanStaff,
  safeImageUrl,
} from "./external-cast";

test("normaliseName collapses whitespace and caps length", () => {
  assert.equal(normaliseName("  Monkey   D.  Luffy "), "Monkey D. Luffy");
  assert.equal(normaliseName(""), null);
  assert.equal(normaliseName(null), null);
  assert.equal(normaliseName(42), null);
  const long = normaliseName("x".repeat(100));
  assert.ok(long && long.length <= 80);
});

test("safeImageUrl only accepts http(s) URLs", () => {
  assert.equal(safeImageUrl("https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
  assert.equal(safeImageUrl("http://cdn.example/a.jpg"), "http://cdn.example/a.jpg");
  assert.equal(safeImageUrl("javascript:alert(1)"), null);
  assert.equal(safeImageUrl("/relative.jpg"), null);
  assert.equal(safeImageUrl(undefined), null);
});

test("normaliseRole maps AniList and Jikan role strings", () => {
  assert.equal(normaliseRole("MAIN"), "MAIN");
  assert.equal(normaliseRole("MAIN_CHARACTER"), "MAIN");
  assert.equal(normaliseRole("SUPPORTING_CHARACTER"), "SUPPORTING");
  assert.equal(normaliseRole("Supporting"), "SUPPORTING");
  assert.equal(normaliseRole("main"), "MAIN");
  assert.equal(normaliseRole(undefined), "BACKGROUND");
});

test("namesMatch ignores order and punctuation", () => {
  assert.ok(namesMatch("Oda Eiichiro", "Eiichiro Oda"));
  assert.ok(namesMatch("Eiichiro Oda", "Eiichiro Oda"));
  assert.ok(namesMatch("Kishimoto, Masashi", "Masashi Kishimoto"));
  assert.ok(!namesMatch("Eiichiro Oda", "Masashi Kishimoto"));
  assert.ok(!namesMatch("Oda", "Eiichiro Oda"));
  assert.ok(!namesMatch("", ""));
});

test("orderStaffForDisplay puts writers/artists first", () => {
  const staff = [
    { id: 1, name: "Director", imageUrl: null, detail: "Director" },
    { id: 2, name: "Author", imageUrl: null, detail: "Story & Art" },
    { id: 3, name: "Composer", imageUrl: null, detail: "Music" },
  ];
  const ordered = orderStaffForDisplay(staff);
  assert.equal(ordered[0]!.name, "Author");
  assert.equal(ordered.length, 3);
});

test("parseAniList extracts characters, voice actors and staff", () => {
  const payload = {
    data: {
      Media: {
        characters: {
          edges: [
            {
              role: "MAIN",
              node: {
                id: 40,
                name: { full: "Monkey D. Luffy", native: "モンキー・D・ルフィ" },
                image: { large: "https://img.example/luffy.jpg" },
              },
              voiceActors: [
                { id: 900, name: { full: "Mayumi Tanaka" }, image: { large: "https://img.example/va.jpg" }, language: "Japanese" },
              ],
            },
            // No id → skipped.
            { role: "MAIN", node: { name: { full: "Ghost" } } },
          ],
        },
        staff: {
          edges: [
            { role: "Story & Art", node: { id: 7, name: { full: "Eiichiro Oda" }, image: { large: "https://img.example/oda.jpg" } } },
            { role: "Story & Art", node: { id: 7, name: { full: "Eiichiro Oda" }, image: null } },
          ],
        },
      },
    },
  };
  const result = parseAniList(payload);
  assert.ok(result);
  assert.equal(result.source, "anilist");
  assert.equal(result.characters.length, 1);
  assert.equal(result.characters[0]!.name, "Monkey D. Luffy");
  assert.equal(result.characters[0]!.role, "MAIN");
  assert.equal(result.characters[0]!.voiceActors.length, 1);
  assert.equal(result.characters[0]!.voiceActors[0]!.name, "Mayumi Tanaka");
  // Staff deduped by id.
  assert.equal(result.staff.length, 1);
  assert.equal(result.staff[0]!.detail, "Story & Art");
});

test("parseAniList returns null when the media node is missing", () => {
  assert.equal(parseAniList({ data: { Media: null } }), null);
  assert.equal(parseAniList({}), null);
  assert.equal(parseAniList(null), null);
  // Empty edges also yield null so the section is hidden.
  assert.equal(parseAniList({ data: { Media: { characters: { edges: [] }, staff: { edges: [] } } } }), null);
});

test("parseJikanCharacters keeps Japanese VAs and flags non-Japanese out", () => {
  const payload = {
    data: [
      {
        character: { mal_id: 1, name: "Luffy", images: { jpg: { image_url: "https://img.example/l.jpg" } } },
        role: "Main",
        voice_actors: [
          { person: { mal_id: 10, name: "Mayumi Tanaka", images: { jpg: { image_url: "https://img.example/va.jpg" } } }, language: "Japanese" },
          { person: { mal_id: 11, name: "English VA", images: {} }, language: "English" },
        ],
      },
      { character: { name: "No id" }, role: "Main" },
    ],
  };
  const characters = parseJikanCharacters(payload);
  assert.equal(characters.length, 1);
  assert.equal(characters[0]!.name, "Luffy");
  assert.equal(characters[0]!.role, "MAIN");
  assert.equal(characters[0]!.voiceActors.length, 1);
  assert.equal(characters[0]!.voiceActors[0]!.name, "Mayumi Tanaka");
});

test("parseJikanStaff reads the people array and joins positions", () => {
  const payload = {
    data: {
      people: [
        { mal_id: 1, name: "Eiichiro Oda", images: { jpg: { image_url: "https://img.example/o.jpg" } }, positions: ["Story", "Art"] },
        { mal_id: 1, name: "Eiichiro Oda", positions: ["Story"] },
        { name: "No id", positions: [] },
      ],
    },
  };
  const staff = parseJikanStaff(payload);
  assert.equal(staff.length, 1);
  assert.equal(staff[0]!.detail, "Story, Art");
});

test("parseJikan handlers tolerate malformed payloads", () => {
  assert.deepEqual(parseJikanCharacters(null), []);
  assert.deepEqual(parseJikanCharacters({ data: "nope" }), []);
  assert.deepEqual(parseJikanStaff({}), []);
});
