import { sessionCreateInput, sessionRefreshInput } from "@still/shared/session";
import { eq } from "drizzle-orm";
import { exchangeNativeCode } from "../../auth/google-native";
import { signInWithIdentity } from "../../auth/identity";
import { clearSessionCookie, clearStaffCookie } from "../../auth/sessions";
import { db } from "../../db/client";
import { userSessions } from "../../db/schema";
import { createAppSession, rotateAppSession } from "../../services/app-sessions";
import { getMe } from "../../services/me";
import { callerProcedure, ipLimitedProcedure, router } from "../init";

export const sessionRouter = router({
  // Native sign-in (SPEC §2.2 Sign in 4): exchange the Google code, then issue app tokens.
  create: ipLimitedProcedure.input(sessionCreateInput).mutation(async ({ input, ctx }) => {
    const identity = await exchangeNativeCode(ctx.req, input);
    const { userId, userTokenId } = await signInWithIdentity({ provider: "GOOGLE", ...identity });
    const appSession = await createAppSession(userId, userTokenId);
    return { ...appSession, user: await getMe({ userId, userTokenId }) };
  }),

  // SPEC §2.3: trade a refresh token for a new pair.
  refresh: ipLimitedProcedure.input(sessionRefreshInput).mutation(({ input }) => rotateAppSession(input.refreshToken)),

  // Sign out (SPEC §2.2, §9.5 every role): drop this session's row and clear that app's cookie.
  delete: callerProcedure.mutation(async ({ ctx }) => {
    await db.delete(userSessions).where(eq(userSessions.tokenHash, ctx.session.tokenHash));
    if (ctx.surface === "visitor") await clearSessionCookie();
    else await clearStaffCookie(ctx.surface);
  }),
});
