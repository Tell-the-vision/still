import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("the guest wordmark is Montserrat", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("STILL.", { exact: true })).toHaveCSS("font-family", /Montserrat/);
});

test("section labels use the gray 9px eyebrow style", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  const heading = page.getByRole("heading", { name: "LINKED ACCOUNTS" });
  await expect(heading).toHaveCSS("color", "rgb(102, 102, 102)");
  await expect(heading).toHaveCSS("font-size", "9px");
});
