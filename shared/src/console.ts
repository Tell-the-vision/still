import { z } from "zod";
import { codeSchema } from "./code";
import { CONTENT_KINDS } from "./console-content";
import { contentSources, stillDoc } from "./still-doc";
import { exhibitionDraft } from "./console-draft";

// Institution console inputs (SPEC §9.5 console.*). Exhibitions are identified by `code`; the
// institution always comes from the session, never from input (SPEC §9.2 권한).

const exhibitionCode = z.object({ code: codeSchema });
const page = { cursor: z.string().nullish(), limit: z.number().int().min(1).max(50).default(20) };

// Exhibitions (SPEC §9.4 전시 초안, 목록)
export const CONSOLE_EXHIBITION_STATES = ["DRAFT", "PUBLISHED", "UNPUBLISHED"] as const;
export const consoleExhibitionListInput = z.object({
  q: z.string().trim().max(100).optional(), // title or venue, case-insensitive
  state: z.enum(CONSOLE_EXHIBITION_STATES).optional(),
  ...page,
});
export const consoleExhibitionGetInput = exhibitionCode;
export const consoleExhibitionCreateInput = z.object({ code: codeSchema, title: z.string().trim().min(1).max(200) });
export const consoleExhibitionDeleteInput = exhibitionCode;
// The opaque list cursor is base64url JSON of the last item's sort key (as archive.list).
export const consoleExhibitionCursor = z.object({ updatedAt: z.iso.datetime(), id: z.uuid() });

// Draft (SPEC §10.9): every write names the revision it was based on.
export const consoleDraftGetInput = exhibitionCode;
export const consoleDraftUpdateInput = z.object({ code: codeSchema, revision: z.uuid(), draft: exhibitionDraft });

// Venues (SPEC §9.4 전시 초안: shared between institutions, edited only by their creator)
export const consoleVenueListInput = z.object({ q: z.string().trim().max(100).optional() });
export const consoleVenueCreateInput = z.object({ name: z.string().trim().min(1).max(200), city: z.string().trim().min(1).max(100) });
export const consoleVenueUpdateInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(100).optional(),
});

// Documents (SPEC §9.4 업로드, §10.6)
export const DOCUMENT_CATEGORIES = ["EXHIBITION_TEXT", "ARTWORK_LIST", "WALL_LABELS", "AUDIO_SCRIPT", "PRESS_KIT", "IMAGE", "OTHER"] as const;
export const DOCUMENT_FAILURES = ["UNSUPPORTED_FORMAT", "ENCRYPTED", "CORRUPTED", "ENCODING_UNKNOWN", "EMPTY"] as const;
// SPEC §9.4 업로드: the accepted formats and the per-file limit. ZIP is accepted by the SPEC but needs
// browser-side unpacking that does not exist yet, so it is refused as unsupported for now.
export const DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;
export const DOCUMENT_FORMATS = [
  { ext: "pdf", mediaType: "application/pdf" },
  { ext: "docx", mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { ext: "xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { ext: "pptx", mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  { ext: "txt", mediaType: "text/plain" },
  { ext: "jpg", mediaType: "image/jpeg" },
  { ext: "png", mediaType: "image/png" },
  { ext: "tiff", mediaType: "image/tiff" },
  { ext: "webp", mediaType: "image/webp" },
] as const;
export const consoleDocumentCreateInput = z.union([
  z.object({
    code: codeSchema,
    name: z.string().trim().min(1).max(255),
    mediaType: z.string().min(1).max(200),
    byteSize: z.number().int().positive(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    category: z.enum(DOCUMENT_CATEGORIES).optional(),
  }),
  // Pasted text is stored as one TXT original and is STORED at once.
  z.object({ code: codeSchema, text: z.string().min(1).max(1_000_000), name: z.string().trim().min(1).max(255).optional(), category: z.enum(DOCUMENT_CATEGORIES).optional() }),
]);
export const consoleDocumentUpdateInput = z.object({
  id: z.uuid(),
  uploaded: z.literal(true).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).nullable().optional(),
  failed: z.enum(DOCUMENT_FAILURES).optional(),
  manifestKey: z.string().min(1).max(600).optional(), // {institutionId}/{exhibitionId}/{documentId}/manifest.v{n}.json
});
// SPEC §9.5 console.documentUpload.create: each name is relative to the document's prefix (the server rejects
// anything but the extraction outputs); size and sha256 describe the file the browser is about to PUT.
export const consoleDocumentUploadCreateInput = z.object({
  documentId: z.uuid(),
  files: z.array(z.object({ name: z.string().min(1).max(300), size: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/) })).min(1).max(500),
});
export const consoleDocumentListInput = exhibitionCode;
export const consoleDocumentGetInput = z.object({ id: z.uuid() });
export const consoleDocumentDeleteInput = z.object({ id: z.uuid() });

// Contents (SPEC §9.4 검토, §10.8)
export const consoleContentListInput = exhibitionCode;
export const consoleContentGetInput = z.object({ id: z.uuid() });
export const consoleContentCreateInput = z.object({
  code: codeSchema,
  kind: z.enum(CONTENT_KINDS),
  doc: stillDoc,
  sources: contentSources.optional(),
  fields: z.record(z.string(), z.unknown()).nullable().optional(),
  editorialNote: z.string().max(10_000).nullable().optional(),
});
export const consoleContentUpdateInput = z.object({
  id: z.uuid(),
  revision: z.uuid(),
  status: z.enum(["APPROVED", "REJECTED"]).optional(),
  kind: z.enum(CONTENT_KINDS).optional(),
  doc: stillDoc.optional(),
  sources: contentSources.optional(),
  fields: z.record(z.string(), z.unknown()).nullable().optional(),
  editorialNote: z.string().max(10_000).nullable().optional(),
});
export const consoleContentDeleteInput = z.object({ id: z.uuid() });
export const consoleContentBatchUpdateInput = z.object({
  code: codeSchema,
  status: z.literal("APPROVED"),
  where: z.object({ status: z.literal("READY") }),
});

// Suggestions (SPEC §9.4 편집 제안, §9.5 console.suggestion.*)
export const consoleSuggestionListInput = exhibitionCode;
export const consoleSuggestionUpdateInput = z.object({
  contentId: z.uuid().optional(),
  id: z.string().min(1).max(100),
  status: z.enum(["ACCEPTED", "DISMISSED"]),
  revision: z.uuid(),
});

// Preview and publication (SPEC §9.4 미리보기와 발행 점검, §10.9)
export const consolePreviewGetInput = exhibitionCode;
export const consolePublicationCreateInput = z.object({
  code: codeSchema,
  revision: z.uuid(),
  // `false` is accepted so that the server answers RIGHTS_NOT_CONFIRMED (SPEC §11.2), not a validation error.
  rightsConfirmed: z.boolean(),
  rightsStatementVersion: z.string().min(1).max(50),
});
export const consolePublicationDeleteInput = exhibitionCode;

// Analysis (SPEC §9.4 진행 표시): only the read side exists until pg-boss and the Worker land.
export const consoleAnalysisGetInput = exhibitionCode;
