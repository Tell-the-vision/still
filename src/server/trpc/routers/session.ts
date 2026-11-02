import { eq } from "drizzle-orm";
import { clearSessionCookie } from "../../auth/sessions";
import { db } from "../../db/client";
import { userSessions } from "../../db/schema";
import { protectedProcedure, router } from "../init";

export const sessionRouter = router({
  // Sign out (SPEC §2.2): drop this session's row and clear the web cookie.
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(userSessions).where(eq(userSessions.tokenHash, ctx.session.tokenHash));
    ctx.resHeaders.append("set-cookie", clearSessionCookie());
  }),
});
