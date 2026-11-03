import type { ContentPackage } from "../content";

// Builds one exhibition from a designer board on the Figma page "04 — Demo Assets".
// The images are original STILL graphics rendered from that board, not artwork photographs.
type Board = {
  code: string;
  venueCode: string;
  title: string;
  about: string;
  startDate: string;
  endDate: string;
  // The five "Sentences to keep" cards, in board order.
  sentences: string[];
  coverAlt: string;
  detailAlt: string;
  // First id in this exhibition's id block, e.g. 2100.
  idBase: number;
};

const uuid = (group: "8000" | "a000", n: number) => `00000000-0000-4000-${group}-${String(n).padStart(12, "0")}`;

export function exhibitionFromBoard(b: Board): ContentPackage["exhibitions"][number] {
  const sentences = b.sentences.map((content, i) => ({ id: uuid("8000", b.idBase + 1 + i), content }));
  // A changed image file needs a new id: +1 was the first, square cover; +3 is the 4:5 one.
  const coverId = uuid("a000", b.idBase + 3);
  const detailId = uuid("a000", b.idBase + 2);
  const images = `src/server/db/seed/figma-demo/images/${b.code}`;
  return {
    code: b.code,
    venueCode: b.venueCode,
    title: b.title,
    description: { version: 1, blocks: [{ type: "paragraph", text: b.about }] },
    guide: {
      version: 1,
      blocks: [
        { type: "heading", text: "Sentences to Keep" },
        { type: "image", imageId: detailId },
        ...sentences.map((s) => ({ type: "sentence" as const, sentenceId: s.id })),
      ],
    },
    startDate: b.startDate,
    endDate: b.endDate,
    status: "PUBLISHED",
    ambienceEnabled: true,
    // The boards name a playlist but have no link yet.
    playlist: null,
    sentences,
    images: [
      { id: coverId, file: `${images}/cover.webp`, altText: b.coverAlt, width: 1200, height: 1500 },
      { id: detailId, file: `${images}/detail-1.webp`, altText: b.detailAlt, width: 1032, height: 990 },
    ],
    cover: 0,
  };
}
