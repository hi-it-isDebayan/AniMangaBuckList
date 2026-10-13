export interface LibraryFilterState {
  status?: string;
  mediaType?: string;
  tag?: string;
  genre?: string;
  sort?: string;
  view?: string;
  q?: string;
  page?: number;
}

/**
 * Build a canonical `/library` URL from a filter set plus optional overrides.
 *
 * Each caller supplies the filters that are currently active and the values
 * that the interaction should change, so a link can never accidentally carry
 * the status (or any other filter) it was meant to replace.
 *
 * Defaults are omitted to keep links stable and shareable:
 * status=ALL, sort=updated, view=list, page=1.
 */
export function buildLibraryHref(
  current: LibraryFilterState = {},
  overrides: LibraryFilterState = {},
): string {
  const f: LibraryFilterState = { ...current, ...overrides };
  const params = new URLSearchParams();

  if (f.status && f.status !== "ALL") params.set("status", f.status);
  if (f.mediaType) params.set("type", f.mediaType);
  if (f.tag) params.set("tag", f.tag);
  if (f.genre) params.set("genre", f.genre);
  if (f.sort && f.sort !== "updated") params.set("sort", f.sort);
  if (f.view && f.view !== "list") params.set("view", f.view);
  if (f.q) params.set("q", f.q);
  if (f.page && f.page > 1) params.set("page", String(f.page));

  const qs = params.toString();
  return qs ? `/library?${qs}` : "/library";
}

/**
 * Whether a debounced search write still needs to happen.
 *
 * The library search input debounces its value into the URL. Comparing the
 * local input against the URL query (whitespace-insensitively) prevents the
 * initial render or an unrelated filter navigation from flushing stale text
 * over a newer navigation.
 */
export function hasPendingSearchChange(q: string, query: string): boolean {
  return q.trim() !== query.trim();
}
