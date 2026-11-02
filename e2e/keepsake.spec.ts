import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";
const sentence = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("a web card shows on Archive Detail once saved", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  await page.getByRole("button", { name: "＋ Save this guide sentence" }).first().click();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness" }).click();
  await expect(page.getByText("No web card yet.")).toBeVisible();

  const saved = await trpcCall(page, "keepsake.upsert", { code, templateId: "sentence", sentenceIds: [sentence(1)] });
  expect(saved.json.result.data.created).toBe(true);
  await page.reload();
  await expect(page.getByText("01 web card")).toBeVisible();
  const webCard = page.getByLabel("Web card");
  const text = saved.json.result.data.keepsake.card.sentences[0].content;
  await expect(webCard).toContainText("STILL");
  await expect(webCard).toContainText("Forms of Stillness");
  await expect(webCard).toContainText(text);

  await trpcCall(page, "keepsake.upsert", { code, templateId: "cover" });
  await page.reload();
  await expect(webCard).toContainText("Forms of Stillness");
  await expect(webCard).not.toContainText(text);

  const unknown = await trpcCall(page, "keepsake.upsert", { code, templateId: "x" });
  expect(unknown.status).toBe(400);
  expect(unknown.json.error.data.appCode).toBe("UNKNOWN_TEMPLATE");
  const unsaved = await trpcCall(page, "keepsake.upsert", { code, templateId: "sentence", sentenceIds: [sentence(2)] });
  expect(unsaved.status).toBe(400);
  expect(unsaved.json.error.data.appCode).toBe("SCRAP_NOT_IN_ARCHIVE");
});
