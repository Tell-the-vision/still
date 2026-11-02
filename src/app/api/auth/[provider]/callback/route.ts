import { exchangeCode, readIdToken } from "../../../../../server/auth/google";
import { signInWithIdentity } from "../../../../../server/auth/identity";
import { consumeOAuthState } from "../../../../../server/auth/oauth-state";
import { createWebSession, sessionCookie } from "../../../../../server/auth/sessions";

const redirect = (path: string, auth: string, clearCookie: string) => {
  const url = new URL(path, process.env.STILL_ORIGIN);
  url.searchParams.set("auth", auth);
  return new Response(null, { status: 302, headers: { location: url.toString(), "set-cookie": clearCookie, "cache-control": "no-store" } });
};

// SPEC §2.3: the state cookie is consumed exactly once, whatever the outcome.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "google") return new Response(null, { status: 404 });
  const query = new URL(req.url).searchParams;
  const { stored, clearCookie } = consumeOAuthState(req, query.get("state"));
  if (!stored) return redirect("/", "failed", clearCookie);
  const error = query.get("error");
  if (error === "access_denied") return redirect(stored.returnTo, "cancelled", clearCookie);
  const code = query.get("code");
  if (error || !code) return redirect(stored.returnTo, "failed", clearCookie);
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
    const sessionToken = await createWebSession(userId, userTokenId);
    const headers = new Headers({ location: new URL(stored.returnTo, process.env.STILL_ORIGIN).toString(), "cache-control": "no-store" });
    headers.append("set-cookie", clearCookie);
    headers.append("set-cookie", sessionCookie(sessionToken));
    return new Response(null, { status: 302, headers });
  } catch (cause) {
    console.error("Google sign-in failed", cause instanceof Error ? cause.message : "unknown");
    return redirect(stored.returnTo, "failed", clearCookie);
  }
}
