import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a guest sees the header wordmark but no MY ARCHIVE link", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByText("STILL.", { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "MY ARCHIVE" })).toHaveCount(0);
});

test("guest home has a single wordmark", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("STILL.")).toHaveCount(1);
});

test("the tab bar marks the active tab", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await expect(page.getByText("MY ARCHIVE", { exact: true })).toHaveCSS("font-size", "9px");
  const home = page.getByText("HOME", { exact: true });
  const archive = page.getByText("ARCHIVE", { exact: true });
  await expect(home).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(archive).toHaveCSS("color", "rgb(102, 102, 102)");
  await archive.click();
  await expect(archive).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(home).toHaveCSS("color", "rgb(102, 102, 102)");
});
