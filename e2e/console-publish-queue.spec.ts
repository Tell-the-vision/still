import { expect, test, type Page } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 발행, §10.8: in the editor's rail, publishing moves the approved artworks out of "Approved" into
// "Live"; editing a live artwork sends it back to review (the server clears its approval).

test.use({ viewport: { width: 1440, height: 900 } });

const artwork = (title: string) => [
  { type: "heading", attrs: { id: `h-${title}`, level: 2 }, content: [{ type: "text", text: title }] },
  { type: "paragraph", attrs: { id: `p-${title}` }, content: [{ type: "text", text: `${title}, oil on canvas.` }] },
];
const group = (page: Page, label: string) => page.locator(".git-group").filter({ has: page.getByRole("button", { name: label, exact: true }) });

test("Publish All moves the approved artworks to Live, and an edit brings one back to review", async ({ page }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  await seedContent(exhibition, { kind: "ARTWORK", status: "APPROVED", doc: artwork("Morning") });
  await seedContent(exhibition, { kind: "ARTWORK", status: "APPROVED", doc: artwork("Evening") });
  await signInConsole(page, account);
  await page.goto("/console/");

  await expect(group(page, "Approved")).toContainText("Morning");
  await expect(group(page, "Live")).toHaveCount(0);

  await page.getByRole("button", { name: "Publish All" }).click();
  await page.getByRole("dialog", { name: "Publish" }).getByRole("checkbox").check();
  await page.getByRole("button", { name: "Publish now" }).click();

  await expect(group(page, "Live")).toContainText("Morning");
  await expect(group(page, "Live")).toContainText("Evening");
  await expect(group(page, "Approved")).toHaveCount(0);
  expect((await e2eSql<{ state: string }>("SELECT state FROM exhibitions WHERE id = $1", [exhibition.id]))[0].state).toBe("PUBLISHED");

  // A reload stays on the exhibition just published, still split the same way.
  await page.reload();
  await expect(group(page, "Live")).toContainText("Evening");

  await group(page, "Live").getByRole("button", { name: /Morning/ }).click();
  await page.locator(".ProseMirror").getByText("Morning, oil on canvas.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Revised.");
  await expect(group(page, "To review")).toContainText("Morning");
  await expect(group(page, "Live")).not.toContainText("Morning");
  await expect(group(page, "Live")).toContainText("Evening");
});
