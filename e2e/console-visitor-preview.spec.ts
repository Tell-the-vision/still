import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 미리보기 모드, §11.8: the review screen shows the visitor renderer beside the editor.

test.use({ viewport: { width: 1440, height: 900 } });

test("the review screen previews the item as visitors see it", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await seedContent(exhibition, {
    kind: "ARTWORK",
    status: "READY",
    doc: [
      { type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "Preview heading" }] },
      { type: "paragraph", attrs: { id: "p1" }, content: [{ type: "text", text: "Preview paragraph text." }] },
    ],
  });
  await signInConsole(page, account);
  await page.goto("/institutions/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/institutions/materials/review");

  await expect(page.getByText("The editor view may differ from what visitors see. The preview on the right is the visitor renderer.")).toBeVisible();
  const preview = page.getByTestId("visitor-preview");
  await expect(preview.getByRole("heading", { name: "Preview heading" })).toBeVisible();
  await expect(preview.getByText("Preview paragraph text.")).toBeVisible();
  await page.screenshot({ path: "/Users/phihu/Desktop/still-wt/shots/edpreview/review-preview.png" });
});
