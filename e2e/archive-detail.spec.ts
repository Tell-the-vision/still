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
  await page.getByRole("link", { name: "Forms of Stillness" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByText("Forms of Stillness", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("LAST VISITED")).toBeVisible();
  await expect(page.getByText(/^\d{1,2} [A-Z][a-z]+ \d{4}$/)).toBeVisible();
  const borderTop = await page.getByRole("button", { name: "Delete this Archive" }).evaluate((el) => getComputedStyle(el).borderTopWidth);
  expect(borderTop).toBe("0px");
  await page.getByRole("link", { name: "Back to My Archive" }).click();
  await expect(page.getByText("My Archive", { exact: true }).last()).toBeVisible();
  expect((await trpcCall(page, "archive.get", { code: "quiet-rooms" })).json.result.data).toBeNull();
  expect((await trpcCall(page, "archive.get", { code: "no-such" })).status).toBe(404);
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
