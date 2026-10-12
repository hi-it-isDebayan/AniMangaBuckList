CREATE TABLE "title_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"series_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "title_comments" ADD CONSTRAINT "title_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "title_comments_series_idx" ON "title_comments" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "title_comments_user_idx" ON "title_comments" USING btree ("user_id");