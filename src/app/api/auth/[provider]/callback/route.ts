import { NextResponse } from "next/server";
import { exchangeCode, readIdToken } from "../../../../../server/auth/google";
import { signInWithIdentity } from "../../../../../server/auth/identity";
import { consumeOAuthState } from "../../../../../server/auth/oauth-state";
import { createWebSession, setSessionCookie } from "../../../../../server/auth/sessions";

const redirectTo = (path: string, auth?: "cancelled" | "failed") => {
  const url = new URL(path, process.env.STILL_ORIGIN);
  if (auth) url.searchParams.set("auth", auth);
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
};

// SPEC §2.3: the state cookie is consumed exactly once, whatever the outcome.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "google") return new Response(null, { status: 404 });
  const query = new URL(req.url).searchParams;
  const stored = await consumeOAuthState(query.get("state"));
  if (!stored) return redirectTo("/", "failed");
  const error = query.get("error");
  if (error === "access_denied") return redirectTo(stored.returnTo, "cancelled");
  const code = query.get("code");
  if (error || !code) return redirectTo(stored.returnTo, "failed");
  try {
    const clientId = process.env.AUTH_GOOGLE_ID ?? "";
    const tokens = await exchangeCode({
      code,
      verifier: stored.verifier,
      redirectUri: `${process.env.STILL_ORIGIN}/api/auth/google/callback`,
      clientId,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    });
    const profile = readIdToken(tokens.id_token, [clientId]);
    const { userId, userTokenId } = await signInWithIdentity({ provider: "GOOGLE", ...profile, refreshToken: tokens.refresh_token });
    await setSessionCookie(await createWebSession(userId, userTokenId));
    return redirectTo(stored.returnTo);
  } catch (cause) {
    console.error("Google sign-in failed", cause instanceof Error ? cause.message : "unknown");
    return redirectTo(stored.returnTo, "failed");
  }
}
