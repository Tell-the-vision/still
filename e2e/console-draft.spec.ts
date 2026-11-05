import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition, type SeededExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole, type InstitutionAccount } from "./support/staff";

// SPEC §9.4 전시 초안 / 가이드 편집, §9.5 console.draft.*, §10.9, §11.1: the draft is edited with the
// revision it was read at; a stale write is REVISION_MISMATCH and never overwrites the newer draft.

test.use({ viewport: { width: 1440, height: 900 } });

type Call = Awaited<ReturnType<typeof consoleCall>>;
const data = (res: Call) => res.json.result.data;
const errorOf = (res: Call) => res.json.error as { message: string; data: { appCode?: string } };

// Test setup only: a content row of the exhibition.
async function seedContent(exhibition: SeededExhibition, status: "APPROVED" | "NEEDS_REVIEW") {
  const [row] = await e2eSql<{ id: string }>(
    `INSERT INTO contents (exhibition_id, kind, status, blocks, approved_at)
     VALUES ($1, 'OTHER', $2, '[]'::jsonb, CASE WHEN $2 = 'APPROVED' THEN now() END) RETURNING id`,
    [exhibition.id, status],
  );
  return row.id;
}

async function seedImage(exhibition: SeededExhibition) {
  const [row] = await e2eSql<{ id: string }>(
    "INSERT INTO images (exhibition_id, width, height, rights, verification) VALUES ($1, 100, 100, 'CONFIRMED', 'NOT_APPLICABLE') RETURNING id",
    [exhibition.id],
  );
  return row.id;
}

// The staff open the exhibition from the list, then use the in-app links (the open exhibition lives in memory, not in the URL).
async function openExhibition(page: Page, title: string) {
  await page.goto("/institutions/exhibitions");
  await page.getByText(title, { exact: true }).click();
  await expect(page).toHaveURL(/\/institutions\/overview$/);
}
const openPublish = async (page: Page, title: string) => {
  await openExhibition(page, title);
  // The open exhibition lives in memory, so move inside the app without a page load. The workflow stepper is
  // not on the Upload page and the step before Publish does not work against the server yet, so there is no link to click.
  await page.evaluate(() => {
    history.pushState({}, "", "/institutions/materials/publish");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: "Prepare publication" })).toBeVisible();
};
const openGuide = async (page: Page, title: string) => {
  await openExhibition(page, title);
  await page.getByRole("link", { name: "Digital guide" }).click();
};

async function seedDraftSections(account: InstitutionAccount, sections: (exhibition: SeededExhibition) => Promise<unknown[]>) {
  const exhibition = await seedExhibition(account);
  const draft = { version: 1, title: exhibition.title, subtitle: null, venueId: exhibition.venueId, startDate: "2026-01-01", endDate: "2030-12-31", coverImageId: null, ambienceEnabled: false, playlist: null, sections: await sections(exhibition) };
  await e2eSql("UPDATE exhibitions SET draft = $1 WHERE id = $2", [JSON.stringify(draft), exhibition.id]);
  return exhibition;
}

test("staff edit the publication details, add a venue inline, save, and find them after a reload", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  await openPublish(page, exhibition.title);

  const newTitle = `Renamed ${randomUUID().slice(0, 6)}`;
  const venueName = `Inline Hall ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Publication title").fill(newTitle);
  await page.getByLabel("Subtitle (optional)").fill("A new subtitle");
  await page.getByLabel("Start date").fill("2027-02-03");
  await page.getByLabel("End date").fill("2027-09-10");
  await page.getByRole("button", { name: "+ Add venue" }).click();
  await page.getByLabel("New venue name").fill(venueName);
  await page.getByLabel("New venue city").fill("Busan");
  await page.getByRole("button", { name: "Add venue", exact: true }).click();
  await expect(page.getByLabel("Museum / venue")).toContainText(venueName);
  const saving = page.waitForResponse((res) => res.url().includes("console.draft.update"));
  await page.getByRole("button", { name: "Save details" }).click();
  expect((await saving).status()).toBe(200);
  await expect(page.getByText("Details saved")).toBeVisible();

  await page.reload();
  await openPublish(page, newTitle);
  await expect(page.getByLabel("Publication title")).toHaveValue(newTitle);
  await expect(page.getByLabel("Subtitle (optional)")).toHaveValue("A new subtitle");
  await expect(page.getByLabel("Start date")).toHaveValue("2027-02-03");
  await expect(page.getByLabel("End date")).toHaveValue("2027-09-10");
  await expect(page.getByLabel("Museum / venue").locator("option:checked")).toHaveText(new RegExp(venueName));
});

test("staff reorder guide sections and add one; the contents stay in their sections after a reload", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedDraftSections(account, async (e) => {
    const contentId = await seedContent(e, "APPROVED");
    return [
      { id: "s-intro", kind: "INTRODUCTION", title: "Welcome", visible: true, contentIds: [contentId] },
      { id: "s-artist", kind: "ARTIST", title: "The artist", visible: false, contentIds: [] },
    ];
  });
  await signInConsole(page, account);
  await openGuide(page, exhibition.title);

  await page.getByRole("button", { name: "Move The artist up" }).click();
  await page.getByRole("button", { name: "+ Add guide section" }).click();
  const saving = page.waitForResponse((res) => res.url().includes("console.draft.update"));
  await page.getByRole("button", { name: "Save draft" }).click();
  expect((await saving).status()).toBe(200);

  await page.reload();
  await openGuide(page, exhibition.title);
  await expect(page.locator(".section-row .item__title")).toHaveText(["The artist", "Welcome", "Untitled section"]);

  const saved = data((await consoleCall(page, "console.draft.get", { code: exhibition.code }))).draft.sections;
  expect(saved.map((s: { id: string; kind: string }) => [s.id, s.kind])).toEqual([["s-artist", "ARTIST"], ["s-intro", "INTRODUCTION"], [expect.stringMatching(/^new-/), "CUSTOM"]]);
  expect(saved[1].contentIds).toHaveLength(1);
});

test("a stale revision is REVISION_MISMATCH and the newer draft survives", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);

  const first = data((await consoleCall(page, "console.draft.get", { code: exhibition.code })));
  expect(first.revision).toBe(exhibition.draftRevision);
  const mine = await consoleCall(page, "console.draft.update", { code: exhibition.code, revision: first.revision, draft: { ...first.draft, title: "First edit" } });
  expect(data(mine).draft.title).toBe("First edit");
  expect(data(mine).revision).not.toBe(first.revision);

  const stale = await consoleCall(page, "console.draft.update", { code: exhibition.code, revision: first.revision, draft: { ...first.draft, title: "Lost edit" } });
  expect(stale.status).toBe(412);
  expect(errorOf(stale).data.appCode).toBe("REVISION_MISMATCH");
  expect(data((await consoleCall(page, "console.draft.get", { code: exhibition.code }))).draft.title).toBe("First edit");
});

test("cross-row rules are checked on write", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const other = await seedExhibition(account);
  const approved = await seedContent(exhibition, "APPROVED");
  const unapproved = await seedContent(exhibition, "NEEDS_REVIEW");
  const foreign = await seedContent(other, "APPROVED");
  const otherImage = await seedImage(other);
  const ownImage = await seedImage(exhibition);
  await signInConsole(page, account);

  const base = data((await consoleCall(page, "console.draft.get", { code: exhibition.code })));
  const section = (id: string, contentIds: string[], kind = "CUSTOM") => ({ id, kind, title: id, visible: true, contentIds });
  const write = async (changes: Record<string, unknown>) =>
    (await consoleCall(page, "console.draft.update", { code: exhibition.code, revision: base.revision, draft: { ...base.draft, ...changes } }));
  const refused = async (changes: Record<string, unknown>, message: RegExp) => {
    const res = await write(changes);
    expect(res.status).toBe(400);
    expect(errorOf(res).message).toMatch(message);
  };

  await refused({ sections: [section("a", [unapproved])] }, /approved/i);
  await refused({ sections: [section("a", [foreign])] }, /not a content of this exhibition/i);
  await refused({ sections: [section("a", [approved]), section("b", [approved])] }, /only once/i);
  await refused({ sections: [section("a", [approved, approved])] }, /only once/i);
  await refused({ sections: [section("a", [], "INTRODUCTION"), section("b", [], "INTRODUCTION")] }, /introduction/i);
  await refused({ venueId: randomUUID() }, /venue/i);
  await refused({ coverImageId: randomUUID() }, /cover/i);
  await refused({ coverImageId: otherImage }, /cover/i);
  await refused({ startDate: "2027-05-01", endDate: "2027-04-01" }, /start date/i);

  // Nothing above changed the draft, so the same revision still writes.
  const ok = await write({ coverImageId: ownImage, sections: [section("a", [approved])] });
  expect(data(ok).draft.coverImageId).toBe(ownImage);
});

test("another institution's code is NOT_FOUND", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const theirs = await seedExhibition(await seedInstitutionAccount());
  await signInConsole(page, account);
  expect((await consoleCall(page, "console.draft.get", { code: theirs.code })).status).toBe(404);
  const draft = (await e2eSql<{ draft: unknown }>("SELECT draft FROM exhibitions WHERE id = $1", [theirs.id]))[0].draft;
  expect((await consoleCall(page, "console.draft.update", { code: theirs.code, revision: theirs.draftRevision, draft })).status).toBe(404);
});

test("a draft that was never published can be published from the digital guide", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account, { title: `Never Published ${Date.now()}` });
  await signInConsole(page, account);
  await openExhibition(page, exhibition.title);
  await page.goto("/institutions/guide");
  await expect(page.getByText("Draft · Not published")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish changes" })).not.toHaveAttribute("aria-disabled", "true");
});
