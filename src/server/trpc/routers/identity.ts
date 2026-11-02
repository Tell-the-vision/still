import { identityCreateInput, identityDeleteInput } from "@still/shared/identity";
import { TRPCError } from "@trpc/server";
import { exchangeNativeCode } from "../../auth/google-native";
import { linkIdentity, listIdentities, removeIdentity } from "../../services/identities";
import { AppError, protectedProcedure, router } from "../init";

export const identityRouter = router({
  list: protectedProcedure.query(({ ctx }) => listIdentities(ctx.session.userId)),
  // Native linking (SPEC §2.2 Linked accounts): idempotent, `created` tells a new link from a repeat.
  create: protectedProcedure.input(identityCreateInput).mutation(async ({ ctx, input }) => {
    const identity = await exchangeNativeCode(ctx.req, input);
    const result = await linkIdentity(ctx.session.userId, { provider: "GOOGLE", ...identity });
    if (result.outcome === "conflict") throw new TRPCError({ code: "CONFLICT", cause: new AppError("IDENTITY_ALREADY_LINKED") });
    return { identity: result.identity ?? null, created: result.outcome === "created" };
  }),
  delete: protectedProcedure.input(identityDeleteInput).mutation(({ ctx, input }) => removeIdentity(ctx.session.userId, input.identityId)),
});
