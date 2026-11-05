import { consoleSuggestionListInput, consoleSuggestionUpdateInput } from "@still/shared/console";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { exhibitions } from "../../../db/schema";
import { exhibitionRows } from "../../../services/console/exhibition-rows";
import { decideSuggestion, listSuggestions } from "../../../services/console/suggestion-write";
import { consoleProcedure, router } from "../../init";

// console.suggestion.* (SPEC §9.4 편집 제안)
export const consoleSuggestionRouter = router({
  list: consoleProcedure.input(consoleSuggestionListInput).query(async ({ ctx, input }) => {
    const [exhibition] = await exhibitionRows(ctx.institutionId, { where: eq(exhibitions.code, input.code) });
    if (!exhibition) throw new TRPCError({ code: "NOT_FOUND" });
    return listSuggestions(exhibition.id);
  }),

  update: consoleProcedure.input(consoleSuggestionUpdateInput).mutation(({ ctx, input }) =>
    decideSuggestion({ institutionId: ctx.institutionId, userId: ctx.session.userId }, input),
  ),
});
