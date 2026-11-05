-- Each guide page (artwork) has its own keepsake: the card is keyed by archive and page. Cards made before pages
-- had their own keep an empty page.
ALTER TABLE "digital_keepsakes" ADD COLUMN "page" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "digital_keepsakes" DROP CONSTRAINT "digital_keepsakes_pkey";--> statement-breakpoint
ALTER TABLE "digital_keepsakes" ADD CONSTRAINT "digital_keepsakes_archive_id_page_pk" PRIMARY KEY("archive_id","page");
