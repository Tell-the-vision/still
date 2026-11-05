import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/client";
import { userSessions, userTokens } from "../db/schema";
import { hashPassword, verifyPassword } from "./password";
import { isLocked, LOCK_MS, MAX_FAILURES } from "./password-sign-in";

export type PasswordChange = { ok: true } | { ok: false; reason: "WRONG" | "LOCKED" };

// SPEC §10.5 계정 전이 "비밀번호 변경": the new hash replaces the old one, the temporary-password
// flag is cleared and every other session of the user ends. `keepTokenHash` is the caller's own session.
// A wrong `currentPassword` counts toward the same lock as a wrong sign-in (SPEC §9.2, #68): while the
// account is locked nothing is verified, and the tenth failure locks it for LOCK_MS.
export async function changePassword(input: { userId: string; keepTokenHash: string; currentPassword: string; newPassword: string }): Promise<PasswordChange> {
  const newHash = await hashPassword(input.newPassword);
  return db.transaction(async (tx) => {
    const [identity] = await tx
      .select({ id: userTokens.id, passwordHash: userTokens.passwordHash, failedLoginCount: userTokens.failedLoginCount, lockedUntil: userTokens.lockedUntil })
      .from(userTokens)
      .where(and(eq(userTokens.userId, input.userId), eq(userTokens.provider, "PASSWORD")))
      .for("update");
    if (!identity?.passwordHash) return { ok: false, reason: "WRONG" };
    if (isLocked(identity.lockedUntil)) return { ok: false, reason: "LOCKED" };

    if (!(await verifyPassword(input.currentPassword, identity.passwordHash))) {
      const failures = identity.failedLoginCount + 1;
      await tx
        .update(userTokens)
        .set({ failedLoginCount: failures, lockedUntil: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null })
        .where(eq(userTokens.id, identity.id));
      return { ok: false, reason: failures >= MAX_FAILURES ? "LOCKED" : "WRONG" };
    }

    await tx
      .update(userTokens)
      .set({ passwordHash: newHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null })
      .where(eq(userTokens.id, identity.id));
    await tx.delete(userSessions).where(and(eq(userSessions.userId, input.userId), ne(userSessions.tokenHash, input.keepTokenHash)));
    return { ok: true };
  });
}
