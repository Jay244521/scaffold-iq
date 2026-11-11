// Builds the 20 print-ready page HTML files + the combined book.html from
// the JSON fixtures in generated/. Run `node scripts/generate-puzzles.mjs`
// first, then `node scripts/build-book.mjs`.
//
// Coordinate system: every page SVG uses viewBox "0 0 630 810" where 1 unit
// = 1pt = 1/72in. That makes the 630x810 box exactly the 8.75x11.25in bleed
// artboard (8.5x11in trim + 0.125in bleed each side), and it means an
// SVG stroke-width of 3-5 directly IS a 3-5pt line as the design brief
// requires. Safe area (0.5in inset from trim) = rect(45,45,540,720).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const gen = (name) => JSON.parse(readFileSync(path.join(ROOT, "generated", name), "utf8"));

const maze = gen("maze.json");
const wordSearch = gen("wordsearch.json");
const moonDots = gen("moon-dots.json");

const SAFE = { x: 45, y: 45, w: 540, h: 720 };

// ---------------------------------------------------------------------------
// Small reusable icon fragments (all pure black outline, stroke-width 4pt).
// ---------------------------------------------------------------------------
const STROKE = 4;

function star(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
  }
  return `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#000" stroke-width="${STROKE}" stroke-linejoin="round"/>`;
}

function leaf(cx, cy, w, h) {
  // Vesica-style leaf: two arcs meeting in points at top and bottom, with a center vein.
  return `<path d="M ${cx} ${cy - h / 2}
    Q ${cx + w / 2} ${cy - h / 4}, ${cx + w / 2} ${cy}
    Q ${cx + w / 2} ${cy + h / 4}, ${cx} ${cy + h / 2}
    Q ${cx - w / 2} ${cy + h / 4}, ${cx - w / 2} ${cy}
    Q ${cx - w / 2} ${cy - h / 4}, ${cx} ${cy - h / 2} Z"
    fill="none" stroke="#000" stroke-width="${STROKE}"/>
    <path d="M ${cx} ${cy - h / 2.4} Q ${cx} ${cy} ${cx} ${cy + h / 2.4}" fill="none" stroke="#000" stroke-width="2"/>`;
}

function flower(cx, cy, r) {
  let petals = "";
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 3) * i;
    const px = cx + r * Math.cos(ang);
    const py = cy + r * Math.sin(ang);
    petals += `<ellipse cx="${px}" cy="${py}" rx="${r * 0.65}" ry="${r * 0.4}" transform="rotate(${(ang * 180) / Math.PI} ${px} ${py})" fill="none" stroke="#000" stroke-width="${STROKE - 1}"/>`;
  }
  return `<g>${petals}<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="none" stroke="#000" stroke-width="${STROKE}"/>
    <line x1="${cx}" y1="${cy + r * 1.4}" x2="${cx}" y2="${cy + r * 3.2}" stroke="#000" stroke-width="${STROKE}"/></g>`;
}

function wateringCan(cx, cy, s) {
  return `<g stroke="#000" stroke-width="${STROKE - 1}" fill="none">
    <rect x="${cx - s}" y="${cy - s * 0.5}" width="${s * 1.6}" height="${s * 1.1}" rx="${s * 0.2}"/>
    <path d="M ${cx + s * 0.6} ${cy - s * 0.3} L ${cx + s * 1.8} ${cy - s * 1.1}"/>
    <circle cx="${cx + s * 1.9}" cy="${cy - s * 1.2}" r="${s * 0.22}"/>
    <path d="M ${cx - s * 0.3} ${cy - s * 0.5} L ${cx - s * 0.1} ${cy - s * 1.1} L ${cx + s * 0.5} ${cy - s * 1.1} L ${cx + s * 0.3} ${cy - s * 0.5}"/>
  </g>`;
}

function butterfly(cx, cy, s) {
  return `<g stroke="#000" stroke-width="${STROKE - 1}" fill="none">
    <ellipse cx="${cx - s * 0.55}" cy="${cy - s * 0.4}" rx="${s * 0.55}" ry="${s * 0.4}"/>
    <ellipse cx="${cx - s * 0.5}" cy="${cy + s * 0.35}" rx="${s * 0.4}" ry="${s * 0.3}"/>
    <ellipse cx="${cx + s * 0.55}" cy="${cy - s * 0.4}" rx="${s * 0.55}" ry="${s * 0.4}"/>
    <ellipse cx="${cx + s * 0.5}" cy="${cy + s * 0.35}" rx="${s * 0.4}" ry="${s * 0.3}"/>
    <line x1="${cx}" y1="${cy - s * 0.7}" x2="${cx}" y2="${cy + s * 0.7}" stroke-width="${STROKE}"/>
    <line x1="${cx}" y1="${cy - s * 0.7}" x2="${cx - s * 0.3}" y2="${cy - s}" stroke-width="2"/>
    <line x1="${cx}" y1="${cy - s * 0.7}" x2="${cx + s * 0.3}" y2="${cy - s}" stroke-width="2"/>
  </g>`;
}

function lightningBolt(cx, cy, s) {
  const p = [
    [cx + s * 0.15, cy - s], [cx - s * 0.55, cy + s * 0.15], [cx, cy + s * 0.15],
    [cx - s * 0.15, cy + s], [cx + s * 0.55, cy - s * 0.15], [cx, cy - s * 0.15],
  ];
  return `<polygon points="${p.map((q) => q.join(",")).join(" ")}" fill="none" stroke="#000" stroke-width="${STROKE}" stroke-linejoin="round"/>`;
}

function cloud(cx, cy, s) {
  return `<g fill="none" stroke="#000" stroke-width="${STROKE - 1}">
    <circle cx="${cx - s * 0.6}" cy="${cy}" r="${s * 0.5}"/>
    <circle cx="${cx}" cy="${cy - s * 0.3}" r="${s * 0.65}"/>
    <circle cx="${cx + s * 0.65}" cy="${cy}" r="${s * 0.5}"/>
    <rect x="${cx - s * 1.1}" y="${cy}" width="${s * 2.2}" height="${s * 0.55}" rx="${s * 0.27}"/>
  </g>`;
}

function schoolHouse(cx, cy, w, h) {
  return `<g fill="none" stroke="#000" stroke-width="${STROKE}">
    <rect x="${cx - w / 2}" y="${cy - h * 0.4}" width="${w}" height="${h * 0.9}"/>
    <polygon points="${cx - w * 0.6},${cy - h * 0.4} ${cx},${cy - h} ${cx + w * 0.6},${cy - h * 0.4}"/>
    <rect x="${cx - w * 0.12}" y="${cy - h * 0.9}" width="${w * 0.14}" height="${h * 0.22}"/>
    <line x1="${cx - w * 0.05}" y1="${cy - h * 0.98}" x2="${cx + w * 0.22}" y2="${cy - h * 0.92}" stroke-width="3"/>
    <rect x="${cx - w * 0.08}" y="${cy + h * 0.1}" width="${w * 0.16}" height="${h * 0.4}"/>
    <rect x="${cx - w * 0.38}" y="${cy - h * 0.2}" width="${w * 0.18}" height="${h * 0.18}"/>
    <rect x="${cx + w * 0.2}" y="${cy - h * 0.2}" width="${w * 0.18}" height="${h * 0.18}"/>
  </g>`;
}

function goggles(cx, cy, s) {
  return `<g fill="none" stroke="#000" stroke-width="${STROKE - 1}">
    <circle cx="${cx - s}" cy="${cy}" r="${s * 0.6}"/>
    <circle cx="${cx + s}" cy="${cy}" r="${s * 0.6}"/>
    <line x1="${cx - s * 0.4}" y1="${cy}" x2="${cx + s * 0.4}" y2="${cy}"/>
  </g>`;
}

function robotIcon(cx, cy, s) {
  return `<g fill="none" stroke="#000" stroke-width="${STROKE - 1}">
    <rect x="${cx - s * 0.6}" y="${cy - s * 0.4}" width="${s * 1.2}" height="${s}" rx="${s * 0.15}"/>
    <circle cx="${cx - s * 0.25}" cy="${cy}" r="${s * 0.12}"/>
    <circle cx="${cx + s * 0.25}" cy="${cy}" r="${s * 0.12}"/>
    <line x1="${cx}" y1="${cy - s * 0.4}" x2="${cx}" y2="${cy - s * 0.7}"/>
    <circle cx="${cx}" cy="${cy - s * 0.8}" r="${s * 0.1}"/>
    <rect x="${cx - s * 0.8}" y="${cy + s * 0.6}" width="${s * 1.6}" height="${s * 0.35}" rx="${s * 0.1}"/>
  </g>`;
}

function ribbonMedal(cx, cy, r) {
  return `<g fill="none" stroke="#000" stroke-width="${STROKE}">
    <polygon points="${cx - r * 0.5},${cy + r * 0.85} ${cx - r * 0.15},${cy + r * 2.1} ${cx},${cy + r * 1.55} ${cx + r * 0.15},${cy + r * 2.1} ${cx + r * 0.5},${cy + r * 0.85}"/>
    ${star(cx, cy, r)}
  </g>`;
}

function decorativeBorder(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="none" stroke="#000" stroke-width="5"/>
    <rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="12" fill="none" stroke="#000" stroke-width="1.5"/>`;
}

function artPlaceholder(x, y, w, h, title, promptRef) {
  return `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="art-placeholder" style="position:static;width:100%;height:100%;">
      <div><b>${title}</b>Full-bleed line-art illustration<span class="ref">AI prompt ref: ${promptRef} — see prompts/image-prompts.md<br/>Export at 300 DPI, pure #000 line art on #FFFFFF, place to fill this frame edge-to-edge.</span></div>
    </div>
  </foreignObject>`;
}

function guides() {
  return `<g class="guide">
    <rect x="9" y="9" width="612" height="792" fill="none" stroke="#ff2fd0" stroke-width="1" stroke-dasharray="4 3"/>
    <rect x="${SAFE.x}" y="${SAFE.y}" width="${SAFE.w}" height="${SAFE.h}" fill="none" stroke="#00b3ff" stroke-width="1" stroke-dasharray="4 3"/>
  </g>`;
}

function title(text, y = 90, size = 28) {
  return `<text x="315" y="${y}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${size}" fill="#000">${text}</text>`;
}

function caption(text, x, y, size = 13, anchor = "middle") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Comic Neue, sans-serif" font-weight="700" font-size="${size}" fill="#000">${text}</text>`;
}

function pageWrap(n, inner) {
  return `<section class="page" id="p${String(n).padStart(2, "0")}">
  <svg class="page-art" viewBox="0 0 630 810" xmlns="http://www.w3.org/2000/svg">
    ${decorativeBorder(SAFE.x, SAFE.y, SAFE.w, SAFE.h)}
    ${inner}
    ${guides()}
  </svg>
  <div class="page-number">${n}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// PAGE 1 — Title / "This Book Belongs To"
// ---------------------------------------------------------------------------
function page01() {
  const inner = `
    ${title("WONDERBLOOM ACADEMY", 140, 34)}
    ${caption("Coloring &amp; Activity Book", 315, 175, 18)}
    ${lightningBolt(80, 75, 20)}${star(550, 75, 20)}${leaf(120, 220, 40, 60)}${star(510, 220, 18)}
    <rect x="120" y="300" width="390" height="150" rx="16" fill="none" stroke="#000" stroke-width="5"/>
    ${caption("This Book Belongs To:", 315, 340, 17)}
    <line x1="150" y1="410" x2="480" y2="410" stroke="#000" stroke-width="3"/>
    ${caption("(write your name above!)", 315, 432, 11)}
    <circle cx="315" cy="590" r="90" fill="none" stroke="#000" stroke-width="5" stroke-dasharray="6 6"/>
    ${caption("PASTE YOUR", 315, 580, 12)}
    ${caption("CHARACTER BADGE", 315, 598, 12)}
    ${caption("HERE", 315, 616, 12)}
    ${caption("Meet Benny, Luna, Zippy &amp; Professor Ollo inside!", 315, 730, 12)}
  `;
  return pageWrap(1, inner);
}

// ---------------------------------------------------------------------------
// PAGE 2 — Meet the Crew (4 quadrants)
// ---------------------------------------------------------------------------
function page02() {
  const crew = [
    { name: "BENNY", blurb: "The curious boy scientist with safety goggles &amp; cool gadgets.", ref: "P02-Benny" },
    { name: "LUNA", blurb: "A nature lover who talks to plants and animals.", ref: "P02-Luna" },
    { name: "ZIPPY", blurb: "A high-energy superhero kid, fast as lightning!", ref: "P02-Zippy" },
    { name: "PROFESSOR OLLO", blurb: "The wise owl mentor with big round glasses.", ref: "P02-Ollo" },
  ];
  const qx = [65, 335], qy = [130, 430];
  const qw = 230, qh = 260;
  let quads = "";
  crew.forEach((c, i) => {
    const x = qx[i % 2], y = qy[Math.floor(i / 2)];
    quads += `
      ${artPlaceholder(x, y, qw, qh - 55, c.name + " portrait", c.ref)}
      <rect x="${x}" y="${y}" width="${qw}" height="${qh - 55}" fill="none" stroke="#000" stroke-width="4"/>
      <text x="${x + qw / 2}" y="${y + qh - 32}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="17">${c.name}</text>
      <foreignObject x="${x}" y="${y + qh - 26}" width="${qw}" height="60">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Comic Neue',sans-serif;font-size:10.5pt;text-align:center;line-height:1.25;">${c.blurb}</div>
      </foreignObject>`;
  });
  const inner = `${title("MEET THE CREW", 95, 26)}${quads}`;
  return pageWrap(2, inner);
}

// ---------------------------------------------------------------------------
// PAGE 3 — Benny's Lab Maze
// ---------------------------------------------------------------------------
function page03() {
  const cell = 48;
  const mw = maze.cols * cell, mh = maze.rows * cell;
  const ox = 315 - mw / 2, oy = 200;
  let walls = "";
  for (const [x1, y1, x2, y2] of maze.segments) {
    walls += `<line x1="${ox + x1 * cell}" y1="${oy + y1 * cell}" x2="${ox + x2 * cell}" y2="${oy + y2 * cell}" stroke="#000" stroke-width="4" stroke-linecap="round"/>`;
  }
  const sx = ox + (maze.start.x + 0.5) * cell, sy = oy + (maze.start.y + 0.5) * cell;
  const ex = ox + (maze.end.x + 0.5) * cell, ey = oy + (maze.end.y + 0.5) * cell;
  const inner = `
    ${title("BENNY'S LAB MAZE", 100, 26)}
    ${caption("Help Benny reach his robot helper! (10 tricky dead ends inside)", 315, 130, 12)}
    ${walls}
    ${goggles(sx, sy, 10)}
    ${robotIcon(ex, ey, 16)}
    ${caption("START", sx, oy + mh + 30, 13)}
    ${caption("FINISH", ex, oy + mh + 30, 13)}
  `;
  return pageWrap(3, inner);
}

// ---------------------------------------------------------------------------
// PAGE 4 — Luna's Counting Garden
// ---------------------------------------------------------------------------
function page04() {
  let flowers = "", cans = "", flies = "";
  for (let i = 0; i < 5; i++) flowers += flower(90 + i * 90, 210, 24);
  for (let i = 0; i < 3; i++) cans += wateringCan(140 + i * 140, 340, 26);
  for (let i = 0; i < 8; i++) flies += butterfly(75 + i * 55, 460, 20);

  let tracing = "";
  for (let n = 1; n <= 10; n++) {
    const col = (n - 1) % 5, row = Math.floor((n - 1) / 5);
    const x = 100 + col * 90, y = 590 + row * 70;
    tracing += `<rect x="${x - 30}" y="${y - 30}" width="60" height="60" fill="none" stroke="#000" stroke-width="2"/>
      <text x="${x}" y="${y + 15}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="36" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="3 3">${n}</text>`;
  }

  const inner = `
    ${title("LUNA'S COUNTING GARDEN", 95, 24)}
    ${caption("Count &amp; color: 5 sunflowers", 315, 165, 13)}
    ${flowers}
    ${caption("3 watering cans", 315, 300, 13)}
    ${cans}
    ${caption("8 butterflies", 315, 420, 13)}
    ${flies}
    ${caption("Trace the numbers 1-10!", 315, 555, 13)}
    ${tracing}
  `;
  return pageWrap(4, inner);
}

// ---------------------------------------------------------------------------
// PAGE 5 — Zippy's Speed Lines (5 tracing paths)
// ---------------------------------------------------------------------------
function tracePath(y, d) {
  return `<path d="${d}" fill="none" stroke="#000" stroke-width="3.5" stroke-dasharray="9 8" stroke-linecap="round"/>`;
}
function page05() {
  const x0 = 100, x1 = 530;
  const rows = [
    { y: 210, label: "Straight Dash", d: (y) => `M ${x0} ${y} L ${x1} ${y}` },
    { y: 315, label: "Zigzag", d: (y) => {
        let d = `M ${x0} ${y}`;
        for (let i = 1; i <= 8; i++) d += ` L ${x0 + i * ((x1 - x0) / 8)} ${y + (i % 2 === 0 ? 25 : -25)}`;
        return d;
      } },
    { y: 420, label: "Wave", d: (y) => {
        let d = `M ${x0} ${y}`;
        for (let i = 1; i <= 6; i++) {
          const cx = x0 + (i - 0.5) * ((x1 - x0) / 6);
          const nx = x0 + i * ((x1 - x0) / 6);
          d += ` Q ${cx} ${y + (i % 2 === 0 ? 30 : -30)}, ${nx} ${y}`;
        }
        return d;
      } },
    { y: 525, label: "Loop-de-Loop", d: (y) => {
        let d = `M ${x0} ${y}`;
        const n = 4, step = (x1 - x0) / n;
        for (let i = 0; i < n; i++) {
          const cx = x0 + step * i + step / 2;
          d += ` A ${step / 2} 32 0 1 1 ${cx + step / 2} ${y}`;
        }
        return d;
      } },
    { y: 640, label: "Curvy S-Curve", d: (y) => {
        let d = `M ${x0} ${y}`;
        for (let i = 1; i <= 4; i++) {
          const nx = x0 + i * ((x1 - x0) / 4);
          d += ` S ${nx - 40} ${y + (i % 2 === 0 ? 40 : -40)}, ${nx} ${y}`;
        }
        return d;
      } },
  ];
  let paths = "";
  for (const r of rows) {
    paths += `${lightningBolt(x0 - 25, r.y, 14)}${tracePath(r.y, r.d(r.y))}${star(x1 + 25, r.y, 12)}
      ${caption(r.label, 315, r.y - 40, 13)}`;
  }
  const inner = `${title("ZIPPY'S SPEED LINES", 100, 26)}${caption("Trace each path from the bolt to the star as fast as Zippy!", 315, 135, 12)}${paths}`;
  return pageWrap(5, inner);
}

// ---------------------------------------------------------------------------
// PAGE 6 — Professor Ollo's Library (hero art)
// ---------------------------------------------------------------------------
function heroPage(n, headline, ref) {
  const inner = `
    ${title(headline, 95, 24)}
    ${artPlaceholder(SAFE.x + 20, 130, SAFE.w - 40, SAFE.h - 190, headline, ref)}
  `;
  return pageWrap(n, inner);
}
function page06() { return heroPage(6, "PROFESSOR OLLO'S LIBRARY", "P06-Ollo-Library"); }

// ---------------------------------------------------------------------------
// PAGES 7 & 8 — Alphabet Match (leaves)
// ---------------------------------------------------------------------------
function shuffle(arr, seedStart) {
  let seed = seedStart;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function alphabetPage(n, letters, seed, headline) {
  const rows = letters.length;
  const startY = 175, endY = 745;
  const rowH = (endY - startY) / (rows - 1);
  const leftX = SAFE.x + 90, rightX = SAFE.x + SAFE.w - 90;
  const lowerShuffled = shuffle(letters.map((l) => l.toLowerCase()), seed);
  let content = "";
  letters.forEach((L, i) => {
    const y = startY + i * rowH;
    content += `${leaf(leftX, y, 62, 40)}
      <text x="${leftX}" y="${y + 7}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="20">${L}</text>
      ${leaf(rightX, y, 62, 40)}
      <text x="${rightX}" y="${y + 7}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="20">${lowerShuffled[i]}</text>`;
  });
  const inner = `${title(headline, 100, 24)}${caption("Draw a line from each capital letter to its lowercase match!", 315, 128, 11.5)}${content}`;
  return pageWrap(n, inner);
}
function page07() { return alphabetPage(7, "ABCDEFGHIJKLM".split(""), 7, "ALPHABET MATCH: A-M"); }
function page08() { return alphabetPage(8, "NOPQRSTUVWXYZ".split(""), 8, "ALPHABET MATCH: N-Z"); }

// ---------------------------------------------------------------------------
// PAGE 9 — Benny's Bubble Experiment (hero art)
// ---------------------------------------------------------------------------
function page09() { return heroPage(9, "BENNY'S BUBBLE EXPERIMENT", "P09-Benny-Bubbles"); }

// ---------------------------------------------------------------------------
// PAGE 10 — Word Search
// ---------------------------------------------------------------------------
function page10() {
  const cell = 46;
  const gw = wordSearch.size * cell;
  const ox = 315 - gw / 2, oy = 160;
  let cells = "";
  for (let y = 0; y < wordSearch.size; y++) {
    for (let x = 0; x < wordSearch.size; x++) {
      const cx = ox + x * cell, cy = oy + y * cell;
      cells += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="none" stroke="#000" stroke-width="2"/>
        <text x="${cx + cell / 2}" y="${cy + cell / 2 + 8}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="22">${wordSearch.grid[y][x]}</text>`;
    }
  }
  const words = wordSearch.placements.map((p) => p.word).sort();
  const wordList = words
    .map((w, i) => caption(w, ox + (i % 3) * (gw / 3) + gw / 6, oy + gw + 60 + Math.floor(i / 3) * 32, 15))
    .join("");
  const inner = `
    ${title("WORD SEARCH!", 100, 26)}
    ${caption("Find these Wonderbloom words:", 315, 130, 13)}
    ${cells}
    ${wordList}
  `;
  return pageWrap(10, inner);
}

// ---------------------------------------------------------------------------
// PAGE 11 — Luna & Magic Tree (hero art)
// ---------------------------------------------------------------------------
function page11() { return heroPage(11, "LUNA &amp; THE MAGIC TREE", "P11-Luna-Tree"); }

// ---------------------------------------------------------------------------
// PAGE 12 — Spot the 5 Differences
// ---------------------------------------------------------------------------
function page12() {
  const diffs = [
    "Zippy's cape is a different color in Scene B.",
    "Scene A has 2 clouds; Scene B has 3 clouds.",
    "A bird sits on the slide in Scene B only.",
    "The slide's stripe pattern is reversed in Scene B.",
    "Zippy's shoes are a different color in Scene B.",
  ];
  const w = (SAFE.w - 20) / 2;
  const inner = `
    ${title("SPOT THE 5 DIFFERENCES", 95, 22)}
    ${caption("Zippy on the Playground Slide", 315, 125, 12)}
    ${artPlaceholder(SAFE.x + 10, 140, w, 380, "Scene A", "P12-Zippy-Slide-A")}
    ${artPlaceholder(SAFE.x + 30 + w, 140, w, 380, "Scene B (redraw with 5 changes below)", "P12-Zippy-Slide-B")}
    <rect x="${SAFE.x + 10}" y="${SAFE.y + SAFE.h - 130}" width="${SAFE.w - 20}" height="130" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="5 4"/>
    <text x="${SAFE.x + 25}" y="${SAFE.y + SAFE.h - 108}" font-family="Comic Neue" font-weight="700" font-size="11">Illustrator / parent answer key (5 differences):</text>
    ${diffs.map((d, i) => `<text x="${SAFE.x + 25}" y="${SAFE.y + SAFE.h - 88 + i * 18}" font-family="Comic Neue" font-size="10">${i + 1}. ${d}</text>`).join("")}
  `;
  return pageWrap(12, inner);
}

// ---------------------------------------------------------------------------
// PAGE 13 — Zippy's Energy Dash (hero art)
// ---------------------------------------------------------------------------
function page13() { return heroPage(13, "ZIPPY'S ENERGY DASH", "P13-Zippy-Stones"); }

// ---------------------------------------------------------------------------
// PAGE 14 — Star Sky Connect-the-Dots
// ---------------------------------------------------------------------------
function page14() {
  const cx = 315, cy = 320, scale = 46; // inches -> pt, sized to clear the title above and the house below
  let dots = "";
  for (const d of moonDots) {
    const x = cx + d.x * scale, y = cy + d.y * scale;
    dots += `<circle cx="${x}" cy="${y}" r="3.5" fill="#000"/>
      <text x="${x + 9}" y="${y - 6}" font-family="Fredoka" font-weight="700" font-size="10">${d.n}</text>`;
  }
  let stars = "";
  const starSeeds = [[80, 200], [550, 210], [80, 350], [550, 350], [90, 660], [540, 670]];
  for (const [sx, sy] of starSeeds) stars += star(sx, sy, 9);

  const inner = `
    ${title("STAR SKY CONNECT-THE-DOTS", 95, 22)}
    ${caption("Connect the dots 1-25 to reveal who's smiling over the school!", 315, 122, 11.5)}
    ${stars}
    ${dots}
    ${schoolHouse(315, 628, 260, 130)}
  `;
  return pageWrap(14, inner);
}

// ---------------------------------------------------------------------------
// PAGE 15 — Color by Number (Ollo owl badge)
// ---------------------------------------------------------------------------
function page15() {
  const cx = 315, cy = 420;
  const inner = `
    ${title("COLOR BY NUMBER", 95, 26)}
    ${caption("Professor Ollo's Badge", 315, 125, 14)}
    <polygon points="${cx - 150},${cy - 200} ${cx + 150},${cy - 200} ${cx + 150},${cy + 120} ${cx},${cy + 240} ${cx - 150},${cy + 120}"
      fill="none" stroke="#000" stroke-width="5"/>
    <text x="${cx - 100}" y="${cy - 150}" font-family="Fredoka" font-weight="700" font-size="30">1</text>
    <circle cx="${cx - 55}" cy="${cy - 40}" r="55" fill="none" stroke="#000" stroke-width="4"/>
    <circle cx="${cx + 55}" cy="${cy - 40}" r="55" fill="none" stroke="#000" stroke-width="4"/>
    <line x1="${cx - 3}" y1="${cy - 40}" x2="${cx + 3}" y2="${cy - 40}" stroke="#000" stroke-width="4"/>
    <text x="${cx - 55}" y="${cy - 34}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="26">2</text>
    <text x="${cx + 55}" y="${cy - 34}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="26">2</text>
    <polygon points="${cx - 18},${cy + 40} ${cx + 18},${cy + 40} ${cx},${cy + 75}" fill="none" stroke="#000" stroke-width="4"/>
    <text x="${cx}" y="${cy + 34}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="20">3</text>
    <path d="M ${cx - 150} ${cy + 120} Q ${cx} ${cy + 200} ${cx + 150} ${cy + 120}" fill="none" stroke="#000" stroke-width="4"/>
    <text x="${cx}" y="${cy + 175}" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="22">4</text>
    <rect x="${SAFE.x + 40}" y="${SAFE.y + SAFE.h - 110}" width="${SAFE.w - 80}" height="90" fill="none" stroke="#000" stroke-width="3"/>
    ${caption("KEY:  1 = Red     2 = Blue     3 = Yellow     4 = Green", 315, SAFE.y + SAFE.h - 60, 15)}
  `;
  return pageWrap(15, inner);
}

// ---------------------------------------------------------------------------
// PAGE 16 — Academy Picnic (hero art, all 4 characters)
// ---------------------------------------------------------------------------
function page16() { return heroPage(16, "WONDERBLOOM ACADEMY PICNIC", "P16-Academy-Picnic"); }

// ---------------------------------------------------------------------------
// PAGE 17 — Shape Matching
// ---------------------------------------------------------------------------
function page17() {
  const leftX = SAFE.x + 110, rightX = SAFE.x + SAFE.w - 110;
  const ys = [220, 360, 500, 640];
  const shapes = [
    { draw: (x, y) => `<circle cx="${x}" cy="${y}" r="42" fill="none" stroke="#000" stroke-width="5"/>`, label: "Circle" },
    { draw: (x, y) => `<rect x="${x - 38}" y="${y - 38}" width="76" height="76" fill="none" stroke="#000" stroke-width="5"/>`, label: "Square" },
    { draw: (x, y) => `<polygon points="${x},${y - 44} ${x + 42},${y + 32} ${x - 42},${y + 32}" fill="none" stroke="#000" stroke-width="5"/>`, label: "Triangle" },
    { draw: (x, y) => star(x, y, 44), label: "Star" },
  ];
  // school-item matches, deliberately reordered on the right so it's a real match, not 1:1 rows
  const items = [
    { draw: (x, y) => `<g fill="none" stroke="#000" stroke-width="4"><circle cx="${x}" cy="${y}" r="40"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y - 26}"/><line x1="${x}" y1="${y}" x2="${x + 18}" y2="${y}"/></g>`, label: "Clock" }, // matches Circle
    { draw: (x, y) => ribbonMedal(x, y - 20, 30), label: "Ribbon Badge" }, // matches Star
    { draw: (x, y) => `<g fill="none" stroke="#000" stroke-width="4"><rect x="${x - 34}" y="${y - 44}" width="68" height="88"/><line x1="${x}" y1="${y - 44}" x2="${x}" y2="${y + 44}"/></g>`, label: "Book" }, // matches Square
    { draw: (x, y) => `<g fill="none" stroke="#000" stroke-width="4"><rect x="${x - 44}" y="${y - 14}" width="88" height="28"/><line x1="${x - 22}" y1="${y - 14}" x2="${x - 22}" y2="${y + 14}"/><line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y + 14}"/><line x1="${x + 22}" y1="${y - 14}" x2="${x + 22}" y2="${y + 14}"/></g>`, label: "Ruler" }, // matches Triangle (set-square)
  ];
  let content = "";
  shapes.forEach((s, i) => {
    content += s.draw(leftX, ys[i]) + caption(s.label, leftX, ys[i] + 68, 12);
  });
  items.forEach((it, i) => {
    content += it.draw(rightX, ys[i]) + caption(it.label, rightX, ys[i] + 68, 12);
  });
  const inner = `${title("SHAPE MATCH-UP", 100, 26)}${caption("Draw a line from each shape to the school item shaped like it!", 315, 130, 12)}${content}`;
  return pageWrap(17, inner);
}

// ---------------------------------------------------------------------------
// PAGE 18 — Design a Badge
// ---------------------------------------------------------------------------
function page18() {
  const cx = 315, cy = 420;
  const inner = `
    ${title("DESIGN A BADGE", 100, 26)}
    ${caption("What would YOUR Wonderbloom Academy badge look like? Draw it below!", 315, 135, 12)}
    <polygon points="${cx - 160},${cy - 220} ${cx + 160},${cy - 220} ${cx + 160},${cy + 130} ${cx},${cy + 260} ${cx - 160},${cy + 130}"
      fill="none" stroke="#000" stroke-width="5"/>
    <polygon points="${cx - 130},${cy - 190} ${cx + 130},${cy - 190} ${cx + 130},${cy + 105} ${cx},${cy + 220} ${cx - 130},${cy + 105}"
      fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="6 5"/>
  `;
  return pageWrap(18, inner);
}

// ---------------------------------------------------------------------------
// PAGE 19 — Friendship Farewell (hero art)
// ---------------------------------------------------------------------------
function page19() { return heroPage(19, "FRIENDSHIP FAREWELL", "P19-Wave-Goodbye"); }

// ---------------------------------------------------------------------------
// PAGE 20 — Official Certificate
// ---------------------------------------------------------------------------
function page20() {
  const cx = 315;
  const inner = `
    ${title("CERTIFICATE OF ACHIEVEMENT", 145, 26)}
    ${caption("WONDERBLOOM ACADEMY", 315, 175, 14)}
    ${caption("This certifies that", 315, 260, 14)}
    <line x1="120" y1="330" x2="510" y2="330" stroke="#000" stroke-width="3"/>
    ${caption("is an official STAR STUDENT", 315, 380, 15)}
    ${caption("having completed all 20 Wonderbloom Academy activities!", 315, 405, 12)}
    ${ribbonMedal(cx, 450, 46)}
    <line x1="150" y1="700" x2="330" y2="700" stroke="#000" stroke-width="2"/>
    ${caption("Signature", 240, 720, 10)}
    <line x1="360" y1="700" x2="480" y2="700" stroke="#000" stroke-width="2"/>
    ${caption("Date", 420, 720, 10)}
  `;
  return pageWrap(20, inner);
}

// ---------------------------------------------------------------------------
const pages = [page01, page02, page03, page04, page05, page06, page07, page08, page09, page10,
  page11, page12, page13, page14, page15, page16, page17, page18, page19, page20];

const pageSlugs = [
  "title-belongs-to", "meet-the-crew", "bennys-lab-maze", "lunas-counting-garden", "zippys-speed-lines",
  "professor-ollos-library", "alphabet-match-a-m", "alphabet-match-n-z", "bennys-bubble-experiment", "word-search",
  "luna-and-the-magic-tree", "spot-the-5-differences", "zippys-energy-dash", "star-sky-connect-the-dots", "color-by-number",
  "academy-picnic", "shape-matching", "design-a-badge", "friendship-farewell", "official-certificate",
];

mkdirSync(path.join(ROOT, "pages"), { recursive: true });

const singlePageTemplate = (n, slug, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Wonderbloom Academy — Page ${n}: ${slug.replace(/-/g, " ")}</title>
<link rel="stylesheet" href="../shared/print.css" />
</head>
<body>
<div class="book">
${body}
</div>
</body>
</html>
`;

let allBodies = [];
pages.forEach((fn, i) => {
  const n = i + 1;
  const body = fn();
  allBodies.push(body);
  writeFileSync(path.join(ROOT, "pages", `page-${String(n).padStart(2, "0")}-${pageSlugs[i]}.html`), singlePageTemplate(n, pageSlugs[i], body));
});

const bookHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Wonderbloom Academy Coloring &amp; Activity Book</title>
<link rel="stylesheet" href="shared/print.css" />
</head>
<body>
<div class="toolbar">
  <strong>Wonderbloom Academy — 20-Page Activity Book</strong>
  <button onclick="document.body.classList.toggle('hide-guides')">Toggle bleed/safe guides</button>
  <button onclick="window.print()">Print / Save as PDF</button>
  <span>8.5&times;11in trim &middot; 0.125in bleed &middot; 0.5in safe margin</span>
</div>
<div class="book">
${allBodies.join("\n")}
</div>
</body>
</html>
`;
writeFileSync(path.join(ROOT, "book.html"), bookHtml);

console.log(`Wrote ${pages.length} page files to pages/ and combined book.html`);
