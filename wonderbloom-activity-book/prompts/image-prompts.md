# Wonderbloom Academy — AI Image Generation Prompts

Every prompt targets **clean, thick black-line vector art on a pure white
background** — no shading, no gradients, no gray fills, no color — so pages
print crisply and hold up to a child's crayon or marker. Use these prompts
in Midjourney v6/v7 or DALL·E 3, then trace/vectorize in Illustrator or
Recraft if you need a perfectly clean vector outline for KDP interior
upload. Each prompt corresponds 1:1 to the `AI prompt ref` label baked into
the matching page in `pages/`.

## Global style block (append to every prompt)

```
black and white coloring book page, bold clean line art, thick uniform
outlines 3-5pt, no shading, no grayscale, no crosshatching, no color,
pure white background, high contrast, simple rounded child-friendly
shapes, large open areas for coloring, vector illustration style,
centered composition, no text, no watermark, no signature
--style raw --stylize 100 --no color, shading, grayscale, text, watermark
```

## Character model sheet (generate first, reuse for consistency)

**REF-CHAR: Wonderbloom Academy character lineup**
```
character reference sheet, four children's-book mascot characters
standing in a row: (1) BENNY — curious boy scientist, round safety
goggles pushed up on messy hair, lab coat, holding a gadget with
antennae; (2) LUNA — nature-loving girl with flower in braided hair,
overalls, cupping a small bird in her hands, a vine curling nearby;
(3) ZIPPY — high-energy superhero kid, short cape, lightning-bolt
emblem on chest, mid-running pose, sneakers with speed lines;
(4) PROFESSOR OLLO — a wise owl mentor wearing big round glasses and
a tiny graduation cap, perched upright, one wing raised as if teaching;
[GLOBAL STYLE BLOCK]
```

---

### P02 — Meet the Crew (4 individual portraits, one per quadrant)

- **P02-Benny**: `Benny the boy scientist, three-quarter view portrait, round safety goggles on forehead, lab coat with one big pocket, holding a bubbling flask, big friendly smile; [GLOBAL STYLE BLOCK]`
- **P02-Luna**: `Luna the nature-loving girl, three-quarter view portrait, flower tucked behind ear, a butterfly landing on her outstretched finger, gentle smile; [GLOBAL STYLE BLOCK]`
- **P02-Zippy**: `Zippy the superhero kid, three-quarter view portrait, short cape flowing, lightning-bolt emblem on chest, confident grin, fists on hips; [GLOBAL STYLE BLOCK]`
- **P02-Ollo**: `Professor Ollo the owl mentor, three-quarter view portrait, big round glasses, tiny graduation cap, one wing raised in a friendly wave; [GLOBAL STYLE BLOCK]`

### P06 — Professor Ollo's Library (full-bleed hero page)

```
Professor Ollo the wise owl standing on a tall library ladder, tall
bookshelves packed with books stretching up on both sides, a stack of
books beside him on the floor, an open book with a lightbulb-shaped
sparkle rising from the pages, full-page scene filling the entire
frame edge-to-edge, plenty of open background areas for coloring;
[GLOBAL STYLE BLOCK]
```

### P09 — Benny's Bubble Experiment (full-bleed hero page)

```
Benny the boy scientist at a lab table crowded with beakers and test
tubes, big bubbles of different sizes floating up and popping, safety
goggles down over his eyes, one hand pouring liquid from a flask,
excited open-mouth smile, full-page scene filling the entire frame
edge-to-edge; [GLOBAL STYLE BLOCK]
```

### P11 — Luna & the Magic Tree (full-bleed hero page)

```
Luna hugging a giant whimsical tree with a friendly swirl-patterned
trunk and heart-shaped leaves, small woodland animals (a rabbit, a
bird, a squirrel) peeking out from between the roots, sparkle motifs
drifting in the air, full-page scene filling the entire frame
edge-to-edge; [GLOBAL STYLE BLOCK]
```

### P12 — Spot the Differences: Zippy on the Playground Slide (2 scenes)

- **P12-Zippy-Slide-A** (base scene):
```
Zippy the superhero kid sliding down a curvy playground slide, cape
flying behind him, two clouds in the sky, a simple playground fence in
the background, full scene filling the frame; [GLOBAL STYLE BLOCK]
```
- **P12-Zippy-Slide-B** (same scene, redrawn with exactly the 5 changes listed in the production notes printed on the page: cape color/pattern swapped, one extra cloud, a bird added on the slide, the slide's stripe pattern reversed, and Zippy's shoe color changed):
```
Same composition as reference image P12-Zippy-Slide-A, Zippy sliding
down the same curvy playground slide with cape flying, but: add a
third cloud, add a small bird sitting on the top of the slide, reverse
the direction of the slide's diagonal stripe pattern, and draw Zippy's
shoes with a different simple pattern than the reference; [GLOBAL STYLE BLOCK]
```

### P13 — Zippy's Energy Dash (full-bleed hero page)

```
Zippy the superhero kid dynamically leaping across a path of round
stepping stones over a small stream, cape whipping upward, motion
lines trailing behind his sneakers, tiny lightning-bolt sparkles in
the air, full-page scene filling the entire frame edge-to-edge;
[GLOBAL STYLE BLOCK]
```

### P16 — Wonderbloom Academy Picnic (full-bleed hero page, all 4 characters)

```
Benny, Luna, Zippy, and Professor Ollo sitting together around a
checkered picnic blanket under a big shade tree, sharing a picnic
basket, sandwiches, and a plate of cookies, everyone laughing
together, full-page scene filling the entire frame edge-to-edge;
[GLOBAL STYLE BLOCK]
```

### P19 — Friendship Farewell (full-bleed hero page)

```
Benny, Luna, Zippy, and Professor Ollo standing in a row waving
goodbye toward the viewer, school building visible in the soft
background, warm happy expressions, full-page scene filling the
entire frame edge-to-edge; [GLOBAL STYLE BLOCK]
```

---

## Non-hero pages that also benefit from AI-assisted line art

These pages are built as programmatic SVG (puzzles/diagrams need exact,
mechanically-verified geometry — see `pages/`), but you can re-skin the
small icons using the same AI-art style for a more organic hand-drawn
feel. If you do, regenerate at small size and vectorize/trace before
placing, so line weight stays a true 3-5pt at print resolution:

- **P01 badge frame ring**: `simple circular badge frame, blank center, laurel leaf border, [GLOBAL STYLE BLOCK]`
- **P03 maze end icon**: `small friendly robot helper, round body, two eyes, antenna, [GLOBAL STYLE BLOCK]`
- **P04 garden icons**: `simple sunflower / watering can / butterfly icon, single object centered, [GLOBAL STYLE BLOCK]`
- **P15 Ollo badge**: `owl-face badge icon divided into 4 flat regions (outer ring, two glasses circles, beak, ribbon banner), [GLOBAL STYLE BLOCK]`
- **P18 blank badge**: `blank heraldic shield outline with decorative border, empty center, [GLOBAL STYLE BLOCK]`
- **P20 medal**: `five-point star medal with two ribbon tails hanging below, [GLOBAL STYLE BLOCK]`

## Production checklist per illustration

1. Generate at the largest available size (Midjourney: `--ar 17:22` to match the 8.5x11in trim; DALL·E 3: request the tallest portrait size and crop).
2. Increase contrast / threshold to pure black-and-white (no gray anti-aliasing) before placing in the layout.
3. Vectorize (Illustrator Image Trace → "Black and White Logo", or Recraft/Vectorizer.ai) so line weight stays crisp at 300 DPI.
4. Export as PNG (transparent background) or SVG at 300 DPI and drop into the matching `art-placeholder` frame in `pages/page-XX-*.html` — the frame's exact pixel/inch box is already sized to the safe area.
5. Re-check that no line art element sits inside the 0.5in safe margin or the 0.125in bleed strip once placed.
