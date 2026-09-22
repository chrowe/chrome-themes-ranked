# Chrome themes, ranked

A scheduled scraper and zero-backend website that ranks every theme linked from the [Chrome Web Store themes category](https://chromewebstore.google.com/category/themes). The collector opens the category, scrolls until no new results appear, visits each theme, and extracts its average rating and rating count. The resulting static site can be searched and sorted.

## Run locally

Node.js 20 or newer is required.

```bash
npm install
npx playwright install chromium
npm run scrape
npx http-server public
```

The output directory can be supplied as the first argument (`node scripts/scrape.mjs dist`). Set `CONCURRENCY` to control simultaneous detail pages, or `CATEGORY_URL` to test against a fixture/server.

## Publish with GitHub Pages

The workflow in `.github/workflows/pages.yml` refreshes the data each Monday and deploys `public/`. In the repository's **Settings → Pages**, select **GitHub Actions** as the source, then run **Refresh theme rankings** from the Actions tab. Pushing to `main` also publishes a fresh copy.

The scraper intentionally fails rather than deploying an empty page if the store stops returning recognizable theme links. Individual detail-page failures are retained in the output with an unavailable rating so that one bad listing cannot prevent an otherwise useful refresh.

This project is not affiliated with Google. Be considerate when changing concurrency or schedule frequency, and comply with the Chrome Web Store's applicable terms and policies.
