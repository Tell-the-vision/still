ALTER TABLE "institutions" DROP CONSTRAINT "institutions_code_check";--> statement-breakpoint
ALTER TABLE "user_tokens" DROP CONSTRAINT "user_tokens_provider_check";--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "analysis_daily_token_limit" bigint;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD COLUMN "failed_login_count" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD COLUMN "locked_until" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD COLUMN "last_login_at" timestamp (3) with time zone;--> statement-breakpoint
-- Existing users are visitors (Google sign-in); new rows always name their role.
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'VISITOR' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "institution_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_institution_id_index" ON "users" USING btree ("institution_id");--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_status_check" CHECK ("institutions"."status" IN ('ACTIVE', 'SUSPENDED'));--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_analysis_daily_token_limit_check" CHECK ("institutions"."analysis_daily_token_limit" > 0);--> statement-breakpoint
-- Institution codes become the uppercase institution ID (SPEC §10.3).
UPDATE "institutions" SET "code" = upper("code");--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_code_check" CHECK ("institutions"."code" ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_password_hash_check" CHECK (("user_tokens"."provider" = 'PASSWORD') = ("user_tokens"."password_hash" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_refresh_token_google_only" CHECK ("user_tokens"."provider" = 'GOOGLE' OR "user_tokens"."refresh_token_ciphertext" IS NULL);--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_password_subject_check" CHECK ("user_tokens"."provider" <> 'PASSWORD' OR ("user_tokens"."subject" = lower("user_tokens"."subject") AND "user_tokens"."subject" ~ '^[^@\s]+@[^@\s]+$'));--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_provider_check" CHECK ("user_tokens"."provider" IN ('GOOGLE', 'PASSWORD'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('VISITOR', 'INSTITUTION', 'ADMIN'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_check" CHECK ("users"."status" IN ('ACTIVE', 'SUSPENDED'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_role_check" CHECK (("users"."role" = 'INSTITUTION') = ("users"."institution_id" IS NOT NULL));