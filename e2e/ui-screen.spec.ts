import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

// The chromium default window is desktop-wide; these tests cover the phone layout.
test.use({ viewport: { width: 390, height: 844 } });

test("a guide taller than the viewport scrolls, and the tab bar stays reachable", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("link", { name: "Write a journal" })).toBeAttached();
  await page.setViewportSize({ width: 390, height: 440 });
  await page.mouse.move(195, 150);
  await page.mouse.wheel(0, 2000);
  await expect(page.getByRole("link", { name: "Write a journal" })).toBeInViewport();
  await expect(page.getByRole("navigation")).toBeInViewport();
});

test("the tab bar marks the current tab and the ARCHIVE tab shows a focus ring", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const home = page.getByRole("link", { name: "HOME", exact: true });
  const account = page.getByRole("link", { name: "ACCOUNT" });
  const archive = page.getByRole("link", { name: "ARCHIVE", exact: true });
  await expect(home).toHaveAttribute("aria-current", "page");
  await archive.focus();
  await expect(archive).toHaveCSS("outline-style", "solid");
  await account.click();
  await expect(account).toHaveAttribute("aria-current", "page");
  await expect(home).not.toHaveAttribute("aria-current", "page");
});

test("on a wide window a reading screen stays within 720px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/scan");
  const box = await page.getByText("STILL.").boundingBox();
  const nav = await page.getByRole("navigation").boundingBox();
  expect(nav!.x + nav!.width - box!.x).toBeLessThanOrEqual(720);
});

test("signed-in Home keeps its sections together and the header rule clears the wordmark", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const upserted = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, "forms-of-stillness");
  await upserted;
  await page.goto("/");
  const tagline = await page.getByText("Your experiences, kept in one place.").boundingBox();
  const next_ = await page.getByText("EXHIBITIONS", { exact: true }).boundingBox();
  expect((next_?.y ?? Infinity) - ((tagline?.y ?? 0) + (tagline?.height ?? 0))).toBeLessThanOrEqual(48);
  const wordmark = await page.getByText("STILL.", { exact: true }).boundingBox();
  const ruleY = await page.getByText("STILL.", { exact: true }).evaluate((el) => {
    let node: Element | null = el;
    while (node && parseFloat(getComputedStyle(node).borderBottomWidth) === 0) node = node.parentElement;
    return node ? node.getBoundingClientRect().bottom : 0;
  });
  expect(ruleY - ((wordmark?.y ?? 0) + (wordmark?.height ?? 0))).toBeGreaterThanOrEqual(16);
});

test("guest Home still centres the wordmark", async ({ page }) => {
  await page.goto("/");
  const box = await page.getByText("STILL.", { exact: true }).boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) / 2 - height / 2)).toBeLessThanOrEqual(height * 0.15);
});
