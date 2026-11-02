import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

test("guide shows the title and venue, and the response is publicly cacheable", async ({ page }) => {
  const response = page.waitForResponse(/exhibition\.get/);
  await openGuide(page, "forms-of-stillness");
  const res = await response;
  expect(res.request().method()).toBe("GET");
  expect(res.headers()["cache-control"]).toMatch(/^public, max-age=60/);
  expect(res.headers()["set-cookie"]).toBeUndefined();
  await expect(page.getByText("Forms of Stillness")).toBeVisible();
  await expect(page.getByText(/· Seoul/)).toBeVisible();
});

test("a draft exhibition is not available and its error is not cached", async ({ page }) => {
  const response = page.waitForResponse(/exhibition\.get/);
  await openGuide(page, "draft-preview");
  expect((await response).headers()["cache-control"]).toBe("private, no-store");
  await expect(page.getByText("This exhibition isn't available.")).toBeVisible();
});
