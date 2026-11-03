import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a guest's save resumes after login and consent", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fe%2Fforms-of-stillness/);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("button", { name: "Agree" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness/);
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(1);
  expect((await trpcCall(page, "scrap.list", { code: "forms-of-stillness" })).json.result.data).toHaveLength(1);
});

test("sign-in brings the guest back to the sentence they used", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await page.setViewportSize({ width: 390, height: 420 });
  await openGuide(page, "forms-of-stillness");
  const last = page.getByRole("button", { name: "Keep this line" }).last();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("button", { name: "Agree" }).click();
  await expect(page.getByRole("button", { name: "Kept" })).toBeInViewport();
});

test("cancelling sign-in keeps the pending action for the next login", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page, { cancel: true });
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByText("Sign-in was cancelled.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(0);
  await stubGoogle(page);
  await page.getByRole("link", { name: "HOME" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("button", { name: "Agree" }).click();
  await page.getByRole("link", { name: "QR Scan" }).click();
  await page.getByRole("button", { name: "Enter Exhibition URL" }).click();
  await page.getByLabel("Exhibition URL or code").fill("forms-of-stillness");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(1);
});

test("an action older than 30 minutes is dropped with a notice", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await page.clock.install();
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await page.clock.fastForward("31:00");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("button", { name: "Agree" }).click();
  await expect(page.getByText("Your earlier action expired. Please try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(0);
});
