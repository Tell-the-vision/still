// PlatformApi over the still server (tRPC at /api/trpc, no transformer = plain JSON).
// Procedure names follow the SPEC (admin.*, me.get, session.delete); see ../../API.md for what is still missing.
import { ApiError } from "./errors";
import type { PlatformAdmin, PlatformApi } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

// Every call is a POST, queries included (the server allows method override): cookie requests must carry
// Origin (SPEC §2.3), which browsers leave out of same-origin GETs. `x-client: admin` makes shared
// procedures (me.get, session.delete) use the STILL Admin session.
async function call<T>(path: string, input?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/trpc/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-client": "admin" },
    body: JSON.stringify(input ?? null),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    const err = body?.error;
    throw new ApiError(err?.message ?? `HTTP ${res.status}`, err?.data?.code, err?.data?.appCode);
  }
  return body.result.data as T;
}

// me.get for an operator (SPEC §9.5).
type StaffMe = { email: string; role: "ADMIN"; mustChangePassword: boolean };
const toAdmin = (me: StaffMe): PlatformAdmin => ({ email: me.email, role: "SUPER_ADMIN", mustChangePassword: me.mustChangePassword });

export function createTrpcApi(): PlatformApi {
  return {
    signIn: async (email, password) => toAdmin(await call("admin.session.create", { email, password })),
    signOut: () => call("session.delete"),
    getMe: async () => toAdmin(await call("me.get")),
    // Not on the server yet (SPEC admin.institution.* / admin.account.*).
    listInstitutions: () => call("platform.listInstitutions"),
    createInstitution: (input) => call("platform.createInstitution", input),
    setInstitutionStatus: (id, status) => call("platform.setInstitutionStatus", { id, status }),
    resendInvite: (id) => call("platform.resendInvite", { id }),
  };
}
