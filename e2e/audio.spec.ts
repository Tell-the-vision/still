import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

test("a playlist is offered as a link and No audio hides it for this screen", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  const link = page.getByRole("link", { name: "Listen on Spotify" });
  await expect(link).toHaveAttribute("href", /^https:\/\/open\.spotify\.com\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "No audio" }).click();
  await expect(link).toHaveCount(0);
  await expect(page.getByText("Music already playing in other apps won't stop.")).toBeVisible();
});

test("ambience is shown without a toggle when there is no playlist", async ({ page }) => {
  await openGuide(page, "quiet-rooms");
  await expect(page.getByRole("link", { name: /^Listen on/ })).toHaveCount(0);
  await expect(page.getByText("Ambience · Pink Noise")).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
});
