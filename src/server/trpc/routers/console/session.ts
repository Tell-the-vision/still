import { consoleSessionCreateInput } from "@still/shared/staff-session";
import { TRPCError } from "@trpc/server";
import { passwordSignIn } from "../../../auth/password-sign-in";
import { createStaffSession, setStaffCookie } from "../../../auth/sessions";
import { loginAllowed } from "../../../rate-limit";
import { getStaffMe } from "../../../services/me";
import { ipLimitedProcedure, router } from "../../init";

export const consoleSessionRouter = router({
  // Institution staff sign in with institution ID, work email and password (SPEC §9.5, §10.5, Figma A10).
  // "Remember this device" keeps the session 30 days instead of until the browser closes.
  create: ipLimitedProcedure.input(consoleSessionCreateInput).mutation(async ({ input }) => {
    if (!loginAllowed(input.email)) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
    const { remember = false, ...credentials } = input;
    const signedIn = await passwordSignIn({ role: "INSTITUTION", ...credentials });
    if (!signedIn) throw new TRPCError({ code: "UNAUTHORIZED", message: "Institution ID, email or password is incorrect." });
    await setStaffCookie("console", await createStaffSession(signedIn.userId, signedIn.userTokenId, remember), remember);
    return getStaffMe(signedIn);
  }),
});
