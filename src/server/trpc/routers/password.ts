import { TRPCError } from "@trpc/server";
import { passwordUpdateInput } from "@still/shared/password";
import { changePassword } from "../../auth/password-change";
import { MIN_PASSWORD_LENGTH } from "../../auth/password";
import { AppError, callerProcedure, router } from "../init";

// password.update for institution staff and operators (SPEC §9.5, §10.5). It runs on callerProcedure
// because a temporary password must be changeable while every other procedure refuses it.
export const passwordRouter = router({
  update: callerProcedure.input(passwordUpdateInput).mutation(async ({ input, ctx }) => {
    if (ctx.surface === "visitor") throw new TRPCError({ code: "FORBIDDEN" }); // visitors have no password
    if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        cause: new AppError("PASSWORD_TOO_WEAK"),
      });
    }
    const changed = await changePassword({
      userId: ctx.session.userId,
      keepTokenHash: ctx.session.tokenHash,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    // BAD_REQUEST, not UNAUTHORIZED: the session is valid and the apps treat UNAUTHORIZED as signed out.
    // A locked account (ten wrong passwords, SPEC §9.2) answers TOO_MANY_REQUESTS until the lock passes.
    if (!changed.ok && changed.reason === "LOCKED") {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many wrong passwords. Try again in 15 minutes." });
    }
    if (!changed.ok) throw new TRPCError({ code: "BAD_REQUEST", message: "The current password is incorrect." });
  }),
});
