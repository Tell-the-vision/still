// ConsoleApi over the existing `still` server (Next.js, tRPC at /api/trpc, no transformer = plain JSON).
// Expects a future `console` router whose procedure names match the ConsoleApi methods
// (console.listFiles, console.updateContentItem, ...). See API.md for the list.
import type { ConsoleApi } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly appCode?: string) {
    super(message);
  }
}

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
    getMe: () => q("getMe"),
    updateMe: (patch) => m("updateMe", patch),
    getNotificationPrefs: () => q("getNotificationPrefs"),
    updateNotificationPrefs: (patch) => m("updateNotificationPrefs", patch),
    // Existing still procedure: ends the current session.
    signOut: () => m("session.delete"),
    getWorkspaceSettings: () => q("getWorkspaceSettings"),
    updateWorkspaceSettings: (patch) => m("updateWorkspaceSettings", patch),
    listVenues: () => q("listVenues"),
    createVenue: (venue) => m("createVenue", venue),
    listMembers: () => q("listMembers"),
    inviteMember: (email, role) => m("inviteMember", { email, role }),
    updateMemberRole: (memberId, role) => m("updateMemberRole", { memberId, role }),
    removeMember: (memberId) => m("removeMember", { memberId }),
    sendSupportRequest: (request) => m("sendSupportRequest", request),

    listExhibitions: () => q("listExhibitions"),
    createExhibition: () => m("createExhibition"),
    updateExhibition: (id, patch) => m("updateExhibition", { id, ...patch }),
    publishExhibition: (id) => m("publishExhibition", { id }),

    listFiles: (exhibitionId) => q("listFiles", { exhibitionId }),
    // tRPC carries JSON only. Files go to a plain upload route (or a presigned URL, like media uploads).
    async uploadFile(exhibitionId, file) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/api/console/exhibitions/${encodeURIComponent(exhibitionId)}/files`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) throw new ApiError(`Upload failed (HTTP ${res.status})`);
      return res.json();
    },
    deleteFile: (exhibitionId, fileId) => m("deleteFile", { exhibitionId, fileId }),
    startAnalysis: (exhibitionId) => m("startAnalysis", { exhibitionId }),
    listProcessingEvents: (exhibitionId) => q("listProcessingEvents", { exhibitionId }),

    listContentItems: (exhibitionId) => q("listContentItems", { exhibitionId }),
    updateContentItem: (itemId, patch) => m("updateContentItem", { itemId, ...patch }),
    approveContentItem: (itemId) => m("approveContentItem", { itemId }),

    listPublicationChecks: (exhibitionId) => q("listPublicationChecks", { exhibitionId }),

    getGuide: (exhibitionId) => q("getGuide", { exhibitionId }),
    saveGuide: (exhibitionId, guide) => m("saveGuide", { exhibitionId, ...guide }),
    publishGuide: (exhibitionId) => m("publishGuide", { exhibitionId }),
  };
}
