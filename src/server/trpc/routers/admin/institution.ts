import { adminInstitutionGetInput, adminInstitutionListInput, adminInstitutionUpdateInput } from "@still/shared/admin";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db/client";
import { institutions, userSessions, users } from "../../../db/schema";
import { createdAtMs, displayStatusWhere, institutionRows } from "../../../services/admin/institution-rows";
import { adminProcedure, router } from "../../init";

const DEFAULT_LIMIT = 20;

// The cursor is the last row's createdAt + id, opaque to the client (keyset, not offset).
const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.uuid() });
const encodeCursor = (row: { createdAt: string; id: string }) => Buffer.from(JSON.stringify({ createdAt: row.createdAt, id: row.id })).toString("base64url");
function decodeCursor(cursor: string) {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
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

// admin.institution.* (SPEC §9.2 기관 목록, §9.5, Figma A9)
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

  // Rename, suspend or reactivate, or set the daily analysis token limit (SPEC §9.2, §10.5).
  // Suspending deletes the sessions of every user of the institution in the same transaction, so no
  // request passes between the status change and the sign-out. Reactivating deletes nothing.
  update: adminProcedure.input(adminInstitutionUpdateInput).mutation(async ({ input }) => {
    const { id, ...changes } = input;
    const found = await db.transaction(async (tx) => {
      const changed = Object.values(changes).some((value) => value !== undefined);
      const [row] = changed
        ? await tx.update(institutions).set(changes).where(eq(institutions.id, id)).returning({ id: institutions.id })
        : await tx.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, id));
      if (row && changes.status === "SUSPENDED") {
        const staff = tx.select({ id: users.id }).from(users).where(eq(users.institutionId, id));
        await tx.delete(userSessions).where(inArray(userSessions.userId, staff));
      }
      return row;
    });
    if (!found) throw new TRPCError({ code: "NOT_FOUND" });
    const [row] = await institutionRows({ where: eq(institutions.id, id) });
    return row;
  }),
});
