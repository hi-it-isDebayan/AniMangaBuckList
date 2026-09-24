export type MediaType =
  | "ANIME"
  | "MANGA"
  | "MANHWA"
  | "MANHUA"
  | "LIGHT_NOVEL"
  | "WEB_NOVEL";

export type MediaStatus =
  | "FINISHED"
  | "ONGOING"
  | "NOT_YET_RELEASED"
  | "HIATUS"
  | "CANCELLED";

export type LibraryStatus =
  | "CURRENTLY_WATCHING"
  | "CURRENTLY_READING"
  | "PLAN_TO_WATCH"
  | "PLAN_TO_READ"
  | "COMPLETED"
  | "ON_HOLD"
  | "DROPPED";

export type ProgressKind = "OPENED" | "COMPLETED";
export type ProgressUnit = "CHAPTER" | "EPISODE";
export type ProgressSource = "MANUAL" | "EXTENSION" | "GENERIC";

export type RelationType =
  | "ADAPTATION"
  | "PRECURSOR"
  | "SIDE_STORY"
  | "SPIN_OFF"
  | "SEQUEL"
  | "PREQUEL"
  | "ALTERNATIVE_VERSION"
  | "CHARACTER"
  | "OTHER";

export type LinkType = "MAL" | "OFFICIAL" | "READ" | "STREAM" | "USER_SAVED";

export type ReleaseType = "CHAPTER" | "EPISODE";
export type NotificationType = "NEW_CHAPTER" | "NEW_EPISODE" | "SYSTEM";

export interface UserPreferences {
  notifications: {
    episodes: boolean;
    chapters: boolean;
  };
}

export interface SearchResultItem {
  malId: number | null;
  title: string;
  englishTitle: string | null;
  japaneseTitle: string | null;
  synonyms: string[];
  mediaType: MediaType;
  synopsis: string | null;
  status: MediaStatus | null;
  episodeCount: number | null;
  chapterCount: number | null;
  volumeCount: number | null;
  startDate: string | null;
  endDate: string | null;
  season: string | null;
  year: number | null;
  coverUrl: string | null;
  score: number | null;
  genres: string[];
}

export interface MediaRelation {
  relationType: RelationType;
  malId: number | null;
  title: string | null;
  mediaType: MediaType | null;
}