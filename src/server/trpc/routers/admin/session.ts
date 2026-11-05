import { adminSessionCreateInput } from "@still/shared/staff-session";
import { TRPCError } from "@trpc/server";
import { passwordSignIn } from "../../../auth/password-sign-in";
import { createStaffSession, setStaffCookie } from "../../../auth/sessions";
import { loginAllowed } from "../../../rate-limit";
import { getStaffMe } from "../../../services/me";
import { ipLimitedProcedure, router } from "../../init";

export const adminSessionRouter = router({
  // Operator sign-in with email and password (SPEC §9.5, §10.5). Sign-out is session.delete.
  create: ipLimitedProcedure.input(adminSessionCreateInput).mutation(async ({ input }) => {
    if (!loginAllowed(input.email)) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
    const signedIn = await passwordSignIn({ role: "ADMIN", ...input });
    if (!signedIn) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
    await setStaffCookie("admin", await createStaffSession(signedIn.userId, signedIn.userTokenId, false), false);
    return getStaffMe(signedIn);
  }),
});
