import { NextResponse } from "next/server";
import { ipAllowed } from "../../../../server/rate-limit";
import { authorizeUrl } from "../../../../server/auth/google";
import { createOAuthState } from "../../../../server/auth/oauth-state";
import { currentWebSession } from "../../../../server/auth/sessions";
import { safeReturnTo } from "../../../../server/auth/return-to";

const redirectLinkFailed = (returnTo: string) => {
  const url = new URL(returnTo, process.env.STILL_ORIGIN);
  url.searchParams.set("link", "failed");
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store" } });
};

// SPEC §2.4: starts the web OAuth flow with a 302 to the provider.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "google") return new Response(null, { status: 404 });
  if (!ipAllowed(req)) return new Response(null, { status: 429 });
  const url = new URL(req.url);
  const intent = url.searchParams.get("intent");
  if (intent !== "sign_in" && intent !== "link") return new Response(null, { status: 400 });
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  if (intent === "link" && !(await currentWebSession())) return redirectLinkFailed(returnTo);
  const { state, codeChallenge } = await createOAuthState({ returnTo, intent });
  const redirectUri = `${process.env.STILL_ORIGIN}/api/auth/google/callback`;
  return NextResponse.redirect(authorizeUrl({ state, codeChallenge, redirectUri }), {
    status: 302,
    headers: { "cache-control": "no-store" },
  });
}
