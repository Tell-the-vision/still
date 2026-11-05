import pw from "/opt/npm-tools/node_modules/playwright/index.js";
import { PNG } from "./fonts/node_modules/pngjs/lib/png.js";
import fs from "node:fs";
const [html, pdfPngDir, outPng, ...pages] = process.argv.slice(2);
const b = await pw.chromium.launch(); const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await c.newPage();
await p.goto("file://" + html); await p.waitForTimeout(1500);
const H = await p.evaluate(() => document.body.scrollHeight);
const n = 4, shots = [];
for (let i = 0; i < n; i++) { const y = Math.round((H - 844) * i / (n - 1)); await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(250); const f = `${outPng}.${i}.png`; await p.screenshot({ path: f }); shots.push(f); }
await b.close();
console.log(JSON.stringify({ H, shots }));
