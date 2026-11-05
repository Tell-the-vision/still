// ConsoleApi over the existing `still` server (Next.js, tRPC at /api/trpc, no transformer = plain JSON).
// Expects a future `console` router whose procedure names match the ConsoleApi methods
// (console.listFiles, console.updateContentItem, ...). See API.md for the list.
import { ApiError } from "./errors";
import type { ConsoleApi } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function call<T>(kind: "query" | "mutation", path: string, input?: unknown): Promise<T> {
  // "console.*" unless a full router path is given (e.g. "session.delete").
  const url = `${BASE}/api/trpc/${path.includes(".") ? path : `console.${path}`}`;
  const res =
    kind === "query"
      ? await fetch(input === undefined ? url : `${url}?input=${encodeURIComponent(JSON.stringify(input))}`, { credentials: "include" })
      : await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input ?? null),
        });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    const err = body?.error;
    throw new ApiError(err?.message ?? `HTTP ${res.status}`, err?.data?.code, err?.data?.appCode);
  }
  return body.result.data as T;
}

const q = <T,>(path: string, input?: unknown) => call<T>("query", path, input);
const m = <T,>(path: string, input?: unknown) => call<T>("mutation", path, input);

export function createTrpcApi(): ConsoleApi {
  return {
    getWorkspace: () => q("getWorkspace"),

    getWorkspaceSummary: () => q("getWorkspaceSummary"),
    signIn: (request) => m("signIn", request),
    getMe: () => q("getMe"),
    updateMe: (patch) => m("updateMe", patch),
    getNotificationPrefs: () => q("getNotificationPrefs"),
    updateNotificationPrefs: (patch) => m("updateNotificationPrefs", patch),
    // Ends the staff session (separate from the visitor session.* procedures).
    signOut: () => m("signOut"),
    getWorkspaceSettings: () => q("getWorkspaceSettings"),
    updateWorkspaceSettings: (patch) => m("updateWorkspaceSettings", patch),
    listVenues: () => q("listVenues"),
    createVenue: (venue) => m("createVenue", venue),
    listMembers: () => q("listMembers"),
    inviteMember: (email, role) => m("inviteMember", { email, role }),
    updateMember: (memberId, patch) => m("updateMember", { memberId, ...patch }),
    removeMember: (memberId) => m("removeMember", { memberId }),
    sendSupportRequest: (request) => m("sendSupportRequest", request),

    listExhibitions: () => q("listExhibitions"),
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
        xhr.open("POST", `${BASE}/api/console/exhibitions/${encodeURIComponent(exhibitionId)}/files`);
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
