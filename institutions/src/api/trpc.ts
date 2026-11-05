// InstitutionsApi over the still server (Next.js, tRPC at /api/trpc, no transformer = plain JSON).
// Calls with a full path ("console.session.create", "me.get") use the SPEC procedures (console.*, SPEC §9.5);
// bare names ("listFiles") still point at the draft `institutions` router from API.md until they move over.
import { ApiError } from "./errors";
import type { Exhibition, InstitutionsApi, Me, Workspace } from "./types";

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
const toMe = (me: StaffMe): Me => ({ id: me.id, name: me.displayName ?? me.email, email: me.email, role: "INSTITUTION_ADMIN", canPublish: true });
const toWorkspace = (me: StaffMe): Workspace => ({ institutionName: me.institution.name, institutionId: me.institution.code, role: me.displayName ?? me.email });

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
    getWorkspaceSettings: () => q("getWorkspaceSettings"),
    updateWorkspaceSettings: (patch) => m("updateWorkspaceSettings", patch),
    listVenues: () => q("listVenues"),
    createVenue: (venue) => m("createVenue", venue),
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
    createExhibition: () => m("createExhibition"),
    updateExhibition: (id, patch) => m("updateExhibition", { id, ...patch }),
    publishExhibition: (id) => m("publishExhibition", { id }),
    unpublishExhibition: (id) => m("unpublishExhibition", { id }),
    duplicateExhibition: (id) => m("duplicateExhibition", { id }),

    listFiles: (exhibitionId) => q("listFiles", { exhibitionId }),
    // tRPC carries JSON only. Files go to a plain upload route (or a presigned URL, like media uploads).
    // XMLHttpRequest instead of fetch: fetch cannot report upload progress.
    uploadFile(exhibitionId, file, options) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${BASE}/api/institutions/exhibitions/${encodeURIComponent(exhibitionId)}/files`);
        xhr.withCredentials = true;
        xhr.responseType = "json";
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) options?.onProgress?.(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response) : reject(new ApiError(`Upload failed (HTTP ${xhr.status})`)));
        xhr.onerror = () => reject(new ApiError("Upload interrupted"));
        xhr.onabort = () => reject(new DOMException("Upload canceled", "AbortError"));
        options?.signal?.addEventListener("abort", () => xhr.abort());
        const form = new FormData();
        form.append("file", file);
        xhr.send(form);
      });
    },
    deleteFile: (exhibitionId, fileId) => m("deleteFile", { exhibitionId, fileId }),
    startAnalysis: (exhibitionId) => m("startAnalysis", { exhibitionId }),
    listProcessingEvents: (exhibitionId) => q("listProcessingEvents", { exhibitionId }),

    listContentItems: (exhibitionId) => q("listContentItems", { exhibitionId }),
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

    listPublicationChecks: (exhibitionId) => q("listPublicationChecks", { exhibitionId }),

    getGuide: (exhibitionId) => q("getGuide", { exhibitionId }),
    saveGuide: (exhibitionId, guide) => m("saveGuide", { exhibitionId, ...guide }),
    publishGuide: (exhibitionId) => m("publishGuide", { exhibitionId }),
  };
}
