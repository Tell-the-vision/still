import { expect, test } from "next/experimental/testmode/playwright";
import { randomUUID } from "node:crypto";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 검토 (Figma A2), §9.5 console.content.list / get, §10.8: staff see their exhibition's
// contents on the review screen; another institution's contents are never listed and get is NOT_FOUND.

test.use({ viewport: { width: 1440, height: 900 } });

const heading = (text: string) => ({ type: "heading", id: "b1", text, origin: "SOURCE", refs: [] });
const paragraph = (id: string, text: string, refs: string[] = []) => ({ type: "paragraph", id, text, origin: "SOURCE", refs });

test("staff open an exhibition's review screen and see its contents, not another institution's", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account, { title: "Review Rooms" });
  await seedContent(exhibition, { kind: "CURATOR_STATEMENT", status: "NEEDS_REVIEW", blocks: [heading("Why light"), paragraph("b2", "Light is the subject.")] });
  await seedContent(exhibition, { kind: "ARTWORK", status: "APPROVED", blocks: [paragraph("b1", "Oil on canvas, 1998.")] });
  const other = await seedExhibition(await seedInstitutionAccount(), { title: "Not Ours" });
  await seedContent(other, { kind: "ARTWORK", status: "READY", blocks: [heading("Foreign heading"), paragraph("b2", "Foreign text.")] });

  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/institutions/materials/review");

  await expect(page.getByText("Why light", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("In review 1")).toBeVisible();
  await expect(page.getByText("Approved 1")).toBeVisible();
  await expect(page.getByText("Light is the subject.")).toBeVisible();
  await page.getByRole("button", { name: /Artwork/ }).click();
  await expect(page.getByText("Oil on canvas, 1998.")).toBeVisible();
  await expect(page.getByText("Foreign heading")).toHaveCount(0);
  await expect(page.getByText("Foreign text.")).toHaveCount(0);
});

test("console.content.list returns the exhibition's contents oldest first with their images; get returns one", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const [doc] = await e2eSql<{ id: string }>(
    `INSERT INTO documents (exhibition_id, object_key, original_name, media_type, byte_size, sha256, status)
     VALUES ($1, $2, 'catalogue.pdf', 'application/pdf', 10, $3, 'STORED') RETURNING id`,
    [exhibition.id, `e2e/${randomUUID()}`, "a".repeat(64)],
  );
  const [image] = await e2eSql<{ id: string }>(
    `INSERT INTO images (exhibition_id, object_key, width, height, alt_text, credit, rights, verification)
     VALUES ($1, $2, 800, 600, 'A lit hall', 'Photo: Kim', 'CONFIRMED', 'VERIFIED') RETURNING id`,
    [exhibition.id, `e2e/private-${randomUUID()}`],
  );
  const first = await seedContent(exhibition, {
    kind: "ARTWORK",
    status: "READY",
    blocks: [paragraph("b1", "From the catalogue.", [`${doc.id}:s1`]), { type: "image", id: "b2", imageId: image.id, display: "HERO", captionRefs: [] }],
    editorialNote: "check the date",
  });
  const second = await seedContent(exhibition, { kind: "CLOSING", status: "APPROVED", blocks: [paragraph("b1", "Thank you.")] });
  const other = await seedExhibition(await seedInstitutionAccount());
  const foreign = await seedContent(other, { kind: "OTHER", status: "READY", blocks: [paragraph("b1", "Foreign.")] });
  await signInConsole(page, account);

  const list = (await consoleCall(page, "console.content.list", { code: exhibition.code })).json.result.data;
  expect(list.map((c: { id: string }) => c.id)).toEqual([first.id, second.id]);
  expect(list[0]).toMatchObject({
    kind: "ARTWORK",
    status: "READY",
    editorialNote: "check the date",
    suggestions: [],
    approvedAt: null,
    images: [{ id: image.id, altText: "A lit hall", credit: "Photo: Kim", rights: "CONFIRMED", verification: "VERIFIED", width: 800, height: 600 }],
  });
  expect(list[1]).toMatchObject({ status: "APPROVED", images: [] });
  expect(list[1].approvedAt).not.toBeNull();
  expect(JSON.stringify(list)).not.toContain("private-");
  expect(list[0].images[0]).not.toHaveProperty("objectKey");

  const got = (await consoleCall(page, "console.content.get", { id: first.id })).json.result.data;
  expect(got).toMatchObject({ id: first.id, kind: "ARTWORK", sources: [], images: [{ id: image.id }] });
  expect((await consoleCall(page, "console.content.get", { id: foreign.id })).status).toBe(404);
  expect((await consoleCall(page, "console.content.list", { code: other.code })).status).toBe(404);
});
