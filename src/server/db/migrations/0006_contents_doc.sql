ALTER TABLE "contents" ALTER COLUMN "blocks" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "doc" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "sources" jsonb DEFAULT '{}'::jsonb NOT NULL;