// Deterministic puzzle-content generator for the Wonderbloom Activity Book.
// Run with `node scripts/generate-puzzles.mjs` from wonderbloom-activity-book/.
// Writes JSON fixtures into generated/ that the page HTML pulls exact
// coordinates from, so the maze / word search / dot-to-dot are all
// mechanically verified solvable rather than hand-guessed.

import { writeFileSync } from "node:fs";

// Small seeded PRNG (mulberry32) so output is reproducible across runs.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Page 3: Benny's Lab Maze — perfect maze via randomized DFS backtracker.
// ---------------------------------------------------------------------------
function generateMaze(cols, rows, seed) {
  const rand = mulberry32(seed);
  const cellState = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      visited: false,
      walls: { N: true, S: true, E: true, W: true },
    }))
  );

  const start = { x: 0, y: 0 };
  const end = { x: cols - 1, y: rows - 1 };

  const stack = [start];
  cellState[start.y][start.x].visited = true;

  const dirs = [
    { name: "N", dx: 0, dy: -1, opp: "S" },
    { name: "S", dx: 0, dy: 1, opp: "N" },
    { name: "E", dx: 1, dy: 0, opp: "W" },
    { name: "W", dx: -1, dy: 0, opp: "E" },
  ];

  while (stack.length) {
    const cur = stack[stack.length - 1];
    const neighbors = [];
    for (const d of dirs) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !cellState[ny][nx].visited) {
        neighbors.push({ x: nx, y: ny, dir: d });
      }
    }
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const pick = neighbors[Math.floor(rand() * neighbors.length)];
    cellState[cur.y][cur.x].walls[pick.dir.name] = false;
    cellState[pick.y][pick.x].walls[pick.dir.opp] = false;
    cellState[pick.y][pick.x].visited = true;
    stack.push({ x: pick.x, y: pick.y });
  }

  // Dead ends = cells with exactly one open passage (leaves of the maze tree).
  let deadEnds = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const open = dirs.filter((d) => !cellState[y][x].walls[d.name]).length;
      if (open === 1) deadEnds++;
    }
  }

  // Solve with BFS to record the unique solution path (used only for QA / an
  // answer-key page, never rendered on the puzzle page itself).
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [start];
  const seen = new Set([key(start.x, start.y)]);
  while (queue.length) {
    const c = queue.shift();
    if (c.x === end.x && c.y === end.y) break;
    for (const d of dirs) {
      if (cellState[c.y][c.x].walls[d.name]) continue;
      const nx = c.x + d.dx;
      const ny = c.y + d.dy;
      if (!seen.has(key(nx, ny))) {
        seen.add(key(nx, ny));
        prev.set(key(nx, ny), c);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  const path = [end];
  let cur = end;
  while (!(cur.x === start.x && cur.y === start.y)) {
    cur = prev.get(key(cur.x, cur.y));
    path.push(cur);
  }
  path.reverse();

  // Emit wall segments in grid units (cell = 1x1) for direct SVG scaling.
  const segments = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = cellState[y][x];
      if (c.walls.N) segments.push([x, y, x + 1, y]);
      if (c.walls.W) segments.push([x, y, x, y + 1]);
      if (y === rows - 1 && c.walls.S) segments.push([x, y + 1, x + 1, y + 1]);
      if (x === cols - 1 && c.walls.E) segments.push([x + 1, y, x + 1, y + 1]);
    }
  }

  return { cols, rows, start, end, segments, deadEnds, solutionLength: path.length };
}

// ---------------------------------------------------------------------------
// Page 10: Word Search — 8x8 grid, 6 hidden words, no illegal overlaps.
// ---------------------------------------------------------------------------
function generateWordSearch(size, words, seed) {
  const rand = mulberry32(seed);
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => null));
  const directions = [
    { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
    { dx: -1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: -1 },
    { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
  ];
  const placements = [];

  function tryPlace(word) {
    const attempts = 500;
    for (let a = 0; a < attempts; a++) {
      const dir = directions[Math.floor(rand() * directions.length)];
      const maxStartX = dir.dx === 1 ? size - word.length : dir.dx === -1 ? word.length - 1 : size - 1;
      const minStartX = dir.dx === -1 ? word.length - 1 : 0;
      const maxStartY = dir.dy === 1 ? size - word.length : dir.dy === -1 ? word.length - 1 : size - 1;
      const minStartY = dir.dy === -1 ? word.length - 1 : 0;
      if (maxStartX < minStartX || maxStartY < minStartY) continue;
      const sx = minStartX + Math.floor(rand() * (maxStartX - minStartX + 1));
      const sy = minStartY + Math.floor(rand() * (maxStartY - minStartY + 1));
      let ok = true;
      const cells = [];
      for (let i = 0; i < word.length; i++) {
        const x = sx + dir.dx * i;
        const y = sy + dir.dy * i;
        if (x < 0 || x >= size || y < 0 || y >= size) { ok = false; break; }
        const existing = grid[y][x];
        if (existing !== null && existing !== word[i]) { ok = false; break; }
        cells.push([x, y]);
      }
      if (!ok) continue;
      cells.forEach(([x, y], i) => (grid[y][x] = word[i]));
      placements.push({ word, start: [sx, sy], end: cells[cells.length - 1] });
      return true;
    }
    return false;
  }

  for (const w of words.sort((a, b) => b.length - a.length)) {
    if (!tryPlace(w)) throw new Error(`Could not place word: ${w}`);
  }

  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x] === null) grid[y][x] = ALPHA[Math.floor(rand() * ALPHA.length)];
    }
  }

  return { size, grid, placements };
}

// ---------------------------------------------------------------------------
// Page 14: Star Sky Connect-the-Dots — 25-point crescent "smiling moon".
// ---------------------------------------------------------------------------
function generateMoonDots(count) {
  // Crescent = big outer circle minus a smaller circle offset to the right.
  // We walk the *visible* outer-circle arc (the part not covered by the bite
  // circle) and place points evenly along it, so the 25 numbered dots trace
  // a clean crescent silhouette when connected in order.
  const R = 3.2; // outer radius, inches
  const r = 2.5; // bite radius, inches
  const outerCenter = { x: 0, y: 0 };
  const biteCenter = { x: 1.7, y: -0.3 }; // shifted right+up to carve a crescent

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const samples = 2000;
  const arcPoints = [];
  for (let i = 0; i < samples; i++) {
    const theta = (i / samples) * Math.PI * 2;
    const p = { x: outerCenter.x + R * Math.cos(theta), y: outerCenter.y + R * Math.sin(theta) };
    if (dist(p, biteCenter) > r) arcPoints.push({ theta, p });
  }

  // arcPoints may wrap across the 0/2pi boundary; rotate the array so it
  // starts at the first contiguous run's beginning.
  let cut = 0;
  for (let i = 1; i < arcPoints.length; i++) {
    if (arcPoints[i].theta - arcPoints[i - 1].theta > 0.1) { cut = i; break; }
  }
  const ordered = arcPoints.slice(cut).concat(arcPoints.slice(0, cut));

  const pick = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * ordered.length);
    pick.push(ordered[idx].p);
  }

  return pick.map((p, i) => ({ n: i + 1, x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) }));
}

// ---------------------------------------------------------------------------
const maze = generateMaze(10, 7, 20260917);
const wordSearch = generateWordSearch(8, ["BENNY", "LUNA", "ZIPPY", "OLLO", "BOOM", "FLOWER"], 42);
const moonDots = generateMoonDots(25);

writeFileSync(new URL("../generated/maze.json", import.meta.url), JSON.stringify(maze, null, 2));
writeFileSync(new URL("../generated/wordsearch.json", import.meta.url), JSON.stringify(wordSearch, null, 2));
writeFileSync(new URL("../generated/moon-dots.json", import.meta.url), JSON.stringify(moonDots, null, 2));

console.log(`Maze: ${maze.cols}x${maze.rows}, ${maze.deadEnds} dead ends, solution length ${maze.solutionLength} cells.`);
console.log("Word search placements:");
for (const p of wordSearch.placements) console.log(`  ${p.word}: start=${p.start} end=${p.end}`);
console.log(`Moon dots: ${moonDots.length} points generated.`);
