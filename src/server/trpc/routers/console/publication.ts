import { consolePublicationCreateInput, consolePublicationDeleteInput } from "@still/shared/console";
import { publishExhibition, unpublishExhibition } from "../../../services/console/publish";
import { consoleProcedure, router } from "../../init";

// console.publication.* (SPEC §10.9 발행 쓰기 경로, Figma A5/A6). Another institution's code is NOT_FOUND.
export const consolePublicationRouter = router({
  create: consoleProcedure
    .input(consolePublicationCreateInput)
    .mutation(({ ctx, input }) => publishExhibition({ institutionId: ctx.institutionId, userId: ctx.session.userId, ...input })),
  delete: consoleProcedure.input(consolePublicationDeleteInput).mutation(({ ctx, input }) => unpublishExhibition(ctx.institutionId, input.code)),
});
