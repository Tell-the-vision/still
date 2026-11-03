import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

test("guide shows the title and venue, and the response is publicly cacheable", async ({ page }) => {
  const response = page.waitForResponse(/exhibition\.get/);
  await openGuide(page, "forms-of-stillness");
  const res = await response;
  expect(res.request().method()).toBe("GET");
  expect(res.headers()["cache-control"]).toMatch(/^public, max-age=60/);
  expect(res.headers()["set-cookie"]).toBeUndefined();
  await expect(page.getByText("Forms of Stillness", { exact: true })).toBeVisible();
  await expect(page.getByText(/Seoul · /)).toBeVisible();
});

test("a draft exhibition is not available and its error is not cached", async ({ page }) => {
  const response = page.waitForResponse(/exhibition\.get/);
  await openGuide(page, "draft-preview");
  expect((await response).headers()["cache-control"]).toBe("private, no-store");
  await expect(page.getByRole("heading", { name: "Not available." })).toBeVisible();
});

test("guide shows the description and the guide document, publicly cacheable", async ({ page }) => {
  const response = page.waitForResponse(/guide\.get/);
  await openGuide(page, "forms-of-stillness");
  expect((await response).headers()["cache-control"]).toMatch(/^public, max-age=60/);
  await expect(page.getByText("About Forms of Stillness.")).toBeVisible();
  await expect(page.getByText("A room can hold its breath.")).toBeVisible();
});

test("the cover image is requested from the media origin and shown", async ({ page }) => {
  await page.route("https://media.test.invalid/**", (route) => route.fulfill({ path: "e2e/fixtures/cover.png" }));
  const media = page.waitForRequest(/media\.test\.invalid/);
  await openGuide(page, "with-cover");
  await media;
  await expect(page.getByRole("img", { name: "Test cover" }).first()).toBeVisible();
});

test("a cover that fails to load leaves the text without a broken image", async ({ page }) => {
  await page.route("https://media.test.invalid/**", (route) => route.fulfill({ status: 404 }));
  await openGuide(page, "with-cover");
  await expect(page.getByText("With Cover", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Test cover" })).toHaveCount(0);
});

test("the header leaves room before the description", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  const date = await page.getByText(/ · /).first().boundingBox();
  const about = await page.getByText("About the exhibition").first().boundingBox();
  expect(about && date && about.y - (date.y + date.height)).toBeGreaterThanOrEqual(32);
});
