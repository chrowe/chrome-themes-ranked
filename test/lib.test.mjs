import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNumber, pageHtml, parseRatingSnapshot, themeId, uniqueThemes } from "../scripts/lib.mjs";

test("normalizes compact and grouped rating counts", () => {
  assert.equal(normalizeNumber("1.2K"), 1200);
  assert.equal(normalizeNumber("12,345"), 12345);
  assert.equal(normalizeNumber("not available"), null);
});

test("recognizes and deduplicates Chrome Web Store detail links", () => {
  const id = "abcdefghijklmnopabcdefghijklmnop";
  assert.equal(themeId(`/detail/blue/${id}`), id);
  assert.deepEqual(uniqueThemes([{ url: `/detail/blue/${id}`, name: "Blue" }, { url: `/detail/blue/${id}`, name: "Duplicate" }]), [{ id, name: "Blue", url: `https://chromewebstore.google.com/detail/theme/${id}` }]);
});

test("prefers structured rating data", () => {
  const result = parseRatingSnapshot({ heading: "Fallback", text: "4.2 stars 88 ratings", ratingLabels: [], image: "", jsonLd: [JSON.stringify({ name: "Midnight", aggregateRating: { ratingValue: "4.8", ratingCount: "2,410" }, author: { name: "Ada" } })] });
  assert.deepEqual(result, { name: "Midnight", rating: 4.8, ratingCount: 2410, userCount: null, image: "", author: "Ada" });
});

test("reads the install count from the listing text", () => {
  const snapshot = (text) => parseRatingSnapshot({ heading: "T", text, ratingLabels: [], image: "", jsonLd: [] }).userCount;
  assert.equal(snapshot("Theme\nDark & Black\n500,000 users\nAdd to Chrome"), 500_000);
  assert.equal(snapshot("10,000+ users"), 10_000);
  assert.equal(snapshot("1.4K users"), 1_400);
  assert.equal(snapshot("no install count here"), null);
});

test("renders a filter control for every sortable column", () => {
  const html = pageHtml("2026-09-22T00:00:00.000Z");
  for (const id of ["search", "filter-rating", "filter-count", "filter-users", "sort", "reset"]) {
    assert.ok(html.includes(`id="${id}"`), `missing control #${id}`);
  }
});
