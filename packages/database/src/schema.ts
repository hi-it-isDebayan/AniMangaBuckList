import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  date,
  doublePrecision,
  boolean,
} from "drizzle-orm/pg-core";
import type { UserPreferences } from "@ambl/types";

export const mediaTypeEnum = pgEnum("media_type", [
  "ANIME",
  "MANGA",
  "MANHWA",
  "MANHUA",
  "LIGHT_NOVEL",
  "WEB_NOVEL",
]);

export const mediaStatusEnum = pgEnum("media_status", [
  "FINISHED",
  "ONGOING",
  "NOT_YET_RELEASED",
  "HIATUS",
  "CANCELLED",
]);

export const libraryStatusEnum = pgEnum("library_status", [
  "CURRENTLY_WATCHING",
  "CURRENTLY_READING",
  "PLAN_TO_WATCH",
  "PLAN_TO_READ",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
]);

export const relationTypeEnum = pgEnum("relation_type", [
  "ADAPTATION",
  "PRECURSOR",
  "SIDE_STORY",
  "SPIN_OFF",
  "SEQUEL",
  "PREQUEL",
  "ALTERNATIVE_VERSION",
  "CHARACTER",
  "OTHER",
]);

export const linkTypeEnum = pgEnum("link_type", [
  "MAL",
  "OFFICIAL",
  "READ",
  "STREAM",
  "USER_SAVED",
]);

export const progressUnitEnum = pgEnum("progress_unit", ["CHAPTER", "EPISODE"]);
export const progressKindEnum = pgEnum("progress_kind", ["OPENED", "COMPLETED"]);
export const progressSourceEnum = pgEnum("progress_source", [
  "MANUAL",
  "EXTENSION",
  "GENERIC",
]);

export const releaseTypeEnum = pgEnum("release_type", ["CHAPTER", "EPISODE"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "NEW_CHAPTER",
  "NEW_EPISODE",
  "SYSTEM",
]);

// --- Sources feature -------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", ["USER", "MODERATOR", "ADMIN"]);

export const sourceStatusEnum = pgEnum("source_status", [
  "WORKING",
  "DEGRADED",
  "BROKEN",
  "UNVERIFIED",
]);

export const sourceExtractorStatusEnum = pgEnum("source_extractor_status", [
  "SUPPORTED",
  "AWAITING_EXTRACTOR",
  "UNSUPPORTED",
]);

export const sourceVisibilityEnum = pgEnum("source_visibility", ["PUBLIC", "HIDDEN"]);

export const sourceFailureCategoryEnum = pgEnum("source_failure_category", [
  "NONE",
  "TIMEOUT",
  "DNS",
  "TLS",
  "HTTP_4XX",
  "HTTP_5XX",
  "BLOCKED",
  "TOO_MANY_REDIRECTS",
  "PARSE_MISMATCH",
  "UNSAFE_TARGET",
  "UNKNOWN",
]);

export const sourceCheckTriggerEnum = pgEnum("source_check_trigger", [
  "MANUAL",
  "SCHEDULED",
  "REPORT",
]);

export const sourceReportKindEnum = pgEnum("source_report_kind", [
  "WORKING",
  "NOT_WORKING",
  "MISMATCH",
  "OTHER",
]);

export const moderationActionEnum = pgEnum("moderation_action", [
  "SOURCE_CREATED",
  "SOURCE_UPDATED",
  "SOURCE_DEPRECATED",
  "SOURCE_RESTORED",
  "SOURCE_DELETED",
  "ROLE_GRANTED",
  "ROLE_REVOKED",
  "REPORT_RESOLVED",
]);

const char64 = (name: string) => varchar(name, { length: 64 });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull().default(""),
    passwordHash: text("password_hash"),
    oauthProvider: varchar("oauth_provider", { length: 20 }),
    oauthId: varchar("oauth_id", { length: 255 }),
    avatarUrl: text("avatar_url"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    role: userRoleEnum("role").notNull().default("USER"),
    preferences: jsonb("preferences")
      .$type<UserPreferences>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    index("users_oauth_idx").on(t.oauthProvider, t.oauthId),
  ],
);

export const userOauthAccounts = pgTable(
  "user_oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull(),
    oauthId: varchar("oauth_id", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 120 }),
    pictureUrl: text("picture_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_oauth_accounts_provider_oauth_id_uq").on(
      t.provider,
      t.oauthId,
    ),
    uniqueIndex("user_oauth_accounts_user_provider_uq").on(
      t.userId,
      t.provider,
    ),
    index("user_oauth_accounts_user_id_idx").on(t.userId),
  ],
);

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scopes: text("scopes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("oauth_tokens_user_provider_uq").on(t.userId, t.provider),
    index("oauth_tokens_user_idx").on(t.userId),
  ],
);

export const providerEntries = pgTable(
  "provider_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    anilistId: integer("anilist_id"),
    malId: integer("mal_id"),
    mediaType: mediaTypeEnum("media_type"),
    title: text("title").notNull(),
    coverUrl: text("cover_url"),
    progressValue: integer("progress_value"),
    progressUnit: progressUnitEnum("progress_unit"),
    status: varchar("status", { length: 32 }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("provider_entries_user_provider_external_uq").on(
      t.userId,
      t.provider,
      t.externalId,
    ),
    index("provider_entries_user_idx").on(t.userId),
    index("provider_entries_provider_external_idx").on(t.provider, t.externalId),
    index("provider_entries_anilist_idx").on(t.anilistId),
    index("provider_entries_mal_idx").on(t.malId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: char64("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deviceLabel: varchar("device_label", { length: 120 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 24 }).notNull(),
    tokenHash: char64("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("auth_tokens_token_hash_uq").on(t.tokenHash),
    index("auth_tokens_user_id_idx").on(t.userId),
    index("auth_tokens_expires_at_idx").on(t.expiresAt),
  ],
);

export const loginRateLimits = pgTable(
  "login_rate_limits",
  {
    key: varchar("key", { length: 160 }).primaryKey(),
    attempts: integer("attempts").notNull().default(0),
    windowStartAt: timestamp("window_start_at", { withTimezone: true }).notNull(),
    lockoutUntil: timestamp("lockout_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const webauthnCredentials = pgTable(
  "webauthn_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: varchar("credential_id", { length: 512 }).notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: jsonb("transports").$type<string[]>(),
    name: varchar("name", { length: 120 }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("webauthn_credentials_credential_id_uq").on(t.credentialId),
    index("webauthn_credentials_user_id_idx").on(t.userId),
  ],
);

export const webauthnChallenges = pgTable(
  "webauthn_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    kind: varchar("kind", { length: 24 }).notNull(),
    challenge: varchar("challenge", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("webauthn_challenges_challenge_uq").on(t.challenge),
    index("webauthn_challenges_user_id_idx").on(t.userId),
  ],
);

export const publicApiKeys = pgTable(
  "public_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull().default("Default"),
    keyHash: char64("key_hash").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastFour: varchar("last_four", { length: 16 }).notNull(),
  },
  (t) => [
    uniqueIndex("public_api_keys_user_name_uq").on(t.userId, t.name),
    index("public_api_keys_user_id_idx").on(t.userId),
    index("public_api_keys_key_hash_idx").on(t.keyHash),
  ],
);

export const browseHistory = pgTable(
  "browse_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    site: varchar("site", { length: 128 }),
    malId: integer("mal_id"),
    mediaType: varchar("media_type", { length: 10 }),
    coverUrl: text("cover_url"),
    unit: varchar("unit", { length: 8 }).notNull().default("CHAPTER"),
    value: integer("value").notNull().default(1),
    visitedAt: timestamp("visited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("browse_history_user_visited_idx").on(t.userId, t.visitedAt),
    index("browse_history_visited_idx").on(t.visitedAt),
  ],
);

export const deviceHeartbeats = pgTable(
  "device_heartbeats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => publicApiKeys.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 20 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("device_heartbeats_key_platform_uq").on(t.apiKeyId, t.platform),
  ],
);

export const titles = pgTable(
  "titles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    malId: integer("mal_id"),
    source: varchar("source", { length: 20 }).notNull().default("JIKAN"),
    primaryTitle: text("primary_title").notNull(),
    englishTitle: text("english_title"),
    japaneseTitle: text("japanese_title"),
    mediaType: mediaTypeEnum("media_type").notNull(),
    synopsis: text("synopsis"),
    status: mediaStatusEnum("status"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    season: varchar("season", { length: 12 }),
    year: integer("year"),
    episodeCount: integer("episode_count"),
    chapterCount: integer("chapter_count"),
    volumeCount: integer("volume_count"),
    coverUrl: text("cover_url"),
    score: doublePrecision("score"),
    genres: text("genres").array().notNull().default(sql`'{}'::text[]`),
    metadataRefreshedAt: timestamp("metadata_refreshed_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("titles_source_mal_uq").on(t.source, t.malId),
    index("titles_media_type_idx").on(t.mediaType),
    index("titles_genres_gin").using("gin", t.genres),
    index("titles_search_primary_gin").using(
      "gin",
      sql`lower(${t.primaryTitle}) gin_trgm_ops`,
    ),
    index("titles_search_english_gin").using(
      "gin",
      sql`lower(${t.englishTitle}) gin_trgm_ops`,
    ),
  ],
);

export const titleExternalIds = pgTable(
  "title_external_ids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    externalId: varchar("external_id", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("title_external_ids_provider_external_uq").on(
      t.provider,
      t.externalId,
    ),
    index("title_external_ids_title_idx").on(t.titleId),
  ],
);

export const titleAliases = pgTable(
  "title_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    mode: varchar("mode", { length: 20 }).notNull().default("SYNONYM"),
  },
  (t) => [
    uniqueIndex("title_aliases_title_alias_uq").on(t.titleId, t.alias),
    index("title_aliases_alias_gin").using(
      "gin",
      sql`lower(${t.alias}) gin_trgm_ops`,
    ),
  ],
);

export const extensionTitleMatches = pgTable(
  "extension_title_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    normalizedTitle: text("normalized_title").notNull(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    host: varchar("host", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("extension_title_matches_user_title_uq").on(
      t.userId,
      t.normalizedTitle,
    ),
    index("extension_title_matches_user_idx").on(t.userId),
  ],
);

export const titleRelations = pgTable(
  "title_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromTitleId: uuid("from_title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    toTitleId: uuid("to_title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    relationType: relationTypeEnum("relation_type").notNull(),
  },
  (t) => [
    uniqueIndex("title_relations_uq").on(
      t.fromTitleId,
      t.toTitleId,
      t.relationType,
    ),
  ],
);

export const chapters = pgTable(
  "chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title"),
    releasedAt: date("released_at"),
  },
  (t) => [
    uniqueIndex("chapters_title_number_uq").on(t.titleId, t.number),
    index("chapters_title_idx").on(t.titleId),
  ],
);

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    season: integer("season").notNull().default(1),
    number: integer("number").notNull(),
    title: text("title"),
    airedAt: date("aired_at"),
  },
  (t) => [
    uniqueIndex("episodes_title_season_number_uq").on(
      t.titleId,
      t.season,
      t.number,
    ),
    index("episodes_title_idx").on(t.titleId),
  ],
);

export const userLibrary = pgTable(
  "user_library",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    status: libraryStatusEnum("status").notNull(),
    isFavorite: boolean("is_favorite").notNull().default(false),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_library_user_title_uq").on(t.userId, t.titleId),
    index("user_library_user_status_idx").on(t.userId, t.status),
    index("user_library_user_fav_idx").on(t.userId, t.isFavorite),
  ],
);

export const userProgress = pgTable(
  "user_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    lastOpenedChapter: integer("last_opened_chapter"),
    lastCompletedChapter: integer("last_completed_chapter"),
    lastOpenedEpisode: integer("last_opened_episode"),
    lastCompletedEpisode: integer("last_completed_episode"),
    lastSource: varchar("last_source", { length: 60 }),
    lastSourceUrl: text("last_source_url"),
    updatedBy: progressSourceEnum("updated_by").notNull().default("MANUAL"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_progress_user_title_uq").on(t.userId, t.titleId),
    index("user_progress_user_idx").on(t.userId),
  ],
);

export const progressHistory = pgTable(
  "progress_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    unit: progressUnitEnum("unit").notNull(),
    kind: progressKindEnum("kind").notNull(),
    value: integer("value").notNull(),
    source: varchar("source", { length: 60 }),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("progress_history_user_created_idx").on(t.userId, t.createdAt),
    index("progress_history_title_idx").on(t.titleId),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("notes_user_title_uq").on(t.userId, t.titleId)],
);

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    score: smallint("score").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ratings_user_title_uq").on(t.userId, t.titleId),
    index("ratings_title_idx").on(t.titleId),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().default("00000000-0000-0000-0000-000000000000"),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("tags_user_name_uq").on(t.userId, t.name)],
);

export const userTags = pgTable(
  "user_tags",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId, t.tagId] })],
);

export const externalLinks = pgTable(
  "external_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 40 }).notNull(),
    url: text("url").notNull(),
    linkType: linkTypeEnum("link_type").notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("external_links_title_provider_type_uq").on(
      t.titleId,
      t.provider,
      t.linkType,
    ),
  ],
);

export const releaseEvents = pgTable(
  "release_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    releaseType: releaseTypeEnum("release_type").notNull(),
    number: integer("number").notNull(),
    source: varchar("source", { length: 60 }),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("release_events_title_type_number_uq").on(
      t.titleId,
      t.releaseType,
      t.number,
    ),
    index("release_events_title_idx").on(t.titleId),
    index("release_events_detected_idx").on(t.detectedAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: uuid("title_id").references(() => titles.id, {
      onDelete: "set null",
    }),
    notifType: notificationTypeEnum("notif_type").notNull(),
    message: varchar("message", { length: 320 }).notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_read_idx").on(t.userId, t.read),
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_conversations_user_idx").on(t.userId)],
);

export const mangabakaSeries = pgTable(
  "mangabaka_series",
  {
    id: integer("id").primaryKey(),
    mediaType: mediaTypeEnum("media_type"),
    state: varchar("state", { length: 24 }).notNull().default("active"),
    primaryTitle: text("primary_title").notNull(),
    englishTitle: text("english_title"),
    nativeTitle: text("native_title"),
    japaneseTitle: text("japanese_title"),
    synopsis: text("synopsis"),
    status: mediaStatusEnum("status"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    year: integer("year"),
    coverUrl: text("cover_url"),
    rating: doublePrecision("rating"),
    popularity: integer("popularity"),
    popularity1d: integer("popularity_1d"),
    popularity1w: integer("popularity_1w"),
    popularity1mo: integer("popularity_1mo"),
    popularity3mo: integer("popularity_3mo"),
    popularity6mo: integer("popularity_6mo"),
    popularity1y: integer("popularity_1y"),
    genres: text("genres").array().notNull().default(sql`'{}'::text[]`),
    tags: jsonb("tags").$type<string[]>(),
    authors: text("authors").array().notNull().default(sql`'{}'::text[]`),
    artists: text("artists").array().notNull().default(sql`'{}'::text[]`),
    publishers: jsonb("publishers").$type<
      { id: number; name: string; language: string | null }[]
    >(),
    malId: integer("mal_id"),
    anilistId: integer("anilist_id"),
    totalChapters: integer("total_chapters"),
    finalVolume: integer("final_volume"),
    contentRating: varchar("content_rating", { length: 16 }),
    isLicensed: boolean("is_licensed").notNull().default(false),
    hasAnime: boolean("has_anime").notNull().default(false),
    canonicalUrl: text("canonical_url"),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mangabaka_series_media_type_idx").on(t.mediaType),
    index("mangabaka_series_year_idx").on(t.year),
    index("mangabaka_series_popularity_idx").on(t.popularity),
    index("mangabaka_series_rating_idx").on(t.rating),
    index("mangabaka_series_mal_idx").on(t.malId),
    index("mangabaka_series_anilist_idx").on(t.anilistId),
    index("mangabaka_series_genres_gin").using("gin", t.genres),
    index("mangabaka_series_tags_gin").using("gin", t.tags),
  ],
);

export const titleComments = pgTable(
  "title_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seriesId: integer("series_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("title_comments_series_idx").on(t.seriesId),
    index("title_comments_user_idx").on(t.userId),
  ],
);

// --- Sources feature tables ------------------------------------------------

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Canonical registrable host, e.g. "asuracomic.net". Uniqueness here is what
    // prevents duplicate registrations for equivalent domains.
    domain: varchar("domain", { length: 253 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    homepageUrl: text("homepage_url").notNull(),
    contentTypes: mediaTypeEnum("content_types")
      .array()
      .notNull()
      .default(sql`'{}'::media_type[]`),
    // Extractor capability is tracked independently of registration: a source
    // can exist and be linked with no compatible extractor yet.
    extractorKey: varchar("extractor_key", { length: 80 }),
    extractorStatus: sourceExtractorStatusEnum("extractor_status")
      .notNull()
      .default("AWAITING_EXTRACTOR"),
    status: sourceStatusEnum("status").notNull().default("UNVERIFIED"),
    visibility: sourceVisibilityEnum("visibility").notNull().default("PUBLIC"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastFailureCategory: sourceFailureCategoryEnum("last_failure_category")
      .notNull()
      .default("NONE"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sources_domain_uq").on(t.domain),
    index("sources_status_idx").on(t.status, t.visibility),
    index("sources_created_by_idx").on(t.createdBy),
  ],
);

export const sourceChecks = pgTable(
  "source_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    reachable: boolean("reachable").notNull(),
    extractOk: boolean("extract_ok").notNull(),
    failureCategory: sourceFailureCategoryEnum("failure_category")
      .notNull()
      .default("NONE"),
    httpStatus: integer("http_status"),
    latencyMs: integer("latency_ms"),
    trigger: sourceCheckTriggerEnum("trigger").notNull().default("MANUAL"),
    checkedBy: uuid("checked_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("source_checks_source_idx").on(t.sourceId, t.createdAt)],
);

export const sourceLinks = pgTable(
  "source_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("source_links_user_source_uq").on(t.userId, t.sourceId),
    index("source_links_user_idx").on(t.userId),
    index("source_links_source_idx").on(t.sourceId),
  ],
);

export const sourceReports = pgTable(
  "source_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: sourceReportKindEnum("kind").notNull(),
    note: varchar("note", { length: 1000 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("source_reports_source_idx").on(t.sourceId, t.createdAt),
    index("source_reports_resolved_idx").on(t.resolvedAt),
  ],
);

export const moderationAuditLog = pgTable(
  "moderation_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: moderationActionEnum("action").notNull(),
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: varchar("reason", { length: 500 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("moderation_audit_log_created_idx").on(t.createdAt),
    index("moderation_audit_log_source_idx").on(t.sourceId),
    index("moderation_audit_log_actor_idx").on(t.actorId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  oauthAccounts: many(userOauthAccounts),
  oauthTokens: many(oauthTokens),
  providerEntries: many(providerEntries),
  library: many(userLibrary),
  progress: many(userProgress),
  progressHistory: many(progressHistory),
  notes: many(notes),
  ratings: many(ratings),
  tags: many(tags),
  notifications: many(notifications),
  extensionTitleMatches: many(extensionTitleMatches),
  comments: many(titleComments),
}));

export const titleCommentsRelations = relations(titleComments, ({ one }) => ({
  user: one(users, { fields: [titleComments.userId], references: [users.id] }),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  createdBy: one(users, { fields: [sources.createdBy], references: [users.id] }),
  checks: many(sourceChecks),
  links: many(sourceLinks),
  reports: many(sourceReports),
}));

export const sourceChecksRelations = relations(sourceChecks, ({ one }) => ({
  source: one(sources, { fields: [sourceChecks.sourceId], references: [sources.id] }),
}));

export const sourceLinksRelations = relations(sourceLinks, ({ one }) => ({
  user: one(users, { fields: [sourceLinks.userId], references: [users.id] }),
  source: one(sources, { fields: [sourceLinks.sourceId], references: [sources.id] }),
}));

export const sourceReportsRelations = relations(sourceReports, ({ one }) => ({
  source: one(sources, { fields: [sourceReports.sourceId], references: [sources.id] }),
  user: one(users, { fields: [sourceReports.userId], references: [users.id] }),
}));

export const moderationAuditLogRelations = relations(moderationAuditLog, ({ one }) => ({
  actor: one(users, { fields: [moderationAuditLog.actorId], references: [users.id] }),
  source: one(sources, { fields: [moderationAuditLog.sourceId], references: [sources.id] }),
}));

export const userOauthAccountsRelations = relations(userOauthAccounts, ({ one }) => ({
  user: one(users, { fields: [userOauthAccounts.userId], references: [users.id] }),
}));

export const oauthTokensRelations = relations(oauthTokens, ({ one }) => ({
  user: one(users, { fields: [oauthTokens.userId], references: [users.id] }),
}));

export const providerEntriesRelations = relations(providerEntries, ({ one }) => ({
  user: one(users, { fields: [providerEntries.userId], references: [users.id] }),
}));

export const titlesRelations = relations(titles, ({ many }) => ({
  aliases: many(titleAliases),
  extensionTitleMatches: many(extensionTitleMatches),
  relationsFrom: many(titleRelations, { relationName: "fromTitle" }),
  relationsTo: many(titleRelations, { relationName: "toTitle" }),
  chapters: many(chapters),
  episodes: many(episodes),
  library: many(userLibrary),
  progress: many(userProgress),
  progressHistory: many(progressHistory),
  notes: many(notes),
  ratings: many(ratings),
  tags: many(userTags),
  externalLinks: many(externalLinks),
  releaseEvents: many(releaseEvents),
  notifications: many(notifications),
  externalIds: many(titleExternalIds),
}));

export const titleExternalIdsRelations = relations(
  titleExternalIds,
  ({ one }) => ({
    title: one(titles, {
      fields: [titleExternalIds.titleId],
      references: [titles.id],
    }),
  }),
);

export const userLibraryRelations = relations(userLibrary, ({ one }) => ({
  user: one(users, { fields: [userLibrary.userId], references: [users.id] }),
  title: one(titles, { fields: [userLibrary.titleId], references: [titles.id] }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, { fields: [userProgress.userId], references: [users.id] }),
  title: one(titles, { fields: [userProgress.titleId], references: [titles.id] }),
}));

export const progressHistoryRelations = relations(progressHistory, ({ one }) => ({
  user: one(users, { fields: [progressHistory.userId], references: [users.id] }),
  title: one(titles, { fields: [progressHistory.titleId], references: [titles.id] }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  user: one(users, { fields: [notes.userId], references: [users.id] }),
  title: one(titles, { fields: [notes.titleId], references: [titles.id] }),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  user: one(users, { fields: [ratings.userId], references: [users.id] }),
  title: one(titles, { fields: [ratings.titleId], references: [titles.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  titles: many(userTags),
}));

export const userTagsRelations = relations(userTags, ({ one }) => ({
  user: one(users, { fields: [userTags.userId], references: [users.id] }),
  title: one(titles, { fields: [userTags.titleId], references: [titles.id] }),
  tag: one(tags, { fields: [userTags.tagId], references: [tags.id] }),
}));

export const releaseEventsRelations = relations(releaseEvents, ({ one }) => ({
  title: one(titles, { fields: [releaseEvents.titleId], references: [titles.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  title: one(titles, { fields: [notifications.titleId], references: [titles.id] }),
}));

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Title = typeof titles.$inferSelect;
export type UserLibrary = typeof userLibrary.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type SourceCheck = typeof sourceChecks.$inferSelect;
export type SourceLink = typeof sourceLinks.$inferSelect;
export type SourceReport = typeof sourceReports.$inferSelect;
export type ModerationAuditEntry = typeof moderationAuditLog.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type SourceStatus = (typeof sourceStatusEnum.enumValues)[number];
export type SourceExtractorStatus = (typeof sourceExtractorStatusEnum.enumValues)[number];
export type SourceFailureCategory = (typeof sourceFailureCategoryEnum.enumValues)[number];

export const SYSTEM_TAG_USER_ID = "00000000-0000-0000-0000-000000000000";