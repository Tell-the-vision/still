import { clearSessionCookie } from "../../auth/sessions";
import { deleteMe, getMe } from "../../services/me";
import { protectedProcedure, router, sessionProcedure } from "../init";

export const meRouter = router({
  get: sessionProcedure.query(({ ctx }) => getMe(ctx.session)),
  // Permanent deletion (SPEC §2.2); sessions go with the user via cascade.
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteMe(ctx.session.userId);
    await clearSessionCookie();
  }),
});
