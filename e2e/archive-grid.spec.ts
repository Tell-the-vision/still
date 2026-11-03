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
  const card = page.getByRole("link", { name: "Forms of Stillness", exact: true });
  // The mini card is the whole tile: no outer outline and no repeated caption under it.
  await expect(card).toHaveCSS("border-top-width", "0px");
  await expect(card.getByText("Forms of Stillness", { exact: true })).toHaveCount(1);
  // The tile leads with the exhibition's keepsake card in miniature.
  await expect(card.getByLabel("Keepsake preview")).toContainText("Forms of Stillness");
  await expect(card.getByLabel("Keepsake preview")).toContainText("STILL");
  // A lone tile stays one column wide, not a full-width block.
  expect((await card.boundingBox())!.width).toBeLessThan(250);
});

test("an empty archive points to QR Scan", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
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
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  // Desktop web has no QR entry points, so the visit happens on the phone viewport first.
  const upserted = page.waitForResponse(/archive\.upsert/);
  await page.goto("/e/forms-of-stillness");
  await upserted;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/archive");
  const card = page.getByRole("link", { name: "Forms of Stillness" });
  const box = await card.boundingBox();
  // Four columns in the 1144px wide column; a lone tile keeps its column width instead of stretching.
  expect(box!.width).toBeGreaterThan(200);
  expect(box!.width).toBeLessThan(320);
  await page.screenshot({ path: "/tmp/still-shots/shell/desktop-archive.png" });
});
