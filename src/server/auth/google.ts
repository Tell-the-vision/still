import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"] as const;
const idTokenClaims = z.object({
  iss: z.enum(GOOGLE_ISSUERS),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
  sub: z.string().min(1),
  email: z.string().optional(),
  name: z.string().optional(),
});

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

const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

// Verifies the id_token signature against Google's published keys, then issuer, audience and expiry (SPEC §2.2).
export async function readIdToken(idToken: string, allowedAud: string[]) {
  const { payload } = await jwtVerify(idToken, createRemoteJWKSet(GOOGLE_JWKS_URL), { issuer: [...GOOGLE_ISSUERS], audience: allowedAud });
  const parsed = idTokenClaims.safeParse(payload);
  if (!parsed.success) throw new Error("Bad id_token claims");
  const claims = parsed.data;
  return { subject: claims.sub, email: claims.email, displayName: claims.name };
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
