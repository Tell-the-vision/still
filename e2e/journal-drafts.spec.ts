import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("a draft survives a reload and is gone after logging out and back in", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/e/forms-of-stillness/journal");
  const field = page.getByRole("textbox", { name: "Journal" });
  await field.fill("Draft text");
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(field).toHaveValue("Draft text");

  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await signIn(page, { firstTime: false });
  await page.goto("/e/forms-of-stillness/journal");
  await expect(field).toHaveValue("");
});
