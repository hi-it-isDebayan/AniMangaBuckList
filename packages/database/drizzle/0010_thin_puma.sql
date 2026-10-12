CREATE TABLE "title_external_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"external_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "title_external_ids" ADD CONSTRAINT "title_external_ids_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "title_external_ids_provider_external_uq" ON "title_external_ids" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "title_external_ids_title_idx" ON "title_external_ids" USING btree ("title_id");