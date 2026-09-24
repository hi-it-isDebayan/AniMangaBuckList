ALTER TABLE "titles" ADD COLUMN "genres" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "titles_genres_gin" ON "titles" USING gin ("genres");