// ConsoleApi over the still server: tRPC at /api/trpc, plain JSON, the console.* procedures of SPEC §9.5.
// Rows are mapped to the screens' shapes here, so the screens never see server field names.
import { ApiError } from "./errors";
import type { ContentItem, Exhibition, Guide, GuideSection, ConsoleApi, MediaAsset, Me, ProcessingEvent, PublicationCheck, SectionKind, SourceFile, UploadOptions, Workspace } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

// Every call is a POST, queries included (the server allows method override): cookie requests must carry
// Origin (SPEC §2.3), which browsers leave out of same-origin GETs. `x-client: console` makes shared
// procedures (me.get, session.delete, password.update) use the institution console session (issue #59).
async function call<T>(path: string, input?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/trpc/${path}`, {
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

// ── Account (SPEC §9.5 me.get) ───────────────────────────
type StaffMe = {
  id: string;
  displayName: string | null;
  email: string;
  institution: { id: string; code: string; name: string };
};
const toMe = (me: StaffMe): Me => ({ id: me.id, name: me.displayName ?? me.email, email: me.email });
const toWorkspace = (me: StaffMe): Workspace => ({ institutionName: me.institution.name, institutionId: me.institution.code });

// ── Exhibitions (console.exhibition.*) ───────────────────
type ConsoleExhibitionRow = {
  id: string;
  code: string;
  state: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  title: string;
  subtitle: string | null;
  venue: { id: string; name: string; city: string } | null;
  startDate: string | null;
  endDate: string | null;
  draftRevision: string;
  hasUnpublishedChanges: boolean;
  updatedAt: string;
};
type Page<T> = { items: T[]; nextCursor: string | null };

// Console procedures identify an exhibition by its code (SPEC §9.5), so the screens' exhibition id is the code.
const toExhibition = (row: ConsoleExhibitionRow): Exhibition => ({
  id: row.code,
  code: row.code,
  title: row.title,
  subtitle: row.subtitle,
  venueName: row.venue?.name ?? "",
  startDate: row.startDate,
  endDate: row.endDate,
  status: row.state === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
  updatedAt: row.updatedAt,
});

// ── Content (console.content.*, SPEC §10.8) ──────────────
type ContentKind = "INTRODUCTION" | "ARTIST" | "CURATOR_STATEMENT" | "THEME" | "ARTWORK" | "GALLERY_SECTION" | "AUDIO_NARRATION" | "PRESS_EXCERPT" | "CLOSING" | "OTHER";
type DocText = { type: "text"; text: string; marks?: unknown[] };
type DocBlock =
  | { type: "paragraph" | "heading"; attrs: { id: string; level?: number }; content?: DocText[] }
  | { type: "blockquote" | "bulletList" | "orderedList"; attrs: { id: string }; content: unknown[] }
  | { type: "stillImage"; attrs: { id: string; imageId: string; display: string; caption: string | null } };
type ContentDoc = { type: "doc"; content: DocBlock[] };
type ConsoleImage = { id: string; altText: string | null; credit: string | null; rights: MediaAsset["rights"] };
type ConsoleContentRow = {
  id: string;
  kind: ContentKind;
  status: "READY" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  doc: ContentDoc;
  sources: Record<string, { refs: string[] }>;
  editorialNote: string | null;
  revision: string;
  updatedAt: string;
  images: ConsoleImage[];
};
type ConsoleFile = { id: string; name: string };
// console.suggestion.list rows; "Keep both" dismisses an open DUPLICATE_CONTENT suggestion (issue #62).
type ConsoleSuggestion = { id: string; contentId: string | null; kind: string; status: "OPEN" | "ACCEPTED" | "DISMISSED"; target?: { contentId?: string }; revision?: string | null };

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
const KIND_BY_LABEL = Object.fromEntries(Object.entries(KIND_LABELS).map(([kind, label]) => [label, kind]));
const REVIEW_STATUS = { READY: "IN_REVIEW", NEEDS_REVIEW: "IN_REVIEW", APPROVED: "APPROVED", REJECTED: "REJECTED" } as const;

const plainText = (b: DocBlock) => (b.type === "paragraph" || b.type === "heading" ? (b.content ?? []).map((t) => t.text).join("") : "");

// A source ref "{documentId}:{segmentId}" names one of the exhibition's documents, which gives the item its file.
function toContentItem(row: ConsoleContentRow, order: number, documents: ConsoleFile[], duplicateOf: string | null): ContentItem {
  const label = KIND_LABELS[row.kind];
  const heading = row.doc.content.find((b) => b.type === "heading");
  const texts = row.doc.content.filter((b) => b.type === "paragraph").map(plainText);
  const text = texts.join("\n\n");
  const refs = Object.values(row.sources).flatMap((s) => s.refs);
  const source = documents.find((d) => refs.some((ref) => ref.split(":")[0] === d.id));
  const assets = row.doc.content.flatMap((b, n): MediaAsset[] => {
    const image = b.type === "stillImage" ? row.images.find((i) => i.id === b.attrs.imageId) : undefined;
    return image ? [{ id: image.id, name: `${source?.name ?? "Image"} · ${n + 1}`, rights: image.rights, credit: image.credit, altText: image.altText }] : [];
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
    text,
    originalText: text,
    theme: "",
    contentType: label,
    note: row.editorialNote ?? "",
    confidence: null,
    origin: "SOURCE",
    updatedBy: null,
    updatedAt: row.updatedAt,
    duplicateOf,
    assets,
  };
}

// The latest row, item and open duplicate suggestion this tab knows per item. Write methods take only an
// item id, so the revision they must send (SPEC §10.8) comes from here; every read and write refreshes it.
const known = new Map<string, { row: ConsoleContentRow; item: ContentItem; duplicate: ConsoleSuggestion | null }>();
let knownFiles: ConsoleFile[] = [];
const remember = (row: ConsoleContentRow, order: number, duplicate: ConsoleSuggestion | null = known.get(row.id)?.duplicate ?? null) => {
  const item = toContentItem(row, order, knownFiles, duplicate?.target?.contentId ?? null);
  known.set(row.id, { row, item, duplicate });
  return item;
};
const knownItem = (itemId: string) => {
  const entry = known.get(itemId);
  if (!entry) throw new ApiError("This item is not loaded. Reload to see the latest.");
  return entry;
};

const CHANGED_ELSEWHERE = "This item changed elsewhere. Reload to see the latest.";
const NOT_YET = "Not available yet.";

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

// The doc with `text` spread over its paragraphs. One paragraph takes the text as is; several take
// blank-line separated parts, in order. An unchanged paragraph keeps its node id and marks.
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

// ── Analysis (console.analysis.get) ──────────────────────
type ConsoleAnalysis = {
  analysis: { startedAt: string; result: "SUCCEEDED" | "FAILED" | "CANCELLED" | null } | null;
  documents: { total: number; uploading: number; stored: number; extracted: number; failed: number; duplicate: number };
  contents: { total: number; open: number };
};

// The four steps of SPEC §9.4 진행 표시, derived from the counts and the analysis summary.
function toProcessingEvents({ analysis, documents: d, contents: c }: ConsoleAnalysis): ProcessingEvent[] {
  const live = d.total - d.failed - d.duplicate;
  const classification: Pick<ProcessingEvent, "detail" | "status"> = !analysis
    ? { status: "PENDING", detail: "Analysis has not started." }
    : analysis.result === "SUCCEEDED" ? { status: "COMPLETE", detail: "Content items were extracted." }
    : analysis.result === "FAILED" ? { status: "FAILED", detail: "The analysis failed." }
    : analysis.result === "CANCELLED" ? { status: "FAILED", detail: "The analysis was cancelled." }
    : { status: "IN_PROGRESS", detail: "Analysis is running." };
  return [
    { id: "upload", at: null, title: "Upload", status: d.stored + d.extracted > 0 ? "COMPLETE" : d.uploading > 0 ? "IN_PROGRESS" : "PENDING", detail: `${d.total} files, ${d.uploading} uploading` },
    { id: "extraction", at: null, title: "Text extraction", status: live > 0 && d.extracted === live ? "COMPLETE" : "PENDING", detail: `${d.extracted} of ${live} files extracted` },
    { id: "classification", at: analysis?.startedAt ?? null, title: "Content classification", ...classification },
    { id: "review", at: null, title: "Curator review", status: c.total === 0 ? "PENDING" : c.open > 0 ? "IN_PROGRESS" : "COMPLETE", detail: `${c.open} of ${c.total} items need review` },
  ];
}

// ── Documents (console.document.*, SPEC §9.4 업로드) ─────
type ConsoleDocument = {
  id: string;
  name: string;
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
const MEDIA_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
};
const toSourceFile = (doc: ConsoleDocument): SourceFile => ({
  id: doc.id,
  name: doc.name,
  format: (doc.name.split(".").pop() ?? "FILE").toUpperCase(),
  summary: null,
  sizeBytes: doc.byteSize,
  uploadedAt: doc.createdAt,
  status: ({ UPLOADING: "UPLOADING", STORED: "UPLOADED", EXTRACTED: "PROCESSED", FAILED: "FAILED", DUPLICATE: "FAILED" } as const)[doc.status],
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

// The server refuses to remove a document that reviewed content still uses.
async function removeDocument(id: string) {
  try {
    await m("console.document.delete", { id });
  } catch (e) {
    if (e instanceof ApiError && e.appCode === "DOCUMENT_IN_USE") throw new ApiError("This file is used by reviewed content and cannot be removed.", e.code, e.appCode);
    throw e;
  }
}

// SPEC §9.4: hash in the browser, register the document, PUT the bytes straight to private R2 with the
// presigned URL, then tell the server they are there. The server never receives the file.
async function uploadDocument(code: string, file: File, options?: UploadOptions): Promise<SourceFile> {
  const mediaType = MEDIA_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""];
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
  return toSourceFile(await m<ConsoleDocument>("console.document.update", { id: document.id, uploaded: true }));
}

// ── Guide draft (console.draft.*, SPEC §10.9) ────────────
// Fields the screens do not edit (cover, ambience, playlist) travel through unchanged.
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

const toGuide = (draft: ServerDraft, row: ConsoleExhibitionRow): Guide => ({
  sections: draft.sections.map(({ id, kind, title, visible, contentIds }): GuideSection => ({ id, kind, title, visible, contentIds })),
  // Anything not live yet (a draft never published, or an unpublished guide) can be published.
  hasUnpublishedChanges: row.state !== "PUBLISHED" || row.hasUnpublishedChanges,
});

const STALE_DRAFT = "This draft changed elsewhere. Reload to see the latest.";

// Replaces the draft the caller just read. Someone else saving in between is REVISION_MISMATCH.
async function writeDraft(code: string, edit: (draft: ServerDraft) => ServerDraft) {
  const { draft, revision } = await q<DraftState>("console.draft.get", { code });
  try {
    await m("console.draft.update", { code, revision, draft: edit(draft) });
  } catch (e) {
    if (e instanceof ApiError && e.appCode === "REVISION_MISMATCH") throw new ApiError(STALE_DRAFT, e.code, e.appCode);
    throw e;
  }
}

// ── Publication (console.publication.*, console.preview.get) ──
// The version of the rights statement shown on the publish page (SPEC §9.4).
const RIGHTS_STATEMENT_VERSION = "2026-11";
const RIGHTS_REQUIRED = "Confirm the content rights on the publish settings page before publishing.";
type ConsoleCheck = { id: string; title: string; ok: boolean; warning: boolean; detail: string };
const toPublicationChecks = (checks: ConsoleCheck[]): PublicationCheck[] =>
  checks.map(({ id, title, ok, warning, detail }) => ({ id, title, detail, ok: ok && !warning, value: ok && !warning ? "Ready" : "Needs check" }));
function publicationError(e: unknown) {
  if (!(e instanceof ApiError)) return e;
  if (e.appCode === "REVISION_MISMATCH") return new ApiError("The draft changed while you were publishing. Check the preview and publish again.", e.code, e.appCode);
  if (e.appCode === "RIGHTS_NOT_CONFIRMED") return new ApiError(RIGHTS_REQUIRED, e.code, e.appCode);
  return e;
}

const getRow = (code: string) => q<ConsoleExhibitionRow & { draft: ServerDraft }>("console.exhibition.get", { code });

export function createTrpcApi(): ConsoleApi {
  return {
    getWorkspace: async () => toWorkspace(await q<StaffMe>("me.get")),

    signIn: async ({ institutionId, email, password, remember }) =>
      toMe(await m<StaffMe>("console.session.create", { institutionCode: institutionId, email, password, remember })),
    getMe: async () => toMe(await q<StaffMe>("me.get")),
    changePassword: (currentPassword, newPassword) => m("password.update", { currentPassword, newPassword }),
    // Ends the console session only; a visitor sign-in in the same browser stays (SPEC §10.5).
    signOut: () => m("session.delete"),
    // Venues are shared between institutions; the server picks the code from the name.
    listVenues: () => q("console.venue.list", {}),
    createVenue: ({ name, city }) => m("console.venue.create", { name, city }),

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
    // A new draft needs a code and a title (SPEC §9.5); both can be changed on the publish page before it goes live.
    createExhibition: async () =>
      toExhibition(await m<ConsoleExhibitionRow>("console.exhibition.create", { code: `untitled-${Date.now().toString(36)}`, title: "Untitled Exhibition" })),
    // Publication details are draft fields (SPEC §9.4 전시 초안); the venue is stored by id.
    updateExhibition: async (id, patch) => {
      if (patch.code !== undefined && patch.code !== id) throw new ApiError("The visitor URL cannot be changed after the exhibition is created.");
      const { code: _code, venueName, ...details } = patch;
      let venueId: string | undefined;
      if (venueName !== undefined) {
        const venues = await q<{ id: string; name: string }[]>("console.venue.list", {});
        const venue = venues.find((v) => v.name === venueName);
        if (!venue) throw new ApiError(`Add "${venueName}" under Venues first.`);
        venueId = venue.id;
      }
      await writeDraft(id, (draft) => ({ ...draft, ...details, ...(venueId !== undefined && { venueId }) }));
      return toExhibition(await getRow(id));
    },
    publishExhibition: async (id) => {
      const { draftRevision } = await getRow(id);
      try {
        await m("console.publication.create", { code: id, revision: draftRevision, rightsConfirmed: true, rightsStatementVersion: RIGHTS_STATEMENT_VERSION });
      } catch (e) {
        throw publicationError(e);
      }
      return toExhibition(await getRow(id));
    },
    unpublishExhibition: async (id) => {
      await m("console.publication.delete", { code: id });
      return toExhibition(await getRow(id));
    },

    listFiles: async (exhibitionId) => (await q<ConsoleDocument[]>("console.document.list", { code: exhibitionId })).map(toSourceFile),
    uploadFile: (exhibitionId, file, options) => uploadDocument(exhibitionId, file, options),
    deleteFile: (_exhibitionId, fileId) => removeDocument(fileId),
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
      const [rows, files, suggestions] = await Promise.all([
        q<ConsoleContentRow[]>("console.content.list", { code: exhibitionId }),
        q<ConsoleFile[]>("console.document.list", { code: exhibitionId }),
        q<ConsoleSuggestion[]>("console.suggestion.list", { code: exhibitionId }),
      ]);
      knownFiles = files;
      known.clear();
      const openDuplicate = (id: string) => suggestions.find((s) => s.kind === "DUPLICATE_CONTENT" && s.status === "OPEN" && s.contentId === id) ?? null;
      return rows.map((row, i) => remember(row, i + 1, openDuplicate(row.id)));
    },
    // `theme` has no SPEC field and is not sent. The content type must be one of the SPEC kinds.
    updateContentItem: async (itemId, patch) => {
      const { row, item } = knownItem(itemId);
      const change: Record<string, unknown> = {};
      if (patch.note !== undefined && patch.note !== item.note) change.editorialNote = patch.note || null;
      if (patch.text !== undefined && patch.text !== item.text) change.doc = docWithText(row, patch.text);
      if (patch.contentType !== undefined && patch.contentType !== item.contentType) {
        const kind = KIND_BY_LABEL[patch.contentType];
        if (!kind) throw new ApiError(`"${patch.contentType}" is not a content type the server knows.`);
        change.kind = kind;
      }
      return Object.keys(change).length ? updateRow(itemId, change) : item;
    },
    approveContentItem: (itemId) => updateRow(itemId, { status: "APPROVED" }),
    // REJECTED is final; the server also takes the item out of the guide draft (SPEC §10.8).
    rejectContentItem: (itemId) => updateRow(itemId, { status: "REJECTED" }),
    // No SPEC transition back to review yet; editing an approved item returns it to READY on the server.
    reopenContentItem: async () => { throw new ApiError(NOT_YET); },
    dismissDuplicate: async (itemId) => {
      const { row, item, duplicate } = knownItem(itemId);
      if (!duplicate) return item;
      try {
        await m("console.suggestion.update", { contentId: itemId, id: duplicate.id, status: "DISMISSED", revision: duplicate.revision ?? row.revision });
      } catch (e) {
        if (e instanceof ApiError && e.appCode === "REVISION_MISMATCH") throw new ApiError(CHANGED_ELSEWHERE, e.code, e.appCode);
        throw e;
      }
      return remember(await q<ConsoleContentRow>("console.content.get", { id: itemId }), item.order, null);
    },
    // console.image.update takes rights, credit and alt text (SPEC §10.7).
    updateMediaAsset: async (itemId, assetId, patch) => {
      const { item } = knownItem(itemId);
      if (!item.assets.some((a) => a.id === assetId)) throw new ApiError("This image is not part of the item.");
      await m("console.image.update", { id: assetId, ...patch });
      return remember(await q<ConsoleContentRow>("console.content.get", { id: itemId }), item.order);
    },

    listPublicationChecks: async (exhibitionId) => toPublicationChecks((await q<{ checks: ConsoleCheck[] }>("console.preview.get", { code: exhibitionId })).checks),

    getGuide: async (exhibitionId) => {
      const { draft, ...row } = await getRow(exhibitionId);
      return toGuide(draft, row);
    },
    saveGuide: async (exhibitionId, sections) => {
      await writeDraft(exhibitionId, (draft) => ({ ...draft, sections: sections.map(({ id, kind, title, visible, contentIds }) => ({ id, kind, title, visible, contentIds })) }));
      const { draft, ...row } = await getRow(exhibitionId);
      return toGuide(draft, row);
    },
    // Every publication needs the rights confirmation, which is on the publish settings page.
    publishGuide: async () => {
      throw new ApiError(RIGHTS_REQUIRED);
    },
  };
}
