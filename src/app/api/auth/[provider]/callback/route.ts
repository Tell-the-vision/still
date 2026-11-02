import { consumeOAuthState } from "../../../../../server/auth/oauth-state";

const redirect = (path: string, auth: string, clearCookie: string) => {
  const url = new URL(path, process.env.STILL_ORIGIN);
  url.searchParams.set("auth", auth);
  return new Response(null, { status: 302, headers: { location: url.toString(), "set-cookie": clearCookie, "cache-control": "no-store" } });
};

// SPEC §2.3: the state cookie is consumed exactly once, whatever the outcome.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "google") return new Response(null, { status: 404 });
  const query = new URL(req.url).searchParams;
  const { stored, clearCookie } = consumeOAuthState(req, query.get("state"));
  if (!stored) return redirect("/", "failed", clearCookie);
  const error = query.get("error");
  if (error === "access_denied") return redirect(stored.returnTo, "cancelled", clearCookie);
  return redirect(stored.returnTo, "failed", clearCookie); // other errors; the success branch arrives with A2b
}
