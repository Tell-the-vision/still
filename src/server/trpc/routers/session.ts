import { sessionCreateInput, sessionRefreshInput } from "@still/shared/session";
import { eq } from "drizzle-orm";
import { exchangeNativeCode } from "../../auth/google-native";
import { signInWithIdentity } from "../../auth/identity";
import { clearSessionCookie } from "../../auth/sessions";
import { db } from "../../db/client";
import { userSessions } from "../../db/schema";
import { createAppSession, rotateAppSession } from "../../services/app-sessions";
import { getMe } from "../../services/me";
import { clientProcedure, protectedProcedure, router } from "../init";

export const sessionRouter = router({
  // Native sign-in (SPEC §2.2 Sign in 4): exchange the Google code, then issue app tokens.
  create: clientProcedure.input(sessionCreateInput).mutation(async ({ input, ctx }) => {
    const identity = await exchangeNativeCode(ctx.req, input);
    const { userId, userTokenId } = await signInWithIdentity({ provider: "GOOGLE", ...identity });
    const appSession = await createAppSession(userId, userTokenId);
    return { ...appSession, user: await getMe({ userId, userTokenId }) };
  }),

  // SPEC §2.3: trade a refresh token for a new pair.
  refresh: clientProcedure.input(sessionRefreshInput).mutation(({ input }) => rotateAppSession(input.refreshToken)),

  // Sign out (SPEC §2.2): drop this session's row and clear the web cookie.
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(userSessions).where(eq(userSessions.tokenHash, ctx.session.tokenHash));
    await clearSessionCookie();
  }),
});
