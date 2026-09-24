ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_oauth_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" varchar(20) NOT NULL,
  "oauth_id" varchar(255) NOT NULL,
  "display_name" varchar(120),
  "picture_url" text,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "user_oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "user_oauth_accounts_provider_oauth_id_uq" ON "user_oauth_accounts" USING btree ("provider","oauth_id");--> statement-breakpoint

CREATE UNIQUE INDEX "user_oauth_accounts_user_provider_uq" ON "user_oauth_accounts" USING btree ("user_id","provider");--> statement-breakpoint

CREATE INDEX "user_oauth_accounts_user_id_idx" ON "user_oauth_accounts" USING btree ("user_id");--> statement-breakpoint

INSERT INTO "user_oauth_accounts" ("user_id","provider","oauth_id")
SELECT u."id", u."oauth_provider", u."oauth_id"
FROM "users" u
WHERE u."oauth_provider" IS NOT NULL AND u."oauth_id" IS NOT NULL
ON CONFLICT ("provider","oauth_id") DO NOTHING;