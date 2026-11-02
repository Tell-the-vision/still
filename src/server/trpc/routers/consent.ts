import { consentUpsertInput } from "@still/shared/consent";
import { TRPCError } from "@trpc/server";
import { getConsent, recordConsent } from "../../services/consent";
import { currentPolicy } from "../../services/policy";
import { AppError, protectedProcedure, router } from "../init";

export const consentRouter = router({
  get: protectedProcedure.query(({ ctx }) => getConsent(ctx.session.userId)),
  upsert: protectedProcedure.input(consentUpsertInput).mutation(({ ctx, input }) => {
    const { termsVersion, privacyVersion } = currentPolicy();
    if (input.termsVersion !== termsVersion || input.privacyVersion !== privacyVersion) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new AppError("POLICY_VERSION_OUTDATED") });
    }
    return recordConsent(ctx.session.userId, input);
  }),
});
