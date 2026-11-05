// What may be logged of an unexpected error: input values must never reach the logs (SPEC §2.3, §11.4).
// A failed query (DrizzleQueryError) prints its SQL and every bound value, and a Postgres error's detail
// repeats key values, so for those only the error's identity is kept.
export function loggable(cause: unknown): unknown {
  const isQuery = !!cause && typeof cause === "object" && "query" in cause;
  const inner = isQuery ? (cause as { cause?: unknown }).cause : cause;
  if (inner && typeof inner === "object" && "code" in inner && "severity" in inner) {
    const e = inner as { name?: string; code?: string; message?: string; constraint?: string; table?: string };
    return { name: e.name, code: e.code, message: e.message, constraint: e.constraint, table: e.table };
  }
  return isQuery ? { name: "DrizzleQueryError" } : cause;
}
