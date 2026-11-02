import { handler, ok, publicUser, readJson, requireUser } from "@/lib/api";
import { applyAsArtist } from "@/lib/artist";

/**
 * POST /api/users/me/artist-application  { artistName, artistBio?, artistPortfolioUrl? }
 * Puts the account into artistStatus=PENDING. An admin approves it from /admin/users.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const updated = await applyAsArtist(user, body);
  return ok({ user: publicUser(updated) }, 201);
});
