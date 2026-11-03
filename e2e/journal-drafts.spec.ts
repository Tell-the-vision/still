import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

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

test("a guest's journal is saved after login and consent", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByText("Write a journal").click();
  await page.getByRole("textbox", { name: "Journal" }).fill("Guest words");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("button", { name: "Agree" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Journal" })).toHaveValue("Guest words");
  expect((await trpcCall(page, "journal.get", { code: "forms-of-stillness" })).json.result.data).not.toBeNull();
});
