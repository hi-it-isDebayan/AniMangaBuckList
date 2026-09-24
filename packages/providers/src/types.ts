import type { MediaRelation, MediaType, SearchResultItem } from "@ambl/types";

export interface SearchOptions {
  type?: "ANIME" | "MANGA" | "BOOK";
  limit?: number;
}

export interface MetadataProvider {
  readonly name: "jikan" | "mal";
  search(query: string, options?: SearchOptions): Promise<SearchResultItem[]>;
  getById(malId: number, mediaType: MediaType): Promise<SearchResultItem | null>;
  getRelations(malId: number, mediaType: MediaType): Promise<MediaRelation[]>;
}