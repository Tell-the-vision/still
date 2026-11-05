import { staffEmail } from "@still/shared/staff-session";
import { TRPCError } from "@trpc/server";
import { hashPassword, temporaryPassword } from "../auth/password";
import { db } from "../db/client";
import { userTokens, users } from "../db/schema";
import { AppError } from "../trpc/init";

export type StaffAccountInput =
  | { role: "ADMIN"; email: string; displayName: string }
  | { role: "INSTITUTION"; institutionId: string; email: string; displayName: string };

class LoginIdTaken extends Error {}

// 발급 (SPEC §9.2, §10.5): a users row plus one PASSWORD identity holding only the hash of a
// temporary password, which must be changed at first sign-in. The password is returned once.
export async function createStaffAccount(input: StaffAccountInput) {
  const email = staffEmail.parse(input.email);
  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ role: input.role, institutionId: input.role === "INSTITUTION" ? input.institutionId : null, status: "ACTIVE" })
        .returning({ id: users.id });
      const [identity] = await tx
        .insert(userTokens)
        .values({ userId: user.id, provider: "PASSWORD", subject: email, email, displayName: input.displayName, passwordHash, mustChangePassword: true })
        .onConflictDoNothing({ target: [userTokens.provider, userTokens.subject] })
        .returning({ id: userTokens.id });
      if (!identity) throw new LoginIdTaken(); // the email already signs in somewhere: roll back the user
      return { userId: user.id, userTokenId: identity.id, email, temporaryPassword: password };
    });
  } catch (error) {
    if (error instanceof LoginIdTaken) throw new TRPCError({ code: "CONFLICT", cause: new AppError("LOGIN_ID_TAKEN") });
    throw error;
  }
}
