// InstitutionsApi over the still server (Next.js, tRPC at /api/trpc, no transformer = plain JSON).
// Calls with a full path ("console.session.create", "me.get") use the SPEC procedures (console.*, SPEC §9.5);
// bare names ("listFiles") still point at the draft `institutions` router from API.md until they move over.
import { ApiError } from "./errors";
import { UPLOAD_FORMATS } from "../constants";
import type { ContentItem, Exhibition, InstitutionsApi, MediaAsset, Me, ProcessingEvent, PublicationCheck, SourceFile, UploadOptions, Workspace } from "./types";

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
  startDate: row.startDate,
  endDate: row.endDate,
  status: row.state,
  updatedAt: row.updatedAt,
});

// console.content.list rows (src/server/services/console/content-rows.ts, SPEC §10.8).
type ContentKind = "INTRODUCTION" | "ARTIST" | "CURATOR_STATEMENT" | "THEME" | "ARTWORK" | "GALLERY_SECTION" | "AUDIO_NARRATION" | "PRESS_EXCERPT" | "CLOSING" | "OTHER";
type ContentBlock =
  | { type: "heading" | "paragraph" | "sentence"; id: string; text: string; origin: "SOURCE" | "EDITED"; refs: string[] }
  | { type: "image"; id: string; imageId: string; display: string; captionRefs: string[] };
export type ConsoleContentRow = {
  id: string;
  kind: ContentKind;
  status: "READY" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
  blocks: ContentBlock[];
  editorialNote: string | null;
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

// `documents` are the exhibition's source files: a ref "{documentId}:{segmentId}" naming one of them
// gives the item its source file. Page locations need analysis manifests, which do not exist yet.
export function toContentItem(row: ConsoleContentRow, order: number, documents: ConsoleFile[]): ContentItem {
  const label = KIND_LABELS[row.kind];
  const heading = row.blocks.find((b) => b.type === "heading");
  const sentences = row.blocks.filter((b) => b.type === "sentence");
  const texts = row.blocks.flatMap((b) => (b.type === "paragraph" || b.type === "sentence" ? [b.text] : []));
  const text = texts.join("\n\n");
  const refs = row.blocks.flatMap((b) => (b.type === "image" ? [] : b.refs));
  const source = documents.find((d) => refs.some((ref) => ref.split(":")[0] === d.id));
  const assets = row.blocks.flatMap((b): MediaAsset[] => {
    const image = b.type === "image" ? row.images.find((i) => i.id === b.imageId) : undefined;
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
  const title = heading && "text" in heading ? heading.text : label;
  return {
    id: row.id,
    order,
    title,
    kind: label,
    summary: sentences.length ? `${sentences.length} sentence${sentences.length === 1 ? "" : "s"}` : `${texts.length} paragraph${texts.length === 1 ? "" : "s"}`,
    itemCount: 1,
    reviewStatus: REVIEW_STATUS[row.status],
    sourceFileName: source?.name ?? "Added in the console",
    sourceLocation: "",
    heading: title,
    fieldLabel: "Text",
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
  };
}

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

const sha256Hex = async (file: File) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())), (b) => b.toString(16).padStart(2, "0")).join("");

const abortError = () => new DOMException("Upload canceled", "AbortError");

// PUTs the file to the presigned URL. XMLHttpRequest instead of fetch: fetch cannot report upload progress.
function putFile(upload: { url: string; headers: Record<string, string> }, file: File, options?: UploadOptions) {
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
  await putFile(upload, file, options);
  return toSourceFile(await m<ConsoleDocument>("console.document.update", { id: document.id, uploaded: true }));
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
    updateExhibition: (id, patch) => m("updateExhibition", { id, ...patch }),
    publishExhibition: (id) => m("publishExhibition", { id }),
    unpublishExhibition: (id) => m("unpublishExhibition", { id }),
    duplicateExhibition: (id) => m("duplicateExhibition", { id }),

    listFiles: async (exhibitionId) => (await q<ConsoleDocument[]>("console.document.list", { code: exhibitionId })).map(toSourceFile),
    uploadFile: (exhibitionId, file, options) => uploadDocument(exhibitionId, file, options),
    deleteFile: (exhibitionId, fileId) => m("deleteFile", { exhibitionId, fileId }),
    // console.analysis.create needs pg-boss and the Worker (SPEC §10.10); no procedure to call yet.
    startAnalysis: async () => {
      throw new ApiError("Analysis is not available yet.");
    },
    listProcessingEvents: async (exhibitionId) => toProcessingEvents(await q<ConsoleAnalysis>("console.analysis.get", { code: exhibitionId })),

    listContentItems: async (exhibitionId) => {
      const [rows, files] = await Promise.all([
        q<ConsoleContentRow[]>("console.content.list", { code: exhibitionId }),
        q<ConsoleFile[]>("console.document.list", { code: exhibitionId }),
      ]);
      return rows.map((row, i) => toContentItem(row, i, files));
    },
    updateContentItem: (itemId, patch) => m("updateContentItem", { itemId, ...patch }),
    approveContentItem: (itemId) => m("approveContentItem", { itemId }),
    rejectContentItem: (itemId) => m("rejectContentItem", { itemId }),
    reopenContentItem: (itemId) => m("reopenContentItem", { itemId }),
    removeContentItem: (itemId) => m("removeContentItem", { itemId }),
    restoreContentItem: (itemId) => m("restoreContentItem", { itemId }),
    dismissDuplicate: (itemId) => m("dismissDuplicate", { itemId }),
    updateMediaAsset: (itemId, assetId, patch) => m("updateMediaAsset", { itemId, assetId, ...patch }),
    mergeContentItems: (itemId, intoId, keep) => m("mergeContentItems", { itemId, intoId, keep }),
    splitContentItem: (itemId, at) => m("splitContentItem", { itemId, at }),

    listPublicationChecks: async (exhibitionId) => toPublicationChecks((await q<{ checks: ConsoleCheck[] }>("console.preview.get", { code: exhibitionId })).checks),

    getGuide: (exhibitionId) => q("getGuide", { exhibitionId }),
    saveGuide: (exhibitionId, guide) => m("saveGuide", { exhibitionId, ...guide }),
    publishGuide: (exhibitionId) => m("publishGuide", { exhibitionId }),
  };
}
