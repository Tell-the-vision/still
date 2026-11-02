import { journalUpsertInput } from "@still/shared/journal";
import { exhibitionInput } from "../../../../shared/src/code";
import { getJournal, upsertJournal } from "../../services/journals";
import { consentedProcedure, router } from "../init";

export const journalRouter = router({
  get: consentedProcedure.input(exhibitionInput).query(({ ctx, input }) => getJournal(ctx.session.userId, input.code)),
  upsert: consentedProcedure.input(journalUpsertInput).mutation(({ ctx, input }) => upsertJournal(ctx.session.userId, input)),
});
