import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { openGuide } from "./support/reach";

type Block = { content?: { marks?: unknown[] }[] };

// SPEC §11.8: visitors receive STILL documents; scrap marks carry the guide sentence ids.
test("guide.get and exhibition.get serve STILL documents", async ({ page }) => {
  await openGuide(page, "forms-of-stillness");
  const guide = (await trpcCall(page, "guide.get", { code: "forms-of-stillness" })).json.result.data.document;
  expect(guide).toMatchObject({ version: 1, type: "doc" });
  expect(guide.content[0]).toMatchObject({ type: "heading", attrs: { level: 2 } });
  const marks = guide.content.flatMap((b: Block) => (b.content ?? []).flatMap((t) => t.marks ?? []));
  expect(marks.length).toBeGreaterThan(0);
  for (const m of marks) expect(m).toMatchObject({ type: "scrap", attrs: { sentenceId: expect.stringMatching(/^[0-9a-f-]{36}$/) } });

  const exhibition = (await trpcCall(page, "exhibition.get", { code: "forms-of-stillness" })).json.result.data;
  expect(exhibition.description).toMatchObject({ version: 1, type: "doc", content: [{ type: "paragraph" }] });
});
