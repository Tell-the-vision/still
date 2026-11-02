import { SignJWT, jwtVerify } from "jose";

export const ACCESS_TOKEN_SECONDS = 900;
const secret = () => new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);

// SPEC §2.3: short-lived JWT. `sub` is the user, `sid` the user_sessions row it is bound to.
export const signAccessToken = ({ sub, sid }: { sub: string; sid: string }) =>
  new SignJWT({ sid }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`).sign(secret());

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  return { sub: payload.sub as string, sid: payload.sid as string };
}
