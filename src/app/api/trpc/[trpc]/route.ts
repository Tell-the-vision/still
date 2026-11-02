import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "../../../../server/trpc/context";
import { appRouter } from "../../../../server/trpc/root";

const PUBLIC_PATHS = ["exhibition.get", "guide.get"];
const PUBLIC_CACHE = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

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
    responseMeta: ({ paths, type, errors }) => {
      // Only successful queries made up entirely of public procedures are cacheable (SPEC §11.1).
      const cacheable =
        type === "query" && errors.length === 0 && !!paths?.length && paths.every((p) => PUBLIC_PATHS.includes(p));
      return { headers: { "cache-control": cacheable ? PUBLIC_CACHE : "private, no-store" } };
    },
  });
}

export { handler as GET, handler as POST };
