const UNIQUE_VIOLATION = "23505";

// Postgres unique_violation. drizzle wraps the driver error, so the SQLSTATE may sit on the error or on its cause.
export const isUniqueViolation = (error: unknown) =>
  [error, (error as { cause?: unknown } | null)?.cause].some((e) => (e as { code?: string } | null)?.code === UNIQUE_VIOLATION);
