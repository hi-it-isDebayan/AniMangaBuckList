import type { MediaRelation, MediaType, SearchResultItem } from "@ambl/types";

export type { SearchResultItem, MediaType };

export interface SearchOptions {
  type?: "ANIME" | "MANGA" | "BOOK";
  limit?: number;
}

export interface MetadataProvider {
  readonly name: "jikan" | "mal" | "anilist";
  search(query: string, options?: SearchOptions): Promise<SearchResultItem[]>;
  getById(malId: number, mediaType: MediaType): Promise<SearchResultItem | null>;
  getRelations(malId: number, mediaType: MediaType): Promise<MediaRelation[]>;
}