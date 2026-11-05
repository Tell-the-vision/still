// InstitutionsApi over the still server (Next.js, tRPC at /api/trpc, no transformer = plain JSON).
// Calls with a full path ("console.session.create", "me.get") use the SPEC procedures (console.*, SPEC §9.5);
// bare names ("listFiles") still point at the draft `institutions` router from API.md until they move over.
import { ApiError } from "./errors";
import { RIGHTS_STATEMENT_VERSION, UPLOAD_FORMATS } from "../constants";
import { extractManifest } from "../extract";
import type { ContentItem, Exhibition, Guide, GuideSection, InstitutionsApi, MediaAsset, Me, ProcessingEvent, PublicationCheck, SectionKind, SourceFile, UploadOptions, Workspace } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

// Every call is a POST, queries included (the server allows method override): cookie requests must carry
// Origin (SPEC §2.3), which browsers leave out of same-origin GETs. `x-client: console` makes shared
// procedures (me.get, session.delete) use the institution console session.
async function call<T>(path: string, input?: unknown): Promise<T> {
  const url = `${BASE}/api/trpc/${path.includes(".") ? path : `institutions.${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-client": "console" },
    body: JSON.stringify(input ?? null),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    const err = body?.error;
    throw new ApiError(err?.message ?? `HTTP ${res.status}`, err?.data?.code, err?.data?.appCode);
  }
  return body.result.data as T;
}

// q for queries, m for mutations: the same request, named for what the screen does.
const q = <T,>(path: string, input?: unknown) => call<T>(path, input);
const m = <T,>(path: string, input?: unknown) => call<T>(path, input);

// me.get for institution staff (SPEC §9.5).
type StaffMe = {
  id: string;
  displayName: string | null;
  email: string;
  institution: { id: string; code: string; name: string };
  mustChangePassword: boolean;
};
// Accounts in one institution have no permission differences (SPEC §9.2, 미결정 26), so everyone
// gets the full workspace. The header shows the account name instead of a role (REVIEW §7-12).
const toMe = (me: StaffMe): Me => ({ id: me.id, name: me.displayName ?? me.email, email: me.email, role: "INSTITUTION_ADMIN", canPublish: true, mustChangePassword: me.mustChangePassword });
const toWorkspace = (me: StaffMe): Workspace => ({ institutionName: me.institution.name, institutionId: me.institution.code, role: me.displayName ?? me.email });

// console.preview.get checks (src/server/services/console/preview.ts, SPEC §9.4 미리보기와 발행 점검).
// A warning does not block publication, but the screen shows it like a check that needs attention.
type ConsoleCheck = { id: string; title: string; ok: boolean; warning: boolean; detail: string };
const toPublicationChecks = (checks: ConsoleCheck[]): PublicationCheck[] =>
  checks.map(({ id, title, ok, warning, detail }) => ({ id, title, detail, ok: ok && !warning, value: ok && !warning ? "Ready" : "Needs check" }));

// console.exhibition.* rows (src/server/services/console/exhibition-rows.ts, SPEC §9.4 목록).
export type ConsoleExhibitionRow = {
  id: string;
  code: string;
  state: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  displayStatus: "DRAFT" | "UNPUBLISHED" | "SCHEDULED" | "LIVE" | "ENDED";
  title: string;
  subtitle: string | null;
  venue: { id: string; name: string; city: string } | null;
  startDate: string | null;
  endDate: string | null;
  draftRevision: string;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};
type Page<T> = { items: T[]; nextCursor: string | null; totalSize: number };

// Console procedures identify an exhibition by its code (SPEC §9.5), so the screens' exhibition id is the code.
export const toExhibition = (row: ConsoleExhibitionRow): Exhibition => ({
  id: row.code,
  code: row.code,
  title: row.title,
  subtitle: row.subtitle,
  venueName: row.venue?.name ?? "",
  venueId: row.venue?.id ?? null,
  startDate: row.startDate,
  endDate: row.endDate,
  status: row.state,
  updatedAt: row.updatedAt,
});

// console.content.list rows (src/server/services/console/content-rows.ts, SPEC §10.8).
type ContentKind = "INTRODUCTION" | "ARTIST" | "CURATOR_STATEMENT" | "THEME" | "ARTWORK" | "GALLERY_SECTION" | "AUDIO_NARRATION" | "PRESS_EXCERPT" | "CLOSING" | "OTHER";
type DocText = { type: "text"; text: string; marks?: { type: "scrap"; attrs: { sentenceId: string | null } }[] };
type DocParagraph = { type: "paragraph"; attrs?: { id: string }; content?: DocText[] };
type DocBlock =
  | { type: "paragraph" | "heading"; attrs: { id: string; level?: number }; content?: DocText[] }
  | { type: "blockquote"; attrs: { id: string }; content: DocParagraph[] }
  | { type: "bulletList" | "orderedList"; attrs: { id: string }; content: { type: "listItem"; content: DocParagraph[] }[] }
  | { type: "stillImage"; attrs: { id: string; imageId: string; display: string; caption: string | null } };
type ContentDoc = { type: "doc"; content: DocBlock[] };
export type ConsoleContentRow = {
  id: string;
  kind: ContentKind;
  status: "READY" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  doc: ContentDoc;
  sources: Record<string, { refs: string[]; start: number; end: number }>;
  editorialNote: string | null;
  revision: string;
  updatedAt: string;
  images: { id: string; altText: string | null; credit: string | null; rights: string; width: number; height: number }[];
};
type ConsoleFile = { id: string; name: string };

const KIND_LABELS: Record<ContentKind, string> = {
  INTRODUCTION: "Introduction",
  ARTIST: "Artist",
  CURATOR_STATEMENT: "Curator statement",
  THEME: "Theme",
  ARTWORK: "Artwork",
  GALLERY_SECTION: "Gallery section",
  AUDIO_NARRATION: "Audio narration",
  PRESS_EXCERPT: "Press excerpt",
  CLOSING: "Closing",
  OTHER: "Other",
};
const REVIEW_STATUS = { READY: "IN_REVIEW", NEEDS_REVIEW: "IN_REVIEW", APPROVED: "APPROVED", REJECTED: "REJECTED" } as const;
const USAGE_PERMISSION = { CONFIRMED: "GRANTED", RESTRICTED: "DENIED" } as const;

const plainText = (b: DocBlock) => (b.type === "paragraph" || b.type === "heading" ? (b.content ?? []).map((t) => t.text).join("") : "");

// `documents` are the exhibition's source files: a ref "{documentId}:{segmentId}" naming one of them
// gives the item its source file. Page locations need analysis manifests, which do not exist yet.
export function toContentItem(row: ConsoleContentRow, order: number, documents: ConsoleFile[]): ContentItem {
  const label = KIND_LABELS[row.kind];
  const heading = row.doc.content.find((b) => b.type === "heading");
  const texts = row.doc.content.filter((b) => b.type === "paragraph").map(plainText);
  const text = texts.join("\n\n");
  const refs = Object.values(row.sources).flatMap((s) => s.refs);
  const source = documents.find((d) => refs.some((ref) => ref.split(":")[0] === d.id));
  const assets = row.doc.content.flatMap((b): MediaAsset[] => {
    const image = b.type === "stillImage" ? row.images.find((i) => i.id === b.attrs.imageId) : undefined;
    if (!image) return [];
    return [{
      id: image.id,
      caption: image.altText ?? image.credit ?? "",
      creator: "",
      copyrightHolder: image.credit ?? "",
      imageSource: "",
      usagePermission: USAGE_PERMISSION[image.rights as keyof typeof USAGE_PERMISSION] ?? "UNKNOWN",
      usageScope: "",
      expiresOn: null,
      excluded: false,
      reviewedBy: null,
      reviewedAt: null,
    }];
  });
  const title = heading ? plainText(heading) || label : label;
  return {
    id: row.id,
    order,
    title,
    kind: label,
    summary: `${texts.length} paragraph${texts.length === 1 ? "" : "s"}`,
    itemCount: 1,
    reviewStatus: REVIEW_STATUS[row.status],
    sourceFileName: source?.name ?? "Added in the console",
    sourceLocation: "",
    heading: title,
    fieldLabel: "Text",
    doc: row.doc,
    text,
    // No analysis manifests exist yet, so there is no extracted original to compare against.
    originalText: text,
    theme: "",
    contentType: label,
    note: row.editorialNote ?? "",
    confidence: null,
    origin: "SOURCE",
    updatedBy: null,
    updatedAt: row.updatedAt,
    removed: false,
    duplicateOf: null,
    assets,
    revision: row.revision,
    needsReview: row.status === "NEEDS_REVIEW",
  };
}

// The latest row and item this tab knows per id. The adapter's write methods take only an item id, so the
// revision they must send (SPEC §10.8) comes from here; every read and write result refreshes it.
const known = new Map<string, { row: ConsoleContentRow; item: ContentItem }>();
let knownFiles: ConsoleFile[] = [];
const remember = (row: ConsoleContentRow, order: number) => {
  const item = toContentItem(row, order, knownFiles);
  known.set(row.id, { row, item });
  return item;
};
const knownItem = (itemId: string) => {
  const entry = known.get(itemId);
  if (!entry) throw new ApiError("This item is not loaded. Reload to see the latest.");
  return entry;
};

const NOT_YET = "Not available yet.";
const unavailable = async (): Promise<never> => {
  throw new ApiError(NOT_YET);
};
const CHANGED_ELSEWHERE = "This item changed elsewhere. Reload to see the latest.";

// console.content.update with the revision this tab last saw; a stale one reads as a plain sentence.
async function updateRow(itemId: string, change: Record<string, unknown>): Promise<ContentItem> {
  const { row, item } = knownItem(itemId);
  try {
    return remember(await m<ConsoleContentRow>("console.content.update", { id: itemId, revision: row.revision, ...change }), item.order);
  } catch (e) {
    if (e instanceof ApiError && e.appCode === "REVISION_MISMATCH") throw new ApiError(CHANGED_ELSEWHERE, e.code, e.appCode);
    throw e;
  }
}

// The doc with `text` spread over its paragraphs (what `text` shows). One paragraph takes the text as is;
// several take blank-line separated parts, in order, when the counts match. A paragraph whose text is
// unchanged stays as it is (node ids and scrap marks); a changed one becomes one plain text node.
function docWithText(row: ConsoleContentRow, text: string): ContentDoc {
  const count = row.doc.content.filter((b) => b.type === "paragraph").length;
  const parts = count === 1 ? [text] : text.split(/\n\s*\n/);
  if (count === 0) throw new ApiError("This item has no text to edit.");
  if (parts.length !== count) throw new ApiError(`This item has ${count} paragraphs; separate the text into ${count} parts with blank lines.`);
  let next = 0;
  return {
    ...row.doc,
    content: row.doc.content.map((b): DocBlock => {
      if (b.type !== "paragraph") return b;
      const part = parts[next++];
      if (plainText(b) === part) return b;
      return { ...b, content: part ? [{ type: "text", text: part }] : [] };
    }),
  };
}

const KIND_BY_LABEL = Object.fromEntries(Object.entries(KIND_LABELS).map(([kind, label]) => [label, kind]));

// console.analysis.get (src/server/trpc/routers/console/analysis.ts, SPEC §9.5).
export type ConsoleAnalysis = {
  analysis: { startedAt: string; result: "SUCCEEDED" | "FAILED" | "CANCELLED" | null } | null;
  documents: { total: number; uploading: number; stored: number; extracted: number; failed: number; duplicate: number };
  contents: { total: number; open: number };
  jobs: unknown[]; // pg-boss jobs; always empty until pg-boss exists
};

// The four steps of SPEC §9.4 진행 표시, derived from the counts and the analysis summary.
// `at` is only known for the analysis itself, so the other steps have none.
export function toProcessingEvents({ analysis, documents: d, contents: c }: ConsoleAnalysis): ProcessingEvent[] {
  const live = d.total - d.failed - d.duplicate;
  const classification: Pick<ProcessingEvent, "detail" | "status"> = !analysis
    ? { status: "PENDING", detail: "Analysis has not started." }
    : analysis.result === "SUCCEEDED" ? { status: "COMPLETE", detail: "Content items were extracted." }
    : analysis.result === "FAILED" ? { status: "FAILED", detail: "The analysis failed." }
    : analysis.result === "CANCELLED" ? { status: "FAILED", detail: "The analysis was cancelled." }
    : { status: "IN_PROGRESS", detail: "Analysis is running." };
  return [
    {
      id: "upload", at: null, title: "Upload",
      status: d.stored + d.extracted > 0 ? "COMPLETE" : d.uploading > 0 ? "IN_PROGRESS" : "PENDING",
      detail: `${d.total} files, ${d.uploading} uploading`,
    },
    {
      id: "extraction", at: null, title: "Text extraction",
      status: live > 0 && d.extracted === live ? "COMPLETE" : "PENDING",
      detail: `${d.extracted} of ${live} files extracted (extraction runs in the browser, which is not built yet)`,
    },
    { id: "classification", at: analysis?.startedAt ?? null, title: "Content classification", ...classification },
    {
      id: "review", at: null, title: "Curator review",
      status: c.total === 0 ? "PENDING" : c.open > 0 ? "IN_PROGRESS" : "COMPLETE",
      detail: `${c.open} of ${c.total} items need review`,
    },
  ];
}

// console.document.* rows (src/server/trpc/routers/console/document.ts, SPEC §9.4 업로드, §10.6).
type ConsoleDocument = {
  id: string;
  name: string;
  mediaType: string;
  byteSize: number;
  status: "UPLOADING" | "STORED" | "EXTRACTED" | "FAILED" | "DUPLICATE";
  errorCode: string | null;
  duplicateOfName: string | null;
  createdAt: string;
};
const FAILURE_TEXT: Record<string, string> = {
  UNSUPPORTED_FORMAT: "This format is not supported.",
  ENCRYPTED: "The file is password protected.",
  CORRUPTED: "The file could not be read or arrived incomplete.",
  ENCODING_UNKNOWN: "The text encoding could not be recognised.",
  EMPTY: "The file has no content.",
  MANIFEST_INVALID: "The extracted content could not be read.",
};
const toSourceFile = (doc: ConsoleDocument): SourceFile => ({
  id: doc.id,
  name: doc.name,
  format: (doc.name.split(".").pop() ?? "FILE").toUpperCase(),
  summary: null,
  sizeBytes: doc.byteSize,
  uploadedAt: doc.createdAt,
  status: { UPLOADING: "UPLOADING", STORED: "UPLOADED", EXTRACTED: "PROCESSED", FAILED: "FAILED", DUPLICATE: "FAILED" }[doc.status] as SourceFile["status"],
  error: doc.status === "DUPLICATE" ? `Same file as ${doc.duplicateOfName}` : doc.errorCode && (FAILURE_TEXT[doc.errorCode] ?? "The file could not be processed."),
});

const sha256Hex = async (file: Blob) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), (b) => b.toString(16).padStart(2, "0")).join("");

const abortError = () => new DOMException("Upload canceled", "AbortError");

// PUTs the file to the presigned URL. XMLHttpRequest instead of fetch: fetch cannot report upload progress.
function putFile(upload: { url: string; headers: Record<string, string> }, file: Blob, options?: UploadOptions) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload.url);
    for (const [name, value] of Object.entries(upload.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) options?.onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(`Upload failed (HTTP ${xhr.status})`)));
    xhr.onerror = () => reject(new ApiError("Upload interrupted"));
    xhr.onabort = () => reject(abortError());
    options?.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

// SPEC §9.4: hash in the browser, register the document, PUT the bytes straight to private R2, then tell the
// server it is there. The server never receives the file.
async function uploadDocument(code: string, file: File, options?: UploadOptions): Promise<SourceFile> {
  const mediaType = UPLOAD_FORMATS[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (!mediaType) throw new ApiError("This format is not supported.");
  const sha256 = await sha256Hex(file);
  if (options?.signal?.aborted) throw abortError();
  const { document, upload } = await m<{ document: ConsoleDocument; upload: { url: string; headers: Record<string, string> } }>(
    "console.document.create", { code, name: file.name, mediaType, byteSize: file.size, sha256 });
  try {
    await putFile(upload, file, options);
  } catch (e) {
    // A row that never got its bytes would sit in UPLOADING for good; a retry registers a new one.
    await removeDocument(document.id).catch(() => {});
    throw e;
  }
  const stored = toSourceFile(await m<ConsoleDocument>("console.document.update", { id: document.id, uploaded: true }));
  // A byte-for-byte duplicate comes back as DUPLICATE: there is nothing to extract.
  return stored.status === "UPLOADED" ? extractStored(stored, file, sha256, options) : stored;
}

const MANIFEST_NAME = "manifest.v1.json";

// SPEC §9.4 추출: the stored file is read in the browser, and the manifest goes to the document's prefix in R2.
// The server then validates it (SPEC §10.6) and answers with the document, EXTRACTED or FAILED. A file that
// cannot be extracted stays stored (UPLOADED) with a note on its row; it never fails the upload.
async function extractStored(stored: SourceFile, file: File, sha256: string, options?: UploadOptions): Promise<SourceFile> {
  try {
    options?.onExtracting?.();
    const manifest = await extractManifest(file, { documentId: stored.id, sha256 });
    if (!manifest) return { ...stored, note: `Text extraction for ${stored.format} is not available yet.` };
    const body = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const { uploads } = await m<{ uploads: { name: string; url: string; headers: Record<string, string> }[] }>(
      "console.documentUpload.create", { documentId: stored.id, files: [{ name: MANIFEST_NAME, size: body.size, sha256: await sha256Hex(body) }] });
    const upload = uploads.find((u) => u.name === MANIFEST_NAME);
    if (!upload) throw new ApiError("The server did not accept the manifest.");
    await putFile(upload, body);
    return toSourceFile(await m<ConsoleDocument>("console.document.update", { id: stored.id, manifestKey: MANIFEST_NAME }));
  } catch (e) {
    return { ...stored, error: `Text extraction failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// The server refuses to remove a document that reviewed content (or the cover) still uses.
async function removeDocument(id: string) {
  try {
    await m("console.document.delete", { id });
  } catch (e) {
    if (e instanceof ApiError && e.appCode === "DOCUMENT_IN_USE") throw new ApiError("This file is used by reviewed content and cannot be removed.", e.code, e.appCode);
    throw e;
  }
}

// exhibitions.draft v1 (shared/src/console-draft.ts), the part the screens edit. Fields the screens do not
// touch (cover, ambience, playlist) travel through unchanged.
type ServerDraft = {
  title: string;
  subtitle: string | null;
  venueId: string | null;
  startDate: string | null;
  endDate: string | null;
  sections: { id: string; kind: SectionKind; title: string; visible: boolean; contentIds: string[] }[];
  [untouched: string]: unknown;
};
type DraftState = { draft: ServerDraft; revision: string };

const itemCount = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

// The draft's sections as the guide screen shows them. The SPEC draft has no section introduction and no
// theme cards, so `intro` is empty and `themes` is always []: whatever the staff type in those two places
// is not saved. `summary` is derived from the items.
const toGuideSection = (s: ServerDraft["sections"][number]): GuideSection => ({
  id: s.id,
  kind: s.kind,
  title: s.title,
  visible: s.visible,
  summary: `Draft · ${itemCount(s.contentIds.length)}`,
  intro: "",
  itemIds: s.contentIds,
});
const toGuide = (draft: ServerDraft, row: ConsoleExhibitionRow): Guide => ({
  sections: draft.sections.map(toGuideSection),
  themes: [],
  // Anything not live yet (a draft never published, or an unpublished guide) can be published.
  hasUnpublishedChanges: row.state !== "PUBLISHED" || row.hasUnpublishedChanges,
});

const STALE_DRAFT = "This draft changed elsewhere. Reload to see the latest.";

// Replaces the draft the caller just read. Someone else saving in between is REVISION_MISMATCH, which
// the screens show as a plain sentence instead of the raw error.
async function writeDraft(code: string, edit: (draft: ServerDraft) => ServerDraft) {
  const { draft, revision } = await q<DraftState>("console.draft.get", { code });
  try {
    await m("console.draft.update", { code, revision, draft: edit(draft) });
  } catch (e) {
    if (e instanceof ApiError && e.appCode === "REVISION_MISMATCH") throw new ApiError(STALE_DRAFT, e.code, e.appCode);
    throw e;
  }
}

const RIGHTS_REQUIRED = "Confirm the content rights on the publish settings page before publishing.";
const PUBLISH_REVISION_CHANGED = "The draft changed while you were publishing. Check the preview and publish again.";

// The refusals of console.publication.create as plain sentences. A failed check already comes with its own sentence.
function publicationError(e: unknown) {
  if (!(e instanceof ApiError)) return e;
  if (e.appCode === "REVISION_MISMATCH") return new ApiError(PUBLISH_REVISION_CHANGED, e.code, e.appCode);
  if (e.appCode === "RIGHTS_NOT_CONFIRMED") return new ApiError(RIGHTS_REQUIRED, e.code, e.appCode);
  return e;
}

export function createTrpcApi(): InstitutionsApi {
  return {
    getWorkspace: async () => toWorkspace(await q<StaffMe>("me.get")),

    getWorkspaceSummary: () => q("getWorkspaceSummary"),
    signIn: async ({ institutionId, ...request }) => toMe(await m<StaffMe>("console.session.create", { institutionCode: institutionId, ...request })),
    getMe: async () => toMe(await q<StaffMe>("me.get")),
    updateMe: (patch) => m("updateMe", patch),
    getNotificationPrefs: () => q("getNotificationPrefs"),
    updateNotificationPrefs: (patch) => m("updateNotificationPrefs", patch),
    // Ends the console session only; a visitor sign-in in the same browser stays (SPEC §10.5).
    signOut: () => m("session.delete"),
    changePassword: (currentPassword, newPassword) => m("password.update", { currentPassword, newPassword }),
    getWorkspaceSettings: () => q("getWorkspaceSettings"),
    updateWorkspaceSettings: (patch) => m("updateWorkspaceSettings", patch),
    // Venues are shared between institutions (SPEC §9.4); the server picks the code from the name.
    listVenues: () => q("console.venue.list", {}),
    createVenue: ({ name, city }) => m("console.venue.create", { name, city }),
    listMembers: () => q("listMembers"),
    inviteMember: (email, role) => m("inviteMember", { email, role }),
    updateMember: (memberId, patch) => m("updateMember", { memberId, ...patch }),
    removeMember: (memberId) => m("removeMember", { memberId }),
    sendSupportRequest: (request) => m("sendSupportRequest", request),

    // Every page: the screens search, filter and sort the full list themselves.
    listExhibitions: async () => {
      const rows: ConsoleExhibitionRow[] = [];
      let cursor: string | null = null;
      do {
        const page: Page<ConsoleExhibitionRow> = await q("console.exhibition.list", { limit: 50, cursor });
        rows.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      return rows.map(toExhibition);
    },
    createExhibition: async (input) => toExhibition(await m<ConsoleExhibitionRow>("console.exhibition.create", input)),
    deleteExhibition: (id) => m("console.exhibition.delete", { code: id }),
    // Publication details are draft fields (SPEC §9.4 전시 초안). The code is fixed at creation.
    updateExhibition: async (id, patch) => {
      if (patch.code !== undefined && patch.code !== id) throw new ApiError("The visitor URL cannot be changed after the exhibition is created.");
      const { code: _code, ...details } = patch;
      await writeDraft(id, (draft) => ({ ...draft, ...details }));
      return toExhibition(await q<ConsoleExhibitionRow>("console.exhibition.get", { code: id }));
    },
    publishExhibition: async (id) => {
      const { draftRevision } = await q<ConsoleExhibitionRow>("console.exhibition.get", { code: id });
      try {
        await m("console.publication.create", { code: id, revision: draftRevision, rightsConfirmed: true, rightsStatementVersion: RIGHTS_STATEMENT_VERSION });
      } catch (e) {
        throw publicationError(e);
      }
      return toExhibition(await q<ConsoleExhibitionRow>("console.exhibition.get", { code: id }));
    },
    unpublishExhibition: async (id) => {
      await m("console.publication.delete", { code: id });
      return toExhibition(await q<ConsoleExhibitionRow>("console.exhibition.get", { code: id }));
    },
    duplicateExhibition: (id) => m("duplicateExhibition", { id }),

    listFiles: async (exhibitionId) => (await q<ConsoleDocument[]>("console.document.list", { code: exhibitionId })).map(toSourceFile),
    uploadFile: (exhibitionId, file, options) => uploadDocument(exhibitionId, file, options),
    deleteFile: (_exhibitionId, fileId) => removeDocument(fileId),
    getFileDownloadUrl: async (fileId) => (await q<{ download: { url: string } }>("console.document.get", { id: fileId })).download.url,
    startAnalysis: async (exhibitionId) => {
      try {
        await m("console.analysis.create", { code: exhibitionId });
      } catch (e) {
        if (e instanceof ApiError && e.appCode === "ANALYSIS_IN_PROGRESS") throw new ApiError("An analysis is already running.", e.code, e.appCode);
        throw e;
      }
    },
    listProcessingEvents: async (exhibitionId) => toProcessingEvents(await q<ConsoleAnalysis>("console.analysis.get", { code: exhibitionId })),

    listContentItems: async (exhibitionId) => {
      const [rows, files] = await Promise.all([
        q<ConsoleContentRow[]>("console.content.list", { code: exhibitionId }),
        q<ConsoleFile[]>("console.document.list", { code: exhibitionId }),
      ]);
      knownFiles = files;
      known.clear();
      return rows.map((row, i) => remember(row, i));
    },
    // `theme` has no SPEC field and is ignored. The review screen's content-type options are not the SPEC
    // kinds, so a label that is not a kind is refused.
    getContentDoc: (itemId) => knownItem(itemId).row.doc,
    saveContentDoc: async (itemId, doc) => {
      await updateRow(itemId, { doc });
    },
    updateContentItem: async (itemId, patch) => {
      const { row, item } = knownItem(itemId);
      const change: Record<string, unknown> = {};
      if (patch.note !== undefined && patch.note !== item.note) change.editorialNote = patch.note || null;
      if (patch.text !== undefined && patch.text !== item.text) change.doc = docWithText(row, patch.text);
      if (patch.contentType !== undefined && patch.contentType !== item.contentType) {
        const kind = KIND_BY_LABEL[patch.contentType];
        if (!kind) throw new ApiError(`"${patch.contentType}" is not a content type the server knows yet.`);
        change.kind = kind;
      }
      return Object.keys(change).length ? updateRow(itemId, change) : item;
    },
    approveContentItem: (itemId) => updateRow(itemId, { status: "APPROVED" }),
    rejectContentItem: (itemId) => updateRow(itemId, { status: "REJECTED" }),
    // No SPEC procedure yet (issue #62).
    reopenContentItem: unavailable,
    removeContentItem: unavailable,
    restoreContentItem: unavailable,
    dismissDuplicate: unavailable,
    updateMediaAsset: unavailable,
    mergeContentItems: unavailable,
    splitContentItem: unavailable,

    listPublicationChecks: async (exhibitionId) => toPublicationChecks((await q<{ checks: ConsoleCheck[] }>("console.preview.get", { code: exhibitionId })).checks),

    getGuide: async (exhibitionId) => {
      const { draft, ...row } = await q<ConsoleExhibitionRow & { draft: ServerDraft }>("console.exhibition.get", { code: exhibitionId });
      return toGuide(draft, row);
    },
    // Only the sections are saved (see toGuideSection); the theme cards have nowhere to go.
    saveGuide: async (exhibitionId, { sections }) => {
      await writeDraft(exhibitionId, (draft) => ({
        ...draft,
        sections: sections.map(({ id, kind, title, visible, itemIds }) => ({ id, kind, title, visible, contentIds: itemIds })),
      }));
      const { draft, ...row } = await q<ConsoleExhibitionRow & { draft: ServerDraft }>("console.exhibition.get", { code: exhibitionId });
      return toGuide(draft, row);
    },
    // Every publication needs the rights confirmation, which is on the publish settings page (see Guide.tsx).
    publishGuide: async () => {
      throw new ApiError(RIGHTS_REQUIRED);
    },
  };
}
