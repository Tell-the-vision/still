import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userTokens, users } from "../db/schema";

type Identity = { provider: "GOOGLE"; subject: string; email?: string; displayName?: string; refreshToken?: string };

class DuplicateIdentity extends Error {}

const findToken = (provider: string, subject: string) =>
  db.query.userTokens.findFirst({ where: and(eq(userTokens.provider, provider), eq(userTokens.subject, subject)) });

// SPEC §2.2 (Sign in 5): resolve by (provider, subject) only, never by email.
// `refreshToken` is accepted now and stored once token crypto lands (A5).
export async function signInWithIdentity(identity: Identity): Promise<{ userId: string; userTokenId: string }> {
  const profile = { email: identity.email ?? null, displayName: identity.displayName ?? null };
  const existing = await findToken(identity.provider, identity.subject);
  if (existing) {
    await db.update(userTokens).set({ ...profile, updatedAt: new Date() }).where(eq(userTokens.id, existing.id));
    return { userId: existing.userId, userTokenId: existing.id };
  }
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({}).returning();
      const [token] = await tx
        .insert(userTokens)
        .values({ userId: user.id, provider: identity.provider, subject: identity.subject, ...profile })
        .onConflictDoNothing({ target: [userTokens.provider, userTokens.subject] })
        .returning();
      if (!token) throw new DuplicateIdentity(); // a concurrent sign-in won: roll back our user
      return { userId: user.id, userTokenId: token.id };
    });
  } catch (error) {
    if (!(error instanceof DuplicateIdentity)) throw error;
    const winner = await findToken(identity.provider, identity.subject);
    return { userId: winner!.userId, userTokenId: winner!.id };
  }
}
