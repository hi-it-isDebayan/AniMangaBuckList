CREATE TABLE "browse_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"site" varchar(128),
	"mal_id" integer,
	"media_type" varchar(10),
	"cover_url" text,
	"unit" varchar(8) DEFAULT 'CHAPTER' NOT NULL,
	"value" integer DEFAULT 1 NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_heartbeats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"platform" varchar(20) NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "browse_history" ADD CONSTRAINT "browse_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_heartbeats" ADD CONSTRAINT "device_heartbeats_api_key_id_public_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."public_api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "browse_history_user_visited_idx" ON "browse_history" USING btree ("user_id","visited_at");--> statement-breakpoint
CREATE INDEX "browse_history_visited_idx" ON "browse_history" USING btree ("visited_at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_heartbeats_key_platform_uq" ON "device_heartbeats" USING btree ("api_key_id","platform");