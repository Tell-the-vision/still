import { expect, test } from "next/experimental/testmode/playwright";

test("Banner: a rule above, no box, and Dismiss hides it", async ({ page }) => {
  await page.goto("/?auth=cancelled");
  const status = page.getByRole("status");
  await expect(status).toContainText("Sign-in was cancelled.");
  await expect(status).toHaveCSS("border-left-width", "0px");
  await expect(status).toHaveCSS("border-top-width", "1px");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(status).toHaveCount(0);
});
