import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";

test("the guide reads in one order: title, playlist, keepsake, introduction, guide, journal link", async ({ page }) => {
  await openGuide(page, code);
  const top = async (locator: ReturnType<typeof page.getByText>) => (await locator.first().boundingBox())?.y ?? NaN;
  const ys = [
    await top(page.getByRole("heading", { name: "Forms of Stillness" })),
    await top(page.getByRole("link", { name: "Playlist on Spotify" })),
    await top(page.getByRole("heading", { name: "Your keepsake" })),
    await top(page.getByText("About Forms of Stillness.")),
    await top(page.getByText(/A room can hold its breath/)),
    await top(page.getByRole("link", { name: "Write a journal" })),
  ];
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  await expect(page.getByRole("heading", { name: "Your keepsake" })).toHaveCount(1);
});

test("a guest sees the preview card and a sign-in action", async ({ page }) => {
  await openGuide(page, code);
  await expect(page.getByText("Lines you keep appear here.")).toBeAttached();
  await expect(page.getByText("This visit, on one card.")).toBeVisible();
  await page.getByRole("link", { name: "Sign in to keep lines" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fe%2Fforms-of-stillness/);
});

test("keeping a line turns + into a dot and the band links to the collection", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  const keep = page.getByRole("button", { name: "Keep this line" }).first();
  await expect(keep).toHaveAttribute("aria-pressed", "false");
  await keep.click();
  const kept = page.getByRole("button", { name: "Kept" });
  await expect(kept).toHaveAttribute("aria-pressed", "true");
  const status = page.getByRole("link", { name: "See your collection for Forms of Stillness" });
  await expect(status).toContainText("1 line kept");
  await expect(status).toHaveAttribute("href", `/archive/${code}`);
  await status.click();
  await expect(page).toHaveURL(new RegExp(`/archive/${code}$`));
});

test("the band opens the creator and Save returns to the guide showing Kept on", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Kept" })).toHaveCount(1);
  await page.getByRole("button", { name: "Your keepsake card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness\/keepsake\?from=guide/);
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));
  await expect(page.getByText(/^Kept on /).last()).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit card" })).toBeVisible();
});

test("the journal link ends the page, is centred and leads to the journal", async ({ page }) => {
  await openGuide(page, code);
  const link = page.getByRole("link", { name: "Write a journal" });
  await link.scrollIntoViewIfNeeded();
  const box = await link.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2)).toBeLessThanOrEqual(24);
  await link.click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness\/journal\?from=guide$/);
});
