import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a saved sentence is unkept on Archive Detail and kept again from the same row", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  const saveButton = page.getByRole("button", { name: "Keep this line" }).first();
  const sentenceText = (await saveButton.locator("xpath=preceding::*[normalize-space(text())][1]").innerText()).replace(/[“”]/g, "").trim();
  await saveButton.click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kept lines" })).toBeVisible();
  await expect(page.getByText(sentenceText).first()).toBeVisible();
  await page.getByRole("button", { name: "Remove this line" }).click();
  await expect(page.getByRole("heading", { name: "Kept lines" })).toBeVisible();
  // The row stays, with "+" as the undo.
  await expect(page.getByText(sentenceText).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep this line" })).toHaveCount(1);
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("button", { name: "Keep this line" }).first()).toBeVisible();
});

test("a line unkept on Archive Detail can be kept again in place", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await page.goto("/archive/forms-of-stillness");
  await expect(page.getByRole("heading", { name: "Kept lines" })).toBeVisible();
  await page.getByRole("button", { name: "Remove this line" }).click();
  await expect(page.getByRole("heading", { name: "Kept lines" })).toBeVisible();
  const kept = page.waitForResponse(/scrap\.upsert/);
  await page.getByRole("button", { name: "Keep this line" }).click();
  await kept;
  await expect(page.getByRole("heading", { name: "Kept lines" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  expect((await trpcCall(page, "scrap.list", { code: "forms-of-stillness" })).json.result.data).toHaveLength(1);
});

test("unsaving is idempotent", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const input = { code: "forms-of-stillness", sentenceId: "00000000-0000-4000-8000-000000000001" };
  expect((await trpcCall(page, "scrap.delete", input)).status).toBe(200);
  expect((await trpcCall(page, "scrap.delete", input)).status).toBe(200);
});
