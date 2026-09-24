ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oauth_provider" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oauth_id" varchar(255);--> statement-breakpoint
CREATE INDEX "users_oauth_idx" ON "users" USING btree ("oauth_provider","oauth_id");