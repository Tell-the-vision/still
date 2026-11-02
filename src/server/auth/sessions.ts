import { createHash, randomBytes } from "node:crypto";
import { lt } from "drizzle-orm";
import { db } from "../db/client";
import { userSessions } from "../db/schema";

export const SESSION_COOKIE = "still_session";
const WEB_SESSION_SECONDS = 30 * 24 * 60 * 60;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const secure = () => (process.env.STILL_ORIGIN?.startsWith("https:") ? "; Secure" : "");

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

export const sessionCookie = (token: string) =>
  `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${WEB_SESSION_SECONDS}${secure()}`;

export const clearSessionCookie = () => `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure()}`;
