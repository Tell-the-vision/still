import { exhibitionInput } from "../../../../shared/src/code";
import { scrapInput } from "../../../../shared/src/scrap";
import { deleteScrap, listScraps, upsertScrap } from "../../services/scraps";
import { consentedProcedure, router } from "../init";

export const scrapRouter = router({
  list: consentedProcedure.input(exhibitionInput).query(({ ctx, input }) => listScraps(ctx.session.userId, input.code)),
  upsert: consentedProcedure.input(scrapInput).mutation(({ ctx, input }) => upsertScrap(ctx.session.userId, input.code, input.sentenceId)),
  delete: consentedProcedure.input(scrapInput).mutation(({ ctx, input }) => deleteScrap(ctx.session.userId, input.code, input.sentenceId)),
});
