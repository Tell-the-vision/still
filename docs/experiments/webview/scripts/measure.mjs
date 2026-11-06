// measure.mjs — screenshot each reconstructed page (B) and compare with the PDF raster (ground truth).
//   node measure.mjs <build dir> <extract out dir> <report json>
import pw from "/opt/npm-tools/node_modules/playwright/index.js";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "./fonts/node_modules/pngjs/lib/png.js";

const [buildDir, extDir, reportPath] = process.argv.slice(2);
const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
fs.mkdirSync(path.join(buildDir, "shots"), { recursive: true });

function gray(png) {
  const g = new Float32Array(png.width * png.height);
  for (let i = 0; i < g.length; i++) g[i] = (png.data[i * 4] * 0.299 + png.data[i * 4 + 1] * 0.587 + png.data[i * 4 + 2] * 0.114);
  return { g, w: png.width, h: png.height };
}
function compare(a, b) {
  const w = Math.min(a.w, b.w), h = Math.min(a.h, b.h);
  let absSum = 0, inkA = 0, inkB = 0, inkBoth = 0;
  // 4x4 block pooling makes the metric tolerant to sub-pixel font differences
  const B = 4;
  for (let y = 0; y + B <= h; y += B) for (let x = 0; x + B <= w; x += B) {
    let sa = 0, sb = 0;
    for (let dy = 0; dy < B; dy++) for (let dx = 0; dx < B; dx++) { sa += a.g[(y + dy) * a.w + x + dx]; sb += b.g[(y + dy) * b.w + x + dx]; }
    sa /= B * B; sb /= B * B;
    absSum += Math.abs(sa - sb);
    const ia = sa < 200, ib = sb < 200;
    inkA += ia; inkB += ib; inkBoth += ia && ib;
  }
  const blocks = Math.floor(w / B) * Math.floor(h / B);
  return { pixelSimilarity: 1 - absSum / 255 / blocks, inkIoU: inkBoth / Math.max(inkA + inkB - inkBoth, 1), inkRatio: inkB / Math.max(inkA, 1) };
}

const results = {};
for (const view of ["view-css.html", "view-raster.html"]) {
  await page.goto("file://" + path.resolve(buildDir, view));
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.fonts.ready);
  const n = await page.locator(".page").count();
  const per = [];
  for (let i = 0; i < n; i++) {
    const el = page.locator(".page").nth(i);
    await el.scrollIntoViewIfNeeded();
    const shot = path.join(buildDir, "shots", `${view.replace(".html", "")}-p${String(i + 1).padStart(2, "0")}.png`);
    await el.screenshot({ path: shot });
    const ref = PNG.sync.read(fs.readFileSync(path.join(extDir, "png", `p${String(i + 1).padStart(2, "0")}.png`)));
    const got = PNG.sync.read(fs.readFileSync(shot));
    per.push({ page: i + 1, ...compare(gray(ref), gray(got)), size: [got.width, got.height], ref: [ref.width, ref.height] });
  }
  const avg = (k) => per.reduce((s, x) => s + x[k], 0) / per.length;
  results[view] = { pages: per.length, pixelSimilarity: +avg("pixelSimilarity").toFixed(4), inkIoU: +avg("inkIoU").toFixed(4), inkRatio: +avg("inkRatio").toFixed(3), per };
  console.log(`${view}: ${per.length} pages · pixelSim ${results[view].pixelSimilarity} · inkIoU ${results[view].inkIoU} · inkRatio ${results[view].inkRatio}`);
}
// reflow: full-page screenshot at phone width for the eye, no pixel metric (it is not page-faithful by design)
await ctx.close();
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const mp = await mctx.newPage();
for (const view of ["view-reflow.html", "view-css.html", "view-raster.html"]) {
  await mp.goto("file://" + path.resolve(buildDir, view));
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: path.join(buildDir, "shots", `phone-${view.replace(".html", "")}.png`), fullPage: false });
}
await browser.close();
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
