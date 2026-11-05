import { consoleVenueCreateInput, consoleVenueListInput, consoleVenueUpdateInput } from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, ilike, ne, or } from "drizzle-orm";
import { db } from "../../../db/client";
import { exhibitions, venues } from "../../../db/schema";
import { AppError, consoleProcedure, router } from "../../init";

// A venue as the console shows it; `editable` when the caller's institution created it.
const toVenue = (row: typeof venues.$inferSelect, institutionId: string) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  city: row.city,
  editable: row.createdByInstitutionId === institutionId,
});

// The server picks the code from the name (SPEC §10.1): an ASCII slug, "venue" when nothing is left,
// then -2, -3, … until it is free.
const slugOf = (name: string) =>
  name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "venue";

// console.venue.* (SPEC §9.4 전시 초안): venues are shared between institutions; only the institution
// that created one may rename it, and not while another institution's published exhibition uses it.
export const consoleVenueRouter = router({
  list: consoleProcedure.input(consoleVenueListInput).query(async ({ ctx, input }) => {
    const pattern = input.q ? `%${input.q}%` : null;
    const rows = await db
      .select()
      .from(venues)
      .where(pattern ? or(ilike(venues.name, pattern), ilike(venues.city, pattern)) : undefined)
      .orderBy(asc(venues.name), asc(venues.id));
    return rows.map((row) => toVenue(row, ctx.institutionId));
  }),

  create: consoleProcedure.input(consoleVenueCreateInput).mutation(async ({ ctx, input }) => {
    const base = slugOf(input.name);
    for (let n = 1; ; n++) {
      const [row] = await db
        .insert(venues)
        .values({ code: n === 1 ? base : `${base}-${n}`, name: input.name, city: input.city, createdByInstitutionId: ctx.institutionId })
        .onConflictDoNothing({ target: venues.code })
        .returning();
      if (row) return toVenue(row, ctx.institutionId);
    }
  }),

  // Renames go straight to visitors (SPEC §9.4; the CDN purge is 미결정 35).
  update: consoleProcedure.input(consoleVenueUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...changes } = input;
    return db.transaction(async (tx) => {
      const [venue] = await tx.select().from(venues).where(eq(venues.id, id)).for("update");
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" });
      if (venue.createdByInstitutionId !== ctx.institutionId) throw new TRPCError({ code: "FORBIDDEN" });
      const [usedByOthers] = await tx
        .select({ id: exhibitions.id })
        .from(exhibitions)
        .where(and(eq(exhibitions.venueId, id), eq(exhibitions.state, "PUBLISHED"), ne(exhibitions.institutionId, ctx.institutionId)))
        .limit(1);
      if (usedByOthers) throw new TRPCError({ code: "CONFLICT", cause: new AppError("VENUE_IN_USE") });
      const [row] = await tx.update(venues).set(changes).where(eq(venues.id, id)).returning();
      return toVenue(row, ctx.institutionId);
    });
  }),
});
