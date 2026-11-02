import { expect, test } from "next/experimental/testmode/playwright";
import { systemPathFor } from "../client/src/features/entry/system-path";

const origin = "http://localhost:3100";

test("exhibition links map to the guide", () => {
  for (const path of [
    "still://e/quiet-rooms",
    "/e/quiet-rooms",
    "e/quiet-rooms",
    "exp://127.0.0.1:8082/--/e/quiet-rooms",
    `${origin}/e/quiet-rooms`,
  ]) {
    expect(systemPathFor(path, origin)).toBe("/e/quiet-rooms");
  }
});

test("other paths pass through and bad codes go to scan", () => {
  expect(systemPathFor("still:///oauthredirect?code=x", origin)).toBe("still:///oauthredirect?code=x");
  expect(systemPathFor("/account", origin)).toBe("/account");
  expect(systemPathFor("/e/BAD", origin)).toBe("/scan");
});
