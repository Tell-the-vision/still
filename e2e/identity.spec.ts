import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("ACCOUNT lists the linked Google identity and opens policy links in a new tab", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await expect(page.getByRole("heading", { name: "LINKED ACCOUNTS" })).toBeVisible();
  await expect(page.getByText(`Google · ${user.email}`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("target", "_blank");
});
