import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

// The chromium default window is desktop-wide; these tests cover the phone layout.
test.use({ viewport: { width: 390, height: 844 } });

test("My Archive lists visited exhibitions", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const upserted = page.waitForResponse(/archive\.upsert/);
  await page.goto("/e/forms-of-stillness");
  await upserted;
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/);
  await expect(page.getByText("My Archive", { exact: true })).toHaveCSS("font-size", "32px");
  await expect(page.getByText("01 EXPERIENCES")).toHaveCSS("color", "rgb(102, 102, 102)");
  const card = page.getByRole("link", { name: "Forms of Stillness", exact: true });
  await expect(card).toHaveCSS("border-top-width", "1px");
  await expect(card).toContainText(/· 2026/);
  await expect(card.locator("> *").first()).toHaveCSS("background-color", "rgb(237, 237, 237)");
});

test("an empty archive points to QR Scan", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await expect(page.getByText("00 EXPERIENCES")).toBeVisible();
  await expect(page.getByText("Nothing kept yet.")).toBeVisible();
  // The header link and the empty-state action both lead to the scanner; the action is the one under test.
  const scan = page.getByRole("link", { name: "QR Scan" }).last();
  await expect(scan).toBeInViewport();
  expect((await scan.boundingBox())?.y).toBeLessThan(400);
  await expect(page.getByText("Exhibitions you open appear here, with the lines you saved and your journal.")).toBeVisible();
  await scan.click();
  await expect(page).toHaveURL(/\/scan$/);
  await expect(page.getByText("Scan to enter.")).toBeVisible();
});

test("on desktop the archive grid has uses the wide column", async ({ page, next }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const upserted = page.waitForResponse(/archive\.upsert/);
  await page.goto("/e/forms-of-stillness");
  await upserted;
  await page.goto("/archive");
  const card = page.getByRole("link", { name: "Forms of Stillness" });
  const box = await card.boundingBox();
  // The desktop archive uses the 1144px wide column (the phone grid is capped at 560px).
  expect(box!.width).toBeGreaterThan(720);
  await page.screenshot({ path: "/tmp/still-shots/shell/desktop-archive.png" });
});
