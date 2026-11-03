import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

test("the guide offers only the playlist link, below the cover and above the keepsake", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  const link = page.getByRole("link", { name: "Playlist on Spotify" });
  await expect(link).toHaveAttribute("href", /^https:\/\/open\.spotify\.com\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByText("LISTENING")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "No audio" })).toHaveCount(0);
  const playlist = await link.boundingBox();
  const keepsake = await page.getByText("Your keepsake", { exact: true }).boundingBox();
  expect(playlist && keepsake && playlist.y < keepsake.y).toBe(true);
});

test("an ambience exhibition shows no audio on the guide", async ({ page }) => {
  await openGuide(page, "quiet-rooms");
  await expect(page.getByRole("heading", { name: "Quiet Rooms" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Playlist on/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Pink noise/i })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "No audio" })).toHaveCount(0);
});
