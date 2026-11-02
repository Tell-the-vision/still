import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("deleting an archive removes it and a new visit recreates it", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const visit = async () => {
    const upserted = page.waitForResponse(/archive\.upsert/);
    await openGuide(page, "forms-of-stillness");
    await upserted;
    await page.goto("/");
    await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
    await page.getByRole("link", { name: "Forms of Stillness" }).click();
  };
  await visit();
  await page.getByRole("button", { name: "Delete this Archive" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);

  await page.getByRole("button", { name: "Delete this Archive" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/archive$/);
  await expect(page.getByText("No archives yet.").last()).toBeVisible();
  expect((await trpcCall(page, "archive.get", { code: "forms-of-stillness" })).json.result.data).toBeNull();

  await visit();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
});
