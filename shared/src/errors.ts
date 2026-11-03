// Application error codes carried in `error.data.appCode` (SPEC §11.2).
export const APP_CODES = [
  "JOURNAL_INVALID",
  "EXCERPT_NOT_IN_JOURNAL",
  "SCRAP_NOT_IN_ARCHIVE",
  "UNKNOWN_TEMPLATE",
  "POLICY_VERSION_OUTDATED",
  "CONSENT_REQUIRED",
  "IDENTITY_ALREADY_LINKED",
  "LAST_IDENTITY",
  "REVISION_MISMATCH",
  "CLIENT_UPGRADE_REQUIRED",
] as const;

export type AppCode = (typeof APP_CODES)[number];
