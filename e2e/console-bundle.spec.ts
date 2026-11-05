import { expect, test } from "next/experimental/testmode/playwright";
import { readFileSync } from "node:fs";

// The extraction module (and with it pdf.js) loads on first upload, not with the console's entry chunk.
// "console-extract" is the extractor name only that module carries; minified pdf.js has no "pdfjs" text to look for.
// The entry is read from index.html: the lazy extraction chunk is also named index-*.js, so a file-name guess is unreliable.
test("the console entry chunk does not contain the extraction module", () => {
  const html = readFileSync("public/console/index.html", "utf8");
  const entry = html.match(/<script[^>]+src="\/console\/(assets\/[^"]+\.js)"/)?.[1];
  expect(entry).toBeTruthy();
  expect(readFileSync(`public/console/${entry}`, "utf8")).not.toContain("console-extract");
});
