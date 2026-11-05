import type { Institution } from "./types";

export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly appCode?: string) {
    super(message);
  }
}

/** No STILL staff session (or it expired): the app shows /admin/sign-in. */
export const isUnauthorized = (e: unknown) => e instanceof ApiError && e.code === "UNAUTHORIZED";

/** Issuing an institution is two steps. This is the second failing: the institution exists, its first account does not. */
export class AccountNotIssuedError extends ApiError {
  constructor(message: string, readonly institution: Institution, appCode?: string) {
    super(message, undefined, appCode);
  }
}
