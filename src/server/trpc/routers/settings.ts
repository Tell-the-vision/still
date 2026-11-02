import { settingsUpdateInput } from "@still/shared/settings";
import { getSettings, updateSettings } from "../../services/settings";
import { consentedProcedure, router } from "../init";

export const settingsRouter = router({
  get: consentedProcedure.query(({ ctx }) => getSettings(ctx.session.userId)),
  update: consentedProcedure.input(settingsUpdateInput).mutation(({ ctx, input }) => updateSettings(ctx.session.userId, input)),
});
