import { asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userTokens } from "../db/schema";

// Same order as `getMe` (SPEC §2.2 Linked accounts).
export async function listIdentities(userId: string) {
  return db
    .select({ id: userTokens.id, provider: userTokens.provider, email: userTokens.email, createdAt: userTokens.createdAt })
    .from(userTokens)
    .where(eq(userTokens.userId, userId))
    .orderBy(asc(userTokens.createdAt), asc(userTokens.id));
}
