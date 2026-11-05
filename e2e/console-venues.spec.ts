import { randomUUID } from "node:crypto";
import { expect, test } from "next/experimental/testmode/playwright";
import { seedExhibition } from "./support/console";
import { consoleCall, e2eSql, seedInstitutionAccount, signInConsole } from "./support/staff";

// SPEC §9.4 전시 초안, §9.5 console.venue.*: venues are shared between institutions, the server
// picks the code from the name, and only the creating institution may edit one, not while another
// institution's published exhibition uses it (VENUE_IN_USE).

const data = (res: { json: { result: { data: unknown } } }) => res.json.result.data as Record<string, unknown>;

test("staff add a venue; the code comes from the name and stays unique", async ({ page }) => {
  const account = await seedInstitutionAccount();
  await signInConsole(page, account);
  const name = `Seoul Hall ${randomUUID().slice(0, 6)}`;
  const first = data(await consoleCall(page, "console.venue.create", { name, city: "Seoul" }));
  const second = data(await consoleCall(page, "console.venue.create", { name, city: "Seoul" }));
  expect(first).toMatchObject({ name, city: "Seoul", editable: true, code: name.toLowerCase().replace(/ /g, "-") });
  expect(second.code).toBe(`${first.code}-2`);
  // Names without Latin letters still get a valid code.
  expect(data(await consoleCall(page, "console.venue.create", { name: "국립현대미술관", city: "서울" })).code).toMatch(/^venue(-\d+)?$/);

  const listed = (await consoleCall(page, "console.venue.list", { q: name })).json.result.data;
  expect(listed.map((v: { id: string }) => v.id)).toEqual([first.id, second.id]);
});

test("only the creating institution edits a venue, and not once another institution publishes with it", async ({ page, browser }) => {
  const owner = await seedInstitutionAccount();
  await signInConsole(page, owner);
  const venue = data(await consoleCall(page, "console.venue.create", { name: `Annex ${randomUUID().slice(0, 6)}`, city: "Busan" }));
  expect(data(await consoleCall(page, "console.venue.update", { id: venue.id, name: "Annex Renamed" }))).toMatchObject({ name: "Annex Renamed", code: venue.code });

  const other = await seedInstitutionAccount();
  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await signInConsole(otherPage, other);
  const listedForOther = (await consoleCall(otherPage, "console.venue.list", { q: "Annex Renamed" })).json.result.data;
  expect(listedForOther).toContainEqual(expect.objectContaining({ id: venue.id, editable: false }));
  expect((await consoleCall(otherPage, "console.venue.update", { id: venue.id, city: "Ulsan" })).status).toBe(403);

  // Another institution publishes an exhibition at this venue: the owner can no longer rename it.
  const published = await seedExhibition(other, { state: "PUBLISHED" });
  await e2eSql("UPDATE exhibitions SET venue_id = $1 WHERE id = $2", [venue.id, published.id]);
  const blocked = await consoleCall(page, "console.venue.update", { id: venue.id, name: "Too Late" });
  expect(blocked.status).toBe(409);
  expect(blocked.json.error.data.appCode).toBe("VENUE_IN_USE");
  expect((await consoleCall(page, "console.venue.update", { id: randomUUID(), name: "Nowhere" })).status).toBe(404);
  await otherContext.close();
});
