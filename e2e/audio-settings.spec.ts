import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

test("No audio saved in Account hides the playlist on the Guide and persists", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await page.getByRole("button", { name: "No audio" }).click();
  await expect(page.getByRole("button", { name: "No audio" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await page.getByLabel("Exhibition URL or code").fill("forms-of-stillness");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByText("Music already playing in other apps won't stop.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Listen on Spotify" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Music already playing in other apps won't stop.")).toBeVisible();
});

test("an unknown audio mode is rejected", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  expect((await trpcCall(page, "settings.update", { audioMode: "LOUD" })).status).toBe(400);
});
