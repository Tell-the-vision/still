import { decodeJwt } from "jose";

const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

export async function exchangeCode(input: { code: string; verifier: string; redirectUri: string; clientId: string; clientSecret?: string }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.verifier,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
  });
  if (input.clientSecret) body.set("client_secret", input.clientSecret);
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  return (await res.json()) as { id_token: string; refresh_token?: string };
}

// The id_token arrives straight from Google's token endpoint over TLS, so the signature is not re-verified (SPEC §2.2).
export function readIdToken(idToken: string, allowedAud: string[]) {
  const claims = decodeJwt(idToken);
  const aud = [claims.aud ?? []].flat();
  if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) throw new Error("Bad id_token issuer");
  if (!aud.some((a) => allowedAud.includes(a))) throw new Error("Bad id_token audience");
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("Expired id_token");
  if (!claims.sub) throw new Error("Missing id_token subject");
  return { subject: claims.sub, email: claims.email as string | undefined, displayName: claims.name as string | undefined };
}

export function authorizeUrl(input: { state: string; codeChallenge: string; redirectUri: string }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID ?? "",
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}
