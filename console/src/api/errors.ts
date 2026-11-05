// Errors shared by the mock and the server adapter, so screens can tell "not signed in" apart from other failures.

export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly appCode?: string) {
    super(message);
  }
}

/** tRPC's UNAUTHORIZED code: no staff session, or it expired. The app shows the sign-in screen. */
export const isUnauthorized = (e: unknown) => e instanceof ApiError && e.code === "UNAUTHORIZED";
