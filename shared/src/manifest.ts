import { z } from "zod";

// The extraction manifest (SPEC §10.6): the only contract between the browser extraction module and
// the server. One JSON object per document version, stored in the private bucket under the document's
// prefix as manifest.v{n}.json. Text is the source text as is; the extractor only rejoins words split
// by line breaks (SPEC §9.4 추출). Suspicious spans are reported in `warnings`, never fixed.

const key = z.string().min(1).max(500); // relative to the document prefix, e.g. "pages/p001.png"

export const manifestSegment = z.strictObject({
  id: z.string().regex(/^s\d{3,}$/), // "s004"
  page: z.number().int().positive(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
  text: z.string().min(1),
  font: z.string().nullable().optional(),
  size: z.number().positive().nullable().optional(),
  lang: z.string().nullable().optional(),
  role: z.string().nullable().optional(), // extractor's hint only (SPEC §9.4)
  overAsset: z.string().nullable().optional(),
  // Joined with single spaces they must equal `text` (SPEC §10.6 검증).
  sentences: z.array(z.string().min(1)).min(1),
});

export const manifestAsset = z.strictObject({
  id: z.string().regex(/^a\d{2,}$/), // "a01"
  kind: z.enum(["EMBEDDED", "PAGE_IMAGE", "FILE"]),
  object: key,
  display: key,
  format: z.string(),
  pixels: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  colorSpace: z.string().nullable().optional(),
  icc: z.boolean().optional(),
  sourceRange: z.strictObject({ offset: z.number().int().nonnegative(), length: z.number().int().positive() }).nullable().optional(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  placements: z.array(z.strictObject({ page: z.number().int().positive(), bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]) })),
  variantOf: z.string().nullable().optional(),
});

export const manifest = z.strictObject({
  version: z.literal(1),
  document: z.strictObject({
    documentId: z.uuid(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    mediaType: z.string().min(1),
    pages: z.number().int().nonnegative(),
  }),
  extractor: z.strictObject({ name: z.string().min(1), version: z.string().min(1) }),
  // `render` is optional until page renders are produced (needed for 원본 쪽 보기 and OCR, SPEC §9.4).
  pages: z.array(z.strictObject({ page: z.number().int().positive(), size: z.tuple([z.number(), z.number()]), render: key.nullable().optional() })),
  segments: z.array(manifestSegment),
  assets: z.array(manifestAsset),
  modelInputs: z.array(z.strictObject({ key, page: z.number().int().positive().nullable().optional(), bytes: z.number().int().positive() })),
  warnings: z.array(z.strictObject({ code: z.string().min(1), segment: z.string().optional() })),
});

export type Manifest = z.infer<typeof manifest>;
export type ManifestSegment = z.infer<typeof manifestSegment>;

// A source reference (SPEC §10.6 참조): "{documentId}:{segmentId}" or "{documentId}:{segmentId}.{sentenceNo}"
// (sentence numbers start at 1).
export const SOURCE_REF = /^([0-9a-f-]{36}):(s\d{3,})(?:\.(\d+))?$/;
