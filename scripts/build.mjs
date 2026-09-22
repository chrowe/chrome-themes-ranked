#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pageHtml } from "./lib.mjs";

export const dataFile = new URL("../data/themes.json", import.meta.url);

// The committed dataset is the source of truth, so the site can be rebuilt
// without re-scraping the store.
export async function buildSite(output) {
  const payload = JSON.parse(await readFile(dataFile, "utf8"));
  await mkdir(output, { recursive: true });
  await cp(new URL("../site", import.meta.url), output, { recursive: true });
  await writeFile(path.join(output, "index.html"), pageHtml(payload.updatedAt));
  await writeFile(path.join(output, "themes.json"), JSON.stringify(payload, null, 2));
  return payload;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const output = path.resolve(process.argv[2] || "public");
  const { themes, updatedAt } = await buildSite(output);
  console.log(`Built ${output} from ${themes.length} themes collected ${updatedAt}.`);
}
