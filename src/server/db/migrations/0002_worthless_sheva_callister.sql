ALTER TABLE "scraps" DROP CONSTRAINT "scraps_exhibition_id_guide_sentence_id_guide_sentences_exhibition_id_id_fk";
--> statement-breakpoint
DROP INDEX "archives_user_id_last_visited_at_id_index";--> statement-breakpoint
ALTER TABLE "scraps" ADD CONSTRAINT "scraps_sentence_fk" FOREIGN KEY ("exhibition_id","guide_sentence_id") REFERENCES "public"."guide_sentences"("exhibition_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archives_user_id_last_visited_at_id_index" ON "archives" USING btree ("user_id","last_visited_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);