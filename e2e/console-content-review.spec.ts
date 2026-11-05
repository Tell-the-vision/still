import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { randomUUID } from "node:crypto";
import { seedContent, seedExhibition, type SeededExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.4 검토 (Figma A2), §9.5 console.content.create / update / delete / batchUpdate, §10.8 상태 전이와
// 쓰기 경로: staff approve, reject and edit contents on the review screen; the API enforces revisions,
// the state table and the draft sections.

test.use({ viewport: { width: 1440, height: 900 } });

const heading = (text: string) => ({ type: "heading", id: "h1", text, origin: "SOURCE", refs: [] });
const paragraph = (id: string, text: string, refs: string[] = []) => ({ type: "paragraph", id, text, origin: "SOURCE", refs });
const edited = (id: string, text: string) => ({ type: "paragraph", id, text, origin: "EDITED", refs: [] });

async function openReview(page: Page, exhibition: SeededExhibition) {
  await page.goto("/institutions/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/institutions/materials/review");
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
  const alpha = await seedContent(exhibition, { kind: "ARTWORK", status: "READY", blocks: [heading("Alpha piece"), paragraph("b1", "Alpha text.")] });
  const bravo = await seedContent(exhibition, { kind: "ARTWORK", status: "NEEDS_REVIEW", blocks: [heading("Bravo piece"), paragraph("b1", "Bravo text.")] });
  await signedIn(page, account);
  await openReview(page, exhibition);

  await row(page, "Alpha piece").click();
  await page.getByRole("button", { name: "Approve item" }).click();
  await expect(row(page, "Alpha piece")).toContainText("Approved");
  await expect(page.getByText("Approved 1")).toBeVisible();

  await row(page, "Bravo piece").click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(row(page, "Bravo piece")).toContainText("Rejected");

  expect(await statusOf(alpha.id)).toBe("APPROVED");
  expect(await statusOf(bravo.id)).toBe("REJECTED");
});

test("staff edit an item's text and it is saved after reload", async ({ page }) => {
  const { account, exhibition } = await setup();
  const item = await seedContent(exhibition, { kind: "CLOSING", status: "READY", blocks: [heading("Farewell"), paragraph("b1", "Old words.", ["d1:s1"])] });
  await signedIn(page, account);
  await openReview(page, exhibition);

  await row(page, "Farewell").click();
  await page.locator("textarea.input--lg").fill("New words.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(async () => (await e2eSql<{ blocks: { text: string }[] }>("SELECT blocks FROM contents WHERE id = $1", [item.id]))[0].blocks[1].text).toBe("New words.");

  await page.reload();
  await openReview(page, exhibition);
  await row(page, "Farewell").click();
  await expect(page.locator("textarea.input--lg")).toHaveValue("New words.");
  const [saved] = await e2eSql<{ blocks: { text: string; origin: string; refs: string[] }[] }>("SELECT blocks FROM contents WHERE id = $1", [item.id]);
  expect(saved.blocks[1]).toMatchObject({ text: "New words.", origin: "EDITED", refs: ["d1:s1"] });
});

test("Approve all ready approves READY items and leaves NEEDS_REVIEW ones", async ({ page }) => {
  const { account, exhibition } = await setup();
  const one = await seedContent(exhibition, { kind: "ARTIST", status: "READY", blocks: [heading("Ready one"), paragraph("b1", "One.")] });
  const two = await seedContent(exhibition, { kind: "ARTIST", status: "READY", blocks: [heading("Ready two"), paragraph("b1", "Two.")] });
  const unsure = await seedContent(exhibition, { kind: "ARTIST", status: "NEEDS_REVIEW", blocks: [heading("Unsure one"), paragraph("b1", "Unsure.")] });
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
  const item = await seedContent(exhibition, { kind: "OTHER", status: "READY", blocks: [paragraph("b1", "Text.")] });
  const other = await seedExhibition(await seedInstitutionAccount());
  const foreign = await seedContent(other, { kind: "OTHER", status: "READY", blocks: [paragraph("b1", "Foreign.")] });
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
  const keep = await seedContent(exhibition, { kind: "ARTIST", status: "APPROVED", blocks: [paragraph("b1", "Keep.")] });
  const drop = await seedContent(exhibition, { kind: "ARTIST", status: "APPROVED", blocks: [paragraph("b1", "Drop.")] });
  const sections = [{ id: "s1", kind: "ARTIST", title: "Artist", visible: true, contentIds: [keep.id, drop.id] }];
  await e2eSql("UPDATE exhibitions SET draft = jsonb_set(draft, '{sections}', $1::jsonb) WHERE id = $2", [JSON.stringify(sections), exhibition.id]);
  await signedIn(page, account);

  const rejected = await call(page, "console.content.update", { id: drop.id, revision: await revisionOf(drop.id), status: "REJECTED" });
  expect(rejected.data).toMatchObject({ status: "REJECTED", approvedAt: null, approvedBy: null });
  const [after] = await e2eSql<{ draft: { sections: { contentIds: string[] }[] }; draft_revision: string }>("SELECT draft, draft_revision FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(after.draft.sections[0].contentIds).toEqual([keep.id]);
  expect(after.draft_revision).not.toBe(exhibition.draftRevision);

  const revision = await revisionOf(drop.id);
  for (const change of [{ status: "APPROVED" }, { editorialNote: "again" }, { blocks: [edited("b1", "Back.")] }]) {
    const res = await call(page, "console.content.update", { id: drop.id, revision, ...change });
    expect(res.status).toBe(409);
  }
  expect(await statusOf(drop.id)).toBe("REJECTED");
});

test("approving needs READY or NEEDS_REVIEW, and editing an APPROVED item returns it to READY", async ({ page }) => {
  const { account, exhibition } = await setup();
  const item = await seedContent(exhibition, { kind: "ARTWORK", status: "NEEDS_REVIEW", blocks: [paragraph("b1", "Original.", ["d1:s1"]), paragraph("b2", "Untouched.", ["d1:s2"])] });
  await signedIn(page, account);

  const approved = await call(page, "console.content.update", { id: item.id, revision: await revisionOf(item.id), status: "APPROVED" });
  expect(approved.data.status).toBe("APPROVED");
  expect(approved.data.approvedAt).not.toBeNull();
  expect(approved.data.approvedBy).not.toBeNull();
  expect((await call(page, "console.content.update", { id: item.id, revision: approved.data.revision, status: "APPROVED" })).status).toBe(409);

  const blocks = approved.data.blocks;
  const reedit = await call(page, "console.content.update", {
    id: item.id,
    revision: approved.data.revision,
    kind: "CLOSING",
    blocks: [{ ...blocks[0], text: "Changed." }, blocks[1]],
  });
  expect(reedit.data).toMatchObject({ status: "READY", kind: "CLOSING", approvedAt: null, approvedBy: null });
  expect(reedit.data.blocks[0]).toMatchObject({ text: "Changed.", origin: "EDITED", refs: ["d1:s1"] });
  expect(reedit.data.blocks[1]).toMatchObject({ text: "Untouched.", origin: "SOURCE", refs: ["d1:s2"] });
});

test("edits are validated: unique block ids, this exhibition's images, no new refs", async ({ page }) => {
  const { account, exhibition } = await setup();
  const other = await seedExhibition(await seedInstitutionAccount());
  const [foreignImage] = await e2eSql<{ id: string }>(
    "INSERT INTO images (exhibition_id, object_key, width, height, rights, verification) VALUES ($1, $2, 10, 10, 'CONFIRMED', 'VERIFIED') RETURNING id",
    [other.id, `e2e/${randomUUID()}`],
  );
  const [ownImage] = await e2eSql<{ id: string }>(
    "INSERT INTO images (exhibition_id, object_key, width, height, rights, verification) VALUES ($1, $2, 10, 10, 'CONFIRMED', 'VERIFIED') RETURNING id",
    [exhibition.id, `e2e/${randomUUID()}`],
  );
  const item = await seedContent(exhibition, { kind: "ARTWORK", status: "READY", blocks: [paragraph("b1", "Text.", ["d1:s1"])] });
  await signedIn(page, account);
  const revision = await revisionOf(item.id);
  const update = (blocks: unknown[]) => call(page, "console.content.update", { id: item.id, revision, blocks });
  const image = (imageId: string) => ({ type: "image", id: "b2", imageId, display: "HERO", captionRefs: [] });

  expect((await update([edited("b1", "A"), edited("b1", "B")])).status).toBe(400);
  expect((await update([paragraph("b1", "Text.", ["d1:s1"]), image(foreignImage.id)])).status).toBe(400);
  expect((await update([paragraph("b1", "Text.", ["d9:s9"])])).status).toBe(400);
  expect(await revisionOf(item.id)).toBe(revision);
  expect((await update([paragraph("b1", "Text.", ["d1:s1"]), image(ownImage.id)])).status).toBe(200);
});

test("create makes a READY item, delete removes it and its place in the draft sections", async ({ page }) => {
  const { account, exhibition } = await setup();
  await signedIn(page, account);

  const created = await call(page, "console.content.create", { code: exhibition.code, kind: "CLOSING", blocks: [edited("b1", "Thank you for visiting.")], editorialNote: "typed by hand" });
  expect(created.status).toBe(200);
  expect(created.data).toMatchObject({ kind: "CLOSING", status: "READY", editorialNote: "typed by hand", approvedAt: null });
  expect(await call(page, "console.content.create", { code: exhibition.code, kind: "CLOSING", blocks: [paragraph("b1", "x", ["d1:s1"])] })).toMatchObject({ status: 400 });

  const sections = [{ id: "s1", kind: "CLOSING", title: "Closing", visible: true, contentIds: [created.data.id] }];
  await e2eSql("UPDATE exhibitions SET draft = jsonb_set(draft, '{sections}', $1::jsonb) WHERE id = $2", [JSON.stringify(sections), exhibition.id]);
  expect((await call(page, "console.content.delete", { id: created.data.id })).status).toBe(200);
  expect(await e2eSql("SELECT 1 FROM contents WHERE id = $1", [created.data.id])).toHaveLength(0);
  const [after] = await e2eSql<{ draft: { sections: { contentIds: string[] }[] } }>("SELECT draft FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(after.draft.sections[0].contentIds).toEqual([]);
});

test("batchUpdate approves every READY item and never a NEEDS_REVIEW one", async ({ page }) => {
  const { account, exhibition } = await setup();
  const ready = await seedContent(exhibition, { kind: "ARTIST", status: "READY", blocks: [paragraph("b1", "Ready.")] });
  const unsure = await seedContent(exhibition, { kind: "ARTIST", status: "NEEDS_REVIEW", blocks: [paragraph("b1", "Unsure.")] });
  const done = await seedContent(exhibition, { kind: "ARTIST", status: "APPROVED", blocks: [paragraph("b1", "Done.")] });
  await signedIn(page, account);

  const res = await call(page, "console.content.batchUpdate", { code: exhibition.code, status: "APPROVED", where: { status: "READY" } });
  expect(res.data.map((c: { id: string }) => c.id)).toEqual([ready.id]);
  expect(res.data[0]).toMatchObject({ status: "APPROVED" });
  expect(res.data[0].approvedAt).not.toBeNull();
  expect(await statusOf(unsure.id)).toBe("NEEDS_REVIEW");
  expect(await statusOf(done.id)).toBe("APPROVED");
});

test("a sentence keeps its published sentence id whatever the client sends", async ({ page }) => {
  const { account, exhibition } = await setup();
  const published = randomUUID();
  const item = await seedContent(exhibition, {
    kind: "ARTWORK",
    status: "READY",
    blocks: [{ type: "sentence", id: "s1", text: "Light stays.", origin: "SOURCE", refs: [], guideSentenceId: published }],
  });
  await signedIn(page, account);

  // The client drops the id on an edit, and invents one on a new sentence block.
  const res = await call(page, "console.content.update", {
    id: item.id,
    revision: await revisionOf(item.id),
    blocks: [
      { type: "sentence", id: "s1", text: "Light stays here.", origin: "EDITED", refs: [] },
      { type: "sentence", id: "s2", text: "A new line.", origin: "EDITED", refs: [], guideSentenceId: randomUUID() },
    ],
  });
  expect(res.status).toBe(200);
  const [stored] = await e2eSql<{ blocks: { id: string; guideSentenceId?: string }[] }>("SELECT blocks FROM contents WHERE id = $1", [item.id]);
  expect(stored.blocks.find((b) => b.id === "s1")?.guideSentenceId).toBe(published);
  expect(stored.blocks.find((b) => b.id === "s2")?.guideSentenceId).toBeUndefined();
});
