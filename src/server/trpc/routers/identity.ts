import { identityDeleteInput } from "@still/shared/identity";
import { listIdentities, removeIdentity } from "../../services/identities";
import { protectedProcedure, router } from "../init";

export const identityRouter = router({
  list: protectedProcedure.query(({ ctx }) => listIdentities(ctx.session.userId)),
  delete: protectedProcedure.input(identityDeleteInput).mutation(({ ctx, input }) => removeIdentity(ctx.session.userId, input.identityId)),
});
