CREATE TABLE "mangabaka_series" (
	"id" integer PRIMARY KEY NOT NULL,
	"media_type" "media_type",
	"state" varchar(24) DEFAULT 'active' NOT NULL,
	"primary_title" text NOT NULL,
	"english_title" text,
	"native_title" text,
	"japanese_title" text,
	"synopsis" text,
	"status" "media_status",
	"start_date" date,
	"end_date" date,
	"year" integer,
	"cover_url" text,
	"rating" double precision,
	"popularity" integer,
	"popularity_1d" integer,
	"popularity_1w" integer,
	"popularity_1mo" integer,
	"popularity_3mo" integer,
	"popularity_6mo" integer,
	"popularity_1y" integer,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags" jsonb,
	"authors" text[] DEFAULT '{}'::text[] NOT NULL,
	"artists" text[] DEFAULT '{}'::text[] NOT NULL,
	"publishers" jsonb,
	"mal_id" integer,
	"anilist_id" integer,
	"total_chapters" integer,
	"final_volume" integer,
	"content_rating" varchar(16),
	"is_licensed" boolean DEFAULT false NOT NULL,
	"has_anime" boolean DEFAULT false NOT NULL,
	"canonical_url" text,
	"last_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mangabaka_series_media_type_idx" ON "mangabaka_series" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "mangabaka_series_year_idx" ON "mangabaka_series" USING btree ("year");--> statement-breakpoint
CREATE INDEX "mangabaka_series_popularity_idx" ON "mangabaka_series" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "mangabaka_series_rating_idx" ON "mangabaka_series" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "mangabaka_series_mal_idx" ON "mangabaka_series" USING btree ("mal_id");--> statement-breakpoint
CREATE INDEX "mangabaka_series_anilist_idx" ON "mangabaka_series" USING btree ("anilist_id");--> statement-breakpoint
CREATE INDEX "mangabaka_series_genres_gin" ON "mangabaka_series" USING gin ("genres");--> statement-breakpoint
CREATE INDEX "mangabaka_series_tags_gin" ON "mangabaka_series" USING gin ("tags");