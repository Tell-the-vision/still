import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

export function newUser() {
  const sub = `g-${randomUUID()}`;
  return { sub, email: `${sub}@example.test`, name: "Test User" };
}

// SPEC §2.8 start-route interceptor. Only the first URL of a redirect chain is routable,
// so fetch the 302 ourselves, record it, and fulfill a stub page instead of reaching Google.
export async function captureAuthorize(page: Page) {
  const captured = { location: "", setCookie: "" };
  await page.route(/\/api\/auth\/google(\?|$)/, async (route) => {
    const res = await route.fetch({ maxRedirects: 0 });
    captured.location = res.headers()["location"] ?? "";
    captured.setCookie = res.headers()["set-cookie"] ?? "";
    await route.fulfill({ status: 200, contentType: "text/html", body: "<p>stub</p>" });
  });
  return captured;
}
