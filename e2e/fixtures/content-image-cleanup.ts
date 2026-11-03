import type { ContentPackage } from "../../src/server/db/seed/content";

export const coverId = "00000000-0000-4000-9000-0000000000a1";
export const detailId = "00000000-0000-4000-9000-0000000000a2";

const pkg: ContentPackage = {
  institution: { code: "still-museum", name: "Still Museum" },
  venues: [{ code: "seoul-hall", name: "Seoul Hall", city: "Seoul" }],
  exhibitions: [
    {
      code: "image-cleanup",
      venueCode: "seoul-hall",
      title: "Image Cleanup",
      description: { version: 1, blocks: [{ type: "image", imageId: detailId }] },
      guide: null,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "PUBLISHED",
      ambienceEnabled: false,
      playlist: null,
      sentences: [],
      images: [
        { id: coverId, file: "e2e/fixtures/cover.png", altText: "Cleanup cover", width: 4, height: 3 },
        { id: detailId, file: "e2e/fixtures/detail.png", altText: "Detail", width: 1, height: 1 },
      ],
      cover: 0,
    },
  ],
};

export default pkg;
