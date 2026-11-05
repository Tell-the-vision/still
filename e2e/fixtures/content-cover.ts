import type { ContentPackage } from "../../src/server/db/seed/content";

const imageId = "00000000-0000-4000-9000-000000000001";

const pkg: ContentPackage = {
  institution: { code: "STILL-MUSEUM", name: "Still Museum" },
  venues: [{ code: "seoul-hall", name: "Seoul Hall", city: "Seoul" }],
  exhibitions: [
    {
      code: "with-cover",
      venueCode: "seoul-hall",
      title: "With Cover",
      description: { version: 1, blocks: [{ type: "image", imageId }] },
      guide: null,
      startDate: "2026-01-01",
      endDate: "2030-12-31",
      state: "PUBLISHED",
      ambienceEnabled: false,
      playlist: null,
      sentences: [],
      images: [{ id: imageId, file: "e2e/fixtures/cover.png", altText: "Test cover", width: 4, height: 3 }],
      cover: 0,
    },
  ],
};

export default pkg;
