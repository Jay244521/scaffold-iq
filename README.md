# Scaffold-IQ — Deploy to Vercel

## Project Structure
```
scaffold-iq/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx       ← Full MVP (student + teacher)
│   └── index.js      ← React entry point
├── package.json
├── vercel.json
└── .gitignore
```

## Deploy in 5 Steps

### Step 1 — Create GitHub Repo
1. Go to github.com → New repository
2. Name it `scaffold-iq`
3. Set to Public
4. Click "Create repository"

### Step 2 — Upload Files
In your new repo, upload ALL files from this folder maintaining the same structure:
- Drag and drop the entire folder OR use GitHub Desktop

### Step 3 — Connect to Vercel
1. Go to vercel.com → Sign up free with GitHub
2. Click "Add New Project"
3. Import your `scaffold-iq` GitHub repo
4. Vercel auto-detects Create React App — click Deploy

### Step 4 — Add API Key
1. In Vercel dashboard → Your project → Settings → Environment Variables
2. Add: `REACT_APP_ANTHROPIC_KEY` = your Anthropic API key
3. Redeploy

### Step 5 — Custom Domain (Optional)
1. Vercel gives you: `scaffold-iq.vercel.app` for free
2. If you own scaffold-iq.com → Settings → Domains → Add domain

## Your Live Links
- **Main app**: https://scaffold-iq.vercel.app
- **Student portal**: same link → click "I'm a Student"
- **Teacher dashboard**: same link → click "I'm a Teacher"

## Notes
- All session data saves to browser localStorage (no database needed yet)
- AI calls use Anthropic Claude API (free credits on signup)
- Zero monthly cost on Vercel free tier

---

# Wonderbloom Academy — PDF Product Pipeline

A self-contained content pipeline, living alongside the Scaffold-IQ app in this
same repository, that compiles print-ready PDF storybooks, activity packs, and
workbooks for the **Wonderbloom Academy** early-childhood IP (Benny, Luna,
Zippy & Professor Ollo).

## Directory layout

```
assets/
  vectors/        SVGs — character page frames, borders, badges, dividers
  brand/           brand-tokens.json + generated tokens.css / tokens.scss
templates/
  partials/        shared print stylesheet + header/footer Handlebars partials
  activity-sheets/ worksheet, SEL prompt, tracing sheet, maze layouts
  storybooks/      story page layout (illustration + text flow)
  covers/          front cover, back cover, certificate of completion
src/
  manifest.json    product catalog — SKUs, pricing, page sequences & content
  generator/
    renderTemplate.js  Handlebars setup, helpers (svg, characterColor, times…)
    build.js            CLI: reads manifest.json → renders pages → PDF via Playwright
output/            generated PDFs land here (git-ignored; rebuild any time)
```

## How a PDF gets built

1. `src/manifest.json` lists each **product** (SKU) as an ordered array of
   **pages**, where every page names a template (e.g. `"covers/front-cover"`)
   and the data to inject into it.
2. `build.js` renders each page's `.hbs` template with Handlebars, wraps the
   whole product in one HTML document (brand tokens CSS + print stylesheet
   inlined, `@page` size set per format), and hands it to a headless Chromium
   instance (via `playwright-core`) for `page.pdf()`.
3. Every `.wb-page` section is a fixed 8.5in × 11in (or 210mm × 297mm for A4)
   block with `page-break-after: always` and a `0.375in` safe-content inset
   inside the `0.25in` trim margin, so nothing gets clipped at the edge and no
   heading/box/row splits mid-page (`.wb-no-split` / `break-inside: avoid`).

## Build the PDFs

```bash
npm install                # installs playwright-core + handlebars, one-time
npm run build:pdfs         # builds every product in manifest.json, both formats
npm run build:pdfs -- WB-SKU01        # build a single SKU
npm run build:pdfs -- WB-SKU01 WB-SKU03
```

This environment ships with a pre-installed Chromium the script points to
automatically (`/opt/pw-browsers/chromium`). On another machine, install a
browser once with `npx playwright install chromium` and either let Playwright
find it automatically or set `WB_CHROMIUM_PATH=/path/to/chromium`.

Output lands in `output/`, one `<sku>.pdf` (US Letter) and `<sku>-a4.pdf` (A4)
per product, plus `output/build-summary.json` listing every file, page count,
and size from the last run.

## Current catalog (sample build)

| SKU | Product | Pages | Price |
|---|---|---|---|
| WB-SKU01 | Wonderbloom Academy Episode 1 Storybook — *Luna and the Whispering Garden* | 11 | $6.99 |
| WB-SKU02 | Benny & Luna's SEL & Feelings Tracing Pack | 12 | $4.99 |
| WB-SKU03 | Professor Ollo's Problem-Solving Activity Workbook | 10 | $5.99 |

## Adding a new product

1. Add vector art for any new character/motif to `assets/vectors/`.
2. If it needs a new page layout, add a `.hbs` file under `templates/` — reuse
   the `page-header` / `page-footer` partials and the CSS classes in
   `templates/partials/print-base.css` (`.wb-page`, `.wb-main`,
   `.wb-no-split`, `.wb-icon`, `.wb-divider`, …) to stay print-safe.
3. Append a new product object to `src/manifest.json` — give it a `sku`,
   `outputFile`, and a `pages` array of `{ template, data }` entries.
4. Run `npm run build:pdfs -- <your-new-sku>` and check `output/`.

## Adjusting brand styling

Edit `assets/brand/brand-tokens.json` (source of truth), then mirror the
values into `assets/brand/tokens.css` and `tokens.scss` — both are plain
generated files, not build-tooled, so keep the three in sync by hand.
Templates consume the CSS custom properties (`var(--wb-color-purple)`, etc.),
so a token edit reflows through every page on the next build.

## Print production notes

- Playwright/Chromium's `page.pdf()` exports sRGB PDFs, which is what most
  print-on-demand vendors (and all screen/e-book use) expect. For offset
  printing that requires true CMYK, convert the RGB PDF with your print
  vendor's preferred tool (e.g. Ghostscript with a CMYK ICC profile) —
  `assets/brand/brand-tokens.json` includes `color.print` CMYK approximations
  of the core palette for that conversion step.
- `templates/activity-sheets/maze-layout.hbs` draws a grid with placed
  obstacles for a hand-designed maze feel; it isn't a solvable-maze generator.
  Swap in real maze-generation logic in `build.js`/manifest data if you need
  guaranteed-solvable mazes at scale.
