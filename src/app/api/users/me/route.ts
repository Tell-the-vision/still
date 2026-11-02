import { currentUser, handler, noContent, ok, requireUser } from "@/lib/api";
import { deleteUserCompletely } from "@/lib/archives";

/** GET /api/users/me — current user (401 when logged out). */
export const GET = handler(async () => {
  const user = await currentUser();
  if (!user) return ok({ user: null });
  return ok({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      image: user.image,
      createdAt: user.createdAt,
    },
  });
});

/**
 * DELETE /api/users/me — Account deletion (ACCOUNT-03).
 * Removes the user and every archive / scrap / journal / keepsake they own.
 * The client must call signOut() afterwards to drop the JWT cookie.
 */
export const DELETE = handler(async () => {
  const user = await requireUser();
  await deleteUserCompletely(user.id);
  return noContent();
});
