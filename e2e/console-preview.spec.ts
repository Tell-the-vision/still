import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.4 가이드 편집과 컴파일, 미리보기와 발행 점검, §9.5 console.preview.get: the draft is
// compiled into the visitor documents and checked; only APPROVED, visible content reaches them.

test.use({ viewport: { width: 1440, height: 900 } });

type Check = { id: string; title: string; ok: boolean; warning: boolean; detail: string };
const block = (type: string, id: string, text: string) => ({ type, id, text, origin: "SOURCE", refs: [] });

async function seedContent(exhibitionId: string, kind: string, status: "APPROVED" | "READY", blocks: unknown[], fields: unknown = null) {
  const [row] = await e2eSql<{ id: string }>(
    `INSERT INTO contents (exhibition_id, kind, status, blocks, fields, approved_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $3 = 'APPROVED' THEN now() END) RETURNING id`,
    [exhibitionId, kind, status, JSON.stringify(blocks), fields && JSON.stringify(fields)],
  );
  return row.id;
}

async function seedImage(exhibitionId: string, opts: { objectKey?: string | null; rights?: string; verification?: string } = {}) {
  const { objectKey = `e2e/${randomUUID()}.jpg`, rights = "CONFIRMED", verification = "VERIFIED" } = opts;
  const [row] = await e2eSql<{ id: string }>(
    "INSERT INTO images (exhibition_id, object_key, width, height, alt_text, rights, verification) VALUES ($1, $2, 800, 600, 'alt', $3, $4) RETURNING id",
    [exhibitionId, objectKey, rights, verification],
  );
  return row.id;
}

// Merges `patch` into the seeded exhibition's draft.
async function setDraft(exhibitionId: string, patch: Record<string, unknown>) {
  await e2eSql("UPDATE exhibitions SET draft = draft || $2::jsonb WHERE id = $1", [exhibitionId, JSON.stringify(patch)]);
}

const section = (id: string, kind: string, title: string, visible: boolean, contentIds: string[]) => ({ id, kind, title, visible, contentIds });

// An exhibition with an introduction, a visible "Works" section (one APPROVED artwork, one READY
// content) and a hidden section.
async function seedScenario(account: InstitutionAccount) {
  const exhibition = await seedExhibition(account);
  const image = await seedImage(exhibition.id);
  const intro = await seedContent(exhibition.id, "INTRODUCTION", "APPROVED", [block("paragraph", "p1", "Intro paragraph."), block("sentence", "s1", "Intro sentence.")]);
  const artwork = await seedContent(
    exhibition.id, "ARTWORK", "APPROVED",
    [block("heading", "h1", "Untitled"), { type: "image", id: "i1", imageId: image, display: "INLINE", captionRefs: [] }, block("paragraph", "p1", "Artwork paragraph."), block("sentence", "s1", "Artwork sentence.")],
    { titleEn: { value: "Untitled", origin: "SOURCE", refs: [] }, year: { value: "2020", origin: "SOURCE", refs: [] } },
  );
  const pending = await seedContent(exhibition.id, "THEME", "READY", [block("paragraph", "p1", "Pending theme text.")]);
  const hidden = await seedContent(exhibition.id, "CLOSING", "APPROVED", [block("paragraph", "p1", "Hidden closing text.")]);
  await setDraft(exhibition.id, {
    sections: [
      section("a", "INTRODUCTION", "Introduction", true, [intro]),
      section("b", "CUSTOM", "Works", true, [artwork, pending]),
      section("c", "CLOSING", "Closing", false, [hidden]),
    ],
  });
  return { exhibition, image, intro, artwork, pending, hidden };
}

const preview = async (page: Page, code: string) => (await consoleCall(page, "console.preview.get", { code })).json.result.data;
const checkOf = (checks: Check[], id: string) => checks.find((c) => c.id === id)!;

async function openPreview(page: Page, title: string) {
  await page.goto("/institutions/exhibitions");
  await page.getByText(title, { exact: true }).click();
  await page.getByRole("link", { name: /Preview/ }).first().click();
  await expect(page).toHaveURL(/\/institutions\/materials\/preview$/);
}

test("staff see the content approval check fail, then pass once the content is approved", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const { exhibition, pending } = await seedScenario(account);
  await signInConsole(page, account);

  await openPreview(page, exhibition.title);
  const approval = page.getByRole("listitem").filter({ hasText: "Content approval" });
  await expect(approval).toContainText("2 of 3 contents in visible sections are approved");
  await expect(approval).toContainText("Needs check");

  await e2eSql("UPDATE contents SET status = 'APPROVED', approved_at = now() WHERE id = $1", [pending]);
  await openPreview(page, exhibition.title);
  await expect(page.getByRole("listitem").filter({ hasText: "Content approval" })).toContainText("Ready");
});

test("console.preview.get compiles description and guide from approved, visible content only", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const { exhibition, image } = await seedScenario(account);
  await signInConsole(page, account);

  const got = await preview(page, exhibition.code);
  expect(got.exhibition).toMatchObject({ code: exhibition.code, title: exhibition.title, venue: { city: "Seoul" }, audio: { playlist: null, ambienceEnabled: false }, coverImage: null });
  expect(got.exhibition.description.blocks).toEqual([
    { type: "paragraph", text: "Intro paragraph." },
    { type: "paragraph", text: "Intro sentence." },
  ]);
  const blocks = got.guide.blocks;
  expect(blocks.map((b: { type: string }) => b.type)).toEqual(["heading", "heading", "image", "paragraph", "sentence"]);
  expect(blocks[0]).toEqual({ type: "heading", text: "Works" });
  expect(blocks[1]).toEqual({ type: "heading", text: "Untitled" });
  expect(blocks[2]).toMatchObject({ imageId: image, url: expect.stringContaining("e2e/"), width: 800 });
  expect(blocks[4]).toMatchObject({ text: "Artwork sentence." });
  const text = JSON.stringify(got);
  expect(text).not.toContain("Pending theme text.");
  expect(text).not.toContain("Hidden closing text.");
  expect(got.losses).toEqual(expect.arrayContaining([
    expect.stringContaining("Sentences in the introduction become paragraphs"),
    expect.stringContaining('Hidden section "Closing"'),
    expect.stringContaining("not approved"),
  ]));
});

test("an image without a public copy has no url in the preview", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const { exhibition, artwork } = await seedScenario(account);
  const bare = await seedImage(exhibition.id, { objectKey: null });
  await e2eSql(
    "UPDATE contents SET blocks = blocks || $2::jsonb WHERE id = $1",
    [artwork, JSON.stringify([{ type: "image", id: "i2", imageId: bare, display: "INLINE", captionRefs: [] }])],
  );
  await signInConsole(page, account);
  const got = await preview(page, exhibition.code);
  expect(got.guide.blocks.find((b: { imageId?: string }) => b.imageId === bare)).toMatchObject({ url: null });
});

test("each publication check passes and fails on its own condition", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const { exhibition, image, artwork } = await seedScenario(account);
  await signInConsole(page, account);
  const checks = async () => (await preview(page, exhibition.code)).checks as Check[];

  // Everything but content approval passes.
  const first = await checks();
  expect(first.map((c) => [c.id, c.ok])).toEqual([
    ["content-approval", false], ["artwork-metadata", true], ["image-rights", true], ["image-verification", true],
    ["image-files", true], ["audio-link", true], ["basic-info", true], ["document-validation", true],
  ]);
  expect(checkOf(first, "artwork-metadata").warning).toBe(false);

  // Artwork metadata is a warning: it does not block.
  await e2eSql("UPDATE contents SET fields = NULL WHERE id = $1", [artwork]);
  expect(checkOf(await checks(), "artwork-metadata")).toMatchObject({ ok: true, warning: true });

  // Image rights and verification apply to the guide's images and to the cover.
  await e2eSql("UPDATE images SET rights = 'UNCONFIRMED' WHERE id = $1", [image]);
  expect(checkOf(await checks(), "image-rights").ok).toBe(false);
  await e2eSql("UPDATE images SET rights = 'CONFIRMED', verification = 'MISMATCH' WHERE id = $1", [image]);
  expect(checkOf(await checks(), "image-verification").ok).toBe(false);
  await e2eSql("UPDATE images SET verification = 'NOT_APPLICABLE' WHERE id = $1", [image]);
  expect(checkOf(await checks(), "image-verification").ok).toBe(true);
  const cover = await seedImage(exhibition.id, { rights: "RESTRICTED" });
  await setDraft(exhibition.id, { coverImageId: cover });
  expect(checkOf(await checks(), "image-rights").ok).toBe(false);

  // Image files: an image without a public file cannot be published before the extraction module exists.
  await e2eSql("UPDATE images SET object_key = NULL WHERE id = $1", [image]);
  expect(checkOf(await checks(), "image-files").ok).toBe(false);
  await e2eSql("UPDATE images SET object_key = $2 WHERE id = $1", [image, `e2e/${randomUUID()}.jpg`]);

  // Audio link: the provider decides the URL.
  await setDraft(exhibition.id, { playlist: { provider: "SPOTIFY", url: "https://music.apple.com/x", title: "Mix", description: null } });
  expect(checkOf(await checks(), "audio-link").ok).toBe(false);
  await setDraft(exhibition.id, { playlist: { provider: "SPOTIFY", url: "https://open.spotify.com/playlist/x", title: "Mix", description: null } });
  expect(checkOf(await checks(), "audio-link").ok).toBe(true);

  // Basic info: title, venue, period.
  await setDraft(exhibition.id, { venueId: null, endDate: null });
  expect(checkOf(await checks(), "basic-info").ok).toBe(false);
});

test("another institution's exhibition code is NOT_FOUND", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const other = await seedExhibition(await seedInstitutionAccount());
  await signInConsole(page, account);
  expect((await consoleCall(page, "console.preview.get", { code: other.code })).status).toBe(404);
  expect((await consoleCall(page, "console.preview.get", { code: "no-such-exhibition" })).status).toBe(404);
});
