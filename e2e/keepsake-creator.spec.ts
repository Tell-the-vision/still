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
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
  await page.getByRole("link", { name: "Write a journal" }).click();
  await page.getByRole("textbox", { name: "Journal" }).fill("Quiet light.");
  await page.getByRole("button", { name: "Save Journal" }).click();
  // Saving returns to the Archive Detail, which shows the time.
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByText(/^Saved · \d\d:\d\d$/).last()).toBeVisible();

  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "Forms of Stillness", exact: true }).click();
  await page.getByRole("link", { name: "Make your card" }).click();
  await expect(page.getByRole("radio", { name: "Sentence" })).toHaveAttribute("aria-checked", "true");
  const cardBox = await page.getByLabel("Web card", { exact: true }).boundingBox();
  const captionBox = await page.getByLabel("Web card", { exact: true }).getByText("SEOUL / 2026").boundingBox();
  expect((cardBox?.y ?? 0) + (cardBox?.height ?? 0) - ((captionBox?.y ?? 0) + (captionBox?.height ?? 0))).toBeLessThanOrEqual(24);
  const headingBox = await page.getByRole("heading", { name: "Keep this moment." }).boundingBox();
  await expect(page.getByText("DIGITAL KEEPSAKE / WEB CARD")).toHaveCount(0);
  expect(headingBox?.y).toBeLessThan(cardBox?.y ?? 0);
  const saveBox = await page.getByRole("button", { name: "Save Web Card" }).boundingBox();
  expect(cardBox?.y).toBeLessThan(saveBox?.y ?? 0);
  await expect(page.getByRole("button", { name: "Download PNG" })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("radio", { name: "Reflection" }).click();
  await expect(page.getByLabel("Web card", { exact: true }).last()).toContainText("Quiet light.");
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByLabel("Your keepsake card", { exact: true }).last()).toContainText("Quiet light.");
  const first = await getKeepsake(page);
  const sentence = first.card.sentences[0].content;
  await expect(page.getByLabel("Your keepsake card", { exact: true }).last()).toContainText(sentence);

  await page.getByRole("link", { name: "Edit card" }).click();
  await page.getByRole("radio", { name: "Cover" }).click();
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  await expect(page.getByLabel("Your keepsake card", { exact: true }).last()).not.toContainText("Quiet light.");
  await expect(page.getByLabel("Your keepsake card", { exact: true }).last()).not.toContainText(sentence);
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

// #24: long text shrinks the cover, so the web card shows every word, as the PNG does (SPEC §7.3).
test("a long record shrinks the cover instead of cutting the text", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.route("https://media.test.invalid/**", (route) => route.fulfill({ path: "e2e/fixtures/cover.png" }));
  await openGuide(page, "with-cover");
  const paragraph = "고요한 빛이 벽을 타고 내려온다. ".repeat(20).trim();
  await trpcCall(page, "journal.upsert", { code: "with-cover", content: paragraph, audioType: null, revision: null });

  await page.goto("/archive/with-cover/keepsake");
  await page.getByRole("radio", { name: "Reflection" }).click();
  // The whole paragraph as the excerpt: longer than the 140-character default.
  await page.getByRole("radio", { name: /^고요한 빛이/ }).click();
  const card = page.getByLabel("Web card", { exact: true });
  const excerpt = card.getByText(/^고요한 빛이/);
  const caption = card.getByText("SEOUL / 2026");
  await expect(excerpt).toBeVisible();
  const cardBox = await card.boundingBox();
  const excerptBox = await excerpt.boundingBox();
  const captionBox = await caption.boundingBox();
  const tight = 8 * ((cardBox?.width ?? 0) / 360); // spacing.tight, at the card's rendered scale
  expect((excerptBox?.y ?? 0) + (excerptBox?.height ?? Infinity) + tight).toBeLessThanOrEqual(captionBox?.y ?? 0); // at least spacing.tight between text and caption
  expect((captionBox?.y ?? 0) + (captionBox?.height ?? Infinity)).toBeLessThanOrEqual((cardBox?.y ?? 0) + (cardBox?.height ?? 0));
});

// #25: a paragraph longer than the card holds is offered as its first 280 characters, and saves.
test("a long journal paragraph is offered as an excerpt that fits", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  const long = "가".repeat(300);
  await trpcCall(page, "journal.upsert", { code, content: `Short paragraph.\n${long}`, audioType: null, revision: null });

  await page.goto(`/archive/${code}/keepsake`);
  await page.getByRole("radio", { name: "Reflection" }).click();
  const choice = page.getByRole("radio", { name: `${"가".repeat(280)}…`, exact: true });
  await choice.click();
  await expect(choice).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  expect((await getKeepsake(page)).card.journalExcerpt).toBe("가".repeat(280));
});

// #26: Reflection shows one sentence, so the creator offers one pick and the server keeps one.
test("Reflection takes one sentence", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, code);
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await trpcCall(page, "scrap.upsert", { code, sentenceId: id(1) });
  await trpcCall(page, "scrap.upsert", { code, sentenceId: id(2) });
  const scraps = (await trpcCall(page, "scrap.list", { code })).json.result.data as { sentenceId: string; content: string }[];

  await page.goto(`/archive/${code}/keepsake`);
  await page.getByRole("checkbox", { name: scraps[0].content }).click();
  await page.getByRole("checkbox", { name: scraps[1].content }).click();
  await page.getByRole("radio", { name: "Reflection" }).click();
  await expect(page.getByText("1 of 1 chosen.")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: scraps[0].content })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: scraps[1].content })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("checkbox", { name: scraps[1].content })).toBeDisabled();
  await page.getByRole("button", { name: "Save Web Card" }).click();
  await expect(page).toHaveURL(/\/archive\/forms-of-stillness$/);
  expect((await getKeepsake(page)).card.sentences.map((s: { content: string }) => s.content)).toEqual([scraps[0].content]);

  // The server keeps no more than the template shows, whatever the request.
  await trpcCall(page, "keepsake.upsert", { code, templateId: "reflection", sentenceIds: [id(1), id(2)] });
  expect((await getKeepsake(page)).card.sentences).toHaveLength(1);
});

test("on a phone the layout choice is visible without scrolling", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await openGuide(page, code);
  await trpcCall(page, "scrap.upsert", { code, sentenceId: "00000000-0000-4000-8000-000000000001" });
  await trpcCall(page, "journal.upsert", { code, content: "Quiet light.", audioType: null, revision: null });
  await page.goto(`/archive/${code}/keepsake`);
  await expect(page.getByText("Choose a layout", { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("radio", { name: "Sentence" })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: "/tmp/still-shots/creator/creator-390.png" });
});
