import type { ContentPackage } from "../../src/server/db/seed/content";

const pkg: ContentPackage = {
  institution: { code: "STILL-MUSEUM", name: "Still Museum" },
  venues: [{ code: "seoul-hall", name: "Seoul Hall", city: "Seoul" }],
  exhibitions: [
    {
      code: "status-flip",
      venueCode: "seoul-hall",
      title: "Status Flip",
      description: { version: 1, blocks: [] },
      guide: null,
      startDate: "2026-01-01",
      endDate: "2030-12-31",
      status: "PUBLISHED",
      ambienceEnabled: false,
      playlist: null,
      sentences: [],
    },
  ],
};

export default pkg;
