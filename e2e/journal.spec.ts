import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

test("a signed-in visitor writes a journal, then edits it", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("link", { name: "Write a journal" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness\/journal\?from=guide$/);
  await expect(page.getByRole("heading", { name: "Your journal." })).toHaveCSS("font-size", "32px");
  await expect(page.getByText("Forms of Stillness", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Your one journal for this exhibition.")).toHaveCSS("font-size", "14px");
  await expect(page.getByRole("button", { name: "Save Journal" })).toBeInViewport({ ratio: 1 });
  const field = page.getByRole("textbox", { name: "Journal" });
  expect((await field.boundingBox())?.height).toBeGreaterThanOrEqual(300);
  await expect(field).toHaveAttribute("placeholder", /^Write and revisit your thoughts here\./);

  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
  await expect(page.getByText(/^Saved · \d\d:\d\d$/).last()).toBeVisible();
  await page.goto("/e/forms-of-stillness/journal");
  await expect(page.getByRole("textbox", { name: "Journal" })).toHaveValue("Quiet light.");

  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light, softer.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
  await page.goto("/e/forms-of-stillness/journal");
  await expect(page.getByRole("textbox", { name: "Journal" })).toHaveValue("Quiet light, softer.");
});

test("whitespace-only text is rejected", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/e/forms-of-stillness/journal");
  await page.getByRole("textbox", { name: "Journal" }).fill("   ");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Write something (up to 2000 characters).")).toBeVisible();
});

test("a stale save shows the conflict notice, then succeeds", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const other = await page.context().newPage();
  await other.goto("/e/forms-of-stillness/journal");
  await page.goto("/e/forms-of-stillness/journal");
  await expect(page.getByRole("textbox", { name: "Journal" })).toBeVisible();
  await expect(other.getByRole("textbox", { name: "Journal" })).toBeVisible();
  await page.getByRole("textbox", { name: "Journal" }).fill("A");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);

  await other.getByRole("textbox", { name: "Journal" }).fill("B");
  await other.getByRole("button", { name: "Save Journal" }).click();
  await expect(other.getByText("This journal was changed on another device.")).toBeVisible();
  await expect(other.getByRole("textbox", { name: "Journal" })).toHaveValue("B");
  await other.getByRole("button", { name: "Save Journal" }).click();
  await expect(other).toHaveURL(/\/e\/forms-of-stillness$/);
  await other.goto("/e/forms-of-stillness/journal");
  await expect(other.getByRole("textbox", { name: "Journal" })).toHaveValue("B");
});

test("a network failure keeps the text and offers Retry", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/e/forms-of-stillness/journal");
  await expect(page.getByRole("textbox", { name: "Journal" })).toBeVisible();
  await page.route(/journal\.upsert/, (route) => route.abort());
  await page.getByRole("textbox", { name: "Journal" }).fill("Kept.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Couldn't save. Your text is kept.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Journal" })).toHaveValue("Kept.");
  await expect(page.getByRole("button", { name: "Retry" })).toBeInViewport();
  await expect(page).toHaveURL(/\/journal$/);
});

test("saving from Archive Detail returns there with Saved shown", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/e/forms-of-stillness/journal?from=archive");
  await page.getByRole("textbox", { name: "Journal" }).fill("From archive.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  // The guide stays mounted under Archive Detail, so check the visible copy.
  await expect(page.getByText("From archive.").last()).toBeVisible();
  await expect(page.getByText(/^Saved · \d\d:\d\d$/).last()).toBeVisible();
});

test("saving from the guide link returns to the guide", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("link", { name: "Write a journal" }).click();
  await page.getByRole("textbox", { name: "Journal" }).fill("From guide.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
  await expect(page.getByText(/^Saved · \d\d:\d\d$/).last()).toBeVisible();

  // Back goes to Home, not to a second copy of the guide.
  await page.goBack();
  await expect(page).toHaveURL(/\/scan/);
  await page.goForward();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
  await expect(page.getByText(/^Saved · \d\d:\d\d$/).last()).toBeVisible();

  // No saved time for a guest.
  await page.getByRole("link", { name: "ACCOUNT" }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await page.goto("/e/forms-of-stillness");
  await expect(page.getByRole("link", { name: "Write a journal" })).toBeVisible();
  await expect(page.getByText(/^Saved · /)).toHaveCount(0);
});

test("a guest's Save goes to login", async ({ page }) => {
  await page.goto("/e/forms-of-stillness/journal");
  await expect(page.getByText("Saving asks you to sign in. Your text stays on this device.")).toBeVisible();
  await page.getByRole("textbox", { name: "Journal" }).fill("Hello");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fe%2Fforms-of-stillness%2Fjournal/);
});

test("the journal has no decorative captions, shows the active sound and a single inset focus edge", async ({ page }) => {
  await page.goto("/e/quiet-rooms/journal");
  await expect(page.getByText("LISTENING")).toHaveCount(0);
  await expect(page.getByText("QUIET ROOMS", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Sound while writing" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "No audio" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "Pink noise" })).toHaveAttribute("aria-checked", "false");
  const field = page.getByRole("textbox", { name: "Journal" });
  await field.focus();
  await expect(field).toHaveCSS("outline-offset", "-1px");
  const box = await field.boundingBox();
  const save = await page.getByRole("button", { name: "Save Journal" }).boundingBox();
  expect(box && save && box.x >= save.x - 0.5).toBe(true);
});
