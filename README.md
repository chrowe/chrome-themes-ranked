# Chrome themes, ranked

A scheduled scraper and zero-backend website that ranks every theme linked from the [Chrome Web Store themes category](https://chromewebstore.google.com/category/themes). The collector walks every category in the store's side menu, pages through each one, visits each theme, and extracts its average rating, rating count, and install count. The resulting static site can be searched and sorted.

## Run locally

Node.js 20 or newer is required.

```bash
npm install
npm run build          # render public/ from the saved data
npx http-server public
```

`npm run build` uses the dataset committed at `data/themes.json`, so the site
can be rebuilt in a second without touching the store. To refresh that dataset:

```bash
npx playwright install chromium
npm run scrape
```

`npm run scrape` writes `data/themes.json` and then rebuilds `public/`. The
`public/` directory is generated output and stays out of version control;
`data/themes.json` is the committed source of truth, so its history doubles as
a record of how theme ratings change over time.

The output directory can be supplied as the first argument (`node scripts/scrape.mjs dist`). Set `CONCURRENCY` to control simultaneous detail pages, or `CATEGORY_URL` to test against a fixture/server.

`MAX_PAGES_PER_CATEGORY` (default `3`) caps how many times the scraper clicks **Load more** in each side-menu category. Each click adds 32 themes, so the default collects up to 128 per category. Set it to `0` for no cap and the full catalogue — that is many thousands of detail pages and takes hours, so keep it bounded in CI.

For a development network that intercepts HTTPS with an untrusted certificate, `IGNORE_HTTPS_ERRORS=1` bypasses browser certificate validation; do not set it in GitHub Actions or on an untrusted network.

## Publish with GitHub Pages

The workflow in `.github/workflows/pages.yml` refreshes the data each Monday, commits any change to `data/themes.json` back to the branch, and deploys `public/`. It enables GitHub Pages automatically on its first run, so you can run **Refresh theme rankings** from the Actions tab without configuring a publishing branch. Pushing to `main` also publishes a fresh copy.

The scraper intentionally fails rather than deploying an empty page if the store stops returning recognizable theme links. Individual detail-page failures are retained in the output with an unavailable rating so that one bad listing cannot prevent an otherwise useful refresh.

This project is not affiliated with Google. Be considerate when changing concurrency or schedule frequency, and comply with the Chrome Web Store's applicable terms and policies.
