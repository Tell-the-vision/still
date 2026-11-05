// Shapes the platform admin screens need from the backend (Figma 09). The platform.* procedures do not exist yet; see ../../API.md.

export type ISODateTime = string; // "2026-11-05T10:42:00Z"

/** PENDING: "Pending setup", no account of the institution has signed in yet. SUSPENDED: nobody can sign in; data is kept (SPEC §9.2). */
export type InstitutionStatus = "ACTIVE" | "PENDING" | "SUSPENDED";

export interface Institution {
  id: string;
  /** The institution ID staff type to sign in (Figma 10), e.g. "STL-SEO-0001". Unique, never reused. */
  publicId: string;
  name: string;
  /** Email of the first account, issued when the institution is created. */
  adminEmail: string;
  status: InstitutionStatus;
  createdAt: ISODateTime;
  /** Last staff sign-in or activity; null until someone signs in. */
  lastActiveAt: ISODateTime | null;
}

export interface NewInstitution {
  name: string;
  /** 2–6 letters used in the ID: STL-<CODE>-<number>. */
  code: string;
  /** Name and email of the first account (the workspace admin). */
  adminName: string;
  adminEmail: string;
}

/** An account was issued: the temporary password is returned this once and never again (SPEC §9.2, §10.5). */
export interface Issued {
  institution: Institution;
  temporaryPassword: string;
}

export interface PlatformAdmin {
  email: string;
  /** "SUPER ADMIN" in the header is just the ADMIN role; operators have no grades (SPEC §9.2). */
  role: "SUPER_ADMIN";
  /** Signed in with a temporary password that must be changed before anything else (SPEC §10.5). */
  mustChangePassword: boolean;
}

/** One sign-in account as admin.account.list returns it (SPEC §9.5). */
export interface Account {
  id: string;
  role: "ADMIN" | "INSTITUTION";
  /** Institution name; null for operators. */
  institution: string | null;
  email: string;
  name: string | null;
  status: "ACTIVE" | "SUSPENDED";
  lastSignInAt: ISODateTime | null;
}

/** The one seam between screens and backend. */
export interface PlatformApi {
  /** Operators sign in with the email and password STILL Admin issued them (SPEC §9.2, admin.session.create). */
  signIn(email: string, password: string): Promise<PlatformAdmin>;
  signOut(): Promise<void>;
  /** Replaces the temporary password (SPEC §9.5 password.update). Wrong current or too-short new password throws BAD_REQUEST. */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  /** Throws UNAUTHORIZED without a STILL staff session. */
  getMe(): Promise<PlatformAdmin>;
  listInstitutions(): Promise<Institution[]>;
  /**
   * Issues the next ID for the code (one above the highest number in `existing`), then the first account with a
   * temporary password. Returns the PENDING institution. If only the account step fails it throws
   * AccountNotIssuedError carrying the institution; finish with issueWorkspaceAdmin.
   */
  createInstitution(input: NewInstitution, existing: Institution[]): Promise<Issued>;
  /** Issues the first account of an institution that has none yet, after createInstitution's account step failed. */
  issueWorkspaceAdmin(institution: Institution, admin: Pick<NewInstitution, "adminName" | "adminEmail">): Promise<Issued>;
  /** Suspend or reactivate. Suspending ends every staff session of that institution; nothing is deleted. */
  setInstitutionStatus(id: string, status: "ACTIVE" | "SUSPENDED"): Promise<Institution>;
  /**
   * Sets a new temporary password for the institution's workspace admin (its first account) and ends that account's
   * sessions (SPEC §9.2 재설정). The password is returned once; the operator passes it on.
   */
  resetWorkspaceAdminPassword(institutionId: string): Promise<{ email: string; temporaryPassword: string }>;
  listAccounts(): Promise<Account[]>;
  /** Issues an operator (role ADMIN); the temporary password is returned once. */
  addOperator(name: string, email: string): Promise<{ account: Account; temporaryPassword: string }>;
  /** Suspending ends the account's sessions. Suspending the last active operator throws LAST_ADMIN. */
  setAccountStatus(id: string, status: "ACTIVE" | "SUSPENDED"): Promise<Account>;
  resetAccountPassword(id: string): Promise<{ email: string; temporaryPassword: string }>;
  /** Deleting the last active operator throws LAST_ADMIN. */
  deleteAccount(id: string): Promise<void>;
}
