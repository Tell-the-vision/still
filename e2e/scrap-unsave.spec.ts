import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a saved sentence is unsaved from Archive Detail and can be saved again", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  const saveButton = page.getByRole("button", { name: "＋ Save this guide sentence" }).first();
  const sentenceText = (await saveButton.locator("xpath=preceding::*[normalize-space(text())][1]").innerText()).replace(/[“”]/g, "").trim();
  await saveButton.click();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness" }).click();
  await expect(page.getByRole("heading", { name: "01 saved guide sentences" })).toBeVisible();
  await expect(page.getByText(sentenceText)).toBeVisible();
  await page.getByRole("button", { name: "Unsave" }).click();
  await expect(page.getByRole("heading", { name: "00 saved guide sentences" })).toBeVisible();
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("button", { name: "＋ Save this guide sentence" }).first()).toBeVisible();
});

test("unsaving is idempotent", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const input = { code: "forms-of-stillness", sentenceId: "00000000-0000-4000-8000-000000000001" };
  expect((await trpcCall(page, "scrap.delete", input)).status).toBe(200);
  expect((await trpcCall(page, "scrap.delete", input)).status).toBe(200);
});
