import { consoleDocumentUploadCreateInput } from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { documents, exhibitions } from "../../../db/schema";
import { presignModelInputPut, presignPrivatePut } from "../../../media/r2";
import { documentPrefix, extractionFileOf } from "../../../services/console/manifests";
import { consoleProcedure, router } from "../../init";

// console.documentUpload.* (SPEC §9.4 처리 구조, §9.5): presigned PUT URLs for what the browser extraction
// module produces, always under the document's own prefix, so a browser can write nowhere else.
export const consoleDocumentUploadRouter = router({
  create: consoleProcedure.input(consoleDocumentUploadCreateInput).mutation(async ({ ctx, input }) => {
    const [document] = await db
      .select({ exhibitionId: documents.exhibitionId, status: documents.status })
      .from(documents)
      .innerJoin(exhibitions, eq(exhibitions.id, documents.exhibitionId))
      .where(and(eq(documents.id, input.documentId), eq(exhibitions.institutionId, ctx.institutionId)));
    if (!document) throw new TRPCError({ code: "NOT_FOUND" });
    if (document.status !== "STORED" && document.status !== "EXTRACTED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Extraction outputs can be uploaded for a stored document only." });
    }

    const prefix = documentPrefix(ctx.institutionId, document.exhibitionId, input.documentId);
    const uploads = await Promise.all(
      input.files.map(async ({ name }) => {
        const file = extractionFileOf(input.documentId, name);
        if (!file) throw new TRPCError({ code: "BAD_REQUEST", message: `Not an extraction output: ${name}` });
        const put = file.bucket === "private" ? await presignPrivatePut(prefix + name) : await presignModelInputPut(name);
        return { name, method: "PUT" as const, ...put };
      }),
    );
    return { uploads };
  }),
});
