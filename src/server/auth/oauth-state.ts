import { createHash, randomBytes } from "node:crypto";

export const OAUTH_COOKIE = "still_oauth";
export type OAuthIntent = "sign_in" | "link";
type OAuthState = { state: string; verifier: string; returnTo: string; intent: OAuthIntent };

const b64url = (bytes: Buffer) => bytes.toString("base64url");
const secure = () => (process.env.STILL_ORIGIN?.startsWith("https:") ? "; Secure" : "");

// SPEC §2.3: state + PKCE verifier + returnTo live in a short HttpOnly cookie.
export function createOAuthState(input: { returnTo: string; intent: OAuthIntent }) {
  const state = b64url(randomBytes(16));
  const verifier = b64url(randomBytes(32));
  const codeChallenge = b64url(createHash("sha256").update(verifier).digest());
  const payload: OAuthState = { state, verifier, ...input };
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const cookie = `${OAUTH_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=600${secure()}`;
  return { state, codeChallenge, cookie };
}

// Returns the stored state when the cookie matches `state`, plus a Set-Cookie that clears it (consumed once).
export function consumeOAuthState(req: Request, state: string | null) {
  const clearCookie = `${OAUTH_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=0${secure()}`;
  const raw = req.headers.get("cookie")?.split("; ").find((c) => c.startsWith(`${OAUTH_COOKIE}=`));
  let stored: OAuthState | null = null;
  try {
    stored = JSON.parse(Buffer.from(raw?.slice(OAUTH_COOKIE.length + 1) ?? "", "base64url").toString());
  } catch {
    stored = null;
  }
  return { stored: stored && state !== null && stored.state === state ? stored : null, clearCookie };
}
