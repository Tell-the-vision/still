import { sessionCreateInput, sessionRefreshInput } from "@still/shared/session";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { exchangeCode, readIdToken } from "../../auth/google";
import { signInWithIdentity } from "../../auth/identity";
import { clearSessionCookie } from "../../auth/sessions";
import { db } from "../../db/client";
import { userSessions } from "../../db/schema";
import { createAppSession, rotateAppSession } from "../../services/app-sessions";
import { getMe } from "../../services/me";
import { protectedProcedure, publicProcedure, router } from "../init";

const nativeClientIds = () => ({ ios: process.env.GOOGLE_IOS_CLIENT_ID, android: process.env.GOOGLE_ANDROID_CLIENT_ID });

export const sessionRouter = router({
  // Native sign-in (SPEC §2.2 Sign in 4): exchange the Google code, then issue app tokens.
  create: publicProcedure.input(sessionCreateInput).mutation(async ({ input, ctx }) => {
    const client = ctx.req.headers.get("x-client");
    const clientId = client === "ios" || client === "android" ? nativeClientIds()[client] : undefined;
    const redirects = (process.env.GOOGLE_NATIVE_REDIRECT_URIS ?? "").split(",");
    if (!clientId || !input.redirectUri || !redirects.includes(input.redirectUri)) throw new TRPCError({ code: "BAD_REQUEST" });
    const tokens = await exchangeCode({ code: input.code, verifier: input.codeVerifier ?? "", redirectUri: input.redirectUri, clientId });
    const audiences = [process.env.AUTH_GOOGLE_ID, ...Object.values(nativeClientIds())].filter((id): id is string => !!id);
    const identity = readIdToken(tokens.id_token, audiences);
    const { userId, userTokenId } = await signInWithIdentity({ provider: "GOOGLE", ...identity, refreshToken: tokens.refresh_token });
    const appSession = await createAppSession(userId, userTokenId);
    return { ...appSession, user: await getMe({ userId, userTokenId }) };
  }),

  // SPEC §2.3: trade a refresh token for a new pair.
  refresh: publicProcedure.input(sessionRefreshInput).mutation(({ input }) => rotateAppSession(input.refreshToken)),

  // Sign out (SPEC §2.2): drop this session's row and clear the web cookie.
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(userSessions).where(eq(userSessions.tokenHash, ctx.session.tokenHash));
    await clearSessionCookie();
  }),
});
