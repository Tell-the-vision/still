import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// A one-page PDF with a real text layer, built here so the repo carries no third-party document.
function textPdf(lines: string[]) {
  const stream = `BT /F1 14 Tf 72 720 Td 18 TL ${lines.map((l) => `(${l}) '`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => { const at = body.length; body += `${i + 1} 0 obj\n${object}\nendobj\n`; return at; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

// SPEC §9.4 업로드 → 추출(브라우저) → 분석 → 검토, with no part of the server mocked: the browser extracts the
// PDF, names its manifest as console.documentUpload.create does, the server validates it (EXTRACTED), and an
// analysis turns it into review content.
test("a PDF uploaded on the materials page is extracted, analysed and shows on the review screen", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "wall-text.pdf", mimeType: "application/pdf",
    buffer: textPdf(["The Secret Show", "Thirty years on a single bronze head."]),
  });

  await expect.poll(async () => {
    const [row] = await e2eSql<{ status: string }>("SELECT status FROM documents WHERE exhibition_id = $1", [exhibition.id]);
    return row?.status;
  }, { timeout: 30_000 }).toBe("EXTRACTED");

  expect((await consoleCall(page, "console.analysis.create", { code: exhibition.code })).status).toBe(200);
  await expect.poll(async () => {
    const [row] = await e2eSql<{ result: string | null }>("SELECT analysis->>'result' AS result FROM exhibitions WHERE id = $1", [exhibition.id]);
    return row.result;
  }, { timeout: 30_000 }).toBe("SUCCEEDED");

  await page.goto("/console/materials/review");
  await expect(page.locator(".item").first()).toBeVisible();
  await page.locator(".item").first().click();
  await expect(page.locator(".ProseMirror")).toContainText("Thirty years on a single bronze head.");
});
