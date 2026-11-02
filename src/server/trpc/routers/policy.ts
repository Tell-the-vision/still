import { currentPolicy } from "../../services/policy";
import { publicProcedure, router } from "../init";

export const policyRouter = router({
  get: publicProcedure.query(() => currentPolicy()),
});
