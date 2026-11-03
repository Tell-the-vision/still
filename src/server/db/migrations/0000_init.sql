CREATE TABLE "archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exhibition_id" uuid NOT NULL,
	"last_visited_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "archives_userId_exhibitionId_unique" UNIQUE("user_id","exhibition_id"),
	CONSTRAINT "archives_id_exhibitionId_unique" UNIQUE("id","exhibition_id")
);
--> statement-breakpoint
CREATE TABLE "digital_keepsakes" (
	"archive_id" uuid PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"content_data" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exhibition_playlists" (
	"exhibition_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exhibition_playlists_provider_check" CHECK ("exhibition_playlists"."provider" IN ('APPLE_MUSIC', 'SPOTIFY')),
	CONSTRAINT "exhibition_playlists_url_check" CHECK (("exhibition_playlists"."provider" = 'SPOTIFY' AND "exhibition_playlists"."url" LIKE 'https://open.spotify.com/%') OR ("exhibition_playlists"."provider" = 'APPLE_MUSIC' AND "exhibition_playlists"."url" LIKE 'https://music.apple.com/%'))
);
--> statement-breakpoint
CREATE TABLE "exhibitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"institution_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" jsonb,
	"guide" jsonb,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"cover_image_id" uuid,
	"status" text NOT NULL,
	"ambience_enabled" boolean NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exhibitions_code_unique" UNIQUE("code"),
	CONSTRAINT "exhibitions_code_check" CHECK ("exhibitions"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "exhibitions_dates_check" CHECK ("exhibitions"."end_date" >= "exhibitions"."start_date"),
	CONSTRAINT "exhibitions_status_check" CHECK ("exhibitions"."status" IN ('DRAFT', 'PUBLISHED'))
);
--> statement-breakpoint
CREATE TABLE "guide_sentences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exhibition_id" uuid NOT NULL,
	"content" text NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guide_sentences_exhibitionId_id_unique" UNIQUE("exhibition_id","id")
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exhibition_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt_text" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "images_objectKey_unique" UNIQUE("object_key"),
	CONSTRAINT "images_exhibitionId_id_unique" UNIQUE("exhibition_id","id"),
	CONSTRAINT "images_width_check" CHECK ("images"."width" > 0),
	CONSTRAINT "images_height_check" CHECK ("images"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_code_unique" UNIQUE("code"),
	CONSTRAINT "institutions_code_check" CHECK ("institutions"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "journals" (
	"archive_id" uuid PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"audio_type" text,
	"revision" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journals_audio_type_check" CHECK ("journals"."audio_type" IN ('EXTERNAL', 'AMBIENCE', 'NONE'))
);
--> statement-breakpoint
CREATE TABLE "scraps" (
	"archive_id" uuid NOT NULL,
	"exhibition_id" uuid NOT NULL,
	"guide_sentence_id" uuid NOT NULL,
	"sentence_content_snapshot" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scraps_archive_id_guide_sentence_id_pk" PRIMARY KEY("archive_id","guide_sentence_id")
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"user_id" uuid NOT NULL,
	"terms_version" text NOT NULL,
	"privacy_version" text NOT NULL,
	"agreed_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_consents_user_id_terms_version_privacy_version_pk" PRIMARY KEY("user_id","terms_version","privacy_version")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_token_id" uuid,
	"kind" text NOT NULL,
	"token_hash" char(64) NOT NULL,
	"previous_token_hash" char(64),
	"rotated_at" timestamp (3) with time zone,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "user_sessions_kind_check" CHECK ("user_sessions"."kind" IN ('WEB', 'APP')),
	CONSTRAINT "user_sessions_previous_token_hash_app_only" CHECK ("user_sessions"."kind" = 'APP' OR "user_sessions"."previous_token_hash" IS NULL),
	CONSTRAINT "user_sessions_rotation_pair" CHECK (("user_sessions"."previous_token_hash" IS NULL) = ("user_sessions"."rotated_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"audio_mode" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_audio_mode_check" CHECK ("user_settings"."audio_mode" IN ('AUTO', 'NONE'))
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"display_name" text,
	"refresh_token_ciphertext" "bytea",
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tokens_provider_subject_unique" UNIQUE("provider","subject"),
	CONSTRAINT "user_tokens_provider_check" CHECK ("user_tokens"."provider" IN ('GOOGLE'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_code_unique" UNIQUE("code"),
	CONSTRAINT "venues_code_check" CHECK ("venues"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "archives" ADD CONSTRAINT "archives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archives" ADD CONSTRAINT "archives_exhibition_id_exhibitions_id_fk" FOREIGN KEY ("exhibition_id") REFERENCES "public"."exhibitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_keepsakes" ADD CONSTRAINT "digital_keepsakes_archive_id_archives_id_fk" FOREIGN KEY ("archive_id") REFERENCES "public"."archives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exhibition_playlists" ADD CONSTRAINT "exhibition_playlists_exhibition_id_exhibitions_id_fk" FOREIGN KEY ("exhibition_id") REFERENCES "public"."exhibitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guide_sentences" ADD CONSTRAINT "guide_sentences_exhibition_id_exhibitions_id_fk" FOREIGN KEY ("exhibition_id") REFERENCES "public"."exhibitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_exhibition_id_exhibitions_id_fk" FOREIGN KEY ("exhibition_id") REFERENCES "public"."exhibitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_archive_id_archives_id_fk" FOREIGN KEY ("archive_id") REFERENCES "public"."archives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraps" ADD CONSTRAINT "scraps_archive_id_exhibition_id_archives_id_exhibition_id_fk" FOREIGN KEY ("archive_id","exhibition_id") REFERENCES "public"."archives"("id","exhibition_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraps" ADD CONSTRAINT "scraps_exhibition_id_guide_sentence_id_guide_sentences_exhibition_id_id_fk" FOREIGN KEY ("exhibition_id","guide_sentence_id") REFERENCES "public"."guide_sentences"("exhibition_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_token_id_user_tokens_id_fk" FOREIGN KEY ("user_token_id") REFERENCES "public"."user_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archives_user_id_last_visited_at_id_index" ON "archives" USING btree ("user_id","last_visited_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "archives_exhibition_id_index" ON "archives" USING btree ("exhibition_id");--> statement-breakpoint
CREATE INDEX "guide_sentences_exhibition_id_index" ON "guide_sentences" USING btree ("exhibition_id") WHERE "guide_sentences"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "scraps_exhibition_id_guide_sentence_id_index" ON "scraps" USING btree ("exhibition_id","guide_sentence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_previous_token_hash_index" ON "user_sessions" USING btree ("previous_token_hash") WHERE "user_sessions"."previous_token_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_index" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_index" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_tokens_user_id_created_at_id_index" ON "user_tokens" USING btree ("user_id","created_at","id");