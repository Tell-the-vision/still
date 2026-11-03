import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

async function openJournal(page: Parameters<typeof openGuide>[0], code: string) {
  await openGuide(page, code);
  await page.getByRole("link", { name: "Write a journal" }).click();
}

test("a guest turns Pink Noise on and off on the journal", async ({ page }) => {
  await openJournal(page, "quiet-rooms");
  const toggle = page.getByRole("switch", { name: /Pink Noise/i });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Couldn't play Pink Noise.")).toHaveCount(0);
  await expect(toggle).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await page.getByRole("button", { name: "NO AUDIO" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
});

test("saving a journal records the AMBIENCE audioType", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openJournal(page, "quiet-rooms");
  await page.getByRole("textbox", { name: "Journal" }).fill("Soft hum.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page).toHaveURL(/\/e\/quiet-rooms$/);
  const { json } = await trpcCall(page, "journal.get", { code: "quiet-rooms" });
  expect(json.result.data.audioType).toBe("AMBIENCE");
});

test("a playlist exhibition shows the Spotify link and no switch on the journal", async ({ page }) => {
  await openJournal(page, "forms-of-stillness");
  await expect(page.getByRole("link", { name: "EXTERNAL PLAYLIST · SPOTIFY" })).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
});

test("the Pink Noise caption shows with the switch on an ambience journal", async ({ page }) => {
  await openJournal(page, "quiet-rooms");
  await expect(page.getByRole("switch", { name: /Pink Noise/i })).toBeVisible();
});
