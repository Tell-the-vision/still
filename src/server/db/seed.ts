import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { db } from "./client";
import { defaultPackage, type ContentPackage } from "./seed/content";
import { importPackage } from "./seed/import";

// Usage: db:seed [packagePath]. A directory imports every content-*.ts in it, in name order.
async function loadPackage(file: string): Promise<ContentPackage> {
  const mod = await import(pathToFileURL(resolve(file)).href);
  return mod.default;
}

async function packagesAt(path?: string): Promise<ContentPackage[]> {
  if (!path) return [defaultPackage];
  if (!statSync(path).isDirectory()) return [await loadPackage(path)];
  const files = readdirSync(path).filter((f) => /^content-.*\.ts$/.test(f)).sort();
  const packages: ContentPackage[] = [];
  for (const f of files) packages.push(await loadPackage(join(path, f)));
  return packages;
}

async function main() {
  for (const pkg of await packagesAt(process.argv[2])) await importPackage(pkg);
  console.log("Seed import complete");
}

main()
  .then(() => db.$client.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
