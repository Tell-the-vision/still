// PlatformApi over the still server (tRPC at /api/trpc, no transformer = plain JSON).
// Procedure names follow the SPEC (admin.*, me.get, session.delete); see ../../API.md for what is still missing.
import { AccountNotIssuedError, ApiError } from "./errors";
import type { Institution, NewInstitution, PlatformAdmin, PlatformApi } from "./types";

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

// admin.institution.* return this row (src/server/services/admin/institution-rows.ts, SPEC §9.2 A9).
export type InstitutionRow = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED";
  displayStatus: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  accountCount: number;
  workspaceAdmin: { accountId: string; email: string } | null;
  lastActiveAt: string | null;
  analysisDailyTokenLimit: number | null;
  createdAt: string;
};

// admin.account.* return this row (src/server/services/admin/account-rows.ts); only the fields the screens use.
type AccountRow = { id: string; email: string };

export const toInstitution = (row: InstitutionRow): Institution => ({
  id: row.id,
  publicId: row.code,
  name: row.name,
  adminEmail: row.workspaceAdmin?.email ?? "—",
  status: row.displayStatus === "PENDING_SETUP" ? "PENDING" : row.displayStatus,
  createdAt: row.createdAt,
  lastActiveAt: row.lastActiveAt,
});

// me.get for an operator (SPEC §9.5).
type StaffMe = { email: string; role: "ADMIN"; mustChangePassword: boolean };
const toAdmin = (me: StaffMe): PlatformAdmin => ({ email: me.email, role: "SUPER_ADMIN", mustChangePassword: me.mustChangePassword });

// admin.account.create: the temporary password appears only in this response (SPEC §9.5).
type IssuedAccount = { account: { email: string }; temporaryPassword: string };

// The number in STL-<CODE>-<NNNN> is platform-wide; a taken ID (someone else just added one) moves on to the next number.
const ID_ATTEMPTS = 3;
const numberOf = (publicId: string) => Number(publicId.split("-").pop()) || 0;

async function issueAccount(institution: Institution, { adminName, adminEmail }: Pick<NewInstitution, "adminName" | "adminEmail">) {
  const issued = await call<IssuedAccount>("admin.account.create", { role: "INSTITUTION", institutionId: institution.id, email: adminEmail, displayName: adminName });
  return { institution: { ...institution, adminEmail: issued.account.email }, temporaryPassword: issued.temporaryPassword };
}

async function createInstitution(input: NewInstitution, existing: Institution[]) {
  const first = Math.max(0, ...existing.map((i) => numberOf(i.publicId))) + 1;
  const short = input.code.trim().toUpperCase();
  let row: InstitutionRow | undefined;
  for (let attempt = 0; !row; attempt++) {
    const code = `STL-${short}-${String(first + attempt).padStart(4, "0")}`;
    try {
      row = await call<InstitutionRow>("admin.institution.create", { code, name: input.name });
    } catch (e) {
      if (!(e instanceof ApiError && e.appCode === "CODE_TAKEN") || attempt === ID_ATTEMPTS - 1) throw e;
    }
  }
  const institution = toInstitution(row);
  try {
    return await issueAccount(institution, input);
  } catch (e) {
    throw new AccountNotIssuedError(e instanceof Error ? e.message : String(e), institution, e instanceof ApiError ? e.appCode : undefined);
  }
}

export function createTrpcApi(): PlatformApi {
  return {
    signIn: async (email, password) => toAdmin(await call("admin.session.create", { email, password })),
    signOut: () => call("session.delete"),
    getMe: async () => toAdmin(await call("me.get")),
    listInstitutions: async () => {
      const institutions: Institution[] = [];
      let cursor: string | undefined;
      do {
        const page = await call<{ items: InstitutionRow[]; nextCursor: string | null }>("admin.institution.list", { limit: 50, cursor });
        institutions.push(...page.items.map(toInstitution));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return institutions;
    },
    createInstitution,
    issueWorkspaceAdmin: issueAccount,
    setInstitutionStatus: async (id, status) => toInstitution(await call("admin.institution.update", { id, status })),
    // The workspace admin is the institution's first account (admin.account.list is oldest first).
    resetWorkspaceAdminPassword: async (institutionId) => {
      const [workspaceAdmin] = await call<AccountRow[]>("admin.account.list", { institutionId });
      if (!workspaceAdmin) throw new ApiError("This institution has no account yet.", "NOT_FOUND");
      const { account, temporaryPassword } = await call<{ account: AccountRow; temporaryPassword: string }>("admin.account.update", {
        id: workspaceAdmin.id,
        resetPassword: true,
      });
      return { email: account.email, temporaryPassword };
    },
  };
}
