import { expect, test } from "next/experimental/testmode/playwright";

test("unknown procedure is a JSON 404 that is never cached", async ({ request }) => {
  const res = await request.get("/api/trpc/nope");
  expect(res.status()).toBe(404);
  expect(res.headers()["cache-control"]).toBe("private, no-store");
  expect((await res.json()).error.data.code).toBe("NOT_FOUND");
});

test("non-JSON POST is rejected with 415", async ({ request }) => {
  const res = await request.post("/api/trpc/nope", { multipart: { a: "1" } });
  expect(res.status()).toBe(415);
});
