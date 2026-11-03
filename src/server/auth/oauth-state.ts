import { hash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { cookieDefaults } from "./sessions";

export const OAUTH_COOKIE = "still_oauth";
export type OAuthIntent = "sign_in" | "link";
const oauthState = z.object({ state: z.string(), verifier: z.string(), returnTo: z.string(), intent: z.enum(["sign_in", "link"]) });
type OAuthState = z.infer<typeof oauthState>;

const cookieOptions = () => ({ ...cookieDefaults(), path: "/api/auth" });

// SPEC §2.3: state + PKCE verifier + returnTo live in a short HttpOnly cookie.
export async function createOAuthState(input: { returnTo: string; intent: OAuthIntent }) {
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const payload: OAuthState = { state, verifier, ...input };
  (await cookies()).set(OAUTH_COOKIE, Buffer.from(JSON.stringify(payload)).toString("base64url"), { ...cookieOptions(), maxAge: 600 });
  return { state, codeChallenge: hash("sha256", verifier, "base64url") };
}

// Returns the stored state when the cookie matches `state`. The cookie is always cleared (consumed once).
export async function consumeOAuthState(state: string | null): Promise<OAuthState | null> {
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, ...cookieOptions() });
  try {
    const stored = oauthState.safeParse(JSON.parse(Buffer.from(raw ?? "", "base64url").toString()));
    return stored.success && state !== null && stored.data.state === state ? stored.data : null;
  } catch {
    return null;
  }
}
