import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 전시 초안, §9.5 console.exhibition.create / delete, §10.3, §10.9 전시 삭제: staff start a
// draft with a title and a code they confirm, and delete drafts nobody has used.

test.use({ viewport: { width: 1440, height: 900 } });

const tag = () => randomUUID().slice(0, 8);

test("staff create an exhibition from the Published exhibitions page and it opens selected", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const code = `e2e-new-${tag()}`;
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");

  await page.getByRole("button", { name: "+ New exhibition" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New exhibition" });
  await dialog.getByLabel("Title").fill("Forms of Light");
  // The code is suggested from the title; staff may edit it before creating.
  await expect(dialog.getByLabel("Exhibition code")).toHaveValue(/forms-of-light$/);
  await dialog.getByLabel("Exhibition code").fill(code);
  await dialog.getByRole("button", { name: "Create exhibition" }).click();

  await expect(page).toHaveURL(/\/institutions\/materials$/);
  await expect(page.locator(".exhibition-line__title")).toHaveText("Forms of Light");
  const [row] = await e2eSql<{ state: string; title: string; created_by: string; draft: { title: string; sections: unknown[] } }>(
    "SELECT state, title, created_by, draft FROM exhibitions WHERE code = $1",
    [code],
  );
  expect(row).toMatchObject({ state: "DRAFT", title: "Forms of Light", created_by: account.userId, draft: { title: "Forms of Light", sections: [] } });

  await page.getByRole("link", { name: "Published exhibitions" }).click();
  await expect(page.getByText("Forms of Light", { exact: true })).toBeVisible();
});

test("a taken or invalid code is shown inside the dialog", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const taken = await seedExhibition(account);
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");

  await page.getByRole("button", { name: "+ New exhibition" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New exhibition" });
  await dialog.getByLabel("Title").fill("Another");
  await dialog.getByLabel("Exhibition code").fill(taken.code);
  await dialog.getByRole("button", { name: "Create exhibition" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("This code is already used. Choose another one.");

  await dialog.getByLabel("Exhibition code").fill("Not A Slug");
  await dialog.getByRole("button", { name: "Create exhibition" }).click();
  await expect(dialog.getByRole("alert")).toContainText("lowercase letters, numbers and hyphens");
  await expect(page).toHaveURL(/\/institutions\/exhibitions$/);
});

test("staff delete a draft from the row menu", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const draft = await seedExhibition(account, { title: "Unused Draft" });
  const live = await seedExhibition(account, { title: "Kept Live", state: "PUBLISHED" });
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");

  const liveMenu = page.getByRole("button", { name: `More actions for ${live.title}` });
  await liveMenu.click();
  await expect(page.getByRole("menuitem", { name: /Delete draft/ })).toHaveCount(0);
  await liveMenu.click(); // its panel would cover the next row's button
  await page.getByRole("button", { name: `More actions for ${draft.title}` }).click();
  await page.getByRole("menuitem", { name: "Delete draft…" }).click();
  await page.getByRole("button", { name: "Delete draft", exact: true }).click();

  await expect(page.getByText(draft.title, { exact: true })).toHaveCount(0);
  await expect(page.getByText(live.title, { exact: true })).toBeVisible();
  expect(await e2eSql("SELECT 1 FROM exhibitions WHERE code = $1", [draft.code])).toHaveLength(0);
});

test("console.exhibition.create makes a draft owned by the caller and rejects taken or invalid codes", async ({ page }) => {
  const account = await seedInstitutionAccount();
  await signInConsole(page, account);
  const code = `e2e-api-${tag()}`;

  const created = await consoleCall(page, "console.exhibition.create", { code, title: "  Api Draft " });
  expect(created.json.result.data).toMatchObject({ code, state: "DRAFT", displayStatus: "DRAFT", title: "Api Draft", venue: null });
  const [row] = await e2eSql<{ draft: unknown; created_by: string }>("SELECT draft, created_by FROM exhibitions WHERE code = $1", [code]);
  expect(row.created_by).toBe(account.userId);
  expect(row.draft).toEqual({
    version: 1, title: "Api Draft", subtitle: null, venueId: null, startDate: null, endDate: null,
    coverImageId: null, ambienceEnabled: false, playlist: null, sections: [],
  });

  const again = await consoleCall(page, "console.exhibition.create", { code, title: "Other" });
  expect(again.status).toBe(409);
  expect(again.json.error.data.appCode).toBe("CODE_TAKEN");
  expect((await consoleCall(page, "console.exhibition.create", { code: "Bad Code", title: "x" })).status).toBe(400);
});

test("console.exhibition.delete refuses published exhibitions and ones visitors archived, and hides other institutions", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const published = await seedExhibition(account, { state: "PUBLISHED" });
  const archived = await seedExhibition(account, { state: "UNPUBLISHED" });
  const draft = await seedExhibition(account);
  const other = await seedExhibition(await seedInstitutionAccount());
  const [visitor] = await e2eSql<{ id: string }>("INSERT INTO users (role, status) VALUES ('VISITOR', 'ACTIVE') RETURNING id");
  await e2eSql("INSERT INTO archives (user_id, exhibition_id) VALUES ($1, $2)", [visitor.id, archived.id]);
  await signInConsole(page, account);

  const livePublished = await consoleCall(page, "console.exhibition.delete", { code: published.code });
  expect(livePublished.status).toBe(409);
  expect(livePublished.json.error.data.appCode).toBe("EXHIBITION_PUBLISHED");
  const withArchives = await consoleCall(page, "console.exhibition.delete", { code: archived.code });
  expect(withArchives.status).toBe(409);
  expect(withArchives.json.error.data.appCode).toBe("EXHIBITION_HAS_ARCHIVES");
  expect((await consoleCall(page, "console.exhibition.delete", { code: other.code })).status).toBe(404);
  expect((await consoleCall(page, "console.exhibition.delete", { code: "no-such-exhibition" })).status).toBe(404);

  expect((await consoleCall(page, "console.exhibition.delete", { code: draft.code })).status).toBe(200);
  const left = await e2eSql<{ code: string }>("SELECT code FROM exhibitions WHERE code = ANY($1)", [[published.code, archived.code, other.code, draft.code]]);
  expect(left.map((r) => r.code).sort()).toEqual([published.code, archived.code, other.code].sort());
});
