import { consoleImageListInput, consoleImageUpdateInput } from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { exhibitions, images } from "../../../db/schema";
import { exhibitionRows } from "../../../services/console/exhibition-rows";
import { consoleProcedure, router } from "../../init";

// An image as the console shows it. Whether a public copy exists is all it learns about the file:
// the object key never leaves the server (SPEC §10.3).
const toImage = (row: typeof images.$inferSelect) => ({
  id: row.id,
  documentId: row.documentId,
  manifestAssetId: row.manifestAssetId,
  altText: row.altText,
  credit: row.credit,
  rights: row.rights,
  verification: row.verification,
  width: row.width,
  height: row.height,
  published: row.objectKey !== null,
});

// console.image.* (SPEC §10.7). Only the caller's institution; another institution's image is NOT_FOUND.
export const consoleImageRouter = router({
  list: consoleProcedure.input(consoleImageListInput).query(async ({ ctx, input }) => {
    const [exhibition] = await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.code, input.code) });
    if (!exhibition) throw new TRPCError({ code: "NOT_FOUND" });
    const rows = await db.select().from(images).where(eq(images.exhibitionId, exhibition.id)).orderBy(asc(images.createdAt), asc(images.id));
    return rows.map(toImage);
  }),

  update: consoleProcedure.input(consoleImageUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...changes } = input;
    const [owned] = await db.select({ exhibitionId: images.exhibitionId }).from(images).where(eq(images.id, id));
    const [exhibition] = owned ? await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.id, owned.exhibitionId) }) : [];
    if (!exhibition) throw new TRPCError({ code: "NOT_FOUND" });
    const [row] = await db.update(images).set(changes).where(eq(images.id, id)).returning();
    return toImage(row);
  }),
});
