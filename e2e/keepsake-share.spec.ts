import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";
type Shared = { shared: string[][] };

async function reachDetail(page: Parameters<typeof signIn>[0], next: Parameters<typeof stubGoogleToken>[0]) {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await trpcCall(page, "keepsake.upsert", { code, templateId: "sentence", sentenceIds: ["00000000-0000-4000-8000-000000000001"] });
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness", exact: true }).click();
  // The guide already holds the card as it was; reload so the detail reads the one just saved.
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await page.reload();
}

test("Share hands exactly one PNG file to the share sheet", async ({ page, next }) => {
  await page.addInitScript(() => {
    const shared: Shared["shared"] = [];
    Object.assign(window, { shared });
    navigator.canShare = () => true;
    navigator.share = async (data) => void shared.push((data?.files ?? []).map((file) => file.type));
  });
  await reachDetail(page, next);
  const share = page.getByRole("button", { name: "Share PNG" });
  await expect(share).toBeEnabled();
  await share.click();
  const shared = await page.evaluate(() => (window as unknown as Shared).shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]).toEqual(["image/png"]);
});

test("without file sharing, only the download link is offered", async ({ page, next }) => {
  await reachDetail(page, next);
  await expect(page.getByText("Press and hold the image to save it.")).toHaveCount(0);
  await expect(page.locator("img[src*='/api/media/keepsake']")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Download PNG" })).toBeVisible();
});

test("on desktop the PNG is not rendered in the page and there is no long-press hint", async ({ page, next }) => {
  await reachDetail(page, next);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("link", { name: "Download PNG" })).toBeVisible();
  await expect(page.getByText("Press and hold the image to save it.")).toHaveCount(0);
  await expect(page.locator("img[src*='/api/media/keepsake']")).toHaveCount(0);
});
