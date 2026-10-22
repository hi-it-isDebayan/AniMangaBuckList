import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLibraryHref,
  hasPendingSearchChange,
  type LibraryFilterState,
} from "./library-filters";

const defaults: LibraryFilterState = {
  status: "ALL",
  mediaType: "",
  tag: "",
  genre: "",
  sort: "updated",
  view: "list",
  q: "",
};

function parse(href: string) {
  const u = new URL(href, "http://localhost");
  return { pathname: u.pathname, params: u.searchParams };
}

test("buildLibraryHref returns a bare /library for default filters", () => {
  assert.equal(buildLibraryHref(), "/library");
  assert.equal(buildLibraryHref(defaults), "/library");
  assert.equal(buildLibraryHref(defaults, { status: "ALL", sort: "updated", view: "list", page: 1 }), "/library");
});

test("status override uses the target status key, not the current status (D1)", () => {
  const current: LibraryFilterState = { ...defaults, status: "READING" };
  const completed = parse(buildLibraryHref(current, { status: "COMPLETED" }));
  assert.equal(completed.pathname, "/library");
  assert.equal(completed.params.get("status"), "COMPLETED");

  // Selecting "All" clears the status instead of pinning the current one.
  assert.equal(buildLibraryHref(current, { status: "ALL" }), "/library");
});

test("status override preserves search, media type, sorting and view", () => {
  const current: LibraryFilterState = {
    status: "READING",
    mediaType: "MANGA",
    tag: "favorite",
    genre: "Action",
    sort: "title",
    view: "grid",
    q: "dragon",
  };
  const { pathname, params } = parse(buildLibraryHref(current, { status: "COMPLETED" }));
  assert.equal(pathname, "/library");
  assert.equal(params.get("status"), "COMPLETED");
  assert.equal(params.get("type"), "MANGA");
  assert.equal(params.get("tag"), "favorite");
  assert.equal(params.get("genre"), "Action");
  assert.equal(params.get("sort"), "title");
  assert.equal(params.get("view"), "grid");
  assert.equal(params.get("q"), "dragon");
  // Tab links carry no page: the page's filter set (unlike a pagination link)
  // does not include `page`, so the override cannot reintroduce it.
  assert.equal(params.get("page"), null);
});

test("media type override keeps the active status (media tabs)", () => {
  const current: LibraryFilterState = { ...defaults, status: "COMPLETED", sort: "title", q: "x" };
  const { params } = parse(buildLibraryHref(current, { mediaType: "ANIME" }));
  assert.equal(params.get("status"), "COMPLETED");
  assert.equal(params.get("type"), "ANIME");
  assert.equal(params.get("sort"), "title");
  assert.equal(params.get("q"), "x");
});

test("pagination only emits page > 1 and preserves filters", () => {
  const current: LibraryFilterState = { ...defaults, status: "READING", mediaType: "MANGA" };
  assert.equal(buildLibraryHref(current, { page: 1 }), "/library?status=READING&type=MANGA");
  assert.equal(buildLibraryHref(current, { page: 2 }), "/library?status=READING&type=MANGA&page=2");
});

test("hasPendingSearchChange ignores equivalent and whitespace-only values", () => {
  assert.equal(hasPendingSearchChange("", ""), false);
  assert.equal(hasPendingSearchChange("dragon", "dragon"), false);
  assert.equal(hasPendingSearchChange("  dragon ", "dragon"), false);
  assert.equal(hasPendingSearchChange("dragon", ""), true);
  assert.equal(hasPendingSearchChange("", "dragon"), true);
  assert.equal(hasPendingSearchChange("dragon", "dragons"), true);
});
