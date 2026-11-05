// The extraction manifest v1 (SPEC §10.6). Mirrors shared/src/manifest.ts (zod); this app is a separate
// package and does not import @still/shared, so keep the two shapes identical.

export type Bbox = [number, number, number, number];

export type ManifestSegment = {
  id: string; // "s004"
  page: number;
  bbox: Bbox | null;
  text: string;
  font?: string | null;
  size?: number | null;
  sentences: string[];
};

// An image found in the file (SPEC §10.6 assets), or the file itself when it is a picture (FILE). Its bytes are
// uploaded next to the manifest under `object`.
export type ManifestAsset = {
  id: string; // "a01"
  kind: "EMBEDDED" | "FILE";
  object: string; // "assets/a01.jpg"
  display: string;
  format: string;
  pixels: [number, number];
  sha256: string;
  placements: { page: number; bbox: Bbox }[];
};

export type Manifest = {
  version: 1;
  document: { documentId: string; sha256: string; mediaType: string; pages: number };
  extractor: { name: string; version: string };
  pages: { page: number; size: [number, number]; render?: string | null }[];
  segments: ManifestSegment[];
  assets: ManifestAsset[];
  modelInputs: never[];
  warnings: { code: string; segment?: string }[];
};

export type ExtractContext = { documentId: string; sha256: string };

// What extraction produces: the manifest and the files it names (the extracted images), to upload with it.
export type Extraction = { manifest: Manifest; files: { name: string; blob: Blob }[] };

// A segment before it has an id: `finish` numbers them in reading order.
export type RawSegment = Omit<ManifestSegment, "id" | "sentences">;

const EXTRACTOR = { name: "console-extract", version: "1" };

// Whitespace runs become one space; control characters count as whitespace (some PDF fonts map their space glyph
// to U+0001). A segment's sentences are joined with single spaces (SPEC §10.6 검증), so this is the one change made
// to the text besides rejoining hyphenated line breaks (SPEC §9.4 추출).
export const normaliseSpaces = (text: string) => text.replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, " ").trim();

// Splits after . ? ! or 。 followed by a space. `text` must already be normalised, so
// splitSentences(text).join(" ") === text.
export const splitSentences = (text: string) => text.split(/(?<=[.?!。]) /);

// "A L I G H T": five or more single characters separated by spaces. Reported, never fixed (SPEC §9.4 추출).
const LETTER_SPACED = /(?:^|\s)(?:\S\s){4,}\S(?:\s|$)/;

export function finish(
  context: ExtractContext,
  mediaType: string,
  pages: Manifest["pages"],
  raw: RawSegment[],
  warnings: Manifest["warnings"] = [],
  assets: ManifestAsset[] = [],
): Manifest {
  const segments = raw.map((segment, i): ManifestSegment => ({
    ...segment,
    id: `s${String(i + 1).padStart(3, "0")}`,
    sentences: splitSentences(segment.text),
  }));
  const letterSpaced = segments.filter((s) => LETTER_SPACED.test(s.text)).map((s) => ({ code: "LETTER_SPACED", segment: s.id }));
  return {
    version: 1,
    document: { ...context, mediaType, pages: pages.length },
    extractor: EXTRACTOR,
    pages,
    segments,
    assets,
    modelInputs: [],
    warnings: [...warnings, ...letterSpaced],
  };
}
