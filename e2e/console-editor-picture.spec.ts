import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 업로드·이미지 표시, §10.7, §10.9 step 2: a picture placed in the editor is stored as an image of the
// exhibition (a document of its own, read in the browser). It shows at once, and after a reload through the console's
// image route, which answers with the private display file of any image extracted from a document, published or not.
// Publication copies that display file to the public bucket (skipped under R2_DRY_RUN=1; the key is still stored).

test.use({ viewport: { width: 1440, height: 900 } });

const PICTURE = readFileSync("e2e/fixtures/cover.png"); // 4 x 3
const DISPLAY = readFileSync("e2e/fixtures/cover.webp");
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: { result: { data: unknown } } }) => res.json.result.data as Record<string, any>;
type Doc = { content: { type: string; attrs: { imageId?: string } }[] };
const imageIdIn = async (contentId: string) =>
  (await e2eSql<{ doc: Doc }>("SELECT doc FROM contents WHERE id = $1", [contentId]))[0].doc.content.find((b) => b.type === "stillImage")?.attrs.imageId ?? null;

// A picture stored the way the editor stores one (console/src/api/trpc.ts uploadPicture): the original, then the
// manifest the browser writes for a picture, with the picture as its one asset and its display copy.
async function storePicture(page: Page, code: string) {
  const created = data(await consoleCall(page, "console.document.create", { code, name: "harbour.png", mediaType: "image/png", byteSize: PICTURE.length, sha256: sha(PICTURE) }));
  expect((await page.request.put(created.upload.url, { data: PICTURE })).status()).toBe(200);
  expect(data(await consoleCall(page, "console.document.update", { id: created.document.id, uploaded: true })).status).toBe("STORED");
  const manifest = {
    version: 1,
    document: { documentId: created.document.id, sha256: sha(PICTURE), mediaType: "image/png", pages: 1 },
    extractor: { name: "console-extract", version: "1" },
    pages: [{ page: 1, size: [4, 3] }],
    segments: [],
    assets: [{ id: "a01", kind: "FILE", object: "assets/a01.png", display: "assets/a01.display.webp", format: "image/png", pixels: [4, 3], sha256: sha(PICTURE), placements: [{ page: 1, bbox: [0, 0, 4, 3] }] }],
    modelInputs: [],
    warnings: [],
  };
  const files = [
    { name: "assets/a01.png", bytes: PICTURE },
    { name: "assets/a01.display.webp", bytes: DISPLAY },
    { name: "manifest.v1.json", bytes: Buffer.from(JSON.stringify(manifest)) },
  ];
  const { uploads } = data(await consoleCall(page, "console.documentUpload.create", { documentId: created.document.id, files: files.map((f) => ({ name: f.name, size: f.bytes.length, sha256: sha(f.bytes) })) }));
  for (const f of files) expect((await page.request.put(uploads.find((u: { name: string }) => u.name === f.name).url, { data: f.bytes })).status()).toBe(200);
  expect(data(await consoleCall(page, "console.document.update", { id: created.document.id, manifestKey: "manifest.v1.json" })).status).toBe("EXTRACTED");
  const images = data(await consoleCall(page, "console.image.list", { code })) as unknown as { id: string; documentId: string; url: string | null }[];
  return images.find((i) => i.documentId === created.document.id)!;
}

test("a picture placed with / Image shows at once, is stored as an image of the exhibition and shows again after a reload", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const artwork = await seedContent(exhibition, {
    kind: "ARTWORK",
    status: "READY",
    doc: [
      { type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "Harbour at dusk" }] },
      { type: "paragraph", attrs: { id: "p1" }, content: [{ type: "text", text: "Oil on canvas." }] },
    ],
  });
  await signInConsole(page, account);
  await page.goto("/console/");

  await page.locator(".ProseMirror").getByText("Oil on canvas.").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/Image");
  await expect(page.getByRole("listbox", { name: "Insert block" }).getByRole("option")).toHaveText(["Image"]);
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles({ name: "harbour.png", mimeType: "image/png", buffer: PICTURE });

  // In place at once, from the file itself.
  const picture = page.locator(".ProseMirror figure[data-still-image] img");
  await expect(picture).toHaveAttribute("src", /^blob:/);

  // Stored as a document of its own, whose one image the saved document points at.
  await expect.poll(() => imageIdIn(artwork.id), { timeout: 15_000 }).not.toBeNull();
  const imageId = (await imageIdIn(artwork.id))!;
  const [image] = await e2eSql<Record<string, unknown>>(
    "SELECT i.rights, i.verification, i.width, i.height, d.media_type, d.status FROM images i JOIN documents d ON d.id = i.document_id WHERE i.id = $1",
    [imageId],
  );
  expect(image).toEqual({ rights: "UNCONFIRMED", verification: "NOT_APPLICABLE", width: 4, height: 3, media_type: "image/png", status: "EXTRACTED" });
  await expect(page.locator(".ProseMirror figure[data-still-image]")).not.toContainText("Uploading");

  // After a reload the picture comes through the console's image route, and it loads.
  await page.reload();
  await expect(picture).toHaveAttribute("src", `/api/console/images/${imageId}`);
  await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(4);

  // Its rights are confirmed where it stands: only a confirmed image is published (SPEC §10.7).
  await page.getByRole("button", { name: "Confirm rights" }).click();
  await expect.poll(async () => (await e2eSql<{ rights: string }>("SELECT rights FROM images WHERE id = $1", [imageId]))[0].rights).toBe("CONFIRMED");
});

test("the image route answers with a document image's display file, published or not, and only to its institution", async ({ page, browser, baseURL }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const image = await storePicture(page, exhibition.code);
  expect(image.url).toBe(`/api/console/images/${image.id}`);
  expect(JSON.stringify(data(await consoleCall(page, "console.image.list", { code: exhibition.code })))).not.toContain("assets/");

  const route = await page.request.get(image.url!, { maxRedirects: 0 });
  expect(route.status()).toBe(302);
  expect(route.headers()["cache-control"]).toBe("private, max-age=300");
  const location = route.headers()["location"];
  expect(location).toMatch(/^\/api\/r2-dry-run\/private-dry-run\/.+\/assets\/a01\.display\.webp$/);
  expect(Buffer.from(await (await page.request.get(location)).body()).equals(DISPLAY)).toBe(true);

  // The preview shows it before publication; publication checks let it through and give it a public key.
  const content = await seedContent(exhibition, {
    kind: "ARTWORK",
    status: "APPROVED",
    doc: [
      { type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "Harbour at dusk" }] },
      { type: "stillImage", attrs: { id: "i1", imageId: image.id, display: "INLINE", caption: null } },
    ],
    fields: { titleEn: { value: "Harbour at dusk" }, year: { value: "1890" } },
  });
  const sections = [{ id: "s1", kind: "ARTWORK_HIGHLIGHTS", title: "Works", visible: true, contentIds: [content.id] }];
  await e2eSql("UPDATE exhibitions SET draft = draft || $2::jsonb WHERE id = $1", [exhibition.id, JSON.stringify({ sections })]);
  await e2eSql("UPDATE images SET rights = 'CONFIRMED' WHERE id = $1", [image.id]);
  const preview = data(await consoleCall(page, "console.preview.get", { code: exhibition.code }));
  expect(preview.images[image.id].url).toBe(image.url);
  expect(preview.checks.find((c: { id: string }) => c.id === "image-files")).toMatchObject({ ok: true });

  const published = await consoleCall(page, "console.publication.create", { code: exhibition.code, revision: exhibition.draftRevision, rightsConfirmed: true, rightsStatementVersion: "v1" });
  expect(published.status).toBe(200);
  const [row] = await e2eSql<{ object_key: string | null }>("SELECT object_key FROM images WHERE id = $1", [image.id]);
  expect(row.object_key).toBe(`${image.id}.webp`);
  const afterPublish = await page.request.get(image.url!, { maxRedirects: 0 });
  expect(afterPublish.headers()["location"]).toBe(location);

  // No session: 401. Another institution: the same 404 as an unknown image.
  const anonymous = await browser.newContext({ baseURL });
  expect((await anonymous.request.get(image.url!, { maxRedirects: 0 })).status()).toBe(401);
  await anonymous.close();
  await signInConsole(page, await seedInstitutionAccount());
  expect((await page.request.get(image.url!, { maxRedirects: 0 })).status()).toBe(404);
  expect((await page.request.get("/api/console/images/00000000-0000-4000-8000-000000000000", { maxRedirects: 0 })).status()).toBe(404);
});
