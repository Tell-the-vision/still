import type { ContentPackage } from "../../src/server/db/seed/content";

export const removedSentence = { id: "00000000-0000-4000-8000-000000000901", content: "This line will be removed." };
export const keptSentence = { id: "00000000-0000-4000-8000-000000000902", content: "This line stays." };

export const softDeleteExhibition = (sentences: { id: string; content: string }[]): ContentPackage["exhibitions"][number] => ({
  code: "soft-delete",
  venueCode: "seoul-hall",
  title: "Soft Delete",
  description: { version: 1, blocks: [] },
  guide: { version: 1, blocks: sentences.map((s) => ({ type: "sentence" as const, sentenceId: s.id })) },
  startDate: "2026-01-01",
  endDate: "2030-12-31",
  state: "PUBLISHED",
  ambienceEnabled: false,
  playlist: null,
  sentences,
});

const pkg: ContentPackage = {
  institution: { code: "STILL-MUSEUM", name: "Still Museum" },
  venues: [{ code: "seoul-hall", name: "Seoul Hall", city: "Seoul" }],
  exhibitions: [softDeleteExhibition([removedSentence, keptSentence])],
};

export default pkg;
