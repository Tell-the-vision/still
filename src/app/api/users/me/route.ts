import { currentUser, handler, noContent, ok, publicUser, requireUser } from "@/lib/api";
import { deleteUserCompletely } from "@/lib/archives";

/** GET /api/users/me — current user incl. role / artist status (null when logged out). */
export const GET = handler(async () => {
  const user = await currentUser();
  if (!user) return ok({ user: null });
  return ok({ user: publicUser(user) });
});

/**
 * DELETE /api/users/me — Account deletion (ACCOUNT-03).
 * Removes the user and every archive / scrap / journal / keepsake they own.
 * Exhibitions they created are kept (owner becomes NULL) so visitors' archives survive.
 * The client must call signOut() afterwards to drop the JWT cookie.
 */
export const DELETE = handler(async () => {
  const user = await requireUser();
  await deleteUserCompletely(user.id);
  return noContent();
});
