import { consoleContentGetInput, consoleContentListInput } from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { contents, exhibitions } from "../../../db/schema";
import { contentRows } from "../../../services/console/content-rows";
import { exhibitionRows } from "../../../services/console/exhibition-rows";
import { consoleProcedure, router } from "../../init";

// console.content.* (SPEC §9.4 검토, §10.8, Figma A2). Only the caller's institution; another
// institution's exhibition or item is NOT_FOUND (SPEC §9.2 권한).
export const consoleContentRouter = router({
  // The exhibition's contents, oldest first.
  list: consoleProcedure.input(consoleContentListInput).query(async ({ ctx, input }) => {
    const [exhibition] = await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.code, input.code) });
    if (!exhibition) throw new TRPCError({ code: "NOT_FOUND" });
    return contentRows(exhibition.id);
  }),

  // One item. `sources` (the referenced source text and page renders) needs the analysis manifests,
  // which do not exist yet, so it is empty.
  get: consoleProcedure.input(consoleContentGetInput).query(async ({ ctx, input }) => {
    const [owned] = await db.select({ exhibitionId: contents.exhibitionId }).from(contents).where(eq(contents.id, input.id));
    const [exhibition] = owned ? await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.id, owned.exhibitionId) }) : [];
    const [row] = exhibition ? await contentRows(exhibition.id, { where: eq(contents.id, input.id) }) : [];
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return { ...row, sources: [] };
  }),
});
