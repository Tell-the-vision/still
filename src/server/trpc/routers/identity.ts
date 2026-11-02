import { listIdentities } from "../../services/identities";
import { protectedProcedure, router } from "../init";

export const identityRouter = router({
  list: protectedProcedure.query(({ ctx }) => listIdentities(ctx.session.userId)),
});
