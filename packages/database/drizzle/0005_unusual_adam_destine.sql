CREATE TABLE "extension_title_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"normalized_title" text NOT NULL,
	"title_id" uuid NOT NULL,
	"host" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extension_title_matches" ADD CONSTRAINT "extension_title_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_title_matches" ADD CONSTRAINT "extension_title_matches_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "extension_title_matches_user_title_uq" ON "extension_title_matches" USING btree ("user_id","normalized_title");--> statement-breakpoint
CREATE INDEX "extension_title_matches_user_idx" ON "extension_title_matches" USING btree ("user_id");