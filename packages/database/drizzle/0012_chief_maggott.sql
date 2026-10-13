CREATE TYPE "public"."moderation_action" AS ENUM('SOURCE_CREATED', 'SOURCE_UPDATED', 'SOURCE_DEPRECATED', 'SOURCE_RESTORED', 'SOURCE_DELETED', 'ROLE_GRANTED', 'ROLE_REVOKED', 'REPORT_RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."source_check_trigger" AS ENUM('MANUAL', 'SCHEDULED', 'REPORT');--> statement-breakpoint
CREATE TYPE "public"."source_extractor_status" AS ENUM('SUPPORTED', 'AWAITING_EXTRACTOR', 'UNSUPPORTED');--> statement-breakpoint
CREATE TYPE "public"."source_failure_category" AS ENUM('NONE', 'TIMEOUT', 'DNS', 'TLS', 'HTTP_4XX', 'HTTP_5XX', 'BLOCKED', 'TOO_MANY_REDIRECTS', 'PARSE_MISMATCH', 'UNSAFE_TARGET', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."source_report_kind" AS ENUM('WORKING', 'NOT_WORKING', 'MISMATCH', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('WORKING', 'DEGRADED', 'BROKEN', 'UNVERIFIED');--> statement-breakpoint
CREATE TYPE "public"."source_visibility" AS ENUM('PUBLIC', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'MODERATOR', 'ADMIN');--> statement-breakpoint
CREATE TABLE "moderation_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" "moderation_action" NOT NULL,
	"source_id" uuid,
	"target_user_id" uuid,
	"reason" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"reachable" boolean NOT NULL,
	"extract_ok" boolean NOT NULL,
	"failure_category" "source_failure_category" DEFAULT 'NONE' NOT NULL,
	"http_status" integer,
	"latency_ms" integer,
	"trigger" "source_check_trigger" DEFAULT 'MANUAL' NOT NULL,
	"checked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"user_id" uuid,
	"kind" "source_report_kind" NOT NULL,
	"note" varchar(1000),
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(253) NOT NULL,
	"name" varchar(160) NOT NULL,
	"homepage_url" text NOT NULL,
	"content_types" "media_type"[] DEFAULT '{}'::media_type[] NOT NULL,
	"extractor_key" varchar(80),
	"extractor_status" "source_extractor_status" DEFAULT 'AWAITING_EXTRACTOR' NOT NULL,
	"status" "source_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"visibility" "source_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_failure_category" "source_failure_category" DEFAULT 'NONE' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'USER' NOT NULL;--> statement-breakpoint
ALTER TABLE "moderation_audit_log" ADD CONSTRAINT "moderation_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_audit_log" ADD CONSTRAINT "moderation_audit_log_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_audit_log" ADD CONSTRAINT "moderation_audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_checks" ADD CONSTRAINT "source_checks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_checks" ADD CONSTRAINT "source_checks_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_links" ADD CONSTRAINT "source_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_links" ADD CONSTRAINT "source_links_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_reports" ADD CONSTRAINT "source_reports_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_reports" ADD CONSTRAINT "source_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_reports" ADD CONSTRAINT "source_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moderation_audit_log_created_idx" ON "moderation_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "moderation_audit_log_source_idx" ON "moderation_audit_log" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "moderation_audit_log_actor_idx" ON "moderation_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "source_checks_source_idx" ON "source_checks" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_links_user_source_uq" ON "source_links" USING btree ("user_id","source_id");--> statement-breakpoint
CREATE INDEX "source_links_user_idx" ON "source_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "source_links_source_idx" ON "source_links" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "source_reports_source_idx" ON "source_reports" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE INDEX "source_reports_resolved_idx" ON "source_reports" USING btree ("resolved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_domain_uq" ON "sources" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "sources_status_idx" ON "sources" USING btree ("status","visibility");--> statement-breakpoint
CREATE INDEX "sources_created_by_idx" ON "sources" USING btree ("created_by");