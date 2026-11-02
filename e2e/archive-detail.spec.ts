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
  await expect(page.getByText(/Last visited \d{4}-\d{2}-\d{2}/)).toBeVisible();
  expect((await trpcCall(page, "archive.get", { code: "quiet-rooms" })).json.result.data).toBeNull();
  expect((await trpcCall(page, "archive.get", { code: "no-such" })).status).toBe(404);
});
