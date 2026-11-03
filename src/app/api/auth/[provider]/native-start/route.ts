import { NextResponse } from "next/server";
import { authorizeUrl } from "../../../../../server/auth/google";
import { isAllowedAppReturnUrl, relayUrl } from "../../../../../server/auth/native-relay";

// Starts native sign-in: wraps the app's return URL and nonce into the OAuth state, then redirects to Google.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  if ((await params).provider !== "google") return new Response(null, { status: 404 });
  const query = new URL(req.url).searchParams;
  const returnUrl = query.get("returnUrl");
  const codeChallenge = query.get("codeChallenge");
  const nonce = query.get("state");
  if (!isAllowedAppReturnUrl(returnUrl) || !codeChallenge || !nonce) return new Response(null, { status: 400 });
  const state = Buffer.from(JSON.stringify({ returnUrl, nonce })).toString("base64url");
  return NextResponse.redirect(authorizeUrl({ state, codeChallenge, redirectUri: relayUrl() }), {
    status: 302,
    headers: { "cache-control": "no-store" },
  });
}
