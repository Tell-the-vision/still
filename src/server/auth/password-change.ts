import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/client";
import { userSessions, userTokens } from "../db/schema";
import { hashPassword, verifyPassword } from "./password";

// SPEC §10.5 계정 전이 "비밀번호 변경": the new hash replaces the old one, the temporary-password
// flag is cleared and every other session of the user ends. `keepTokenHash` is the caller's own session.
// Returns false when `currentPassword` is not the user's password.
export async function changePassword(input: { userId: string; keepTokenHash: string; currentPassword: string; newPassword: string }) {
  const newHash = await hashPassword(input.newPassword);
  return db.transaction(async (tx) => {
    const [identity] = await tx
      .select({ id: userTokens.id, passwordHash: userTokens.passwordHash })
      .from(userTokens)
      .where(and(eq(userTokens.userId, input.userId), eq(userTokens.provider, "PASSWORD")))
      .for("update");
    if (!identity?.passwordHash || !(await verifyPassword(input.currentPassword, identity.passwordHash))) return false;

    await tx.update(userTokens).set({ passwordHash: newHash, mustChangePassword: false }).where(eq(userTokens.id, identity.id));
    await tx.delete(userSessions).where(and(eq(userSessions.userId, input.userId), ne(userSessions.tokenHash, input.keepTokenHash)));
    return true;
  });
}
