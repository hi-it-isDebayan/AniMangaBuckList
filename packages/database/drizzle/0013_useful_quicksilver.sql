CREATE INDEX "mangabaka_series_discover_popularity_idx" ON "mangabaka_series" USING btree ("popularity","total_chapters","year");--> statement-breakpoint
CREATE INDEX "mangabaka_series_discover_rating_idx" ON "mangabaka_series" USING btree ("rating","total_chapters","year");--> statement-breakpoint
CREATE INDEX "mangabaka_series_discover_latest_idx" ON "mangabaka_series" USING btree ("last_updated_at","total_chapters","year");--> statement-breakpoint
CREATE INDEX "mangabaka_series_new_idx" ON "mangabaka_series" USING btree ("year","popularity","total_chapters");