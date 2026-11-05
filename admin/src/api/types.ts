// Shapes the platform admin screens need from the backend (Figma 09). The platform.* procedures do not exist yet; see ../../API.md.

export type ISODateTime = string; // "2026-11-05T10:42:00Z"

/** PENDING: created, the first institution admin has not accepted the invite yet. SUSPENDED: nobody can sign in; data is kept. */
export type InstitutionStatus = "ACTIVE" | "PENDING" | "SUSPENDED";

export interface Institution {
  id: string;
  /** The institution ID staff type to sign in (Figma 10), e.g. "STL-SEO-0001". Unique, never reused. */
  publicId: string;
  name: string;
  /** First INSTITUTION_ADMIN, invited when the institution is created. */
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
  adminEmail: string;
}

export interface PlatformAdmin {
  email: string;
  role: "SUPER_ADMIN";
}

/** The one seam between screens and backend. */
export interface PlatformApi {
  /** TEMPORARY: STILL staff sign in with their STILL Google account (server checks domain + allow-list).
   *  Server mode leaves the page for the Google flow; the mock signs in at once. */
  signInWithGoogle(): Promise<PlatformAdmin>;
  signOut(): Promise<void>;
  /** Throws UNAUTHORIZED without a STILL staff session. */
  getMe(): Promise<PlatformAdmin>;
  listInstitutions(): Promise<Institution[]>;
  /** Issues the next ID for the code and emails a one-time invite link to adminEmail. Returns the PENDING institution. */
  createInstitution(input: NewInstitution): Promise<Institution>;
  /** Suspend or reactivate. Suspending ends every staff session of that institution; nothing is deleted. */
  setInstitutionStatus(id: string, status: "ACTIVE" | "SUSPENDED"): Promise<Institution>;
  /** New invite link for a PENDING institution's admin (the old link stops working). */
  resendInvite(id: string): Promise<void>;
}
