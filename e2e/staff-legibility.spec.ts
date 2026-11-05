import type { Page } from "@playwright/test";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { seedInstitutionAccount, seedOperator, signInAdmin, signInConsole } from "./support/staff";

// Staff screens stay legible: no functional text under 11px, and faint or amber text reaches WCAG AA (4.5:1).

test.use({ viewport: { width: 1440, height: 900 } });

// Font sizes of every visible element that carries its own text.
const smallTexts = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()) && el.getClientRects().length > 0)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 11)
      .map((el) => `${el.tagName}.${el.className} "${el.textContent?.trim().slice(0, 30)}" ${getComputedStyle(el).fontSize}`),
  );

// Contrast of each matching element's text colour against its first opaque ancestor background.
const lowContrast = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const rgba = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const background = (el: Element): number[] => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const c = rgba(getComputedStyle(node).backgroundColor);
        if (c.length === 3 || (c.length === 4 && c[3] === 1)) return c;
      }
      return [255, 255, 255];
    };
    const found = [...document.querySelectorAll(sel)].filter((el) => el.getClientRects().length > 0);
    const failing = found
      .map((el) => {
        const [a, b] = [lum(rgba(getComputedStyle(el).color)), lum(background(el))].sort((x, y) => y - x);
        return { name: `${el.className} "${el.textContent?.trim().slice(0, 20)}"`, ratio: (a + 0.05) / (b + 0.05) };
      })
      .filter((r) => r.ratio < 4.5)
      .map((r) => `${r.name} ${r.ratio.toFixed(2)}`);
    return { count: found.length, failing };
  }, selector);

test("the review screen has no text under 11px, readable amber, and a singular group header", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await seedContent(exhibition, { kind: "ARTWORK", status: "NEEDS_REVIEW", doc: [{ type: "paragraph", attrs: { id: "b1" }, content: [{ type: "text", text: "Body" }] }] });
  await signInConsole(page, account);
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");

  await expect(page.locator(".panel__head")).toContainText("1 group");
  await expect(page.locator(".panel__head")).not.toContainText("1 groups");
  await expect(page.getByText(/^1 item found · /)).toBeVisible();
  expect(await smallTexts(page)).toEqual([]);
  const amber = await lowContrast(page, ".status-text--amber, .badge--amber, .tone-amber");
  expect(amber.count).toBeGreaterThan(0);
  expect(amber.failing).toEqual([]);
});

test("Users & access has no text under 11px and readable faint text", async ({ page }) => {
  await signInAdmin(page, await seedOperator());
  await page.goto("/admin/institutions");
  await page.getByRole("link", { name: "Users & access" }).click();
  await expect(page.getByRole("button", { name: "Add operator" })).toBeVisible();

  expect(await smallTexts(page)).toEqual([]);
  const faint = await lowContrast(page, ".pa-side__heading, .pa-side__foot, .pa-note, .pa-hint");
  expect(faint.count).toBeGreaterThan(0);
  expect(faint.failing).toEqual([]);
});

// WCAG 2.5.8: the list's select box is 15px, so its label gives it a 24×24 target that toggles it.
test("the review list's select box has a 24px target", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await seedContent(exhibition, { kind: "ARTWORK", status: "NEEDS_REVIEW", doc: [{ type: "paragraph", attrs: { id: "b1" }, content: [{ type: "text", text: "Body" }] }] });
  await signInConsole(page, account);
  await page.goto("/console/exhibitions");
  await page.getByText(exhibition.title, { exact: true }).click();
  await page.goto("/console/materials/review");

  const box = page.getByRole("checkbox", { name: /^Select / });
  const target = page.locator(".pick-row label").filter({ has: box });
  const size = await target.boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(24);
  expect(size!.height).toBeGreaterThanOrEqual(24);
  // A click on the target's corner, outside the 15px box, still toggles it.
  await target.click({ position: { x: 1, y: 1 } });
  await expect(box).toBeChecked();
});
