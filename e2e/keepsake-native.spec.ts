import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";

// iOS checklist (dev build): Share opens the share sheet; Save to Photos prompts once.
test("the signed PNG url downloads without any auth header", async ({ page, next, playwright }) => {
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
  const loaded = page.waitForResponse((r) => r.url().includes("keepsake.get") && r.ok());
  await page.reload();
  await loaded;
  await expect(page.getByText("Download PNG", { exact: true })).toBeVisible();

  const { json } = await trpcCall(page, "keepsake.get", { code });
  const anonymous = await playwright.request.newContext();
  const response = await anonymous.get(json.result.data.png.url);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect(response.headers()["content-disposition"]).toContain("attachment");
});
