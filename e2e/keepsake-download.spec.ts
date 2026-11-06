import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

const code = "forms-of-stillness";

// Download PNG saves the card's PNG: the browser follows the signed link. The app's router used to take the link for
// one of its own screens and showed "Unmatched Route" instead of the file.
test("Download PNG on Archive saves the work's card as a PNG and stays on the page", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  const pages = await page.request.get(`/api/trpc/exhibition.pages?input=${encodeURIComponent(JSON.stringify({ scope: "ALL" }))}`);
  const work = ((await pages.json()).result.data.items as { code: string; page: string }[]).find((i) => i.code === code)!;

  await page.goto(`/e/${code}/${work.page}`);
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await trpcCall(page, "keepsake.upsert", { code, page: work.page, templateId: "still", sentenceIds: ["00000000-0000-4000-8000-000000000001"] });

  await page.goto(`/archive/${code}`);
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG" }).first().click();
  expect((await downloading).suggestedFilename()).toBe(`still-${code}-${work.page}.png`);
  await expect(page).toHaveURL(new RegExp(`/archive/${code}$`));
  await expect(page.getByText("Unmatched Route")).toHaveCount(0);
});
