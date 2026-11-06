import { randomUUID } from "node:crypto";
import type { Locator } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { newUser, signIn, stubGoogle, stubGoogleToken } from "./support/google";
import { openGuide } from "./support/reach";
import { e2eSql, seedInstitutionAccount } from "./support/staff";

// A heading's size follows its level in the STILL document, as the console's editor draws it (heading-integrity.spec.ts
// compares the two): after the move to STILL documents every heading had been drawn at one small size.

const fontSize = (heading: Locator) => heading.evaluate((el) => getComputedStyle(el).fontSize);

async function publishedGuide() {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account, { state: "PUBLISHED" });
  const work = `Work ${randomUUID().slice(0, 8)}`;
  const page = "abcd1234";
  const text = (t: string) => [{ type: "text", text: t }];
  const guide = {
    version: 1,
    type: "doc",
    content: [
      { type: "heading", attrs: { id: "sec-works", level: 1 }, content: text("Works") },
      { type: "heading", attrs: { id: `${page}-n1`, level: 2 }, content: text(work) },
      { type: "paragraph", attrs: { id: `${page}-n2` }, content: text("A line about the work.") },
      { type: "heading", attrs: { id: `${page}-n3`, level: 3 }, content: text("Up close") },
      { type: "paragraph", attrs: { id: `${page}-n4` }, content: text("A closer look.") },
    ],
  };
  await e2eSql("UPDATE exhibitions SET guide = $2 WHERE id = $1", [exhibition.id, JSON.stringify(guide)]);
  return { code: exhibition.code, page, work };
}

test("a work opened from Home has its title as large as in the editor, and its parts smaller", async ({ page, next }) => {
  const { code, page: workPage, work } = await publishedGuide();
  stubGoogleToken(next, newUser());
  await stubGoogle(page);
  await signIn(page);
  await page.goto("/");
  await page.getByRole("link", { name: new RegExp(work) }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${code}/${workPage}$`));

  const title = page.getByRole("heading", { name: work });
  await expect(title).toHaveAttribute("aria-level", "1");
  expect(await fontSize(title)).toBe("36px");
  expect(await fontSize(page.getByRole("heading", { name: "Up close" }))).toBe("18px");
});

test("the whole guide sizes its section title, work titles and parts by level", async ({ page }) => {
  const { code, work } = await publishedGuide();
  await openGuide(page, code);
  await expect(page).toHaveURL(new RegExp(`/e/${code}$`));

  expect(await fontSize(page.getByRole("heading", { name: "Works", exact: true }))).toBe("30px");
  expect(await fontSize(page.getByRole("heading", { name: work }))).toBe("22px");
  expect(await fontSize(page.getByRole("heading", { name: "Up close" }))).toBe("18px");
});
