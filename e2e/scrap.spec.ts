import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a saved sentence stays saved after reload and can no longer be pressed", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "＋ Save this guide sentence" }).first().click();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Saved" })).toHaveCount(0);
});

test("a guest is asked to log in", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByText("Login Required").first()).toBeVisible();
});
