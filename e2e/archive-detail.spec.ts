import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("an archive card opens its detail", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const upserted = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, "forms-of-stillness");
  await upserted;
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness", exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByText("Forms of Stillness", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(/^Last visited \d{1,2} [A-Z][a-z]+ \d{4}$/)).toBeVisible();
  const borderTop = await page.getByRole("button", { name: "Delete this Archive" }).evaluate((el) => getComputedStyle(el).borderTopWidth);
  expect(borderTop).toBe("0px");
  await page.getByRole("link", { name: "Back to My Archive" }).click();
  await expect(page.getByText("My Archive", { exact: true }).last()).toBeVisible();
  expect((await trpcCall(page, "archive.get", { code: "quiet-rooms" })).json.result.data).toBeNull();
  expect((await trpcCall(page, "archive.get", { code: "no-such" })).status).toBe(404);
});

test("collection groups are separated and the journal excerpt is small", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await page.getByRole("link", { name: "Write a journal" }).click();
  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light.");
  const saved = page.waitForResponse(/journal\.upsert/);
  await page.getByRole("button", { name: "Save Journal" }).click();
  await saved;
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await page.goto("/archive/forms-of-stillness");
  const mark = await page.getByRole("button", { name: "Remove this line" }).boundingBox();
  const journal = await page.getByRole("heading", { name: "Journal", exact: true }).boundingBox();
  expect(journal && mark && journal.y - (mark.y + mark.height)).toBeGreaterThanOrEqual(32);
  await expect(page.getByText("Quiet light.")).toHaveCSS("font-size", "13px");
});

test("an unknown archive shows a quiet empty state", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/archive/no-such");
  await expect(page.getByRole("heading", { name: "Nothing here." })).toBeVisible();
  await page.getByRole("link", { name: "My Archive", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/);
});
