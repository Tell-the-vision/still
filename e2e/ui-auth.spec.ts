import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("a failed OAuth callback shows an alert banner", async ({ page }) => {
  const stub = await stubGoogle(page, { cancel: true });
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByText("Sign-in was cancelled.")).toBeVisible();
  await page.goto(stub.callbackUrl);
  await expect(page.getByRole("alert")).toContainText("Sign-in failed. Try again.");
});

test("the Login screen has a heading", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  const heading = page.getByRole("heading", { name: "Login" });
  await expect(heading).toHaveCSS("font-size", "32px");
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page).toHaveURL("/");
});

test("Consent is left-aligned with a gray Decline", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("heading", { name: "One more step." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Decline" }).getByText("Decline")).toHaveCSS("color", "rgb(102, 102, 102)");
});

test("Home 02 greets a signed-in user", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await expect(page.getByText("Welcome back.")).toBeVisible();
});
