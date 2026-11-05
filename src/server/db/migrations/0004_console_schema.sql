CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exhibition_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"blocks" jsonb NOT NULL,
	"fields" jsonb,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"editorial_note" text,
	"revision" uuid DEFAULT gen_random_uuid() NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contents_exhibitionId_id_unique" UNIQUE("exhibition_id","id"),
	CONSTRAINT "contents_kind_check" CHECK ("contents"."kind" IN ('INTRODUCTION', 'ARTIST', 'CURATOR_STATEMENT', 'THEME', 'ARTWORK', 'GALLERY_SECTION', 'AUDIO_NARRATION', 'PRESS_EXCERPT', 'CLOSING', 'OTHER')),
	CONSTRAINT "contents_status_check" CHECK ("contents"."status" IN ('READY', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED')),
	CONSTRAINT "contents_approved_check" CHECK (("contents"."status" = 'APPROVED') = ("contents"."approved_at" IS NOT NULL)),
	CONSTRAINT "contents_approved_by_check" CHECK ("contents"."approved_at" IS NOT NULL OR "contents"."approved_by" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exhibition_id" uuid NOT NULL,
	"parent_id" uuid,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"sha256" char(64) NOT NULL,
	"category" text,
	"status" text NOT NULL,
	"error_code" text,
	"duplicate_of_id" uuid,
	"manifest_object_key" text,
	"analyzed_at" timestamp (3) with time zone,
	"uploaded_by" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_objectKey_unique" UNIQUE("object_key"),
	CONSTRAINT "documents_exhibitionId_id_unique" UNIQUE("exhibition_id","id"),
	CONSTRAINT "documents_byte_size_check" CHECK ("documents"."byte_size" > 0),
	CONSTRAINT "documents_category_check" CHECK ("documents"."category" IN ('EXHIBITION_TEXT', 'ARTWORK_LIST', 'WALL_LABELS', 'AUDIO_SCRIPT', 'PRESS_KIT', 'IMAGE', 'OTHER')),
	CONSTRAINT "documents_status_check" CHECK ("documents"."status" IN ('UPLOADING', 'STORED', 'EXTRACTED', 'FAILED', 'DUPLICATE')),
	CONSTRAINT "documents_error_code_check" CHECK ("documents"."error_code" IN ('UNSUPPORTED_FORMAT', 'ENCRYPTED', 'CORRUPTED', 'ENCODING_UNKNOWN', 'EMPTY', 'MANIFEST_INVALID')),
	CONSTRAINT "documents_failed_error_check" CHECK (("documents"."status" = 'FAILED') = ("documents"."error_code" IS NOT NULL)),
	CONSTRAINT "documents_duplicate_check" CHECK (("documents"."status" = 'DUPLICATE') = ("documents"."duplicate_of_id" IS NOT NULL)),
	CONSTRAINT "documents_extracted_manifest_check" CHECK (("documents"."status" = 'EXTRACTED') = ("documents"."manifest_object_key" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "exhibitions" ALTER COLUMN "venue_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exhibitions" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exhibitions" ALTER COLUMN "end_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exhibitions" ALTER COLUMN "ambience_enabled" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "object_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "subtitle" text;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "first_published_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "draft" jsonb;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "draft_revision" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "analysis" jsonb;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "published_revision" uuid;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "published_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "published_by" uuid;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "rights_statement_version" text;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "credit" text;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "manifest_asset_id" text;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "rights" text;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "verification" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "created_by_institution_id" uuid;--> statement-breakpoint
-- Backfill rows that already exist (production has them), then tighten the temporarily nullable columns.
UPDATE "exhibitions" SET "state" = "status";--> statement-breakpoint
UPDATE "exhibitions" SET
	"first_published_at" = "created_at",
	"published_at" = "updated_at",
	"published_revision" = "draft_revision"
WHERE "state" = 'PUBLISHED';--> statement-breakpoint
UPDATE "exhibitions" SET "draft" = jsonb_build_object(
	'version', 1,
	'title', "title",
	'subtitle', NULL,
	'venueId', "venue_id",
	'startDate', "start_date",
	'endDate', "end_date",
	'coverImageId', "cover_image_id",
	'ambienceEnabled', "ambience_enabled",
	'playlist', (
		SELECT jsonb_build_object('provider', p."provider", 'url', p."url", 'title', p."title", 'description', p."description")
		FROM "exhibition_playlists" p WHERE p."exhibition_id" = "exhibitions"."id"
	),
	'sections', '[]'::jsonb
);--> statement-breakpoint
-- Operator-imported images are already public.
UPDATE "images" SET "rights" = 'CONFIRMED', "verification" = 'NOT_APPLICABLE';--> statement-breakpoint
ALTER TABLE "exhibitions" ALTER COLUMN "state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exhibitions" ALTER COLUMN "draft" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "rights" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "verification" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_exhibition_id_exhibitions_id_fk" FOREIGN KEY ("exhibition_id") REFERENCES "public"."exhibitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_exhibition_id_exhibitions_id_fk" FOREIGN KEY ("exhibition_id") REFERENCES "public"."exhibitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_fk" FOREIGN KEY ("exhibition_id","parent_id") REFERENCES "public"."documents"("exhibition_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_duplicate_of_fk" FOREIGN KEY ("exhibition_id","duplicate_of_id") REFERENCES "public"."documents"("exhibition_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contents_exhibition_id_status_index" ON "contents" USING btree ("exhibition_id","status");--> statement-breakpoint
CREATE INDEX "documents_exhibition_id_sha256_index" ON "documents" USING btree ("exhibition_id","sha256");--> statement-breakpoint
ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_document_fk" FOREIGN KEY ("exhibition_id","document_id") REFERENCES "public"."documents"("exhibition_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_created_by_institution_id_institutions_id_fk" FOREIGN KEY ("created_by_institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exhibitions_state_start_date_index" ON "exhibitions" USING btree ("state","start_date");--> statement-breakpoint
CREATE INDEX "exhibitions_institution_id_state_index" ON "exhibitions" USING btree ("institution_id","state");--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_documentId_manifestAssetId_unique" UNIQUE("document_id","manifest_asset_id");--> statement-breakpoint
ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_state_check" CHECK ("exhibitions"."state" IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED'));--> statement-breakpoint
ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_published_fields_check" CHECK ("exhibitions"."state" = 'DRAFT' OR ("exhibitions"."venue_id" IS NOT NULL AND "exhibitions"."start_date" IS NOT NULL AND "exhibitions"."end_date" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_first_published_check" CHECK (("exhibitions"."state" = 'DRAFT') = ("exhibitions"."first_published_at" IS NULL));--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_rights_check" CHECK ("images"."rights" IN ('UNCONFIRMED', 'CONFIRMED', 'RESTRICTED'));--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_verification_check" CHECK ("images"."verification" IN ('UNVERIFIED', 'VERIFIED', 'MISMATCH', 'NOT_APPLICABLE'));--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_manifest_pair_check" CHECK (("images"."document_id" IS NULL) = ("images"."manifest_asset_id" IS NULL));--> statement-breakpoint
-- SPEC §10.1: the code may change only until the first publication.
CREATE FUNCTION "exhibitions_code_immutable"() RETURNS trigger AS $$
BEGIN
	IF OLD."first_published_at" IS NOT NULL AND NEW."code" IS DISTINCT FROM OLD."code" THEN
		RAISE EXCEPTION 'exhibition code is immutable after first publication' USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "exhibitions_code_immutable" BEFORE UPDATE OF "code" ON "exhibitions"
FOR EACH ROW EXECUTE FUNCTION "exhibitions_code_immutable"();
