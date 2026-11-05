import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { institutions, userTokens, users } from "../db/schema";
import { verifyDecoy, verifyPassword } from "./password";

const MAX_FAILURES = 10; // SPEC §9.2 implementation defaults
const LOCK_MS = 15 * 60_000;

type Attempt =
  | { role: "ADMIN"; email: string; password: string }
  | { role: "INSTITUTION"; institutionCode: string; email: string; password: string };

// SPEC §10.5 로그인: lock the PASSWORD identity, verify only when the account may sign in here,
// count failures toward a lock. Every mismatch returns null, so callers give one UNAUTHORIZED
// and the same timing for an unknown email, a wrong institution ID, a suspended or locked account.
export async function passwordSignIn(attempt: Attempt) {
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
        institutionCode: institutions.code,
        institutionStatus: institutions.status,
      })
      .from(userTokens)
      .innerJoin(users, eq(users.id, userTokens.userId))
      .leftJoin(institutions, eq(institutions.id, users.institutionId))
      .where(and(eq(userTokens.provider, "PASSWORD"), eq(userTokens.subject, attempt.email.trim().toLowerCase())))
      .for("update", { of: userTokens });

    const rightInstitution =
      attempt.role !== "INSTITUTION" ||
      (row?.institutionCode === attempt.institutionCode.trim().toUpperCase() && row.institutionStatus === "ACTIVE");
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
    return { userId: row.userId, userTokenId: row.userTokenId };
  });
}
