import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

type Entry = Record<string, unknown>;
const dataLayer = (page: Page) => page.evaluate(() => (window as unknown as { dataLayer: Entry[] }).dataLayer);

test("entry events reach the data layer, and login_success carries no email", async ({ page, next }) => {
  const user = newUser();
  stubGoogleToken(next, user);
  await stubGoogle(page);
  // The Google round trip reloads the page, so the data layer is mirrored into sessionStorage.
  await page.addInitScript(() => {
    const layer: unknown[] = JSON.parse(sessionStorage.getItem("test:dataLayer") ?? "[]");
    layer.push = (...items) => {
      Array.prototype.push.apply(layer, items);
      sessionStorage.setItem("test:dataLayer", JSON.stringify(layer));
      return layer.length;
    };
    (window as unknown as { dataLayer: unknown[] }).dataLayer = layer;
  });
  await page.goto("/");
  await page.getByRole("link", { name: "QR Scan" }).click();
  await page.getByRole("textbox").fill("forms-of-stillness");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/e\/forms-of-stillness$/);
  await expect.poll(async () => (await dataLayer(page)).map((e) => e.event)).toContain("exhibition_view");
  const entries = await dataLayer(page);
  expect(entries).toContainEqual(expect.objectContaining({ event: "home_view", user_state: "guest", platform: "web" }));
  expect(entries).toContainEqual(expect.objectContaining({ event: "qr_scan_start", user_state: "guest" }));
  expect(entries).toContainEqual(expect.objectContaining({ event: "exhibition_view", exhibition_code: "forms-of-stillness" }));

  await signIn(page);
  await expect.poll(async () => (await dataLayer(page)).map((e) => e.event)).toContain("login_success");
  const after = await dataLayer(page);
  expect(after).toContainEqual(expect.objectContaining({ event: "login_start", source_action: "login" }));
  expect(after).toContainEqual(expect.objectContaining({ event: "login_success", provider: "GOOGLE" }));
  expect(JSON.stringify(after)).not.toContain(user.email);
});
