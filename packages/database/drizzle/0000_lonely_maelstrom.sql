CREATE TYPE "public"."library_status" AS ENUM('CURRENTLY_WATCHING', 'CURRENTLY_READING', 'PLAN_TO_WATCH', 'PLAN_TO_READ', 'COMPLETED', 'ON_HOLD', 'DROPPED');--> statement-breakpoint
CREATE TYPE "public"."link_type" AS ENUM('MAL', 'OFFICIAL', 'READ', 'STREAM', 'USER_SAVED');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('FINISHED', 'ONGOING', 'NOT_YET_RELEASED', 'HIATUS', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('ANIME', 'MANGA', 'MANHWA', 'MANHUA', 'LIGHT_NOVEL', 'WEB_NOVEL');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('NEW_CHAPTER', 'NEW_EPISODE', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."progress_kind" AS ENUM('OPENED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."progress_source" AS ENUM('MANUAL', 'EXTENSION', 'GENERIC');--> statement-breakpoint
CREATE TYPE "public"."progress_unit" AS ENUM('CHAPTER', 'EPISODE');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('ADAPTATION', 'PRECURSOR', 'SIDE_STORY', 'SPIN_OFF', 'SEQUEL', 'PREQUEL', 'ALTERNATIVE_VERSION', 'CHARACTER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."release_type" AS ENUM('CHAPTER', 'EPISODE');--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text,
	"released_at" date
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"season" integer DEFAULT 1 NOT NULL,
	"number" integer NOT NULL,
	"title" text,
	"aired_at" date
);
--> statement-breakpoint
CREATE TABLE "external_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"url" text NOT NULL,
	"link_type" "link_type" NOT NULL,
	"last_verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title_id" uuid,
	"notif_type" "notification_type" NOT NULL,
	"message" varchar(320) NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"unit" "progress_unit" NOT NULL,
	"kind" "progress_kind" NOT NULL,
	"value" integer NOT NULL,
	"source" varchar(60),
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"release_type" "release_type" NOT NULL,
	"number" integer NOT NULL,
	"source" varchar(60),
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "title_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"mode" varchar(20) DEFAULT 'SYNONYM' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "title_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_title_id" uuid NOT NULL,
	"to_title_id" uuid NOT NULL,
	"relation_type" "relation_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mal_id" integer,
	"source" varchar(20) DEFAULT 'JIKAN' NOT NULL,
	"primary_title" text NOT NULL,
	"english_title" text,
	"japanese_title" text,
	"media_type" "media_type" NOT NULL,
	"synopsis" text,
	"status" "media_status",
	"start_date" date,
	"end_date" date,
	"season" varchar(12),
	"year" integer,
	"episode_count" integer,
	"chapter_count" integer,
	"volume_count" integer,
	"cover_url" text,
	"score" double precision,
	"metadata_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"status" "library_status" NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"last_opened_chapter" integer,
	"last_completed_chapter" integer,
	"last_opened_episode" integer,
	"last_completed_episode" integer,
	"last_source" varchar(60),
	"last_source_url" text,
	"updated_by" "progress_source" DEFAULT 'MANUAL' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tags" (
	"user_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "user_tags_user_id_title_id_tag_id_pk" PRIMARY KEY("user_id","title_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(120) DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_history" ADD CONSTRAINT "progress_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_history" ADD CONSTRAINT "progress_history_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_events" ADD CONSTRAINT "release_events_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_aliases" ADD CONSTRAINT "title_aliases_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_relations" ADD CONSTRAINT "title_relations_from_title_id_titles_id_fk" FOREIGN KEY ("from_title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_relations" ADD CONSTRAINT "title_relations_to_title_id_titles_id_fk" FOREIGN KEY ("to_title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_conversations_user_idx" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_title_number_uq" ON "chapters" USING btree ("title_id","number");--> statement-breakpoint
CREATE INDEX "chapters_title_idx" ON "chapters" USING btree ("title_id");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_title_season_number_uq" ON "episodes" USING btree ("title_id","season","number");--> statement-breakpoint
CREATE INDEX "episodes_title_idx" ON "episodes" USING btree ("title_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_links_title_provider_type_uq" ON "external_links" USING btree ("title_id","provider","link_type");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_user_title_uq" ON "notes" USING btree ("user_id","title_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "progress_history_user_created_idx" ON "progress_history" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "progress_history_title_idx" ON "progress_history" USING btree ("title_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_user_title_uq" ON "ratings" USING btree ("user_id","title_id");--> statement-breakpoint
CREATE INDEX "ratings_title_idx" ON "ratings" USING btree ("title_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_events_title_type_number_uq" ON "release_events" USING btree ("title_id","release_type","number");--> statement-breakpoint
CREATE INDEX "release_events_title_idx" ON "release_events" USING btree ("title_id");--> statement-breakpoint
CREATE INDEX "release_events_detected_idx" ON "release_events" USING btree ("detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_uq" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "title_aliases_title_alias_uq" ON "title_aliases" USING btree ("title_id","alias");--> statement-breakpoint
CREATE INDEX "title_aliases_alias_gin" ON "title_aliases" USING gin (lower("alias") gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "title_relations_uq" ON "title_relations" USING btree ("from_title_id","to_title_id","relation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "titles_source_mal_uq" ON "titles" USING btree ("source","mal_id");--> statement-breakpoint
CREATE INDEX "titles_media_type_idx" ON "titles" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "titles_search_primary_gin" ON "titles" USING gin (lower("primary_title") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "titles_search_english_gin" ON "titles" USING gin (lower("english_title") gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_library_user_title_uq" ON "user_library" USING btree ("user_id","title_id");--> statement-breakpoint
CREATE INDEX "user_library_user_status_idx" ON "user_library" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_library_user_fav_idx" ON "user_library" USING btree ("user_id","is_favorite");--> statement-breakpoint
CREATE UNIQUE INDEX "user_progress_user_title_uq" ON "user_progress" USING btree ("user_id","title_id");--> statement-breakpoint
CREATE INDEX "user_progress_user_idx" ON "user_progress" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");