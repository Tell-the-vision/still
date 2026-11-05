import { expect, test } from "next/experimental/testmode/playwright";
import { readdirSync, readFileSync } from "node:fs";

// The extraction module (and with it pdf.js) loads on first upload, not with the console's entry chunk.
// "console-extract" is the extractor name only that module carries; minified pdf.js has no "pdfjs" text to look for.
test("the console entry chunk does not contain the extraction module", () => {
  const dir = "public/console/assets";
  const entry = readdirSync(dir).find((f) => /^index-.*\.js$/.test(f));
  expect(entry).toBeTruthy();
  expect(readFileSync(`${dir}/${entry}`, "utf8")).not.toContain("console-extract");
});
