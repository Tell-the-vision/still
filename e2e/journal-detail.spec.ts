import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a saved journal shows in Detail, where it can be deleted", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("link", { name: "Write a journal" }).click();
  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness" }).click();
  await expect(page.getByRole("heading", { name: "01 journal · editable" })).toBeVisible();
  await expect(page.getByText("Quiet light.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/e/forms-of-stillness/journal");

  await page.getByRole("button", { name: "Delete journal" }).click();
  await expect(page.getByRole("dialog", { name: "Delete journal" })).toContainText("Your saved sentences and web card stay.");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Quiet light.")).toBeVisible();

  await page.getByRole("button", { name: "Delete journal" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "00 journal" })).toBeVisible();
  await expect(page.getByText("Forms of Stillness", { exact: true }).last()).toBeVisible();
  expect((await trpcCall(page, "journal.get", { code: "forms-of-stillness" })).json.result.data).toBeNull();
});
