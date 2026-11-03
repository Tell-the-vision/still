import { exhibitionInput } from "../../../../shared/src/code";
import { getPublishedExhibition, toExhibition } from "../../services/exhibitions";
import { publicProcedure, router } from "../init";

export const exhibitionRouter = router({
  get: publicProcedure
    .input(exhibitionInput)
    .query(async ({ input }) => toExhibition(await getPublishedExhibition(input.code))),
});
