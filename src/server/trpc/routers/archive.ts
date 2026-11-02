import { exhibitionInput } from "../../../../shared/src/code";
import { upsertArchive } from "../../services/archives";
import { consentedProcedure, router } from "../init";

export const archiveRouter = router({
  upsert: consentedProcedure.input(exhibitionInput).mutation(({ ctx, input }) => upsertArchive(ctx.session.userId, input.code)),
});
