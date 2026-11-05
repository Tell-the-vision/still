// PlatformApi over the still server (tRPC at /api/trpc, no transformer = plain JSON).
// Procedure names follow the SPEC (admin.*, me.get, session.delete, password.update); the full list is in admin/API.md.
import { AccountNotIssuedError, ApiError } from "./errors";
import type { Account, Institution, NewInstitution, PlatformAdmin, PlatformApi } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

// Plain-English text for the server's AppError codes (SPEC §11.2), so screens never show a raw code.
const APP_CODE_MESSAGES: Record<string, string> = {
  LOGIN_ID_TAKEN: "This email already signs in to another account.",
  CODE_TAKEN: "This institution ID is already taken.",
  CODE_INVALID: "The institution ID is not valid. Use letters, numbers and hyphens.",
  LAST_ADMIN: "STILL must keep at least one active operator, so this account cannot be suspended or deleted.",
  PASSWORD_TOO_WEAK: "The new password is too short.",
};

type TrpcErrorBody = { message?: string; data?: { code?: string; appCode?: string; zodError?: unknown } };
function messageOf(err: TrpcErrorBody | undefined, status: number) {
  const appCode = err?.data?.appCode;
  // PASSWORD_TOO_WEAK carries a full sentence with the minimum length; keep it.
  if (appCode === "PASSWORD_TOO_WEAK" && err?.message && err.message !== appCode) return err.message;
  if (appCode && APP_CODE_MESSAGES[appCode]) return APP_CODE_MESSAGES[appCode];
  if (err?.data?.code === "BAD_REQUEST" && err.data.zodError) return "Check the form fields.";
  return err?.message ?? `HTTP ${status}`;
}

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
    const err = body?.error as TrpcErrorBody | undefined;
    throw new ApiError(messageOf(err, res.status), err?.data?.code, err?.data?.appCode);
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
type AccountRow = {
  id: string; email: string; role: "ADMIN" | "INSTITUTION"; institution: { name: string } | null;
  displayName: string | null; status: "ACTIVE" | "SUSPENDED"; lastLoginAt: string | null;
};
const toAccount = (r: AccountRow): Account => ({
  id: r.id, role: r.role, institution: r.institution?.name ?? null, email: r.email, name: r.displayName, status: r.status, lastSignInAt: r.lastLoginAt,
});

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
  // The server accepts any STL-...-NNNN shape; the 2–6 letter short code is this app's rule (same as the mock).
  if (!/^[A-Z]{2,6}$/.test(short)) throw new ApiError("Short code: 2–6 letters (A–Z).", "BAD_REQUEST");
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
    changePassword: (currentPassword, newPassword) => call("password.update", { currentPassword, newPassword }),
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
    listAccounts: async (filter = {}) => (await call<AccountRow[]>("admin.account.list", filter)).map(toAccount),
    issueInstitutionAccount: async (institutionId, name, email) => {
      const issued = await call<{ account: AccountRow; temporaryPassword: string }>("admin.account.create", { role: "INSTITUTION", institutionId, email, displayName: name });
      return { account: toAccount(issued.account), temporaryPassword: issued.temporaryPassword };
    },
    addOperator: async (name, email) => {
      const issued = await call<{ account: AccountRow; temporaryPassword: string }>("admin.account.create", { role: "ADMIN", email, displayName: name });
      return { account: toAccount(issued.account), temporaryPassword: issued.temporaryPassword };
    },
    setAccountStatus: async (id, status) => toAccount((await call<{ account: AccountRow }>("admin.account.update", { id, status })).account),
    resetAccountPassword: async (id) => {
      const { account, temporaryPassword } = await call<{ account: AccountRow; temporaryPassword: string }>("admin.account.update", { id, resetPassword: true });
      return { email: account.email, temporaryPassword };
    },
    deleteAccount: async (id) => { await call("admin.account.delete", { id }); },
    createInstitution,
    issueWorkspaceAdmin: issueAccount,
    setInstitutionStatus: async (id, status) => toInstitution(await call("admin.institution.update", { id, status })),
  };
}
