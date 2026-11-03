import type { z } from "zod";
import type { sessionCreateInput } from "@still/shared/session";
import { TRPCError } from "@trpc/server";
import { exchangeCode, readIdToken } from "./google";

const nativeClientIds = () => ({ ios: process.env.GOOGLE_IOS_CLIENT_ID, android: process.env.GOOGLE_ANDROID_CLIENT_ID });

// Exchanges a native PKCE code for the Google identity (SPEC §2.2 Sign in 4). Shared by sign-in and linking.
export async function exchangeNativeCode(req: Request, input: z.infer<typeof sessionCreateInput>) {
  const client = req.headers.get("x-client");
  const clientId = client === "ios" || client === "android" ? nativeClientIds()[client] : undefined;
  const redirects = (process.env.GOOGLE_NATIVE_REDIRECT_URIS ?? "").split(",");
  if (!clientId || !input.redirectUri || !redirects.includes(input.redirectUri)) throw new TRPCError({ code: "BAD_REQUEST" });
  const tokens = await exchangeCode({ code: input.code, verifier: input.codeVerifier ?? "", redirectUri: input.redirectUri, clientId });
  const audiences = [process.env.AUTH_GOOGLE_ID, ...Object.values(nativeClientIds())].filter((id): id is string => !!id);
  return { ...(await readIdToken(tokens.id_token, audiences)), refreshToken: tokens.refresh_token };
}
