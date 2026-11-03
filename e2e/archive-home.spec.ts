import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

// Opens the guide and waits until the archive row is written.
async function visit(page: Page, code: string) {
  const upserted = page.waitForResponse(/archive\.upsert/);
  await openGuide(page, code);
  await upserted;
}

test("archive.list pages by last visit with a cursor", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await visit(page, "forms-of-stillness");
  await visit(page, "quiet-rooms");
  const first = (await trpcCall(page, "archive.list", { limit: 1 })).json.result.data;
  expect(first.items[0].exhibition.code).toBe("quiet-rooms");
  expect(first.totalSize).toBe(2);
  expect(first.nextCursor).toBeTruthy();
  const second = (await trpcCall(page, "archive.list", { limit: 1, cursor: first.nextCursor })).json.result.data;
  expect(second.items[0].exhibition.code).toBe("forms-of-stillness");
  expect(second.nextCursor).toBeNull();
  expect((await trpcCall(page, "archive.list", { cursor: "bad" })).status).toBe(400);
});

