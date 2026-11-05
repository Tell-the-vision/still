export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly appCode?: string) {
    super(message);
  }
}

/** No STILL staff session (or it expired): the app shows /admin/sign-in. */
export const isUnauthorized = (e: unknown) => e instanceof ApiError && e.code === "UNAUTHORIZED";
