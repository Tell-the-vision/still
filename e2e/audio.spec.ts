import { expect, test } from "next/experimental/testmode/playwright";
import { openGuide } from "./support/reach";

test("a playlist row is black and NO AUDIO toggles it for this screen", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByText("LISTENING")).toBeVisible();
  const link = page.getByRole("link", { name: "EXTERNAL PLAYLIST · SPOTIFY" });
  await expect(link).toHaveAttribute("href", /^https:\/\/open\.spotify\.com\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveCSS("background-color", "rgb(0, 0, 0)");
  const noAudio = page.getByRole("button", { name: "NO AUDIO" });
  await noAudio.click();
  await expect(noAudio).toHaveAttribute("aria-pressed", "true");
  await expect(link).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.getByText("Music already playing in other apps won't stop.")).toBeVisible();
  await noAudio.click();
  await expect(noAudio).toHaveAttribute("aria-pressed", "false");
  await expect(link).toHaveCSS("background-color", "rgb(0, 0, 0)");
});

test("ambience is an option as tall as the playlist option and starts off", async ({ page }) => {
  await openGuide(page, "quiet-rooms");
  await expect(page.getByRole("link", { name: /^EXTERNAL PLAYLIST/ })).toHaveCount(0);
  const ambience = page.getByRole("switch", { name: /Pink Noise/i });
  await expect(ambience).toHaveAttribute("aria-checked", "false");
  const ambienceBox = await ambience.boundingBox();
  await openGuide(page, "forms-of-stillness");
  const playlistBox = await page.getByRole("link", { name: /^EXTERNAL PLAYLIST/ }).boundingBox();
  expect(ambienceBox?.height).toBe(playlistBox?.height);
});
