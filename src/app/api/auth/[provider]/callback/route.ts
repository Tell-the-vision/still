import { NextResponse } from "next/server";
import { ipAllowed } from "../../../../../server/rate-limit";
import { exchangeCode, readIdToken } from "../../../../../server/auth/google";
import { signInWithIdentity } from "../../../../../server/auth/identity";
import { consumeOAuthState } from "../../../../../server/auth/oauth-state";
import { linkIdentity } from "../../../../../server/services/identities";
import { createWebSession, currentWebSession, setSessionCookie } from "../../../../../server/auth/sessions";

type Result = { auth: "cancelled" | "failed" } | { link: "created" | "exists" | "conflict" | "failed" };
const redirectTo = (path: string, result?: Result) => {
  const url = new URL(path, process.env.STILL_ORIGIN);
  if (result) for (const [key, value] of Object.entries(result)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
};

// SPEC §2.3: the state cookie is consumed exactly once, whatever the outcome.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "google") return new Response(null, { status: 404 });
  if (!ipAllowed(req)) return new Response(null, { status: 429 });
  const query = new URL(req.url).searchParams;
  const stored = await consumeOAuthState(query.get("state"));
  if (!stored) return redirectTo("/", { auth: "failed" });
  const linking = stored.intent === "link";
  const failed: Result = linking ? { link: "failed" } : { auth: "failed" };
  const error = query.get("error");
  if (error === "access_denied") return redirectTo(stored.returnTo, linking ? failed : { auth: "cancelled" });
  const code = query.get("code");
  if (error || !code) return redirectTo(stored.returnTo, failed);
  try {
    const clientId = process.env.AUTH_GOOGLE_ID ?? "";
    const tokens = await exchangeCode({
      code,
      verifier: stored.verifier,
      redirectUri: `${process.env.STILL_ORIGIN}/api/auth/google/callback`,
      clientId,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    });
    const profile = await readIdToken(tokens.id_token, [clientId]);
    if (linking) {
      const session = await currentWebSession();
      if (!session) return redirectTo(stored.returnTo, failed);
      const { outcome } = await linkIdentity(session.userId, { provider: "GOOGLE", ...profile, refreshToken: tokens.refresh_token });
      return redirectTo(stored.returnTo, { link: outcome });
    }
    const { userId, userTokenId } = await signInWithIdentity({ provider: "GOOGLE", ...profile, refreshToken: tokens.refresh_token });
    await setSessionCookie(await createWebSession(userId, userTokenId));
    return redirectTo(stored.returnTo);
  } catch (cause) {
    console.error("Google sign-in failed", cause instanceof Error ? cause.message : "unknown");
    return redirectTo(stored.returnTo, failed);
  }
}
