import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 STILL 스키마: staff insert one of the exhibition's images into an item from the editor toolbar.

test.use({ viewport: { width: 1440, height: 900 } });

test("the Image button inserts an exhibition image that autosaves and shows in the visitor preview", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const [image] = await e2eSql<{ id: string }>(
    "INSERT INTO images (exhibition_id, object_key, width, height, alt_text, rights, verification) VALUES ($1, 'e2e/k-' || gen_random_uuid() || '.jpg', 800, 600, 'Skull study', 'UNCONFIRMED', 'VERIFIED') RETURNING id",
    [exhibition.id],
  );
  const item = await seedContent(exhibition, {
    kind: "CLOSING",
    status: "READY",
    doc: [{ type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "Farewell" }] }],
  });
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/institutions/materials/review");
  await page.locator(".item", { hasText: "Farewell" }).click();

  await page.locator(".ProseMirror").getByText("Farewell").click();
  await page.getByRole("toolbar").getByRole("button", { name: "Image" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("list", { name: "Exhibition images" })).toBeHidden();
  await page.getByRole("toolbar").getByRole("button", { name: "Image" }).click();
  await page.getByRole("button", { name: "Skull study" }).click();

  await expect(page.locator(".ProseMirror figure[data-still-image]")).toContainText("INLINE");
  // The preview follows the editor live (SPEC §9.4 미리보기 모드), before any save or reload.
  await expect(page.getByTestId("visitor-preview").locator("figure")).toHaveCount(1);
  await expect.poll(async () => {
    const [row] = await e2eSql<{ doc: { content: { type: string; attrs?: { imageId?: string } }[] } }>("SELECT doc FROM contents WHERE id = $1", [item.id]);
    return row.doc.content.find((n) => n.type === "stillImage")?.attrs?.imageId;
  }).toBe(image.id);
  // After a reload the saved doc shows the image too.
  await page.reload();
  await page.locator(".item", { hasText: "Farewell" }).click();
  await expect(page.getByTestId("visitor-preview").locator("figure")).toHaveCount(1);
});
