import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.5 console.image.*, §9.4 발행 점검 (이미지 권리): staff confirm an image's rights on the review
// screen; the API never shows an object key and treats another institution's image as missing.

test.use({ viewport: { width: 1440, height: 900 } });

type Check = { id: string; ok: boolean };
const imageRights = async (page: Page, code: string) => {
  const { json } = await consoleCall(page, "console.preview.get", { code });
  if (!json.result) throw new Error(JSON.stringify(json));
  return (json.result.data.checks as Check[]).find((c) => c.id === "image-rights")!;
};

async function setup() {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const [image] = await e2eSql<{ id: string }>(
    "INSERT INTO images (exhibition_id, object_key, width, height, alt_text, rights, verification) VALUES ($1, 'e2e/secret-key-' || gen_random_uuid() || '.jpg', 800, 600, 'A still', 'UNCONFIRMED', 'VERIFIED') RETURNING id",
    [exhibition.id],
  );
  const content = await seedContent(exhibition, {
    kind: "ARTWORK",
    status: "APPROVED",
    doc: [
      { type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "Pictured work" }] },
      { type: "stillImage", attrs: { id: "i1", imageId: image.id, display: "INLINE", caption: null } },
    ],
  });
  const sections = [{ id: "s1", kind: "CUSTOM", title: "Works", visible: true, contentIds: [content.id] }];
  await e2eSql("UPDATE exhibitions SET draft = draft || $2::jsonb WHERE id = $1", [exhibition.id, JSON.stringify({ sections })]);
  return { account, exhibition, image };
}

test("confirming an image's permission on the review screen passes the Image rights check", async ({ page }) => {
  const { account, exhibition, image } = await setup();
  await signInConsole(page, account);
  expect((await imageRights(page, exhibition.code)).ok).toBe(false);

  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");
  await page.locator(".item", { hasText: "Pictured work" }).click();
  await page.getByLabel("Rights").selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Save image details" }).click();
  await expect(page.getByText("Image details saved")).toBeVisible();

  const [row] = await e2eSql<{ rights: string }>("SELECT rights FROM images WHERE id = $1", [image.id]);
  expect(row.rights).toBe("CONFIRMED");
  expect((await imageRights(page, exhibition.code)).ok).toBe(true);
  await page.screenshot({ path: "/Users/phihu/Desktop/still-wt/shots/images/panel.png" });
});

test("alt text and permission saved without a copyright holder leave no rights issue", async ({ page }) => {
  const { account, exhibition, image } = await setup();
  await signInConsole(page, account);
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");
  await page.locator(".item", { hasText: "Pictured work" }).click();
  await page.getByLabel("Alt text").fill("A still life with pears");
  await page.getByLabel("Rights").selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Save image details" }).click();
  await expect(page.getByText("Image details saved")).toBeVisible();

  const [row] = await e2eSql<{ alt_text: string; credit: string | null }>("SELECT alt_text, credit FROM images WHERE id = $1", [image.id]);
  expect(row).toEqual({ alt_text: "A still life with pears", credit: null });
  await expect(page.locator(".asset__head")).toContainText("Confirmed");
  expect((await imageRights(page, exhibition.code)).ok).toBe(true);
});

test("image list hides keys and another institution's image is NOT_FOUND", async ({ page }) => {
  const { account, exhibition, image } = await setup();
  await signInConsole(page, account);
  const list = await consoleCall(page, "console.image.list", { code: exhibition.code });
  expect(list.json.result.data).toEqual([expect.objectContaining({ id: image.id, published: true, rights: "UNCONFIRMED" })]);
  expect(JSON.stringify(list.json)).not.toContain("secret-key");

  const other = await seedInstitutionAccount();
  await signInConsole(page, other);
  const update = await consoleCall(page, "console.image.update", { id: image.id, rights: "CONFIRMED" });
  expect(update.json.error.data.code).toBe("NOT_FOUND");
  const read = await consoleCall(page, "console.image.list", { code: exhibition.code });
  expect(read.json.error.data.code).toBe("NOT_FOUND");
});
