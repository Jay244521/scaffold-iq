#!/usr/bin/env node
'use strict';

/**
 * Wonderbloom Academy PDF build pipeline.
 *
 * Reads src/manifest.json, injects each product's page data into its
 * Handlebars template, and compiles a print-ready PDF per product/format
 * into output/ using a Chromium instance driven by Playwright.
 *
 * Usage:
 *   npm run build:pdfs                 # build every product, every format
 *   npm run build:pdfs -- WB-SKU01     # build a single SKU
 *   npm run build:pdfs -- WB-SKU01 WB-SKU02
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { renderPage } = require('./renderTemplate');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(ROOT, 'output');
const MANIFEST_PATH = path.join(ROOT, 'src', 'manifest.json');

// Pre-installed Chromium in this environment (see repo README for local setup).
const CHROMIUM_EXECUTABLE =
  process.env.WB_CHROMIUM_PATH ||
  (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function loadManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  return JSON.parse(raw);
}

/** Assembles the full standalone HTML document for one product in one format. */
function buildDocumentHtml(manifest, product, format) {
  const tokensCss = readFile('assets/brand/tokens.css');
  const printCss = readFile('templates/partials/print-base.css');

  const sharedDefaults = {
    website: manifest.brand.website,
    year: new Date().getFullYear(),
    pageCount: product.pages.length,
  };

  const bodyHtml = product.pages
    .map((entry, index) => {
      const data = Object.assign({}, sharedDefaults, { pageNumber: index + 1 }, entry.data);
      let pageHtml = renderPage(entry.template, data);
      if (format === 'a4') {
        // Swap the base trim size for the A4 page-size variant.
        pageHtml = pageHtml.replace('class="wb-page"', 'class="wb-page wb-page--a4"');
      }
      return pageHtml;
    })
    .join('\n');

  const pageSizeOverride = `@page { size: ${format === 'a4' ? 'A4' : 'letter'}; margin: 0; }`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(product.title)}</title>
<style>${tokensCss}</style>
<style>${printCss}</style>
<style>${pageSizeOverride}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

async function renderPdf(browser, html, outFile) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: outFile,
      printBackground: true,
      preferCSSPageSize: true, // honors the @page size rule injected per format
      displayHeaderFooter: false,
      margin: { top: '0in', right: '0in', bottom: '0in', left: '0in' },
    });
  } finally {
    await page.close();
  }
}

async function buildProduct(browser, manifest, product) {
  const formats = product.formats && product.formats.length ? product.formats : manifest.buildDefaults.formats;
  const results = [];

  for (const format of formats) {
    const html = buildDocumentHtml(manifest, product, format);
    const suffix = format === 'a4' ? '-a4' : '';
    const outFile = path.join(OUTPUT_DIR, `${product.outputFile}${suffix}.pdf`);
    await renderPdf(browser, html, outFile);
    const stat = fs.statSync(outFile);
    results.push({
      sku: product.sku,
      title: product.title,
      format,
      file: outFile,
      pageCount: product.pages.length,
      sizeKb: Math.round(stat.size / 1024),
    });
  }

  return results;
}

async function main() {
  const skuFilter = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const manifest = loadManifest();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const products = skuFilter.length
    ? manifest.products.filter((p) => skuFilter.includes(p.sku))
    : manifest.products;

  if (!products.length) {
    console.error(`No products matched: ${skuFilter.join(', ')}`);
    console.error(`Available SKUs: ${manifest.products.map((p) => p.sku).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Wonderbloom Academy — building ${products.length} product(s)`);
  console.log(`Output directory: ${path.relative(ROOT, OUTPUT_DIR)}/\n`);

  const launchOptions = { headless: true };
  if (CHROMIUM_EXECUTABLE) launchOptions.executablePath = CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(launchOptions);

  const manifestSummary = [];
  try {
    for (const product of products) {
      console.log(`> ${product.sku} — "${product.title}" (${product.pages.length} pages)`);
      const results = await buildProduct(browser, manifest, product);
      for (const r of results) {
        console.log(`  built ${path.relative(ROOT, r.file)}  [${r.format}, ${r.sizeKb} KB]`);
      }
      manifestSummary.push(...results);
    }
  } finally {
    await browser.close();
  }

  const summaryPath = path.join(OUTPUT_DIR, 'build-summary.json');
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        products: manifestSummary.map((r) => ({
          sku: r.sku,
          title: r.title,
          format: r.format,
          file: path.basename(r.file),
          pageCount: r.pageCount,
          sizeKb: r.sizeKb,
        })),
      },
      null,
      2
    )
  );

  console.log(`\nDone — ${manifestSummary.length} PDF file(s) written.`);
  console.log(`Summary: ${path.relative(ROOT, summaryPath)}`);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exitCode = 1;
});
