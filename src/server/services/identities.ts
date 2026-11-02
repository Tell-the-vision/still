import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userTokens, users } from "../db/schema";
import { findToken } from "../auth/identity";
import { encryptToken } from "../auth/token-crypto";
import { AppError } from "../trpc/init";
import { revokeGoogleToken } from "./me";

const identityColumns = { id: userTokens.id, provider: userTokens.provider, email: userTokens.email, createdAt: userTokens.createdAt };

// Same order as `getMe` (SPEC §2.2 Linked accounts).
export async function listIdentities(userId: string) {
  return db
    .select(identityColumns)
    .from(userTokens)
    .where(eq(userTokens.userId, userId))
    .orderBy(asc(userTokens.createdAt), asc(userTokens.id));
}

// SPEC §2.2 Linked accounts: attach to the signed-in user, never merge accounts.
export async function linkIdentity(
  userId: string,
  identity: { provider: "GOOGLE"; subject: string; email?: string; displayName?: string; refreshToken?: string },
) {
  const { refreshToken, ...profile } = identity;
  const [created] = await db
    .insert(userTokens)
    .values({ ...profile, userId, refreshTokenCiphertext: refreshToken ? encryptToken(refreshToken) : undefined })
    .onConflictDoNothing({ target: [userTokens.provider, userTokens.subject] })
    .returning(identityColumns);
  if (created) return { outcome: "created" as const, identity: created };
  const existing = await findToken(identity.provider, identity.subject);
  return { outcome: existing?.userId === userId ? ("exists" as const) : ("conflict" as const) };
}

// Idempotent. Locks the user row so two concurrent unlinks cannot both pass the last-identity check (SPEC §2.2 Linked accounts).
export async function removeIdentity(userId: string, identityId: string) {
  const deleted = await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const owned = await tx.$count(userTokens, and(eq(userTokens.id, identityId), eq(userTokens.userId, userId)));
    if (owned === 0) return [];
    if ((await tx.$count(userTokens, eq(userTokens.userId, userId))) < 2) {
      throw new TRPCError({ code: "CONFLICT", cause: new AppError("LAST_IDENTITY") });
    }
    return tx.delete(userTokens).where(eq(userTokens.id, identityId)).returning({ ciphertext: userTokens.refreshTokenCiphertext });
  });
  for (const { ciphertext } of deleted) if (ciphertext) await revokeGoogleToken(ciphertext);
}
