import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

async function openJournal(page: Parameters<typeof openGuide>[0], code: string) {
  await openGuide(page, code);
  await page.getByRole("link", { name: "Write a journal" }).click();
}

test("a guest turns Ambience on and off on the journal", async ({ page }) => {
  await openJournal(page, "quiet-rooms");
  const toggle = page.getByRole("radio", { name: /Ambience/i });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Couldn't play Ambience.")).toHaveCount(0);
  await expect(toggle).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await page.getByRole("radio", { name: "No audio" }).click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
});

test("saving a journal records the AMBIENCE audioType", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openJournal(page, "quiet-rooms");
  await page.getByRole("radio", { name: "Ambience" }).click();
  await expect(page.getByRole("radio", { name: "Ambience" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("textbox", { name: "Journal" }).fill("Soft hum.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  // Saving lands on Archive Detail.
  await expect(page).toHaveURL(/\/archive\/quiet-rooms$/);
  const { json } = await trpcCall(page, "journal.get", { code: "quiet-rooms" });
  expect(json.result.data.audioType).toBe("AMBIENCE");
});

test("a playlist exhibition shows the Spotify link and no Ambience option on the journal", async ({ page }) => {
  await openJournal(page, "forms-of-stillness");
  await expect(page.getByRole("link", { name: "EXTERNAL PLAYLIST · SPOTIFY" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Ambience/i })).toHaveCount(0);
});

test("the Ambience caption shows with the switch on an ambience journal", async ({ page }) => {
  await openJournal(page, "quiet-rooms");
  await expect(page.getByRole("radio", { name: /Ambience/i })).toBeVisible();
});

test("the journal sound options are one aligned radio group and the hint follows No audio", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openJournal(page, "quiet-rooms");
  const group = page.getByRole("radiogroup", { name: "Sound while writing" });
  const ambience = group.getByRole("radio", { name: "Ambience" });
  const none = group.getByRole("radio", { name: "No audio" });
  const hint = page.getByText("Music already playing in other apps won't stop.");
  const [a, b] = [await ambience.boundingBox(), await none.boundingBox()];
  expect(a && b && a.x === b.x && a.width === b.width).toBe(true);
  await expect(none).toHaveCSS("border-top-width", "1px");
  await expect(hint).toBeVisible();
  await ambience.click();
  await expect(hint).toHaveCount(0);
  await none.click();
  await expect(none).toHaveAttribute("aria-checked", "true");
  await expect(hint).toBeVisible();
  await none.focus();
  await expect(none).toHaveCSS("border-top-width", "1px");
  expect((await none.boundingBox())?.x).toBe(a?.x);
  await page.screenshot({ path: "/tmp/still-shots/audio/journal-audio-390.png" });
  await ambience.click();
  await expect(ambience).toHaveAttribute("aria-checked", "true");
  await expect(hint).toHaveCount(0);
});

test("exactly one journal sound radio is checked at a time and pressing the checked one keeps it", async ({ page }) => {
  await openJournal(page, "quiet-rooms");
  const ambience = page.getByRole("radio", { name: "Ambience" });
  const none = page.getByRole("radio", { name: "No audio" });
  const hint = page.getByText("Music already playing in other apps won't stop.");
  await expect(none).toHaveAttribute("aria-checked", "true");
  await expect(ambience).toHaveAttribute("aria-checked", "false");
  await expect(hint).toBeVisible();
  await none.click();
  await expect(none).toHaveAttribute("aria-checked", "true");
  await ambience.click();
  await expect(ambience).toHaveAttribute("aria-checked", "true");
  await expect(none).toHaveAttribute("aria-checked", "false");
  await expect(hint).toHaveCount(0);
  await ambience.click();
  await expect(ambience).toHaveAttribute("aria-checked", "true");
  await expect(none).toHaveAttribute("aria-checked", "false");
  await none.click();
  await expect(none).toHaveAttribute("aria-checked", "true");
  await expect(ambience).toHaveAttribute("aria-checked", "false");
  await expect(hint).toBeVisible();
});

test("Ambience keeps playing while the visitor types in the journal", async ({ page }) => {
  // Record the media elements the player creates (the browser is muted; playback still runs).
  await page.addInitScript(() => {
    const w = window as unknown as { __media: HTMLMediaElement[] };
    w.__media = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { w.__media.push(this); return play.call(this); };
  });
  await openJournal(page, "quiet-rooms");
  const toggle = page.getByRole("radio", { name: /Ambience/i });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.getByRole("textbox", { name: "Journal" }).pressSequentially("Quiet light on the wall.", { delay: 30 });
  await page.waitForTimeout(500);
  const playing = await page.evaluate(() => (window as unknown as { __media: HTMLMediaElement[] }).__media.some((m) => !m.paused && m.loop));
  expect(playing).toBe(true);
  await expect(toggle).toHaveAttribute("aria-checked", "true");
});
