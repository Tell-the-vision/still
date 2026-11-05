import { router } from "../../init";
import { adminAccountRouter } from "./account";
import { adminInstitutionRouter } from "./institution";
import { adminSessionRouter } from "./session";

// STILL Admin (/admin): operators manage institutions and their accounts (SPEC §9.2, §9.5).
export const adminRouter = router({
  account: adminAccountRouter,
  institution: adminInstitutionRouter,
  session: adminSessionRouter,
});
