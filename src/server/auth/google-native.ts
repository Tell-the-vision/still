import type { z } from "zod";
import type { sessionCreateInput } from "@still/shared/session";
import { TRPCError } from "@trpc/server";
import { exchangeCode, readIdToken } from "./google";
import { relayUrl } from "./native-relay";

const nativeClientIds = () => ({ ios: process.env.GOOGLE_IOS_CLIENT_ID, android: process.env.GOOGLE_ANDROID_CLIENT_ID });

// Web-client path: the code was issued to the relay redirect, so it is exchanged with the web client id and secret.
async function exchangeViaRelay(input: z.infer<typeof sessionCreateInput>) {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const verifier = input.codeVerifier;
  if (!clientId || !verifier || verifier.length < 43 || verifier.length > 128) throw new TRPCError({ code: "BAD_REQUEST" });
  const tokens = await exchangeCode({ code: input.code, verifier, redirectUri: relayUrl(), clientId, clientSecret: process.env.AUTH_GOOGLE_SECRET });
  return { ...(await readIdToken(tokens.id_token, [clientId])), refreshToken: tokens.refresh_token };
}

// Exchanges a native PKCE code for the Google identity (SPEC §2.2 Sign in 4). Shared by sign-in and linking.
export async function exchangeNativeCode(req: Request, input: z.infer<typeof sessionCreateInput>) {
  if (input.redirectUri === relayUrl()) return exchangeViaRelay(input);
  const client = req.headers.get("x-client");
  const clientId = client === "ios" || client === "android" ? nativeClientIds()[client] : undefined;
  const redirects = (process.env.GOOGLE_NATIVE_REDIRECT_URIS ?? "").split(",");
  if (!clientId || !input.redirectUri || !redirects.includes(input.redirectUri)) throw new TRPCError({ code: "BAD_REQUEST" });
  const tokens = await exchangeCode({ code: input.code, verifier: input.codeVerifier ?? "", redirectUri: input.redirectUri, clientId });
  const audiences = [process.env.AUTH_GOOGLE_ID, ...Object.values(nativeClientIds())].filter((id): id is string => !!id);
  return { ...(await readIdToken(tokens.id_token, audiences)), refreshToken: tokens.refresh_token };
}
