import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";

// Share PNG is a text action like Download PNG and sits on the same line, at phone and desktop widths.
for (const width of [390, 1280]) {
  test(`at ${width}px Share PNG is a text action on the same line as Download PNG`, async ({ page, next }) => {
    await page.addInitScript(() => {
      navigator.canShare = () => true;
      navigator.share = async () => undefined;
    });
    stubGoogleToken(next, newUser());
    await stubGoogle(page);
    await signIn(page);
    await openGuide(page, code);
    await page.getByRole("button", { name: "Keep this line" }).first().click();
    await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
    await trpcCall(page, "keepsake.upsert", { code, templateId: "sentence", sentenceIds: ["00000000-0000-4000-8000-000000000001"] });
    // Desktop web has no QR entry, so the visit happens on the phone viewport first.
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/archive/${code}`);
    const share = page.getByRole("button", { name: "Share PNG" });
    await expect(share).toBeEnabled();
    const download = await page.getByRole("link", { name: "Download PNG" }).boundingBox();
    const shareBox = await share.boundingBox();
    expect(Math.abs(shareBox!.y - download!.y)).toBeLessThanOrEqual(2);
    await expect(share).toHaveCSS("border-top-width", "0px");
  });
}
