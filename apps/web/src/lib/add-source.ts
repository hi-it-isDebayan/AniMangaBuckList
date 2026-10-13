import type { MediaType } from "@ambl/types";

/**
 * Which upstream metadata provider should fulfil an "add title" request.
 * Manga-family titles (manga/manhwa/manhua/novels) prefer MangaBaka because it
 * carries richer chapter, credit and history data; anime stays on MAL, where
 * the catalog is more complete.
 *
 * This module is deliberately dependency-free so client components can import
 * it without pulling server-only database code into the browser bundle.
 */
export type AddSource = "mangabaka" | "mal";

export interface AddSourceInput {
  mediaType: MediaType | string;
  mangabakaId?: number | null;
  malId?: number | null;
}

/**
 * Pick the metadata provider that should fulfil an "add" request.
 *
 * Order of preference:
 * 1. MangaBaka for anything that is not anime (when a MangaBaka id is known).
 * 2. MAL for anything MAL can provide.
 * 3. MangaBaka as a last resort (covers anime-shaped rows that only exist in
 *    MangaBaka).
 *
 * Returns `null` when the item has neither a MAL nor a MangaBaka id.
 */
export function selectAddSource(item: AddSourceInput): AddSource | null {
  if (item.mediaType !== "ANIME" && item.mangabakaId != null) return "mangabaka";
  if (item.malId != null) return "mal";
  if (item.mangabakaId != null) return "mangabaka";
  return null;
}
