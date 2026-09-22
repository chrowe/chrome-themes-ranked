#!/usr/bin/env node
import { chromium } from "playwright";
import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pageHtml, parseRatingSnapshot, uniqueThemes } from "./lib.mjs";

const categoryUrl = process.env.CATEGORY_URL || "https://chromewebstore.google.com/category/themes";
const output = path.resolve(process.argv[2] || "public");
const concurrency = Math.max(1, Number(process.env.CONCURRENCY) || 5);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MENU = "ul[role=menubar] li[role=menuitem]";
const DETAIL = 'a[href*="/detail/"]';
const maxPages = Math.max(0, Number(process.env.MAX_PAGES_PER_CATEGORY ?? 3));

const COLLECTION = 'a[href*="/collection/"]';

const collectionsOn = (page) => page.locator(COLLECTION).evaluateAll((anchors) =>
  [...new Set(anchors.map((anchor) => anchor.href.split(/[?#]/)[0]).filter((href) => href.includes("/collection/")))]);

const linksOn = (page) => page.locator(DETAIL).evaluateAll((anchors) => anchors.map((anchor) => ({
  url: anchor.href,
  slug: new URL(anchor.href).pathname.split("/")[2],
  name: anchor.getAttribute("aria-label") || anchor.querySelector("h2,h3")?.textContent || anchor.textContent || ""
})));

async function openCategory(page) {
  await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: /accept all/i }).click({ timeout: 2_000 }).catch(() => {});
  await page.waitForSelector(MENU, { timeout: 30_000 });
}

// The side menu entries are <li role="menuitem"> with no href, so the only way to
// learn each subcategory URL is to click the entry and read where it lands.
async function menuCategories(page) {
  await openCategory(page);
  const labels = (await page.locator(MENU).allInnerTexts()).map((label) => label.trim()).filter(Boolean);
  const categories = [];
  for (const label of labels) {
    await openCategory(page);
    await page.locator(MENU).filter({ hasText: label }).first().click().catch(() => {});
    await page.waitForFunction((base) => location.href !== base, categoryUrl, { timeout: 15_000 }).catch(() => {});
    const url = page.url();
    if (url !== categoryUrl && !categories.some((category) => category.url === url)) categories.push({ label, url });
  }
  return categories;
}

// Subcategory pages ignore scrolling; they grow only when "Load more" is clicked.
async function collectCategory(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Hub pages such as Artist Series list collections rather than themes, so a
  // missing grid here is normal and must not abort the sweep.
  await page.waitForSelector(DETAIL, { timeout: 15_000 }).catch(() => {});
  for (let round = 0; maxPages === 0 || round < maxPages; round++) {
    const more = page.getByRole("button", { name: /load more|show more|more results/i }).first();
    if (!(await more.isVisible().catch(() => false))) break;
    const before = await page.locator(DETAIL).count();
    await more.click().catch(() => {});
    const grew = await page
      .waitForFunction(([selector, count]) => document.querySelectorAll(selector).length > count, [DETAIL, before], { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!grew) break;
  }
  return { links: await linksOn(page), collections: await collectionsOn(page) };
}

async function discover(page) {
  const categories = await menuCategories(page);
  if (!categories.length) throw new Error("No side-menu categories were found; the store markup may have changed.");
  console.log(`Side menu: ${categories.map((category) => category.label).join(", ")}`);

  const links = [];
  const collections = new Set();
  const visited = new Set();

  const sweep = async (label, url) => {
    if (visited.has(url)) return;
    visited.add(url);
    const found = await collectCategory(page, url);
    links.push(...found.links);
    for (const collection of found.collections) collections.add(collection);
    console.log(`  ${label}: ${uniqueThemes(found.links).length} themes`);
  };

  await sweep("Themes (landing)", categoryUrl);
  for (const category of categories) await sweep(category.label, category.url);

  // Follow the collections those pages link to, one level deep.
  for (const url of [...collections]) {
    if (!visited.has(url)) await sweep(`↳ ${url.split("/collection/")[1]}`, url);
  }
  return uniqueThemes(links);
}

async function scrapeTheme(context, theme) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const page = await context.newPage();
    try {
      await page.goto(theme.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForSelector("h1", { timeout: 15_000 }).catch(() => {});
      const snapshot = await page.evaluate(() => ({
        heading: document.querySelector("h1")?.textContent?.trim() || "",
        text: document.body.innerText.slice(0, 30_000),
        ratingLabels: [...document.querySelectorAll("[aria-label]")].map((node) => node.getAttribute("aria-label")).filter((label) => /star|rating|review/i.test(label || "")),
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent || ""),
        image: document.querySelector('meta[property="og:image"]')?.content || ""
      }));
      return { ...theme, ...parseRatingSnapshot(snapshot), scrapedAt: new Date().toISOString() };
    } catch (error) {
      if (attempt === 3) return { ...theme, rating: null, ratingCount: null, error: error.message };
      await delay(attempt * 2_000);
    } finally {
      await page.close();
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === "1"
    });
    const category = await context.newPage();
    const themes = await discover(category);
    await category.close();
    if (!themes.length) throw new Error("No theme links were found; the store markup may have changed.");
    console.log(`Found ${themes.length} themes. Collecting ratings…`);
    const results = new Array(themes.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, themes.length) }, async () => {
      while (next < themes.length) {
        const index = next++;
        results[index] = await scrapeTheme(context, themes[index]);
        console.log(`[${index + 1}/${themes.length}] ${results[index].name}`);
      }
    }));
    const updatedAt = new Date().toISOString();
    await mkdir(output, { recursive: true });
    await cp(new URL("../site", import.meta.url), output, { recursive: true });
    await writeFile(path.join(output, "index.html"), pageHtml(updatedAt));
    await writeFile(path.join(output, "themes.json"), JSON.stringify({ updatedAt, source: categoryUrl, themes: results }, null, 2));
    console.log(`Wrote ${output}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
