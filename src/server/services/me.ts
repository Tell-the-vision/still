import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userTokens, users } from "../db/schema";
import type { Session } from "../trpc/context";

// Profile comes from the identity the session signed in with, else the oldest one (SPEC §2.2).
export async function getMe(session: Session) {
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
