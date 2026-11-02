import { archiveListInput } from "../../../../shared/src/archive";
import { exhibitionInput } from "../../../../shared/src/code";
import { getArchive, listArchives, upsertArchive } from "../../services/archives";
import { consentedProcedure, router } from "../init";

export const archiveRouter = router({
  list: consentedProcedure.input(archiveListInput).query(({ ctx, input }) => listArchives(ctx.session.userId, input)),
  get: consentedProcedure.input(exhibitionInput).query(({ ctx, input }) => getArchive(ctx.session.userId, input.code)),
  upsert: consentedProcedure.input(exhibitionInput).mutation(({ ctx, input }) => upsertArchive(ctx.session.userId, input.code)),
});
