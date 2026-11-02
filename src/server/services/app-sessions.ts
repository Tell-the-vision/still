import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { ACCESS_TOKEN_SECONDS, signAccessToken } from "../auth/access-token";
import { hashToken } from "../auth/sessions";
import { db } from "../db/client";
import { userSessions } from "../db/schema";

const APP_SESSION_SECONDS = 90 * 24 * 60 * 60;
const graceSeconds = () => Number(process.env.SESSION_REFRESH_GRACE_SECONDS ?? 30);

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

// SPEC §2.3 / §10.2: one conditional UPDATE rotates the token. A replay of the previous token within the grace
// window gets a new pair but leaves previous_token_hash and rotated_at alone, so a later replay still matches.
export async function rotateAppSession(refreshToken: string) {
  const oldHash = hashToken(refreshToken);
  const newToken = randomBytes(32).toString("base64url");
  const { rows } = await db.execute<{ id: string; user_id: string }>(sql`
    UPDATE user_sessions SET
      token_hash = ${hashToken(newToken)},
      previous_token_hash = CASE WHEN token_hash = ${oldHash} THEN token_hash ELSE previous_token_hash END,
      rotated_at          = CASE WHEN token_hash = ${oldHash} THEN now()      ELSE rotated_at          END
    WHERE kind = 'APP' AND expires_at > now()
      AND (token_hash = ${oldHash} OR (previous_token_hash = ${oldHash} AND rotated_at > now() - make_interval(secs => ${graceSeconds()})))
    RETURNING id, user_id`);
  if (rows.length === 0) {
    // Expired, unknown or stolen-and-replayed: end the session this token belongs to.
    await db.delete(userSessions).where(
      and(eq(userSessions.kind, "APP"), or(eq(userSessions.tokenHash, oldHash), eq(userSessions.previousTokenHash, oldHash))),
    );
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const accessToken = await signAccessToken({ sub: rows[0].user_id, sid: rows[0].id });
  return { accessToken, refreshToken: newToken, expiresIn: ACCESS_TOKEN_SECONDS };
}
