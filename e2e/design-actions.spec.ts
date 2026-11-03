import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("Home: View all and QR Scan are borderless text actions", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const upserted = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, "forms-of-stillness");
  await upserted;
  await page.goto("/");
  const viewAll = page.getByRole("link", { name: "View all" });
  await expect(viewAll).toHaveCSS("border-top-width", "0px");
  await expect(page.getByRole("link", { name: "QR Scan" })).toHaveCSS("border-top-width", "0px");
  await viewAll.click();
  await expect(page.getByText("My Archive").first()).toBeVisible();
});

test("Creator: the selected template button is filled and swaps on click", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness", exact: true }).click();
  await page.getByRole("link", { name: "Create web card" }).click();
  const sentence = page.getByRole("radio", { name: "Sentence" });
  const cover = page.getByRole("radio", { name: "Cover" });
  await expect(sentence).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(cover).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await cover.click();
  await expect(cover).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(sentence).toHaveCSS("background-color", "rgb(255, 255, 255)");
});
