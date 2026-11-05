import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { institutions, userTokens, users } from "../db/schema";
import { verifyDecoy, verifyPassword } from "./password";
import { createStaffSession } from "./sessions";

const MAX_FAILURES = 10; // SPEC §9.2 implementation defaults
const LOCK_MS = 15 * 60_000;

type Attempt =
  | { role: "ADMIN"; email: string; password: string }
  | { role: "INSTITUTION"; institutionCode: string; email: string; password: string };

// SPEC §10.5 로그인: lock the PASSWORD identity, verify only when the account may sign in here,
// count failures toward a lock. Every mismatch returns null, so callers give one UNAUTHORIZED
// and the same timing for an unknown email, a wrong institution ID, a suspended or locked account.
//
// The account and its institution stay locked until the session row exists, so a suspension,
// reset or deletion running at the same time either happens first (and this sign-in fails) or
// waits and then deletes the new session with the others.
export async function passwordSignIn(attempt: Attempt, { remember }: { remember: boolean }) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        userTokenId: userTokens.id,
        userId: users.id,
        passwordHash: userTokens.passwordHash,
        failedLoginCount: userTokens.failedLoginCount,
        lockedUntil: userTokens.lockedUntil,
        role: users.role,
        status: users.status,
        institutionId: users.institutionId,
      })
      .from(userTokens)
      .innerJoin(users, eq(users.id, userTokens.userId))
      .where(and(eq(userTokens.provider, "PASSWORD"), eq(userTokens.subject, attempt.email.trim().toLowerCase())))
      .for("update", { of: [userTokens, users] });

    const [institution] = row?.institutionId
      ? await tx
          .select({ code: institutions.code, status: institutions.status })
          .from(institutions)
          .where(eq(institutions.id, row.institutionId))
          .for("share")
      : [];

    const rightInstitution =
      attempt.role !== "INSTITUTION" ||
      (institution?.code === attempt.institutionCode.trim().toUpperCase() && institution.status === "ACTIVE");
    const mayTry =
      row?.passwordHash != null &&
      row.status === "ACTIVE" &&
      row.role === attempt.role &&
      rightInstitution &&
      !(row.lockedUntil && row.lockedUntil > new Date());
    if (!mayTry) return verifyDecoy(attempt.password).then(() => null);

    if (!(await verifyPassword(attempt.password, row.passwordHash!))) {
      const failures = row.failedLoginCount + 1;
      await tx
        .update(userTokens)
        .set({ failedLoginCount: failures, lockedUntil: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null })
        .where(eq(userTokens.id, row.userTokenId));
      return null;
    }
    await tx
      .update(userTokens)
      .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(userTokens.id, row.userTokenId));
    const token = await createStaffSession(row.userId, row.userTokenId, remember, tx);
    return { userId: row.userId, userTokenId: row.userTokenId, token };
  });
}
