import { authorizeUrl } from "../../../../server/auth/google";
import { createOAuthState } from "../../../../server/auth/oauth-state";
import { safeReturnTo } from "../../../../server/auth/return-to";

// SPEC §2.4: starts the web OAuth flow with a 302 to the provider.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "google") return new Response(null, { status: 404 });
  const url = new URL(req.url);
  if (url.searchParams.get("intent") !== "sign_in") return new Response(null, { status: 400 }); // link: A11
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const { state, codeChallenge, cookie } = createOAuthState({ returnTo, intent: "sign_in" });
  const redirectUri = `${process.env.STILL_ORIGIN}/api/auth/google/callback`;
  return new Response(null, {
    status: 302,
    headers: { location: authorizeUrl({ state, codeChallenge, redirectUri }), "set-cookie": cookie, "cache-control": "no-store" },
  });
}
