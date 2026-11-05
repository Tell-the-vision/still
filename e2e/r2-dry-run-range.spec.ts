import { createHash, randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { consoleCall, seedInstitutionAccount, signInConsole } from "./support/staff";
import { seedExhibition } from "./support/console";

// The dry-run R2 GET honors a single Range like real R2: 206 + Content-Range, 416 past the end, 200 without Range.

test("dry-run GET answers byte ranges", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await signInConsole(page, account);
  const body = Buffer.from(`0123456789-${randomUUID()}`);
  const sha256 = createHash("sha256").update(body).digest("hex");
  const created = await consoleCall(page, "console.document.create", { code: exhibition.code, name: "r.pdf", mediaType: "application/pdf", byteSize: body.length, sha256 });
  const url = created.json.result.data.upload.url as string;
  expect((await page.request.put(url, { data: body })).status()).toBe(200);

  const get = (range?: string) => page.request.get(url, { headers: range ? { Range: range } : {} });
  const part = await get("bytes=2-5");
  expect(part.status()).toBe(206);
  expect(part.headers()["content-range"]).toBe(`bytes 2-5/${body.length}`);
  expect(Buffer.from(await part.body()).toString()).toBe("2345");

  const tail = await get("bytes=2-");
  expect(tail.status()).toBe(206);
  expect(tail.headers()["content-range"]).toBe(`bytes 2-${body.length - 1}/${body.length}`);
  expect(Buffer.from(await tail.body())).toEqual(body.subarray(2));

  const past = await get(`bytes=${body.length}-`);
  expect(past.status()).toBe(416);
  expect(past.headers()["content-range"]).toBe(`bytes */${body.length}`);

  const whole = await get();
  expect(whole.status()).toBe(200);
  expect(Buffer.from(await whole.body())).toEqual(body);
});
