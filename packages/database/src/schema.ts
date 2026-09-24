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

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: char64("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
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

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  library: many(userLibrary),
  progress: many(userProgress),
  progressHistory: many(progressHistory),
  notes: many(notes),
  ratings: many(ratings),
  tags: many(tags),
  notifications: many(notifications),
}));

export const titlesRelations = relations(titles, ({ many }) => ({
  aliases: many(titleAliases),
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
}));

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

export const SYSTEM_TAG_USER_ID = "00000000-0000-0000-0000-000000000000";