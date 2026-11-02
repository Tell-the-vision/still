import { getMe } from "../../services/me";
import { protectedProcedure, router } from "../init";

export const meRouter = router({
  get: protectedProcedure.query(({ ctx }) => getMe(ctx.session)),
});
