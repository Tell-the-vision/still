import { keepsakeUpsertInput } from "@still/shared/keepsake";
import { exhibitionInput } from "../../../../shared/src/code";
import { deleteKeepsake, getKeepsake, upsertKeepsake } from "../../services/keepsakes";
import { consentedProcedure, router } from "../init";

export const keepsakeRouter = router({
  get: consentedProcedure.input(exhibitionInput).query(({ ctx, input }) => getKeepsake(ctx.session.userId, input.code)),
  upsert: consentedProcedure.input(keepsakeUpsertInput).mutation(({ ctx, input }) => upsertKeepsake(ctx.session.userId, input)),
  delete: consentedProcedure.input(exhibitionInput).mutation(({ ctx, input }) => deleteKeepsake(ctx.session.userId, input.code)),
});
