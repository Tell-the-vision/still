import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

test("a published exhibition link carries its own title and preview tags", async ({ request }) => {
  const res = await request.get("/e/forms-of-stillness");
  expect(res.headers()["cache-control"]).toBe("public, max-age=60");
  const html = await res.text();
  expect(html).toContain("<title>Forms of Stillness");
  expect(html).toContain('property="og:title" content="Forms of Stillness"');
  expect(html).toMatch(/property="og:url" content="http:\/\/localhost:\d+\/e\/forms-of-stillness"/);
});

test("a draft link keeps the plain shell without exhibition tags", async ({ request }) => {
  const html = await (await request.get("/e/draft-preview")).text();
  expect(html).not.toContain("og:title");
});

test("the guide still opens from the scan flow", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByText("About Forms of Stillness.")).toBeVisible();
});

test("an unknown code still shows the unavailable state", async ({ page }) => {
  await openGuide(page, "no-such-exhibition");
  await expect(page.getByRole("heading", { name: "Not available." })).toBeVisible();
});
