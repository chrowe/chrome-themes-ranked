const DETAIL_PATH = /\/detail\/[^/?#]+\/([a-p]{32})(?:[/?#]|$)/i;

export function normalizeNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const text = String(value).trim().toLowerCase().replaceAll(",", "");
  const match = text.match(/([\d.]+)\s*([kmb])?/);
  if (!match) return null;
  const multiplier = { k: 1e3, m: 1e6, b: 1e9 }[match[2]] ?? 1;
  const number = Number(match[1]) * multiplier;
  return Number.isFinite(number) ? Math.round(number) : null;
}

export function themeId(url) {
  return new URL(url, "https://chromewebstore.google.com").pathname.match(DETAIL_PATH)?.[1] ?? null;
}

export function uniqueThemes(items) {
  const themes = new Map();
  for (const item of items) {
    const id = themeId(item.url);
    if (!id) continue;
    const url = `https://chromewebstore.google.com/detail/${encodeURIComponent(item.slug || "theme")}/${id}`;
    const current = themes.get(id);
    if (!current || (!current.name && item.name)) themes.set(id, { id, name: item.name?.trim() || "", url });
  }
  return [...themes.values()];
}

export function parseRatingSnapshot(snapshot) {
  const json = snapshot.jsonLd.flatMap((value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  });
  const product = json.find((item) => item?.aggregateRating) ?? {};
  const aggregate = product.aggregateRating ?? {};
  const aria = snapshot.ratingLabels.join(" ");
  const text = `${aria} ${snapshot.text}`;
  const ratingMatch = text.match(/([0-5](?:\.\d+)?)\s*(?:out of\s*5|stars?)/i);
  const countMatch = text.match(/([\d,.]+\s*[kmb]?)\s+(?:ratings?|reviews?)/i);
  const userMatch = snapshot.text.match(/([\d,.]+\s*[kmb]?)\+?\s*users\b/i);
  const rating = Number(aggregate.ratingValue ?? ratingMatch?.[1]);
  return {
    name: product.name || snapshot.heading || "Untitled theme",
    rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
    ratingCount: normalizeNumber(aggregate.ratingCount ?? aggregate.reviewCount ?? countMatch?.[1]),
    userCount: normalizeNumber(aggregate.userInteractionCount ?? userMatch?.[1]),
    image: typeof product.image === "string" ? product.image : product.image?.url ?? snapshot.image ?? "",
    author: product.author?.name ?? (typeof product.author === "string" ? product.author : "")
  };
}

export function pageHtml(updatedAt) {
  const date = new Date(updatedAt).toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="A sortable ranking of themes from the Chrome Web Store.">
<title>Chrome themes, ranked</title><link rel="stylesheet" href="styles.css"></head>
<body><header><p class="eyebrow">CHROME WEB STORE</p><h1>Themes, ranked.</h1>
<p class="lede">A regularly refreshed, independent index of the themes listed in the Chrome Web Store.</p>
<div class="updated">Last collected <time datetime="${updatedAt}">${date} UTC</time></div></header>
<main><section class="toolbar" aria-label="Filter and sort the table">
<label>Theme <input id="search" type="search" placeholder="Find a theme…"></label>
<label>Rating <select id="filter-rating"><option value="">Any</option><option value="4.5">4.5 and up</option><option value="4">4.0 and up</option><option value="3.5">3.5 and up</option><option value="3">3.0 and up</option></select></label>
<label>Ratings <select id="filter-count"><option value="">Any</option><option value="10">10+</option><option value="100">100+</option><option value="1000">1K+</option><option value="10000">10K+</option></select></label>
<label>Users <select id="filter-users"><option value="">Any</option><option value="1000">1K+</option><option value="10000">10K+</option><option value="100000">100K+</option><option value="1000000">1M+</option></select></label>
<label>Sort <select id="sort"><option value="rating-desc">Rating: high to low</option><option value="users-desc">Most users</option><option value="count-desc">Most ratings</option><option value="name-asc">Name: A–Z</option></select></label>
<button id="reset" type="button" class="reset">Reset</button></section>
<p id="status" role="status">Loading themes…</p><div class="table-wrap"><table><thead><tr><th>#</th><th>Theme</th><th>Rating</th><th>Ratings</th><th>Users</th></tr></thead><tbody id="themes"></tbody></table></div>
<noscript>This page needs JavaScript to sort and filter the theme list.</noscript></main>
<footer>Data collected from the <a href="https://chromewebstore.google.com/category/themes">Chrome Web Store</a>. Not affiliated with Google.</footer>
<script type="module" src="app.js"></script></body></html>`;
}
