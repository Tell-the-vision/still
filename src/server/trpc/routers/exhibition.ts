import { z } from "zod";
import { exhibitionInput } from "../../../../shared/src/code";
import { getPublishedExhibition, listPublishedExhibitions, toExhibition } from "../../services/exhibitions";
import { publicProcedure, router } from "../init";

const listInput = z.object({ scope: z.enum(["ON_VIEW", "ALL"]).default("ON_VIEW") });

export const exhibitionRouter = router({
  list: publicProcedure.input(listInput).query(({ input }) => listPublishedExhibitions(input.scope)),
  get: publicProcedure
    .input(exhibitionInput)
    .query(async ({ input }) => toExhibition(await getPublishedExhibition(input.code))),
});
