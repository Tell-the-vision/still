import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { randomUUID } from "node:crypto";
import { seedContent, seedExhibition, type SeededExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.4 검토 (Figma A2), §9.5 console.content.create / update / delete / batchUpdate, §10.8 상태 전이와
// 쓰기 경로: staff approve, reject and edit contents on the review screen; the API enforces revisions,
// the state table and the draft sections.

test.use({ viewport: { width: 1440, height: 900 } });

const text = (value: string) => ({ type: "text", text: value });
const heading = (value: string) => ({ type: "heading", attrs: { id: "h1", level: 2 }, content: [text(value)] });
const paragraph = (id: string, value: string) => ({ type: "paragraph", attrs: { id }, content: [text(value)] });

const doc = (content: unknown[]) => ({ type: "doc", content });

async function openReview(page: Page, exhibition: SeededExhibition) {
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");
}
const row = (page: Page, title: string) => page.locator(".item", { hasText: title });
const statusOf = async (id: string) => (await e2eSql<{ status: string }>("SELECT status FROM contents WHERE id = $1", [id]))[0].status;
const call = async (page: Page, path: string, input: unknown) => {
  const { status, json } = await consoleCall(page, path, input);
  return { status, data: json.result?.data, appCode: json.error?.data?.appCode as string | undefined };
};
const revisionOf = async (id: string) => (await e2eSql<{ revision: string }>("SELECT revision FROM contents WHERE id = $1", [id]))[0].revision;

async function setup() {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  return { account, exhibition };
}
async function signedIn(page: Page, account: InstitutionAccount) {
  await signInConsole(page, account);
}

test("staff approve and reject items on the review screen", async ({ page }) => {
  const { account, exhibition } = await setup();
  const alpha = await seedContent(exhibition, { kind: "ARTWORK", status: "READY", doc: [heading("Alpha piece"), paragraph("b1", "Alpha text.")] });
  const bravo = await seedContent(exhibition, { kind: "ARTWORK", status: "NEEDS_REVIEW", doc: [heading("Bravo piece"), paragraph("b1", "Bravo text.")] });
  await signedIn(page, account);
  await openReview(page, exhibition);

  await row(page, "Alpha piece").click();
  await page.getByRole("button", { name: "Approve item" }).click();
  await expect(row(page, "Alpha piece")).toContainText("Approved");
  await expect(page.getByText("Approved 1")).toBeVisible();

  await row(page, "Bravo piece").click();
  // Rejecting is final (SPEC §10.8), so the screen asks once more.
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Reject permanently" }).click();
  await expect(row(page, "Bravo piece")).toContainText("Rejected");

  expect(await statusOf(alpha.id)).toBe("APPROVED");
  expect(await statusOf(bravo.id)).toBe("REJECTED");
});

test("staff edit an item's text and it is saved after reload", async ({ page }) => {
  const { account, exhibition } = await setup();
  const item = await seedContent(exhibition, { kind: "CLOSING", status: "READY", doc: [heading("Farewell"), paragraph("b1", "Old words.")] });
  await signedIn(page, account);
  await openReview(page, exhibition);

  await row(page, "Farewell").click();
  await page.locator(".ProseMirror").getByText("Old words.").click({ clickCount: 3 });
  await page.keyboard.type("New words.");
  await expect.poll(async () => (await e2eSql<{ doc: { content: { content: { text: string }[] }[] } }>("SELECT doc FROM contents WHERE id = $1", [item.id]))[0].doc.content[1].content[0].text).toBe("New words.");

  await page.reload();
  await openReview(page, exhibition);
  await row(page, "Farewell").click();
  await expect(page.locator(".ProseMirror")).toContainText("New words.");
  const [saved] = await e2eSql<{ doc: { content: { attrs: { id: string }; content: { text: string }[] }[] } }>("SELECT doc FROM contents WHERE id = $1", [item.id]);
  expect(saved.doc.content[1]).toMatchObject({ attrs: { id: "b1" }, content: [{ text: "New words." }] });
});

test("Approve all ready approves READY items and leaves NEEDS_REVIEW ones", async ({ page }) => {
  const { account, exhibition } = await setup();
  const one = await seedContent(exhibition, { kind: "ARTIST", status: "READY", doc: [heading("Ready one"), paragraph("b1", "One.")] });
  const two = await seedContent(exhibition, { kind: "ARTIST", status: "READY", doc: [heading("Ready two"), paragraph("b1", "Two.")] });
  const unsure = await seedContent(exhibition, { kind: "ARTIST", status: "NEEDS_REVIEW", doc: [heading("Unsure one"), paragraph("b1", "Unsure.")] });
  await signedIn(page, account);
  await openReview(page, exhibition);

  await page.getByRole("button", { name: /Approve all ready \(2\)/ }).click();
  await expect(page.getByText("Approve 2 groups")).toBeVisible();
  await page.getByRole("button", { name: "Confirm approve" }).click();
  await expect(page.getByText("Approved 2")).toBeVisible();
  await expect(row(page, "Unsure one")).toContainText("In review");

  expect(await statusOf(one.id)).toBe("APPROVED");
  expect(await statusOf(two.id)).toBe("APPROVED");
  expect(await statusOf(unsure.id)).toBe("NEEDS_REVIEW");
});

test("a stale revision is REVISION_MISMATCH and another institution's item is NOT_FOUND", async ({ page }) => {
  const { account, exhibition } = await setup();
  const item = await seedContent(exhibition, { kind: "OTHER", status: "READY", doc: [paragraph("b1", "Text.")] });
  const other = await seedExhibition(await seedInstitutionAccount());
  const foreign = await seedContent(other, { kind: "OTHER", status: "READY", doc: [paragraph("b1", "Foreign.")] });
  await signedIn(page, account);

  const stale = await revisionOf(item.id);
  const first = await call(page, "console.content.update", { id: item.id, revision: stale, editorialNote: "first" });
  expect(first.status).toBe(200);
  expect(first.data.revision).not.toBe(stale);
  const second = await call(page, "console.content.update", { id: item.id, revision: stale, editorialNote: "second" });
  expect(second.status).toBe(412);
  expect(second.appCode).toBe("REVISION_MISMATCH");
  expect(await statusOf(item.id)).toBe("READY");

  const foreignRevision = await revisionOf(foreign.id);
  expect((await call(page, "console.content.update", { id: foreign.id, revision: foreignRevision, status: "APPROVED" })).status).toBe(404);
  expect((await call(page, "console.content.delete", { id: foreign.id })).status).toBe(404);
  expect((await call(page, "console.content.batchUpdate", { code: other.code, status: "APPROVED", where: { status: "READY" } })).status).toBe(404);
  expect(await statusOf(foreign.id)).toBe("READY");
});

test("rejecting removes the item from the draft sections; REJECTED is terminal", async ({ page }) => {
  const { account, exhibition } = await setup();
  const keep = await seedContent(exhibition, { kind: "ARTIST", status: "APPROVED", doc: [paragraph("b1", "Keep.")] });
  const drop = await seedContent(exhibition, { kind: "ARTIST", status: "APPROVED", doc: [paragraph("b1", "Drop.")] });
  const sections = [{ id: "s1", kind: "ARTIST", title: "Artist", visible: true, contentIds: [keep.id, drop.id] }];
  await e2eSql("UPDATE exhibitions SET draft = jsonb_set(draft, '{sections}', $1::jsonb) WHERE id = $2", [JSON.stringify(sections), exhibition.id]);
  await signedIn(page, account);

  const rejected = await call(page, "console.content.update", { id: drop.id, revision: await revisionOf(drop.id), status: "REJECTED" });
  expect(rejected.data).toMatchObject({ status: "REJECTED", approvedAt: null, approvedBy: null });
  const [after] = await e2eSql<{ draft: { sections: { contentIds: string[] }[] }; draft_revision: string }>("SELECT draft, draft_revision FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(after.draft.sections[0].contentIds).toEqual([keep.id]);
  expect(after.draft_revision).not.toBe(exhibition.draftRevision);

  const revision = await revisionOf(drop.id);
  for (const change of [{ status: "APPROVED" }, { editorialNote: "again" }, { doc: doc([paragraph("b1", "Back.")]) }]) {
    const res = await call(page, "console.content.update", { id: drop.id, revision, ...change });
    expect(res.status).toBe(409);
  }
  expect(await statusOf(drop.id)).toBe("REJECTED");
});

test("approving needs READY or NEEDS_REVIEW, and editing an APPROVED item returns it to READY", async ({ page }) => {
  const { account, exhibition } = await setup();
  const item = await seedContent(exhibition, { kind: "ARTWORK", status: "NEEDS_REVIEW", doc: [paragraph("b1", "Original."), paragraph("b2", "Untouched.")] });
  await signedIn(page, account);

  const approved = await call(page, "console.content.update", { id: item.id, revision: await revisionOf(item.id), status: "APPROVED" });
  expect(approved.data.status).toBe("APPROVED");
  expect(approved.data.approvedAt).not.toBeNull();
  expect(approved.data.approvedBy).not.toBeNull();
  expect((await call(page, "console.content.update", { id: item.id, revision: approved.data.revision, status: "APPROVED" })).status).toBe(409);

  const { content } = approved.data.doc;
  const reedit = await call(page, "console.content.update", {
    id: item.id,
    revision: approved.data.revision,
    kind: "CLOSING",
    doc: doc([paragraph("b1", "Changed."), content[1]]),
  });
  expect(reedit.data).toMatchObject({ status: "READY", kind: "CLOSING", approvedAt: null, approvedBy: null });
  expect(reedit.data.doc.content.map((b: { content: { text: string }[] }) => b.content[0].text)).toEqual(["Changed.", "Untouched."]);
});

test("edits are validated: ids, headings, images, sources and node limit", async ({ page }) => {
  const { account, exhibition } = await setup();
  const other = await seedExhibition(await seedInstitutionAccount());
  const insertImage = async (exhibitionId: string) =>
    (await e2eSql<{ id: string }>(
      "INSERT INTO images (exhibition_id, object_key, width, height, rights, verification) VALUES ($1, $2, 10, 10, 'CONFIRMED', 'VERIFIED') RETURNING id",
      [exhibitionId, `e2e/${randomUUID()}`],
    ))[0];
  const foreignImage = await insertImage(other.id);
  const ownImage = await insertImage(exhibition.id);
  const item = await seedContent(exhibition, { kind: "ARTWORK", status: "READY", doc: [paragraph("b1", "Text.")] });
  await signedIn(page, account);
  const revision = await revisionOf(item.id);
  const update = (blocks: unknown[], sources?: unknown) => call(page, "console.content.update", { id: item.id, revision, doc: doc(blocks), sources });
  const image = (imageId: string) => ({ type: "stillImage", attrs: { id: "b2", imageId, display: "HERO", caption: null } });

  expect((await update([paragraph("b1", "A"), paragraph("b1", "B")])).status).toBe(400);
  expect((await update([{ ...heading("Title"), attrs: { id: "h1", level: 1 } }])).status).toBe(400);
  expect((await update([paragraph("b1", "Text."), image(foreignImage.id)])).status).toBe(400);
  expect((await update(Array.from({ length: 300 }, (_, i) => paragraph(`p${i}`, "x")))).status).toBe(400);
  expect((await update([paragraph("b1", "Text.")], { nope: { refs: [`${randomUUID()}:s001`], start: 0, end: 1 } })).status).toBe(400);
  expect((await update([paragraph("b1", "Text.")], { b1: { refs: [`${randomUUID()}:s001`], start: 0, end: 1 } })).status).toBe(400);
  expect(await revisionOf(item.id)).toBe(revision);
  expect((await update([paragraph("b1", "Text."), image(ownImage.id)])).status).toBe(200);
});

test("a scrap mark's sentenceId is server-owned: only ids already stored are kept", async ({ page }) => {
  const { account, exhibition } = await setup();
  const published = randomUUID();
  const scrap = (sentenceId: string, value: string) => ({ type: "text", text: value, marks: [{ type: "scrap", attrs: { sentenceId } }] });
  const item = await seedContent(exhibition, {
    kind: "ARTWORK",
    status: "READY",
    doc: [{ type: "paragraph", attrs: { id: "b1" }, content: [scrap(published, "Light stays.")] }],
  });
  await signedIn(page, account);

  const res = await call(page, "console.content.update", {
    id: item.id,
    revision: await revisionOf(item.id),
    doc: doc([
      { type: "paragraph", attrs: { id: "b1" }, content: [scrap(published, "Light stays here.")] },
      { type: "paragraph", attrs: { id: "b2" }, content: [scrap(randomUUID(), "A new line.")] },
    ]),
  });
  expect(res.status).toBe(200);
  const marks = res.data.doc.content.map((b: { content: { marks: { attrs: { sentenceId: string | null } }[] }[] }) => b.content[0].marks[0].attrs.sentenceId);
  expect(marks).toEqual([published, null]);
});

test("create makes a READY item, delete removes it and its place in the draft sections", async ({ page }) => {
  const { account, exhibition } = await setup();
  await signedIn(page, account);

  const created = await call(page, "console.content.create", { code: exhibition.code, kind: "CLOSING", doc: doc([paragraph("b1", "Thank you for visiting.")]), editorialNote: "typed by hand" });
  expect(created.status).toBe(200);
  expect(created.data).toMatchObject({ kind: "CLOSING", status: "READY", editorialNote: "typed by hand", approvedAt: null });
  expect(await call(page, "console.content.create", { code: exhibition.code, kind: "CLOSING", doc: [paragraph("b1", "x")] })).toMatchObject({ status: 400 });

  const sections = [{ id: "s1", kind: "CLOSING", title: "Closing", visible: true, contentIds: [created.data.id] }];
  await e2eSql("UPDATE exhibitions SET draft = jsonb_set(draft, '{sections}', $1::jsonb) WHERE id = $2", [JSON.stringify(sections), exhibition.id]);
  expect((await call(page, "console.content.delete", { id: created.data.id })).status).toBe(200);
  expect(await e2eSql("SELECT 1 FROM contents WHERE id = $1", [created.data.id])).toHaveLength(0);
  const [after] = await e2eSql<{ draft: { sections: { contentIds: string[] }[] } }>("SELECT draft FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(after.draft.sections[0].contentIds).toEqual([]);
});

test("batchUpdate approves every READY item and never a NEEDS_REVIEW one", async ({ page }) => {
  const { account, exhibition } = await setup();
  const ready = await seedContent(exhibition, { kind: "ARTIST", status: "READY", doc: [paragraph("b1", "Ready.")] });
  const unsure = await seedContent(exhibition, { kind: "ARTIST", status: "NEEDS_REVIEW", doc: [paragraph("b1", "Unsure.")] });
  const done = await seedContent(exhibition, { kind: "ARTIST", status: "APPROVED", doc: [paragraph("b1", "Done.")] });
  await signedIn(page, account);

  const res = await call(page, "console.content.batchUpdate", { code: exhibition.code, status: "APPROVED", where: { status: "READY" } });
  expect(res.data.map((c: { id: string }) => c.id)).toEqual([ready.id]);
  expect(res.data[0]).toMatchObject({ status: "APPROVED" });
  expect(res.data[0].approvedAt).not.toBeNull();
  expect(await statusOf(unsure.id)).toBe("NEEDS_REVIEW");
  expect(await statusOf(done.id)).toBe("APPROVED");
});
