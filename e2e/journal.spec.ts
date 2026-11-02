import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a signed-in visitor writes a journal, then edits it", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("link", { name: "Write a journal" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness\/journal$/);
  await expect(page.getByRole("heading", { name: "Forms of Stillness" }).last()).toBeVisible();
  await expect(page.getByText("Your journal.")).toBeVisible();

  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Journal" })).toHaveValue("Quiet light.");

  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light, softer.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Journal" })).toHaveValue("Quiet light, softer.");
});
