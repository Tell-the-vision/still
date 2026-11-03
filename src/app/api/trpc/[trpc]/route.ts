import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "../../../../server/trpc/context";
import { appRouter } from "../../../../server/trpc/root";

const MAX_BODY_BYTES = 100 * 1024;
const PUBLIC_PATHS = ["exhibition.get", "exhibition.list", "guide.get"];
const PUBLIC_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=300";
// exhibition.list depends on today's date (Asia/Seoul), so it gets a short cache and no long stale window.
const LIST_CACHE = "public, max-age=60, s-maxage=300";

async function handler(req: Request) {
  // JSON only: rejects FormData and other bodies tRPC could parse (SPEC §11.4).
  if (req.method === "POST" && !req.headers.get("content-type")?.startsWith("application/json")) {
    return new Response(null, { status: 415 });
  }
  // Oversized bodies are refused before tRPC reads them (SPEC §11.1).
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    allowMethodOverride: true,
    createContext: () => createContext(req),
    responseMeta: ({ paths, type, errors }) => {
      // Only successful queries made up entirely of public procedures are cacheable (SPEC §11.1).
      const cacheable =
        type === "query" && errors.length === 0 && !!paths?.length && paths.every((p) => PUBLIC_PATHS.includes(p));
      const onlyList = !!paths?.every((p) => p === "exhibition.list");
      return { headers: { "cache-control": !cacheable ? "private, no-store" : onlyList ? LIST_CACHE : PUBLIC_CACHE } };
    },
  });
}

export { handler as GET, handler as POST };
