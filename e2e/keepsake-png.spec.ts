import { readFile } from "node:fs/promises";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";

test("a saved web card downloads as a signed PNG", async ({ page, next }) => {
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

  const box = await page.getByLabel("Web card", { exact: true }).boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? Infinity)).toBeLessThanOrEqual((page.viewportSize()?.width ?? 0) - 24);

  const downloading = page.waitForEvent("download");
  await page.getByText("Download PNG").click();
  const path = await (await downloading).path();
  const png = await readFile(path);
  expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1440]);

  const first = await trpcCall(page, "keepsake.get", { code });
  const second = await trpcCall(page, "keepsake.get", { code });
  const url: string = first.json.result.data.png.url;
  expect(second.json.result.data.png.url).toBe(url);
  expect((await page.request.get(`${url}x`)).status()).toBe(403);

  await trpcCall(page, "keepsake.upsert", { code, templateId: "cover" });
  expect((await page.request.get(url)).status()).toBe(403);
});
