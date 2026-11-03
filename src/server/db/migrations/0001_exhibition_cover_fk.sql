ALTER TABLE "exhibitions" ADD CONSTRAINT "exhibitions_cover_image_fk" FOREIGN KEY ("id", "cover_image_id") REFERENCES "images" ("exhibition_id", "id") ON DELETE SET NULL ("cover_image_id");
