import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a guide taller than the viewport scrolls, and the tab bar stays reachable", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("link", { name: "Write a journal" })).toBeAttached();
  await page.setViewportSize({ width: 390, height: 440 });
  await page.mouse.move(195, 150);
  await page.mouse.wheel(0, 2000);
  await expect(page.getByRole("link", { name: "Write a journal" })).toBeInViewport();
  await expect(page.getByRole("navigation")).toBeInViewport();
});

test("the tab bar marks the current tab and MY ARCHIVE shows a focus ring", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const home = page.getByRole("link", { name: "HOME" });
  const account = page.getByRole("link", { name: "ACCOUNT" });
  const archive = page.getByRole("link", { name: "MY ARCHIVE" });
  await expect(home).toHaveAttribute("aria-current", "page");
  await archive.focus();
  await expect(archive).toHaveCSS("outline-style", "solid");
  await account.click();
  await expect(account).toHaveAttribute("aria-current", "page");
  await expect(home).not.toHaveAttribute("aria-current", "page");
});

test("on a wide window the screen stays a phone-width column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/scan");
  const box = await page.getByRole("navigation").boundingBox();
  expect(box?.width).toBeLessThanOrEqual(560);
});
