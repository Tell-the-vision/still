import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { decryptToken } from "../auth/token-crypto";
import { userTokens, users } from "../db/schema";
import type { Session } from "../trpc/context";

// Profile comes from the identity the session signed in with, else the oldest one (SPEC §2.2).
export async function getMe(session: Pick<Session, "userId" | "userTokenId">) {
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  const identities = await db
    .select()
    .from(userTokens)
    .where(eq(userTokens.userId, session.userId))
    .orderBy(asc(userTokens.createdAt), asc(userTokens.id));
  const identity = identities.find((t) => t.id === session.userTokenId) ?? identities[0];
  if (!user || !identity) throw new TRPCError({ code: "UNAUTHORIZED" });
  return {
    id: user.id,
    displayName: identity.displayName,
    email: identity.email,
    provider: identity.provider,
    createdAt: user.createdAt.toISOString(),
  };
}

// Best-effort (SPEC §2.2 Delete account). Awaited inside the request: testmode only intercepts fetches made there.
export async function revokeGoogleToken(ciphertext: Buffer) {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      body: new URLSearchParams({ token: decryptToken(ciphertext) }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Revocation failure must not block deletion.
  }
}

export async function deleteMe(userId: string) {
  const deleted = await db.transaction(async (tx) => {
    const tokens = await tx.delete(userTokens).where(eq(userTokens.userId, userId)).returning({ ciphertext: userTokens.refreshTokenCiphertext });
    await tx.delete(users).where(eq(users.id, userId));
    return tokens;
  });
  for (const { ciphertext } of deleted) if (ciphertext) await revokeGoogleToken(ciphertext);
}
