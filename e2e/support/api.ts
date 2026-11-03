import type { Page } from "@playwright/test";

// A same-origin tRPC call from the page, so the session cookie, Origin and testmode headers apply.
export async function trpcCall(page: Page, path: string, input: unknown, headers: Record<string, string> = {}) {
  return page.evaluate(
    async ([path, input, headers]) => {
      const res = await fetch(`/api/trpc/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(input),
      });
      return { status: res.status, json: await res.json() };
    },
    [path, input, headers] as const,
  );
}
