import { TRPCError } from "@trpc/server";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { adminInstitutionGetInput, adminInstitutionListInput } from "@still/shared/admin";
import { db } from "../../../db/client";
import { institutions } from "../../../db/schema";
import { createdAtMs, displayStatusWhere, institutionRows } from "../../../services/admin/institution-rows";
import { AppError, adminProcedure, router } from "../../init";

const DEFAULT_LIMIT = 20;

// The cursor is the last row's createdAt + id, opaque to the client (keyset, not offset).
const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.uuid() });
const encodeCursor = (row: { createdAt: string; id: string }) => Buffer.from(JSON.stringify({ createdAt: row.createdAt, id: row.id })).toString("base64url");
function decodeCursor(cursor: string) {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", cause: new AppError("CODE_INVALID") });
  }
}

// Escapes LIKE wildcards so q is a plain substring.
const contains = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

// The four A9 metric cards: every institution, whatever the list filters are.
async function institutionCounts() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`(count(*) FILTER (WHERE ${displayStatusWhere("ACTIVE")}))::int`,
      pendingSetup: sql<number>`(count(*) FILTER (WHERE ${displayStatusWhere("PENDING_SETUP")}))::int`,
      suspended: sql<number>`(count(*) FILTER (WHERE ${displayStatusWhere("SUSPENDED")}))::int`,
    })
    .from(institutions);
  return row;
}

// admin.institution.* (SPEC §9.5, Figma A10 -> A9 기관 목록)
export const adminInstitutionRouter = router({
  list: adminProcedure.input(adminInstitutionListInput).query(async ({ input }) => {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const where = and(
      input.q ? or(ilike(institutions.name, contains(input.q)), ilike(institutions.code, contains(input.q))) : undefined,
      input.status ? displayStatusWhere(input.status) : undefined,
      cursor ? sql`(${createdAtMs}, ${institutions.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)` : undefined,
    );
    // One extra row tells whether another page follows.
    const rows = await institutionRows({ where, limit: limit + 1 });
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
      counts: await institutionCounts(),
    };
  }),

  get: adminProcedure.input(adminInstitutionGetInput).query(async ({ input }) => {
    const [row] = await institutionRows({ where: eq(institutions.id, input.id), limit: 1 });
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return row;
  }),
});
