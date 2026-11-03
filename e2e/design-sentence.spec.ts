import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("Guest: Login Required is a borderless text action", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("button", { name: "Login Required" }).first()).toHaveCSS("border-top-width", "0px");
});

test("Saving a sentence does not shift its layout", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  const save = page.getByRole("button", { name: "＋ Save this guide sentence" }).first();
  const row = await save.locator("xpath=..").elementHandle();
  const top = async () => (await row?.evaluate((el) => el.getBoundingClientRect().top + window.scrollY)) ?? 0;
  const before = await top();
  await save.click();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  expect(Math.abs((await top()) - before)).toBeLessThan(1);
});
