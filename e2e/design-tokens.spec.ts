import { expect, test } from "next/experimental/testmode/playwright";

test("the guest wordmark is Montserrat", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("STILL.", { exact: true })).toHaveCSS("font-family", /Montserrat/);
});

