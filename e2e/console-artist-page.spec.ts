import { expect, test } from "next/experimental/testmode/playwright";
import { seedContent, seedExhibition } from "./support/console";
import { seedInstitutionAccount, signInConsole } from "./support/staff";

// A page may be about an artist instead of an artwork; each page has its own address and QR. The editor lists it with
// the artworks, Publish All publishes it, Go to works shows its QR, and a visitor opens it at that address.

test.use({ viewport: { width: 1440, height: 900 } });

test("an artist page is listed, approved and published like an artwork, and visitors open it at its own address", async ({ page, baseURL }) => {
  const account = await seedInstitutionAccount();
  const exhibition = await seedExhibition(account);
  const artist = await seedContent(exhibition, {
    kind: "ARTIST",
    status: "READY",
    doc: [
      { type: "heading", attrs: { id: "h1", level: 2 }, content: [{ type: "text", text: "William Turner" }] },
      { type: "paragraph", attrs: { id: "p1" }, content: [{ type: "text", text: "Turner painted light all his life." }] },
    ],
  });
  await signInConsole(page, account);
  await page.goto("/console/");

  await page.getByRole("checkbox", { name: "Approve William Turner" }).click();
  await page.getByRole("button", { name: "Publish All" }).click();
  await expect(page.getByText(/^Published/)).toBeVisible();
  // With nothing left to publish, Go to works is the next step and takes the emphasis.
  await expect(page.getByRole("link", { name: "Go to works" })).toHaveClass(/rail-works--next/);

  const address = `/e/${exhibition.code}/${artist.id.slice(0, 8)}`;
  await page.getByRole("link", { name: "Go to works" }).click();
  await expect(page.getByText("William Turner", { exact: true })).toBeVisible();
  // The address under its QR is on the origin visitors use (the server's own).
  await expect(page.getByText(`${new URL(baseURL!).host}${address}`, { exact: true })).toBeVisible();

  await page.goto(address);
  await expect(page.getByText("Turner painted light all his life.")).toBeVisible();
});
