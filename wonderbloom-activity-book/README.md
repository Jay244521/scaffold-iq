# Wonderbloom Academy Coloring & Activity Book

A 20-page print-ready activity book generator for children ages 3-7,
starring Benny, Luna, Zippy, and Professor Ollo. This directory contains
the full asset pack requested in the project spec: AI image-generation
prompts, print-accurate HTML/SVG page layouts, and Etsy/TpT listing copy.

## What's here

```
wonderbloom-activity-book/
├── book.html                  ← all 20 pages combined, open in a browser and Print → Save as PDF
├── pages/                     ← each page as its own standalone HTML file
│   └── page-01-title-belongs-to.html ... page-20-official-certificate.html
├── shared/print.css           ← shared print stylesheet (fonts, trim/bleed/safe-area system)
├── prompts/image-prompts.md   ← Midjourney/DALL-E 3 prompts for every hero-art page
├── product-listing.md         ← Etsy/TpT description + search tags
├── generated/                 ← puzzle data (maze walls, word-search grid, dot-to-dot points) as JSON
└── scripts/
    ├── generate-puzzles.mjs   ← deterministically generates the maze / word search / connect-the-dots data
    └── build-book.mjs         ← renders that data + all 20 page layouts into pages/ and book.html
```

## Print specs implemented

- **Trim size**: 8.5 x 11in. **Bleed**: 0.125in. **Safe margin**: 0.5in from trim.
- Every page SVG uses a `viewBox="0 0 630 810"` where **1 SVG unit = 1pt = 1/72in**,
  so a `stroke-width` of 3-5 in the markup is a literal 3-5pt line as specified.
- Pure `#000` line art on `#FFFFFF` — no fills, no grayscale.
- Fonts: Fredoka (headlines) and Comic Neue (body/captions), loaded from Google Fonts in `shared/print.css`.
- Non-printing bleed/safe-area guide lines are drawn on every page; toggle them off from the toolbar in `book.html` (or add `class="hide-guides"` to `<body>`) before exporting your final print PDF.

## Puzzles are mechanically verified, not hand-guessed

Rather than eyeballing coordinates, `scripts/generate-puzzles.mjs` actually
computes:
- **Page 3 maze**: a 10x7 perfect maze (randomized DFS backtracker) with 11
  dead-end branches and one guaranteed solvable path from Benny to his robot helper.
- **Page 10 word search**: an 8x8 grid with `BENNY`, `LUNA`, `ZIPPY`, `OLLO`,
  `BOOM`, and `FLOWER` placed in random directions with verified non-conflicting overlaps.
- **Page 14 connect-the-dots**: 25 points sampled evenly along a true
  crescent-moon silhouette (two-circle boolean difference), numbered in order.

Re-run `node scripts/generate-puzzles.mjs && node scripts/build-book.mjs`
any time you want a fresh maze/word-search/dot-to-dot layout (edit the seed
values at the bottom of `generate-puzzles.mjs` to get different variants).

## What still needs a human/AI illustrator pass

Six pages are full-bleed character "hero art" scenes (Professor Ollo's
library, Benny's bubble experiment, Luna & the tree, Zippy's dash, the
academy picnic, and the farewell wave) plus the 4 crew portraits on page 2
and the 2 scenes on the spot-the-differences page. These can't be
pixel-perfect hand-drawn by this generator, so each one is laid out as a
dashed placeholder frame sized exactly to its safe area, labeled with the
matching prompt reference from `prompts/image-prompts.md`. Generate the
art, clean it up to pure black-and-white vector line art, and drop it into
the frame at 300 DPI.

## Rendering to a KDP-ready PDF

1. Open `book.html` in Chrome/Chromium.
2. Click "Toggle bleed/safe guides" to hide the non-printing guide lines.
3. Print → Destination: Save as PDF → Paper size: match the 8.75 x 11.25in
   artboard (or print at 100% scale, "no margins") → Save.
4. The resulting PDF's page size already includes the 0.125in bleed on all sides, matching KDP's bleed-cover interior requirements.
