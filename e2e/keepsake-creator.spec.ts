import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";

test("a visitor creates a web card, then edits it", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "＋ Save this guide sentence" }).first().click();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "Write a journal" }).click();
  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Saved", { exact: true }).last()).toBeVisible();

  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness" }).click();
  await page.getByRole("link", { name: "Create web card" }).click();
  await page.getByRole("button", { name: "Reflection" }).click();
  await expect(page.getByLabel("Web card", { exact: true }).last()).toContainText("Quiet light.");
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByLabel("Web card", { exact: true }).last()).toContainText("Quiet light.");
  const first = await getKeepsake(page);
  const sentence = first.card.sentences[0].content;
  await expect(page.getByLabel("Web card", { exact: true }).last()).toContainText(sentence);

  await page.getByRole("link", { name: "Edit web card" }).click();
  await page.getByRole("button", { name: "Cover" }).click();
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByLabel("Web card", { exact: true }).last()).not.toContainText("Quiet light.");
  await expect(page.getByLabel("Web card", { exact: true }).last()).not.toContainText(sentence);
  expect((await getKeepsake(page)).createdAt).toBe(first.createdAt);
});

const getKeepsake = async (page: Page) => (await trpcCall(page, "keepsake.get", { code })).json.result.data;
