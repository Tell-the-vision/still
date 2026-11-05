// PlatformApi over the existing `still` server (tRPC at /api/trpc, no transformer = plain JSON).
// Expects a future `platform` router whose procedure names match the PlatformApi methods. See ../../API.md.
import { ApiError } from "./errors";
import type { PlatformApi } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function call<T>(kind: "query" | "mutation", name: string, input?: unknown): Promise<T> {
  const url = `${BASE}/api/trpc/platform.${name}`;
  const res =
    kind === "query"
      ? await fetch(input === undefined ? url : `${url}?input=${encodeURIComponent(JSON.stringify(input))}`, { credentials: "include" })
      : await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(input ?? null) });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    const err = body?.error;
    throw new ApiError(err?.message ?? `HTTP ${res.status}`, err?.data?.code, err?.data?.appCode);
  }
  return body.result.data as T;
}

const q = <T,>(name: string, input?: unknown) => call<T>("query", name, input);
const m = <T,>(name: string, input?: unknown) => call<T>("mutation", name, input);

export function createTrpcApi(): PlatformApi {
  return {
    // TEMPORARY: the staff Google route does not exist yet (see API.md). It returns here after sign-in.
    signInWithGoogle: () => {
      window.location.assign(`${BASE}/api/auth/staff/google?returnTo=${encodeURIComponent("/admin/")}`);
      return new Promise(() => {}); // the page is leaving
    },
    signOut: () => m("signOut"),
    getMe: () => q("getMe"),
    listInstitutions: () => q("listInstitutions"),
    createInstitution: (input) => m("createInstitution", input),
    setInstitutionStatus: (id, status) => m("setInstitutionStatus", { id, status }),
    resendInvite: (id) => m("resendInvite", { id }),
  };
}
