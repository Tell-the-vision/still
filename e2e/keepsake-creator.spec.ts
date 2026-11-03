import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const code = "forms-of-stillness";

test("a visitor creates a web card, then edits it", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await page.getByRole("button", { name: "＋ Save this guide sentence" }).first().click();
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(1);
  await page.getByRole("link", { name: "Write a journal" }).click();
  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  await expect(page.getByText("Saved", { exact: true }).last()).toBeVisible();

  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness" }).click();
  await page.getByRole("link", { name: "Create web card" }).click();
  await expect(page.getByRole("radio", { name: "Sentence" })).toHaveAttribute("aria-checked", "true");
  const cardBox = await page.getByLabel("Web card", { exact: true }).boundingBox();
  const saveBox = await page.getByRole("button", { name: "Save Web Card" }).boundingBox();
  expect(cardBox?.y).toBeLessThan(saveBox?.y ?? 0);
  await expect(page.getByRole("button", { name: "Download PNG" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("radio", { name: "Reflection" }).click();
  await expect(page.getByLabel("Web card", { exact: true }).last()).toContainText("Quiet light.");
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByLabel("Web card", { exact: true }).last()).toContainText("Quiet light.");
  const first = await getKeepsake(page);
  const sentence = first.card.sentences[0].content;
  await expect(page.getByLabel("Web card", { exact: true }).last()).toContainText(sentence);

  await page.getByRole("link", { name: "Edit web card" }).click();
  await page.getByRole("radio", { name: "Cover" }).click();
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByLabel("Web card", { exact: true }).last()).not.toContainText("Quiet light.");
  await expect(page.getByLabel("Web card", { exact: true }).last()).not.toContainText(sentence);
  expect((await getKeepsake(page)).createdAt).toBe(first.createdAt);
});

test("a visitor picks sentences and an excerpt; the server checks the excerpt", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await trpcCall(page, "scrap.upsert", { code, sentenceId: id(1) });
  await trpcCall(page, "scrap.upsert", { code, sentenceId: id(2) });
  await trpcCall(page, "journal.upsert", { code, content: "First paragraph.\nSecond paragraph.", audioType: null, revision: null });
  const scraps = (await trpcCall(page, "scrap.list", { code })).json.result.data as { content: string }[];

  await page.goto(`/archive/${code}/keepsake`);
  await page.getByRole("radio", { name: "Reflection" }).click();
  await page.getByRole("checkbox", { name: scraps[1].content }).click();
  await expect(page.getByRole("checkbox", { name: scraps[1].content })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "Second paragraph." }).click();
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  const card = (await getKeepsake(page)).card;
  expect(card.sentences.map((s: { content: string }) => s.content)).toEqual([scraps[1].content]);
  expect(card.journalExcerpt).toBe("Second paragraph.");

  const missing = await trpcCall(page, "keepsake.upsert", { code, templateId: "reflection", journalExcerpt: "Nowhere." });
  expect(missing.status).toBe(400);
  expect(missing.json.error.data.appCode).toBe("EXCERPT_NOT_IN_JOURNAL");

  const { revision } = (await trpcCall(page, "journal.get", { code })).json.result.data;
  await trpcCall(page, "journal.upsert", { code, content: "café", audioType: null, revision });
  const nfc = await trpcCall(page, "keepsake.upsert", { code, templateId: "reflection", journalExcerpt: "café" });
  expect(nfc.status).toBe(200);
});

const getKeepsake = async (page: Page) => (await trpcCall(page, "keepsake.get", { code })).json.result.data;

test("editing a web card starts from the saved picks", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await trpcCall(page, "scrap.upsert", { code, sentenceId: id(1) });
  await trpcCall(page, "scrap.upsert", { code, sentenceId: id(2) });
  await trpcCall(page, "journal.upsert", { code, content: "First paragraph.\nSecond paragraph.", audioType: null, revision: null });
  const scraps = (await trpcCall(page, "scrap.list", { code })).json.result.data as { sentenceId: string; content: string }[];
  // Not the default: the default is the first saved sentence.
  await trpcCall(page, "keepsake.upsert", { code, templateId: "sentence", sentenceIds: [scraps[1].sentenceId] });

  await page.goto(`/archive/${code}/keepsake`);
  await expect(page.getByRole("checkbox", { name: scraps[1].content })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: scraps[0].content })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("link", { name: "Download PNG" })).toBeVisible();

  // Changing only the layout keeps the picked sentence.
  await page.getByRole("radio", { name: "Reflection" }).click();
  await page.getByRole("radio", { name: "Second paragraph." }).click();
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  const card = (await getKeepsake(page)).card;
  expect(card.sentences.map((s: { content: string }) => s.content)).toEqual([scraps[1].content]);
  expect(card.journalExcerpt).toBe("Second paragraph.");

  // Reopening shows the saved excerpt as picked.
  await page.goto(`/archive/${code}/keepsake`);
  await expect(page.getByRole("radio", { name: "Second paragraph." })).toHaveAttribute("aria-checked", "true");
});

test("a failed load shows a Retry notice", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.route(/keepsake\.get/, (route) => route.fulfill({ status: 500, json: [{ error: { message: "boom", code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } } }] }));
  await page.goto(`/archive/${code}/keepsake`);
  await expect(page.getByText("Couldn't load the web card.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});
