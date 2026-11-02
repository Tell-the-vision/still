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

test("whitespace-only text is rejected", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/e/forms-of-stillness/journal");
  await page.getByRole("textbox", { name: "Journal" }).fill("   ");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Write something (up to 2000 characters).")).toBeVisible();
});

test("a stale save shows the conflict notice, then succeeds", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const other = await page.context().newPage();
  await other.goto("/e/forms-of-stillness/journal");
  await page.goto("/e/forms-of-stillness/journal");
  await expect(page.getByRole("textbox", { name: "Journal" })).toBeVisible();
  await expect(other.getByRole("textbox", { name: "Journal" })).toBeVisible();
  await page.getByRole("textbox", { name: "Journal" }).fill("A");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

  await other.getByRole("textbox", { name: "Journal" }).fill("B");
  await other.getByRole("button", { name: "Save Journal" }).click();
  await expect(other.getByText("This journal was changed on another device.")).toBeVisible();
  await expect(other.getByRole("textbox", { name: "Journal" })).toHaveValue("B");
  await other.getByRole("button", { name: "Save Journal" }).click();
  await expect(other.getByText("Saved", { exact: true }).first()).toBeVisible();
  await other.reload();
  await expect(other.getByRole("textbox", { name: "Journal" })).toHaveValue("B");
});

test("a network failure keeps the text and offers Retry", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/e/forms-of-stillness/journal");
  await expect(page.getByRole("textbox", { name: "Journal" })).toBeVisible();
  await page.route(/journal\.upsert/, (route) => route.abort());
  await page.getByRole("textbox", { name: "Journal" }).fill("Kept.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Couldn't save. Your text is kept.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Journal" })).toHaveValue("Kept.");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("a guest's Save goes to login", async ({ page }) => {
  await page.goto("/e/forms-of-stillness/journal");
  await page.getByRole("textbox", { name: "Journal" }).fill("Hello");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fe%2Fforms-of-stillness%2Fjournal/);
});
