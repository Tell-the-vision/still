import { hash, randomBytes } from "node:crypto";
import { lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "../db/client";
import { userSessions } from "../db/schema";

export const SESSION_COOKIE = "still_session";
const WEB_SESSION_SECONDS = 30 * 24 * 60 * 60;

export const hashToken = (token: string) => hash("sha256", token);
export const cookieDefaults = () =>
  ({ httpOnly: true, sameSite: "lax", secure: process.env.STILL_ORIGIN?.startsWith("https:") ?? false }) as const;

// SPEC §2.3: opaque token in the cookie, only its sha256 in the database.
export async function createWebSession(userId: string, userTokenId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.delete(userSessions).where(lt(userSessions.expiresAt, new Date())); // lazy cleanup of expired rows
  await db.insert(userSessions).values({
    userId,
    userTokenId,
    kind: "WEB",
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + WEB_SESSION_SECONDS * 1000),
  });
  return token;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieDefaults(), path: "/", maxAge: WEB_SESSION_SECONDS });
}

export async function clearSessionCookie() {
  (await cookies()).delete({ name: SESSION_COOKIE, ...cookieDefaults(), path: "/" });
}
