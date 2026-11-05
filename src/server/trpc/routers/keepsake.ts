import { keepsakePageInput, keepsakeUpsertInput } from "@still/shared/keepsake";
import { exhibitionInput } from "../../../../shared/src/code";
import { deleteKeepsake, getKeepsake, listKeepsakes, upsertKeepsake } from "../../services/keepsakes";
import { consentedProcedure, router } from "../init";

// One keepsake per guide page: each artwork's card is its own.
export const keepsakeRouter = router({
  list: consentedProcedure.input(exhibitionInput).query(({ ctx, input }) => listKeepsakes(ctx.session.userId, input.code)),
  get: consentedProcedure.input(keepsakePageInput).query(({ ctx, input }) => getKeepsake(ctx.session.userId, input.code, input.page)),
  upsert: consentedProcedure.input(keepsakeUpsertInput).mutation(({ ctx, input }) => upsertKeepsake(ctx.session.userId, input)),
  delete: consentedProcedure.input(keepsakePageInput).mutation(({ ctx, input }) => deleteKeepsake(ctx.session.userId, input.code, input.page)),
});
