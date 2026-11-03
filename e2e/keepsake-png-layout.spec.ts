import { readFile } from "node:fs/promises";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";

test("a Korean reflection card downloads as a full-size PNG without fetching fonts", async ({ page, next }) => {
  const fetched: string[] = [];
  next.onFetch((request) => {
    fetched.push(request.url);
    return "abort";
  });
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  await page.getByRole("button", { name: "＋ Save this guide sentence" }).first().click();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  await trpcCall(page, "journal.upsert", { code, content: "고요한 빛 Quiet light.", audioType: null, revision: null });
  await trpcCall(page, "keepsake.upsert", { code, templateId: "reflection", journalExcerpt: "고요한 빛 Quiet light." });
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness" }).click();

  const downloading = page.waitForEvent("download");
  await page.getByText("Download PNG").click();
  const png = await readFile(await (await downloading).path());
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1440]);
  expect(png.length).toBeGreaterThan(10_000);
  expect(fetched.filter((url) => /font|\.ttf|gstatic/i.test(url))).toEqual([]);
});
