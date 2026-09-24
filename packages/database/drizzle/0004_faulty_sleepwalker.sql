CREATE TABLE "public_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) DEFAULT 'Default' NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_four" varchar(16) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "public_api_keys" ADD CONSTRAINT "public_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_api_keys_user_name_uq" ON "public_api_keys" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "public_api_keys_user_id_idx" ON "public_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "public_api_keys_key_hash_idx" ON "public_api_keys" USING btree ("key_hash");