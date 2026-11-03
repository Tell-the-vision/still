import { exhibitionInput } from "../../../../shared/src/code";
import { getGuide } from "../../services/guide";
import { publicProcedure, router } from "../init";

export const guideRouter = router({
  get: publicProcedure.input(exhibitionInput).query(({ input }) => getGuide(input.code)),
});
