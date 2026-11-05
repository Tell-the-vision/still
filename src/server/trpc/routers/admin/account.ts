import { adminAccountCreateInput } from "@still/shared/admin";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { institutions, users } from "../../../db/schema";
import { accountRows } from "../../../services/admin/account-rows";
import { createStaffAccount } from "../../../services/staff-accounts";
import { adminProcedure, router } from "../../init";

// admin.account.* (SPEC §9.5, §10.5)
export const adminAccountRouter = router({
  // 발급 (SPEC §9.2): the temporary password is returned here and nowhere else.
  create: adminProcedure.input(adminAccountCreateInput).mutation(async ({ input }) => {
    if (input.role === "INSTITUTION") {
      const [institution] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, input.institutionId));
      if (!institution) throw new TRPCError({ code: "NOT_FOUND" });
    }
    const { userId, temporaryPassword } = await createStaffAccount(input);
    const [account] = await accountRows(eq(users.id, userId));
    return { account, temporaryPassword };
  }),
});
