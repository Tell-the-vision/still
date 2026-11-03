import { z } from "zod";
import { isAllowedAppReturnUrl } from "../../../../../server/auth/native-relay";

const relayState = z.object({ returnUrl: z.string(), nonce: z.string() });

function decodeState(value: string | null) {
  try {
    return relayState.safeParse(JSON.parse(Buffer.from(value ?? "", "base64url").toString()));
  } catch {
    return { success: false } as const;
  }
}

// Hands Google's code back to the app. Never sets cookies and never exchanges the code.
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const state = decodeState(query.get("state"));
  if (!state.success || !isAllowedAppReturnUrl(state.data.returnUrl)) return new Response(null, { status: 400 });
  const target = new URL(state.data.returnUrl);
  const error = query.get("error");
  const code = query.get("code");
  if (error) target.searchParams.set("error", error);
  else if (code) target.searchParams.set("code", code);
  else return new Response(null, { status: 400 });
  target.searchParams.set("state", state.data.nonce);
  return new Response(null, { status: 302, headers: { location: target.toString(), "cache-control": "no-store" } });
}
