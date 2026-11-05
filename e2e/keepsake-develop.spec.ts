import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

// The keepsake's one authored moment: where a save lands, the card develops once like a print in the tray.
const photo = "src/server/db/seed/demo/images/forms-of-stillness/cover.webp";
const excerpt = "The light kept still on the stone.";

// `slowCover`: the cover hasn't arrived by the time anything develops.
async function visitWithCover(page: Page, next: Parameters<typeof stubGoogleToken>[0], { slowCover = false } = {}) {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await page.route("https://media.test.invalid/**", async (route) => {
    if (slowCover) await new Promise((resolve) => setTimeout(resolve, 15_000));
    await route.fulfill({ path: photo, contentType: "image/webp" }).catch(() => {});
  });
  await signIn(page);
  await openGuide(page, "with-cover");
  // This exhibition has no guide sentences, so a journal creates the archive.
  await trpcCall(page, "journal.upsert", { code: "with-cover", content: excerpt, audioType: null, revision: null });
}

async function openArchiveDetail(page: Page) {
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: "With Cover", exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/with-cover$/);
}

async function saveReflection(page: Page) {
  await page.getByRole("radio", { name: "Reflection" }).click();
  await page.getByRole("radio", { name: excerpt }).click();
  await page.getByRole("button", { name: "Save Web Card" }).click();
}

type Frame = { t: number; owner: string | null; v: string; veil: boolean; coverFilter: string | null; filtered: boolean; translated: boolean; title: number; caption: number; status: number };

// Samples every visible developing card on each frame: its phase, the cover's filter, any translate, the title's and
// the caption's ink, and the ink of the visible status line beside it.
async function sampleCards(page: Page, title: string) {
  await page.evaluate((title) => {
    const w = window as unknown as { __frames: Frame[] };
    w.__frames = [];
    const tick = () => {
      requestAnimationFrame(tick);
      document.querySelectorAll<HTMLElement>("[data-develop]").forEach((card) => {
        if (card.getClientRects().length === 0) return; // a screen hidden under the stack
        const inside = [...card.querySelectorAll<HTMLElement>("*")].map((el) => getComputedStyle(el));
        const cover = card.querySelector("[aria-label='Test cover']")?.parentElement;
        const leaves = [...card.querySelectorAll<HTMLElement>("*")].filter((el) => el.childElementCount === 0);
        const heading = leaves.find((el) => el.textContent === title);
        const caption = leaves.find((el) => / \/ \d{4}$/.test(el.textContent ?? ""));
        const status = [...document.querySelectorAll<HTMLElement>("[data-ink-status]")].find((el) => el.getClientRects().length > 0);
        const ink = (el: HTMLElement | null | undefined) => (el ? Number(getComputedStyle(el).opacity) : NaN);
        w.__frames.push({
          t: performance.now(),
          owner: card.closest("[role=button]")?.getAttribute("aria-label") ?? null,
          v: card.dataset.develop ?? "",
          veil: card.querySelector("[data-develop-veil]") !== null,
          coverFilter: cover ? getComputedStyle(cover).filter : null,
          filtered: inside.some((s) => s.filter !== "none"),
          translated: inside.some((s) => s.transform !== "none"),
          title: ink(heading?.parentElement),
          caption: ink(caption?.parentElement),
          status: ink(status),
        });
      });
    };
    requestAnimationFrame(tick);
  }, title);
}

const framesOf = async (page: Page, owner: string) =>
  (await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames)).filter((f) => f.owner === owner);
// The frames of one develop: it has run, and the card has reported done (its surface is `still` again).
const developed = (frames: Frame[]) => {
  const run = frames.findIndex((f) => f.v === "run");
  return run >= 0 && frames.slice(run).some((f) => f.v === "still");
};
const developedFrames = async (page: Page, owner: string) => {
  await expect.poll(async () => developed(await framesOf(page, owner))).toBe(true);
  return framesOf(page, owner);
};
const firstInk = (frames: Frame[], key: "title" | "caption" | "status") => frames.find((f) => f[key] > 0.02 && f[key] < 1)?.t ?? NaN;
const span = (frames: Frame[], from: string, to: string) => {
  const start = frames.find((f) => f.v === from);
  const end = frames.find((f) => f.v === to && start && f.t >= start.t);
  return start && end ? end.t - start.t : NaN;
};

const heroName = "Your keepsake card — edit";
// A card waits up to 250 ms for its cover; its title inks from 200 ms after it begins (less a frame or two).
const coverWaitThenTitle = 250 + 200 - 50;

test("saving from Archive Detail develops the hero once; it rests exactly as the still card", async ({ page, next }) => {
  await visitWithCover(page, next);
  await openArchiveDetail(page);
  const hero = page.getByRole("button", { name: heroName });
  const card = hero.locator("[data-develop]");
  await expect(card).toHaveAttribute("data-develop", "still");
  await hero.click();
  await sampleCards(page, "With Cover");
  await saveReflection(page);
  await expect(page).toHaveURL(/\/archive\/with-cover$/);

  // Nothing waits on the develop: the PNG is there and pressable while the card comes up.
  await page.waitForSelector('[data-develop="run"]', { state: "attached" });
  await page.getByRole("link", { name: "Download PNG" }).click({ trial: true, timeout: 500 });
  // The run ends: the hero reports done and rests, so nothing that mounts later can replay it.
  await expect(card).toHaveAttribute("data-develop", "still", { timeout: 1500 });

  const frames = await developedFrames(page, heroName);
  expect(span(frames, "run", "still")).toBeLessThan(1200);
  // While developing: paper first (title uninked, veil down), and the cover's brightness ramps on web.
  expect(frames.some((f) => f.v === "run" && f.veil && f.title < 0.05)).toBe(true);
  expect(frames.some((f) => f.v === "run" && f.coverFilter?.startsWith("brightness("))).toBe(true);
  // Nothing slides.
  expect(frames.every((f) => !f.translated)).toBe(true);

  // At rest: full ink, no veil, no filter.
  const title = card.getByText("With Cover", { exact: true });
  expect(await title.evaluate((el) => getComputedStyle(el.parentElement!).opacity)).toBe("1");
  expect(await card.locator("[aria-label='Test cover']").evaluate((el) => getComputedStyle(el.parentElement!).filter)).toBe("none");
  await expect(card.locator("[data-develop-veil]")).toHaveCount(0);
  await expect(page.getByText(/^Kept on /).last()).toBeVisible();
  const rested = await hero.screenshot();

  // A reload never replays it, and the still card is pixel for pixel the developed one.
  await page.reload();
  await expect(card).toHaveAttribute("data-develop", "still");
  const coverShown = () => card.locator("[aria-label='Test cover']").evaluate((el) => [...el.querySelectorAll("*")].some((c) => getComputedStyle(c).backgroundImage.startsWith("url")));
  await expect.poll(coverShown).toBe(true);
  await sampleCards(page, "With Cover");
  await page.waitForTimeout(600);
  expect(new Set((await framesOf(page, heroName)).map((f) => f.v))).toEqual(new Set(["still"]));
  expect((await hero.screenshot()).equals(rested)).toBe(true);

  // Nor does a routine visit.
  await openArchiveDetail(page);
  await expect(card).toHaveAttribute("data-develop", "still");
});

test("saving from the guide develops the guide's thumbnail, then the Archive Detail hero once", async ({ page, next }) => {
  await visitWithCover(page, next);
  await page.reload();
  const thumbName = "Your keepsake card";
  await page.getByRole("link", { name: "Make your card" }).click();
  await expect(page).toHaveURL(/\/archive\/with-cover\/keepsake\?from=guide/);
  await sampleCards(page, "With Cover");
  await saveReflection(page);
  await expect(page).toHaveURL(/\/e\/with-cover$/);
  const thumb = page.getByRole("button", { name: thumbName, exact: true }).locator("[data-develop]");
  expect((await developedFrames(page, thumbName)).some((f) => f.v === "run")).toBe(true);
  await expect(thumb).toHaveAttribute("data-develop", "still");

  // The echo: the first Archive Detail of this version develops, the next one rests.
  await sampleCards(page, "With Cover");
  await openArchiveDetail(page);
  const hero = page.getByRole("button", { name: heroName }).locator("[data-develop]");
  expect((await developedFrames(page, heroName)).some((f) => f.v === "run")).toBe(true);
  await expect(hero).toHaveAttribute("data-develop", "still");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  // My Archive's mini cards never develop.
  const tile = page.getByRole("link", { name: "With Cover", exact: true });
  await expect(tile.getByLabel("Keepsake preview")).toBeVisible();
  await expect(tile.locator("[data-develop]")).toHaveCount(0);
  expect(await tile.getByLabel("Keepsake preview").getAttribute("data-develop")).toBeNull();
  await tile.click();
  await expect(hero).toHaveAttribute("data-develop", "still");
});

test("with reduced motion the develop is one short fade, without the filter or any travel", async ({ page, next }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await visitWithCover(page, next);
  await openArchiveDetail(page);
  await page.getByRole("button", { name: heroName }).click();
  await sampleCards(page, "With Cover");
  await saveReflection(page);
  const card = page.getByRole("button", { name: heroName }).locator("[data-develop]");
  const frames = await developedFrames(page, heroName);
  expect(span(frames, "run", "still")).toBeLessThan(400);
  await expect(card).toHaveAttribute("data-develop", "still");
  expect(frames.every((f) => !f.filtered && !f.translated)).toBe(true);
  // The confirmation still stands in the live region.
  await expect(page.getByText(/^Kept on /).last()).toBeVisible();
});

test("a slow cover holds the develop, and the status still settles after the date", async ({ page, next }) => {
  await visitWithCover(page, next, { slowCover: true });
  await openArchiveDetail(page);
  await page.getByRole("button", { name: heroName }).click();
  await sampleCards(page, "With Cover");
  await saveReflection(page);
  const frames = await developedFrames(page, heroName);
  const run = frames.find((f) => f.v === "run")!.t;
  // The card waited for its cover before it began (the title inks from 200 ms after the begin).
  expect(firstInk(frames, "title") - run).toBeGreaterThan(coverWaitThenTitle);
  // The status counts from the card's real begin, so it never comes up ahead of the date.
  expect(firstInk(frames, "status")).toBeGreaterThanOrEqual(firstInk(frames, "caption"));
  await expect(page.getByText(/^Kept on /).last()).toBeVisible();
});

test("ticking a line inks only that line in, in place", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await trpcCall(page, "scrap.upsert", { code: "forms-of-stillness", sentenceId: id(1) });
  await trpcCall(page, "scrap.upsert", { code: "forms-of-stillness", sentenceId: id(2) });
  const scraps = (await trpcCall(page, "scrap.list", { code: "forms-of-stillness" })).json.result.data as { sentenceId: string; content: string }[];
  await trpcCall(page, "keepsake.upsert", { code: "forms-of-stillness", templateId: "sentence", sentenceIds: [scraps[0].sentenceId] });
  await page.goto("/archive/forms-of-stillness/keepsake");
  const preview = page.getByLabel("Web card", { exact: true });
  await expect(preview).toContainText(scraps[0].content);
  await expect(preview.locator("[data-develop]")).toHaveCount(0);

  await page.evaluate((texts) => {
    const w = window as unknown as { __lines: { text: string; opacity: number; transform: string }[] };
    w.__lines = [];
    const tick = () => {
      document.querySelectorAll<HTMLElement>("[aria-label='Web card'] *").forEach((el) => {
        if (el.childElementCount === 0 && texts.includes(el.textContent ?? "")) {
          const s = getComputedStyle(el.parentElement!);
          w.__lines.push({ text: el.textContent!, opacity: Number(s.opacity), transform: s.transform });
        }
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [scraps[0].content, scraps[1].content]);
  await page.getByRole("checkbox", { name: scraps[1].content }).click();
  await expect(preview).toContainText(scraps[1].content);
  await page.waitForTimeout(500);
  const lines = await page.evaluate(() => (window as unknown as { __lines: { text: string; opacity: number; transform: string }[] }).__lines);
  const added = lines.filter((l) => l.text === scraps[1].content);
  expect(added[0].opacity).toBeLessThan(1);
  expect(added.at(-1)).toMatchObject({ opacity: 1, transform: "none" });
  expect(lines.filter((l) => l.text === scraps[0].content).every((l) => l.opacity === 1)).toBe(true);
});

test("a line kept on the guide inks into the live preview", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByText("Lines you keep appear here.")).toBeAttached();
  await page.evaluate(() => {
    const w = window as unknown as { __first: number | null };
    w.__first = null;
    const tick = () => {
      const line = [...document.querySelectorAll<HTMLElement>("[aria-label='Keepsake preview'] *")].find(
        (el) => el.childElementCount === 0 && /^(A room can hold its breath\.|Stillness is attention\.)$/.test(el.textContent ?? ""),
      );
      if (line && line.getClientRects().length > 0) w.__first = Number(getComputedStyle(line.parentElement!).opacity);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __first: number | null }).__first)).not.toBeNull();
  expect(await page.evaluate(() => (window as unknown as { __first: number }).__first)).toBeLessThan(1);
});

test("saving shows Keeping… and blocks a second tap; a failed save keeps the editor still", async ({ page, next }) => {
  await visitWithCover(page, next);
  await openArchiveDetail(page);
  await page.getByRole("button", { name: heroName }).click();
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/api\/trpc\/keepsake\.upsert/, async (route) => {
    await held;
    await route.abort();
  });
  await saveReflection(page);
  const keeping = page.getByRole("button", { name: "Keeping…" });
  await expect(keeping).toBeVisible();
  await expect(keeping).toHaveAttribute("aria-disabled", "true");
  release();
  await expect(page.getByText("Couldn't save. Your selection is kept.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Web Card" })).toBeVisible();
  await expect(page).toHaveURL(/\/archive\/with-cover\/keepsake/);
  await expect(page.getByLabel("Web card", { exact: true }).locator("[data-develop]")).toHaveCount(0);
});
