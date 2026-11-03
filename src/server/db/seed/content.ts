import type { StoredDocument } from "@still/shared/document";

export type ContentPackage = {
  institution: { code: string; name: string };
  venues: { code: string; name: string; city: string }[];
  exhibitions: {
    code: string;
    venueCode: string;
    title: string;
    description: StoredDocument | null;
    guide: StoredDocument | null;
    startDate: string;
    endDate: string;
    status: "DRAFT" | "PUBLISHED";
    ambienceEnabled: boolean;
    playlist: { provider: "APPLE_MUSIC" | "SPOTIFY"; url: string; title: string; description: string | null } | null;
    // Sentences the guide references; any other stored sentence is soft-deleted.
    sentences: { id: string; content: string }[];
    // Images are uploaded to R2; image blocks reference them by id. `cover` indexes into `images`.
    images?: { id: string; file: string; altText: string | null; width: number; height: number }[];
    cover?: number | null;
  }[];
};

const sentenceId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const guideOf = (sentences: { id: string }[]): StoredDocument => ({
  version: 1,
  blocks: [
    { type: "heading", text: "Guide" },
    ...sentences.map((s) => ({ type: "sentence" as const, sentenceId: s.id })),
  ],
});

const describe = (text: string): StoredDocument => ({ version: 1, blocks: [{ type: "paragraph", text }] });

const sentences = (first: number, ...texts: string[]) =>
  texts.map((content, i) => ({ id: sentenceId(first + i), content }));

const exhibition = (
  code: string,
  venueCode: string,
  title: string,
  texts: string[],
  first: number,
  extra: Partial<ContentPackage["exhibitions"][number]> = {},
): ContentPackage["exhibitions"][number] => {
  const list = sentences(first, ...texts);
  return {
    code, venueCode, title,
    description: describe(`About ${title}.`),
    guide: guideOf(list),
    startDate: "2026-01-01",
    endDate: "2030-12-31",
    status: "PUBLISHED",
    ambienceEnabled: true,
    playlist: null,
    sentences: list,
    ...extra,
  };
};

export const defaultPackage: ContentPackage = {
  institution: { code: "still-museum", name: "Still Museum" },
  venues: [
    { code: "seoul-hall", name: "Seoul Hall", city: "Seoul" },
    { code: "busan-gallery", name: "Busan Gallery", city: "Busan" },
  ],
  exhibitions: [
    exhibition("forms-of-stillness", "seoul-hall", "Forms of Stillness", ["A room can hold its breath.", "Stillness is attention."], 1, {
      playlist: { provider: "SPOTIFY", url: "https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ", title: "Forms of Stillness", description: null },
    }),
    exhibition("quiet-rooms", "busan-gallery", "Quiet Rooms", ["Quiet is the space between things."], 3),
    exhibition("past-light", "busan-gallery", "Past Light", ["Light remembers the room."], 5, {
      startDate: "2025-01-01", endDate: "2025-06-30",
    }),
    exhibition("draft-preview", "seoul-hall", "Draft Preview", ["Not yet open."], 4, {
      startDate: "2027-01-01", endDate: "2027-12-31", status: "DRAFT", ambienceEnabled: false,
    }),
  ],
};
