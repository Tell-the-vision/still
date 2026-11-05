import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { seedContent, seedExhibition, type SeededExhibition } from "./support/console";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.4 발행, §9.5 console.publication.*, §10.9 발행 쓰기 경로 and 발행 취소: the console turns the
// draft into the visitor guide, keeps sentence ids across republishing, and takes it offline again.

const STATEMENT = "I confirm that the museum has permission to publish the submitted text and media for this exhibition.";
const block = (type: string, id: string, text: string) => ({ type, id, text, origin: "SOURCE", refs: [] });

// A complete draft: venue and dates from seedExhibition, one visible section with one APPROVED content.
async function seedCompleteDraft(account: InstitutionAccount) {
  const exhibition = await seedExhibition(account);
  const content = await seedContent(exhibition, {
    kind: "OTHER",
    status: "APPROVED",
    blocks: [block("heading", "h1", "The first room"), block("paragraph", "p1", "Light enters slowly."), block("sentence", "s1", "Stillness is a way of looking.")],
  });
  const sections = [{ id: "a", kind: "CUSTOM", title: "Rooms", visible: true, contentIds: [content.id] }];
  await e2eSql("UPDATE exhibitions SET draft = draft || $2::jsonb WHERE id = $1", [exhibition.id, JSON.stringify({ sections })]);
  return { exhibition, content };
}

const publish = (page: Page, exhibition: SeededExhibition, over: Record<string, unknown> = {}) =>
  consoleCall(page, "console.publication.create", {
    code: exhibition.code,
    revision: exhibition.draftRevision,
    rightsConfirmed: true,
    rightsStatementVersion: "v1",
    ...over,
  });

const liveSentences = (exhibitionId: string) =>
  e2eSql<{ id: string; content: string }>("SELECT id, content FROM guide_sentences WHERE exhibition_id = $1 AND deleted_at IS NULL ORDER BY content", [exhibitionId]);

test("staff publish, a visitor keeps a line, a republish keeps its id, unpublishing closes the guide", async ({ page, next, browser, baseURL }) => {
  const account = await seedInstitutionAccount();
  const { exhibition, content } = await seedCompleteDraft(account);

  // Staff: publish settings -> confirm rights -> Publish -> publication complete.
  const staff = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const staffPage = await staff.newPage();
  await signInConsole(staffPage, account);
  await staffPage.goto("/console/exhibitions");
  await staffPage.getByText(exhibition.title, { exact: true }).click();
  await expect(staffPage).toHaveURL(/\/console\/overview$/);
  // The open exhibition lives in memory, so move inside the app without a page load.
  await staffPage.evaluate(() => {
    history.pushState({}, "", "/console/materials/publish");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(staffPage.getByRole("heading", { name: "Prepare publication" })).toBeVisible();
  await staffPage.getByLabel(STATEMENT).check();
  await staffPage.getByRole("button", { name: "Publish exhibition" }).click();
  await expect(staffPage.getByRole("heading", { name: "Your guide is live." })).toBeVisible();

  // Visitor (phone size): the heading, the paragraph and the sentence; keeps the sentence.
  const visitorUser = newUser();
  stubGoogleToken(next, visitorUser);
  await stubGoogle(page);
  await signIn(page);
  await openGuide(page, exhibition.code);
  await expect(page.getByRole("heading", { name: "The first room" })).toBeVisible();
  await expect(page.getByText("Light enters slowly.")).toBeVisible();
  await expect(page.getByText("Stillness is a way of looking.")).toBeVisible();
  await page.getByRole("button", { name: "Keep this line" }).first().click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);

  const [first] = await liveSentences(exhibition.id);
  const [{ blocks }] = await e2eSql<{ blocks: { guideSentenceId?: string }[] }>("SELECT blocks FROM contents WHERE id = $1", [content.id]);
  expect(blocks[2].guideSentenceId).toBe(first.id);

  // Staff change the sentence (a new content revision) and republish the new draft revision.
  const edited = [block("heading", "h1", "The first room"), block("paragraph", "p1", "Light enters slowly."), { ...block("sentence", "s1", "Stillness is a way of seeing."), guideSentenceId: first.id }];
  await e2eSql("UPDATE contents SET blocks = $2, revision = gen_random_uuid() WHERE id = $1", [content.id, JSON.stringify(edited)]);
  const [{ draft_revision: revision }] = await e2eSql<{ draft_revision: string }>("UPDATE exhibitions SET draft_revision = gen_random_uuid() WHERE id = $1 RETURNING draft_revision", [exhibition.id]);
  const again = await publish(staffPage, { ...exhibition, draftRevision: revision });
  expect(again.status).toBe(200);
  expect(await liveSentences(exhibition.id)).toEqual([{ id: first.id, content: "Stillness is a way of seeing." }]);

  // The visitor's kept line still points at the same sentence, and the guide has the new text.
  const kept = (await trpcCall(page, "scrap.list", { code: exhibition.code })).json.result.data;
  expect(kept.map((s: { sentenceId: string }) => s.sentenceId)).toEqual([first.id]);
  const [{ guide: stored }] = await e2eSql<{ guide: unknown }>("SELECT guide FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(JSON.stringify(stored)).toContain(first.id);
  const guide = (await trpcCall(page, "guide.get", { code: exhibition.code })).json.result.data;
  expect(JSON.stringify(guide.document)).toContain("Stillness is a way of seeing.");
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);

  // Staff unpublish from the Published exhibitions row menu.
  await staffPage.goto("/console/exhibitions");
  await staffPage.getByRole("button", { name: `More actions for ${exhibition.title}` }).click();
  await staffPage.getByRole("menuitem", { name: "Unpublish…" }).click();
  await staffPage.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(staffPage.getByText("Guide taken offline.")).toBeVisible();
  await staff.close();

  // A new context avoids the max-age=60 browser cache of the earlier guide response.
  const fresh = await browser.newContext({ baseURL });
  const freshPage = await fresh.newPage();
  await openGuide(freshPage, exhibition.code);
  await expect(freshPage.getByText("Not available.")).toBeVisible();
  await fresh.close();
  // The visitor's archive stays readable.
  await page.goto("/");
  await page.getByRole("link", { name: "ARCHIVE", exact: true }).click();
  await page.getByRole("link", { name: exhibition.title }).click();
  await expect(page.getByText(exhibition.title, { exact: true }).last()).toBeVisible();
  expect((await trpcCall(page, "archive.get", { code: exhibition.code })).json.result.data).not.toBeNull();
});

test("publishing is refused for a stale revision, failing checks, and unconfirmed rights", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const { exhibition } = await seedCompleteDraft(account);
  await signInConsole(page, account);

  const stale = await publish(page, exhibition, { revision: randomUUID() });
  expect(stale.status).toBe(412);
  expect(stale.json.error.data.appCode).toBe("REVISION_MISMATCH");

  const noRights = await publish(page, exhibition, { rightsConfirmed: false });
  expect(noRights.status).toBe(412);
  expect(noRights.json.error.data.appCode).toBe("RIGHTS_NOT_CONFIRMED");

  // A READY content in a visible section blocks publication and the refusal names the check.
  const ready = await seedContent(exhibition, { kind: "THEME", status: "READY", blocks: [block("paragraph", "p1", "Not reviewed yet.")] });
  const [{ draft }] = await e2eSql<{ draft: { sections: { contentIds: string[] }[] } }>("SELECT draft FROM exhibitions WHERE id = $1", [exhibition.id]);
  draft.sections[0].contentIds.push(ready.id);
  await e2eSql("UPDATE exhibitions SET draft = $2 WHERE id = $1", [exhibition.id, JSON.stringify(draft)]);
  const blocked = await publish(page, exhibition);
  expect(blocked.status).toBe(412);
  expect(blocked.json.error.data.appCode).toBe("PUBLISH_CHECKS_FAILED");
  expect(blocked.json.error.message).toContain("Content approval");
  const [row] = await e2eSql<{ state: string }>("SELECT state FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(row.state).toBe("DRAFT");
  expect(await liveSentences(exhibition.id)).toEqual([]);
});

test("an image without a public copy blocks publication until extraction exists", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const { exhibition, content } = await seedCompleteDraft(account);
  const [image] = await e2eSql<{ id: string }>(
    "INSERT INTO images (exhibition_id, object_key, width, height, rights, verification) VALUES ($1, NULL, 10, 10, 'CONFIRMED', 'VERIFIED') RETURNING id",
    [exhibition.id],
  );
  await e2eSql("UPDATE contents SET blocks = blocks || $2::jsonb WHERE id = $1", [content.id, JSON.stringify([{ type: "image", id: "i1", imageId: image.id, display: "INLINE", captionRefs: [] }])]);
  await signInConsole(page, account);
  const refused = await publish(page, exhibition);
  expect(refused.json.error.data.appCode).toBe("PUBLISH_CHECKS_FAILED");
  expect(refused.json.error.message).toContain("Image files");
});

test("another institution's exhibition is NOT_FOUND to publish and unpublish", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const { exhibition: other } = await seedCompleteDraft(await seedInstitutionAccount());
  await signInConsole(page, account);
  expect((await publish(page, other)).status).toBe(404);
  expect((await consoleCall(page, "console.publication.delete", { code: other.code })).status).toBe(404);
});

test("publishing the same draft twice keeps the sentence ids, and only a published exhibition can be unpublished", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const { exhibition } = await seedCompleteDraft(account);
  await signInConsole(page, account);

  const draftOnly = await consoleCall(page, "console.publication.delete", { code: exhibition.code });
  expect(draftOnly.status).toBe(409);

  expect((await publish(page, exhibition)).status).toBe(200);
  const first = await liveSentences(exhibition.id);
  expect((await publish(page, exhibition)).status).toBe(200);
  expect(await liveSentences(exhibition.id)).toEqual(first);
  expect(first).toHaveLength(1);
  const [row] = await e2eSql<{ state: string; published_revision: string; rights_statement_version: string; first_published_at: Date }>(
    "SELECT state, published_revision, rights_statement_version, first_published_at FROM exhibitions WHERE id = $1",
    [exhibition.id],
  );
  expect(row).toMatchObject({ state: "PUBLISHED", published_revision: exhibition.draftRevision, rights_statement_version: "v1" });

  expect((await consoleCall(page, "console.publication.delete", { code: exhibition.code })).status).toBe(200);
  expect((await consoleCall(page, "console.publication.delete", { code: exhibition.code })).status).toBe(409);
  // Republishing after unpublishing continues the same sentence ids.
  expect((await publish(page, exhibition)).status).toBe(200);
  expect(await liveSentences(exhibition.id)).toEqual(first);
});

test("publishing a doc-based content writes the sentence id into its scrap mark and keeps it on republish", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const doc = {
    type: "doc",
    content: [{ type: "paragraph", attrs: { id: "d1" }, content: [{ type: "text", text: "Before. " }, { type: "text", text: "Keep me.", marks: [{ type: "scrap", attrs: { sentenceId: null } }] }] }],
  };
  const [{ id: contentId }] = await e2eSql<{ id: string }>(
    "INSERT INTO contents (exhibition_id, kind, status, blocks, doc, approved_at) VALUES ($1, 'OTHER', 'APPROVED', '[]', $2, now()) RETURNING id",
    [exhibition.id, JSON.stringify(doc)],
  );
  const sections = [{ id: "a", kind: "CUSTOM", title: "Rooms", visible: true, contentIds: [contentId] }];
  await e2eSql("UPDATE exhibitions SET draft = draft || $2::jsonb WHERE id = $1", [exhibition.id, JSON.stringify({ sections })]);
  await signInConsole(page, account);

  expect((await publish(page, exhibition)).status).toBe(200);
  const markId = async () => {
    const [{ doc: stored, revision }] = await e2eSql<{ doc: { content: { content: { marks?: { attrs: { sentenceId: string } }[] }[] }[] }; revision: string }>("SELECT doc, revision FROM contents WHERE id = $1", [contentId]);
    return { id: stored.content[0].content[1].marks![0].attrs.sentenceId, revision };
  };
  const first = await markId();
  expect(await liveSentences(exhibition.id)).toEqual([{ id: first.id, content: "Keep me." }]);
  const [{ guide }] = await e2eSql<{ guide: { version: number; type: string; content: { type: string; attrs: { level?: number }; content?: { marks?: { attrs: { sentenceId: string } }[] }[] }[] } }>("SELECT guide FROM exhibitions WHERE id = $1", [exhibition.id]);
  expect(guide).toMatchObject({ version: 1, type: "doc" });
  expect(guide.content[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
  expect(guide.content.flatMap((b) => b.content ?? []).flatMap((n) => n.marks ?? []).map((m) => m.attrs.sentenceId)).toEqual([first.id]);

  const [{ draft_revision: revision }] = await e2eSql<{ draft_revision: string }>("UPDATE exhibitions SET draft_revision = gen_random_uuid() WHERE id = $1 RETURNING draft_revision", [exhibition.id]);
  expect((await publish(page, { ...exhibition, draftRevision: revision })).status).toBe(200);
  expect(await markId()).toEqual(first);
  expect(await liveSentences(exhibition.id)).toHaveLength(1);
});
