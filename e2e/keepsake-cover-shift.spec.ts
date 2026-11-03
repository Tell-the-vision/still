import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";

// Headless Chromium hides scrollbars by default; a desktop browser shows them and they take width.
test.use({
  launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"], args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--mute-audio"] },
});

test("switching the keepsake layout to Cover does not move the page sideways or up", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await trpcCall(page, "keepsake.upsert", { code, templateId: "sentence", sentenceIds: ["00000000-0000-4000-8000-000000000001"] });
  // Desktop web has no QR entry, so the visit happens on the phone viewport first.
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto(`/archive/${code}/keepsake`);
  const heading = page.getByText("Keep this moment.");
  const position = async () => {
    const box = (await heading.boundingBox())!;
    return { x: Math.round(box.x), y: Math.round(box.y) };
  };
  await page.getByRole("radio", { name: "Sentence" }).click();
  await expect(page.getByText("On the card")).toBeVisible();
  // Scroll to the bottom first, as someone reaching the layout tiles and Save on a short window would.
  await page.mouse.move(683, 500);
  await page.mouse.wheel(0, 2000);
  await expect.poll(async () => (await position()).y).toBeLessThan(100);
  const withSentences = await position();
  await page.getByRole("radio", { name: "Cover" }).click();
  await expect(page.getByText("On the card")).toHaveCount(0);
  expect(await position()).toEqual(withSentences);
});
