import { clearSessionCookie } from "../../auth/sessions";
import { deleteMe, getMe, getStaffMe } from "../../services/me";
import { callerProcedure, protectedProcedure, router } from "../init";

export const meRouter = router({
  // Every role reads its own profile; staff also get role, institution and mustChangePassword (SPEC §9.5).
  get: callerProcedure.query(({ ctx }) => (ctx.surface === "visitor" ? getMe(ctx.session) : getStaffMe(ctx.session))),
  // Permanent deletion (SPEC §2.2); sessions go with the user via cascade. Visitors only (SPEC §10.5).
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteMe(ctx.session.userId);
    await clearSessionCookie();
  }),
});
