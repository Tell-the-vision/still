import type { Route } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";

const sentenceId = "00000000-0000-4000-8000-000000000001";
const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const svg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='lightgray'/></svg>";
const image = (display: string, altText: string) => ({ type: "stillImage", attrs: { display, caption: null, url: svg, altText, width: 400, height: 300 } });
const stillDocument = {
  version: 1,
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [text("Still Heading")] },
    paragraph(text("Plain opening line. "), text("A keepable line.", [{ type: "scrap", attrs: { sentenceId } }]), text(" Closing words.", [{ type: "unknown" }])),
    { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("First bullet"))] }] },
    { type: "blockquote", content: [paragraph(text("A quoted passage"))] },
    image("HERO", "Hero shot"),
    image("GALLERY", "Gallery one"),
    image("GALLERY", "Gallery two"),
    { type: "mystery", content: [] },
  ],
};

// Serve the real guide.get response with its document swapped for a STILL document.
async function serveStillDocument(route: Route) {
  const response = await route.fetch();
  const body = await response.json();
  for (const item of Array.isArray(body) ? body : [body]) item.result.data.document = stillDocument;
  await route.fulfill({ response, json: body });
}

test("a STILL document renders and its scrap sentence can be kept", async ({ page, next }) => {
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.route("**/api/trpc/guide.get*", serveStillDocument);
  await openGuide(page, "forms-of-stillness");
  await expect(page.getByRole("heading", { name: "Still Heading" })).toBeVisible();
  await expect(page.getByText("Plain opening line.")).toBeVisible();
  await expect(page.getByText("Closing words.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "First bullet" })).toBeVisible();
  await expect(page.getByText("A quoted passage")).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep this line" })).toHaveCount(1);
  await page.getByRole("button", { name: "Keep this line" }).click();
  await expect(page.getByRole("button", { name: "Remove this line" })).toHaveCount(1);
});

test("on a phone a HERO image spans the screen and GALLERY images share one scrolling row", async ({ page, next }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.route("**/api/trpc/guide.get*", serveStillDocument);
  await openGuide(page, "forms-of-stillness");
  const hero = await page.getByAltText("Hero shot").boundingBox();
  expect(hero?.width).toBe(390);
  expect(hero?.x).toBe(0);
  const one = await page.getByAltText("Gallery one").boundingBox();
  const two = await page.getByAltText("Gallery two").boundingBox();
  expect(one!.y).toBe(two!.y);
  expect(two!.x).toBeGreaterThan(one!.x);
  const row = page.getByTestId("gallery-row");
  expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await page.getByAltText("Hero shot").scrollIntoViewIfNeeded();
});
