import { expect, test } from "next/experimental/testmode/playwright";
import { trpcCall } from "./support/api";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";

// SPEC §3.2: personal procedures resolve PUBLISHED or UNPUBLISHED codes; a never-published DRAFT does not exist for visitors.
// The UNPUBLISHED side is covered by archive-rules.spec.ts.
test("a never-published DRAFT exhibition is NOT_FOUND for personal procedures", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  expect((await trpcCall(page, "archive.get", { code: "draft-preview" })).status).toBe(404);
  expect((await trpcCall(page, "archive.upsert", { code: "draft-preview" })).status).toBe(404);
  expect((await trpcCall(page, "archive.delete", { code: "draft-preview" })).status).toBe(404);
  expect((await trpcCall(page, "exhibition.get", { code: "draft-preview" })).status).toBe(404);
});
