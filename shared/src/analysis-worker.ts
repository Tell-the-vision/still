import { z } from "zod";
import { CONTENT_KINDS } from "./console-content";
import { SECTION_KINDS } from "./console-draft";

// The HTTP contract between the server's analysis jobs and the Cloudflare Worker that calls Gemini
// (SPEC §9.4 처리 구조 and 구조화, §10.10). The Worker never touches the database and never writes text:
// it answers with references to source segments only.
//
// Authentication (SPEC §10.10 Worker 호출): every request carries
//   X-Still-Timestamp: unix seconds
//   X-Still-Signature: hex HMAC-SHA256(ANALYSIS_WORKER_SECRET, `${timestamp}.${rawBody}`)
// and the Worker refuses anything more than 5 minutes off or with a wrong signature.

// Documents get short aliases ("d1") so references stay small in the prompt; the server maps them back
// to "{documentId}:{segmentId}" refs (shared/src/manifest.ts SOURCE_REF) when it stores contents.
const alias = z.string().regex(/^d\d+$/);
const segmentRef = z.string().regex(/^d\d+:s\d{3,}(\.\d+)?$/); // "d1:s014" or sentence "d1:s015.3"
const assetRef = z.string().regex(/^d\d+:a\d{2,}$/); // "d1:a01"

export const structureRequest = z.strictObject({
  analysisId: z.uuid(),
  chunk: z.number().int().nonnegative(),
  documents: z.array(z.strictObject({ alias, mediaType: z.string(), category: z.string().nullable() })),
  segments: z.array(
    z.strictObject({
      ref: segmentRef,
      page: z.number().int().positive(),
      text: z.string(),
      size: z.number().nullable().optional(),
      role: z.string().nullable().optional(),
      lang: z.string().nullable().optional(),
      sentences: z.number().int().positive(), // how many sentences the segment has (refs .1 … .n)
    }),
  ),
  // Presigned GET URLs of model inputs (SPEC §9.4: Gemini fetches them itself; never logged).
  images: z.array(z.strictObject({ ref: assetRef, url: z.url() })),
});

const block = z.discriminatedUnion("type", [
  z.strictObject({ type: z.enum(["heading", "paragraph", "sentence"]), refs: z.array(segmentRef).min(1) }),
  z.strictObject({ type: z.literal("image"), asset: assetRef, display: z.enum(["HERO", "GALLERY", "INLINE", "PORTRAIT"]), captionRefs: z.array(segmentRef) }),
]);

export const structureResponse = z.strictObject({
  items: z.array(
    z.strictObject({
      key: z.string().min(1), // "i1", unique within the response
      kind: z.enum(CONTENT_KINDS),
      blocks: z.array(block),
      fields: z.record(z.string(), segmentRef), // artwork fields → the segment holding the value
      // Labels the source does not contain (section or theme names) are allowed only here and are
      // flagged LABEL_GENERATED for a person to confirm (SPEC §9.4).
      label: z.string().nullable(),
    }),
  ),
  outline: z.array(z.strictObject({ section: z.enum(SECTION_KINDS), title: z.string().nullable(), items: z.array(z.string()) })),
  usage: z.strictObject({ model: z.string(), inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }),
});

export type StructureRequest = z.infer<typeof structureRequest>;
export type StructureResponse = z.infer<typeof structureResponse>;

export const WORKER_TIMESTAMP_HEADER = "x-still-timestamp";
export const WORKER_SIGNATURE_HEADER = "x-still-signature";
export const WORKER_MAX_SKEW_SECONDS = 300;
