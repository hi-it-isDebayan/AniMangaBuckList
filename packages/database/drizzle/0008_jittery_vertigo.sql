CREATE TABLE "oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scopes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(20) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"anilist_id" integer,
	"mal_id" integer,
	"media_type" "media_type",
	"title" text NOT NULL,
	"cover_url" text,
	"progress_value" integer,
	"progress_unit" "progress_unit",
	"status" varchar(32),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_entries" ADD CONSTRAINT "provider_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_tokens_user_provider_uq" ON "oauth_tokens" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "oauth_tokens_user_idx" ON "oauth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_entries_user_provider_external_uq" ON "provider_entries" USING btree ("user_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "provider_entries_user_idx" ON "provider_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "provider_entries_provider_external_idx" ON "provider_entries" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "provider_entries_anilist_idx" ON "provider_entries" USING btree ("anilist_id");--> statement-breakpoint
CREATE INDEX "provider_entries_mal_idx" ON "provider_entries" USING btree ("mal_id");