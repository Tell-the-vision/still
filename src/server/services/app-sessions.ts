import { randomBytes } from "node:crypto";
import { lt } from "drizzle-orm";
import { ACCESS_TOKEN_SECONDS, signAccessToken } from "../auth/access-token";
import { hashToken } from "../auth/sessions";
import { db } from "../db/client";
import { userSessions } from "../db/schema";

const APP_SESSION_SECONDS = 90 * 24 * 60 * 60;

// SPEC §2.3: opaque refresh token (only its hash is stored) plus a short-lived access token.
export async function createAppSession(userId: string, userTokenId: string) {
  const refreshToken = randomBytes(32).toString("base64url");
  await db.delete(userSessions).where(lt(userSessions.expiresAt, new Date())); // lazy cleanup of expired rows
  const [row] = await db
    .insert(userSessions)
    .values({
      userId,
      userTokenId,
      kind: "APP",
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + APP_SESSION_SECONDS * 1000),
    })
    .returning({ id: userSessions.id });
  const accessToken = await signAccessToken({ sub: userId, sid: row.id });
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_SECONDS };
}
