import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a guest's save resumes after login and consent", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "Login Required" }).first().click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fe%2Fforms-of-stillness/);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("button", { name: "Agree" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness/);
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  expect((await trpcCall(page, "scrap.list", { code: "forms-of-stillness" })).json.result.data).toHaveLength(1);
});
