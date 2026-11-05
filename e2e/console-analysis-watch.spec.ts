import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { consoleCall, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.5 console.analysis.watch, §11.1: the subscription streams the snapshot, then job events, over SSE.

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (res: { json: any }) => res.json.result.data;

async function extractedExhibition(page: Page, text = "One two. Three.") {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const put = async (url: string, body: Buffer) => expect((await page.request.put(url, { data: body })).status()).toBe(200);
  const original = Buffer.from(`%PDF-1.4 ${randomUUID()}`);
  const created = data(await consoleCall(page, "console.document.create", {
    code: exhibition.code, name: "statement.pdf", mediaType: "application/pdf", byteSize: original.length, sha256: sha(original),
  }));
  await put(created.upload.url, original);
  await consoleCall(page, "console.document.update", { id: created.document.id, uploaded: true });
  const manifest = Buffer.from(JSON.stringify({
    version: 1,
    document: { documentId: created.document.id, sha256: sha(original), mediaType: "application/pdf", pages: 1 },
    extractor: { name: "test", version: "1" },
    pages: [{ page: 1, size: [100, 100] }],
    segments: [{ id: "s001", page: 1, bbox: null, text, sentences: text.split(/(?<=\.) /) }],
    assets: [], modelInputs: [], warnings: [],
  }));
  const upload = await consoleCall(page, "console.documentUpload.create", {
    documentId: created.document.id, files: [{ name: "manifest.v1.json", size: manifest.length, sha256: sha(manifest) }],
  });
  await put(data(upload).uploads[0].url, manifest);
  const key = `${account.institutionId}/${exhibition.id}/${created.document.id}/manifest.v1.json`;
  expect(data(await consoleCall(page, "console.document.update", { id: created.document.id, manifestKey: key })).status).toBe("EXTRACTED");
  return exhibition;
}

const watchUrl = (code: string) => `/api/trpc/console.analysis.watch?client=console&input=${encodeURIComponent(JSON.stringify({ code }))}`;

test("watch streams the snapshot, then the completion", async ({ page }) => {
  const exhibition = await extractedExhibition(page);
  expect((await consoleCall(page, "console.analysis.create", { code: exhibition.code })).status).toBe(200);
  const messages = await page.evaluate((url) => new Promise<{ analysis?: { result: string | null }; queue?: string; state?: string }[]>((resolve, reject) => {
    const source = new EventSource(url);
    const seen: { analysis?: { result: string | null } }[] = [];
    source.onerror = () => { source.close(); reject(new Error("stream error")); };
    source.onmessage = (e) => {
      const value = JSON.parse(e.data).data ?? JSON.parse(e.data);
      seen.push(value);
      if (value.analysis?.result) { source.close(); resolve(seen); }
    };
  }), watchUrl(exhibition.code));
  expect(messages[0].analysis).toBeTruthy(); // the snapshot comes first
  expect(messages.at(-1)!.analysis!.result).toBe("SUCCEEDED");
});

test("a cookie-authenticated watch is refused unless it is same-origin", async ({ page }) => {
  const exhibition = await extractedExhibition(page);
  const get = (site: string) => page.request.get(watchUrl(exhibition.code), { headers: { "sec-fetch-site": site, accept: "text/event-stream" }, timeout: 5000 }).catch(() => null);
  // The SSE response is already 200 when the procedure fails, so the refusal arrives as an error event.
  const body = await (await get("cross-site"))?.text();
  expect(body).toContain("FORBIDDEN");
  expect(body).not.toContain('"documents"');
});

test("deleting a running analysis ends the open watch with CANCELLED", async ({ page }) => {
  const exhibition = await extractedExhibition(page, "SLOW One two. Three.");
  expect((await consoleCall(page, "console.analysis.create", { code: exhibition.code })).status).toBe(200);
  const last = page.evaluate((url) => new Promise<{ analysis?: { result: string | null } }>((resolve, reject) => {
    const source = new EventSource(url);
    const timer = setTimeout(() => { source.close(); reject(new Error("watch did not end")); }, 8000);
    source.onmessage = (e) => {
      const value = JSON.parse(e.data).data ?? JSON.parse(e.data);
      if (value.analysis?.result) { clearTimeout(timer); source.close(); resolve(value); }
    };
  }), watchUrl(exhibition.code));
  await page.waitForTimeout(1000); // the stream is open and the job is still running
  expect((await consoleCall(page, "console.analysis.delete", { code: exhibition.code })).status).toBe(200);
  expect((await last).analysis!.result).toBe("CANCELLED");
});
