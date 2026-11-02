import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "../../../../server/trpc/context";
import { appRouter } from "../../../../server/trpc/root";

async function handler(req: Request) {
  // JSON only: rejects FormData and other bodies tRPC could parse (SPEC §11.4).
  if (req.method === "POST" && !req.headers.get("content-type")?.startsWith("application/json")) {
    return new Response(null, { status: 415 });
  }
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    allowMethodOverride: true,
    createContext: ({ resHeaders }) => createContext(req, resHeaders),
    responseMeta: () => ({ headers: { "cache-control": "private, no-store" } }),
  });
}

export { handler as GET, handler as POST };
