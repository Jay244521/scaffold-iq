/**
 * Layout analysis for OEM manuals: positioned text items → reading-order blocks.
 *
 * HVAC manuals mix two-column prose, full-width spec tables, charging charts and
 * fault-code tables. Plain text extraction interleaves columns and flattens table
 * rows into word soup, which wrecks retrieval of exact specs. This module works on
 * coordinates instead:
 *   1. items → lines (shared baseline) → segments (runs separated by wide gaps)
 *   2. strip running headers/footers and page numbers
 *   3. detect a two-column gutter and read left column, then right
 *   4. detect tables from column-aligned multi-segment lines (with wrapped cells)
 *   5. everything else becomes headings and paragraphs
 *
 * Pure and dependency-free so it can be unit tested without a PDF.
 */

export type TextItem = {
  str: string;
  /** Left edge, PDF points. */
  x: number;
  /** Baseline measured from the TOP of the page, PDF points. */
  y: number;
  width: number;
  fontSize: number;
};

export type PageText = { page: number; width: number; height: number; items: TextItem[] };

type Segment = { text: string; x0: number; x1: number; fontSize: number };
type Line = { y: number; fontSize: number; segments: Segment[]; page: number };

export type Block =
  | { kind: "heading"; text: string; level: 1 | 2 | 3; page: number }
  | { kind: "paragraph"; text: string; page: number }
  | { kind: "table"; rows: string[][]; page: number; pageEnd: number };

export type LayoutStats = { pages: number; emptyPages: number[]; strippedLines: number; twoColumnPages: number[]; tables: number };

/** Gap (in ems) that splits a line into separate segments: table cells or columns. */
const SEGMENT_GAP_EM = 1.5;
/** Gap (in ems) above which adjacent items get a space between them. */
const SPACE_GAP_EM = 0.12;
const MARGIN_BAND = 0.075;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* ------------------------------ lines & segments ------------------------------ */

function toLines(p: PageText): Line[] {
  const items = p.items.filter((i) => i.str.trim() !== "" && i.fontSize > 0).sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: TextItem[][] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(it.y - g[0].y) <= 0.45 * Math.max(it.fontSize, g[0].fontSize)) g.push(it);
    else groups.push([it]);
  }

  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x);
    const fontSize = median(g.map((i) => i.fontSize));
    const segments: Segment[] = [];
    for (const it of g) {
      const seg = segments[segments.length - 1];
      const gap = seg ? it.x - seg.x1 : Infinity;
      const em = Math.max(it.fontSize, 1);
      if (!seg || gap > SEGMENT_GAP_EM * em) {
        segments.push({ text: it.str.trim(), x0: it.x, x1: it.x + it.width, fontSize: it.fontSize });
        continue;
      }
      const needsSpace = gap > SPACE_GAP_EM * em && !seg.text.endsWith(" ") && !it.str.startsWith(" ");
      seg.text = (seg.text + (needsSpace ? " " : "") + it.str).replace(/\s+/g, " ");
      seg.x1 = Math.max(seg.x1, it.x + it.width);
    }
    for (const s of segments) s.text = s.text.trim();
    return { y: median(g.map((i) => i.y)), fontSize, segments: segments.filter((s) => s.text), page: p.page };
  });
}

const lineText = (l: Line, sep = " ") => l.segments.map((s) => s.text).join(sep);

/* ------------------------------ headers / footers ------------------------------ */

const PAGE_NUMBER = /^(page\s*)?[-–]?\s*\d{1,4}\s*[-–]?(\s*(of|\/)\s*\d{1,4})?$/i;
const normalizeRunning = (s: string) => s.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

function stripRunningText(pages: { page: PageText; lines: Line[] }[]): number {
  const inMargin = (l: Line, h: number) => l.y < h * MARGIN_BAND || l.y > h * (1 - MARGIN_BAND);
  const counts = new Map<string, number>();
  for (const { page, lines } of pages) {
    const seen = new Set<string>();
    for (const l of lines) if (inMargin(l, page.height)) seen.add(normalizeRunning(lineText(l)));
    for (const k of seen) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.5));
  let stripped = 0;
  for (const p of pages) {
    const before = p.lines.length;
    p.lines = p.lines.filter((l) => {
      if (!inMargin(l, p.page.height)) return true;
      const t = lineText(l);
      return !(PAGE_NUMBER.test(t.trim()) || (pages.length > 1 && (counts.get(normalizeRunning(t)) ?? 0) >= threshold));
    });
    stripped += before - p.lines.length;
  }
  return stripped;
}

/* ------------------------------ columns ------------------------------ */

type Gutter = { start: number; end: number };

/** Find a vertical whitespace band between two prose columns, if the page has one. */
function findGutter(lines: Line[], width: number): Gutter | null {
  if (lines.length < 6) return null;
  const bins = new Uint16Array(Math.ceil(width) + 1);
  for (const l of lines) {
    const covered = new Set<number>();
    for (const s of l.segments) for (let x = Math.max(0, Math.floor(s.x0)); x <= Math.min(width, Math.ceil(s.x1)); x++) covered.add(x);
    for (const x of covered) bins[x]++;
  }
  // Full-width titles, captions and banners legitimately cross the gutter on two-column pages.
  const allowed = Math.max(2, Math.ceil(lines.length * 0.15));
  let best: Gutter | null = null;
  let runStart = -1;
  for (let x = Math.floor(width * 0.3); x <= Math.ceil(width * 0.7); x++) {
    if (bins[x] <= allowed) {
      if (runStart < 0) runStart = x;
      if (!best || x - runStart > best.end - best.start) best = { start: runStart, end: x };
    } else runStart = -1;
  }
  if (!best || best.end - best.start < 8) return null;

  const left = lines.filter((l) => l.segments.some((s) => s.x1 <= best!.start + 1));
  const right = lines.filter((l) => l.segments.some((s) => s.x0 >= best!.end - 1));
  if (left.length < lines.length * 0.3 || right.length < lines.length * 0.3) return null;

  // Prose columns have long runs; a full-width table has short cells. Don't mistake one for the other.
  const segLen = (ls: Line[], side: "l" | "r") =>
    median(ls.flatMap((l) => l.segments.filter((s) => (side === "l" ? s.x1 <= best!.start + 1 : s.x0 >= best!.end - 1)).map((s) => s.text.length)));
  if (segLen(left, "l") < 22 || segLen(right, "r") < 22) return null;
  return best;
}

/** Reading-order streams of lines: bands of (left column, right column) separated by full-width lines. */
function orderStreams(lines: Line[], gutter: Gutter | null): Line[][] {
  if (!gutter) return [lines];
  const mid = (gutter.start + gutter.end) / 2;
  const streams: Line[][] = [];
  let left: Line[] = [];
  let right: Line[] = [];
  let full: Line[] = [];
  const flushColumns = () => {
    if (left.length) streams.push(left);
    if (right.length) streams.push(right);
    left = [];
    right = [];
  };
  for (const l of lines) {
    const spans = l.segments.some((s) => s.x0 < gutter.start - 2 && s.x1 > gutter.end + 2);
    const ls = l.segments.filter((s) => s.x1 <= mid);
    const rs = l.segments.filter((s) => s.x0 >= mid);
    const tableRowAcross = l.segments.length >= 3 && ls.length > 0 && rs.length > 0;
    if (spans || tableRowAcross) {
      flushColumns();
      full.push(l);
      continue;
    }
    if (full.length) {
      streams.push(full);
      full = [];
    }
    if (ls.length) left.push({ ...l, segments: ls });
    if (rs.length) right.push({ ...l, segments: rs });
  }
  flushColumns();
  if (full.length) streams.push(full);
  return streams;
}

/* ------------------------------ tables ------------------------------ */

function clusterAnchors(xs: number[], tol: number): number[] {
  const sorted = [...xs].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const x of sorted) {
    const c = clusters[clusters.length - 1];
    if (c && x - c[c.length - 1] <= tol) c.push(x);
    else clusters.push([x]);
  }
  return clusters.map((c) => Math.min(...c));
}

const anchorIndex = (anchors: number[], x: number, tol: number) => {
  let idx = -1;
  for (let i = 0; i < anchors.length; i++) if (anchors[i] <= x + tol) idx = i;
  return idx;
};

/**
 * Try to read lines[start..] as a table. Returns the table and how many lines it
 * consumed, or null when the lines aren't column-aligned.
 */
function readTable(lines: Line[], start: number): { rows: string[][]; used: number } | null {
  const first = lines[start];
  if (first.segments.length < 2) return null;
  const em = first.fontSize;
  const tol = Math.max(4, em * 0.9);
  const maxGap = em * 2.6;

  // Collect the candidate run: multi-segment lines plus single-segment continuation lines.
  const run: Line[] = [first];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.y - run[run.length - 1].y > maxGap) break;
    if (l.segments.length >= 2) run.push(l);
    else if (l.segments.length === 1 && run.length >= 1) run.push(l);
    else break;
  }
  const multi = run.filter((l) => l.segments.length >= 2);
  if (multi.length < 2) return null;

  const anchors = clusterAnchors(multi.flatMap((l) => l.segments.map((s) => s.x0)), tol);
  if (anchors.length < 2) return null;
  const used = new Map<number, number>();
  for (const l of multi) for (const s of l.segments) {
    const i = anchorIndex(anchors, s.x0, tol);
    used.set(i, (used.get(i) ?? 0) + 1);
  }
  const strong = anchors.filter((_, i) => (used.get(i) ?? 0) >= 2);
  if (strong.length < 2) return null;
  const aligned = multi.flatMap((l) => l.segments).filter((s) => strong.some((a) => Math.abs(a - s.x0) <= tol)).length;
  if (aligned / multi.reduce((n, l) => n + l.segments.length, 0) < 0.7) return null;
  // Two "columns" of long running text are prose columns the gutter detector missed, not a table.
  if (strong.length === 2 && median(multi.flatMap((l) => l.segments.map((s) => s.text.length))) >= 30) return null;

  const rows: string[][] = [];
  let consumed = 0;
  for (const l of run) {
    if (l.segments.length >= 2) {
      const row = Array<string>(strong.length).fill("");
      for (const s of l.segments) {
        const i = Math.max(0, anchorIndex(strong, s.x0, tol));
        row[i] = row[i] ? `${row[i]} ${s.text}` : s.text;
      }
      rows.push(row);
      consumed++;
      continue;
    }
    // Single segment: a wrapped cell continues the previous row only when it sits under a non-first column.
    const s = l.segments[0];
    const i = anchorIndex(strong, s.x0, tol);
    if (rows.length && i > 0 && Math.abs(strong[i] - s.x0) <= tol) {
      const prev = rows[rows.length - 1];
      prev[i] = prev[i] ? `${prev[i]} ${s.text}`.replace(/(\w)- (\w)/, "$1$2") : s.text;
      consumed++;
      continue;
    }
    break;
  }
  return rows.length >= 2 ? { rows, used: consumed } : null;
}

/* ------------------------------ blocks ------------------------------ */

const BULLET = /^([•▪◦●■\-–*]|\(?\d{1,2}[.)]|\(?[a-z][.)])\s+/;
// Callouts are capitalized ("WARNING", "Caution:"); a wrapped line that merely starts with "warning" is not one.
const CALLOUT = /^(WARNING|CAUTION|DANGER|NOTICE|NOTE|IMPORTANT)\b|^(Warning|Caution|Danger|Notice|Note|Important)\s*[:!]/;

function isHeading(l: Line, bodySize: number): 1 | 2 | 3 | 0 {
  if (l.segments.length !== 1) return 0;
  const t = l.segments[0].text;
  if (t.length > 90 || /[.,;:]$/.test(t) || CALLOUT.test(t)) return 0;
  const ratio = l.fontSize / bodySize;
  if (ratio >= 1.6) return 1;
  if (ratio >= 1.25) return 2;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (ratio >= 1.12 || (letters.length >= 4 && letters === letters.toUpperCase() && t.length <= 70 && !/\d{3,}/.test(t))) return 3;
  return 0;
}

function joinLines(a: string, b: string): string {
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return `${a} ${b}`;
}

function streamToBlocks(lines: Line[], bodySize: number, out: Block[], stats: LayoutStats) {
  let para: { text: string; page: number; lastY: number; size: number } | null = null;
  const flush = () => {
    if (para?.text.trim()) out.push({ kind: "paragraph", text: para.text.trim(), page: para.page });
    para = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    if (l.segments.length >= 2) {
      const table = readTable(lines, i);
      if (table) {
        flush();
        out.push({ kind: "table", rows: table.rows, page: l.page, pageEnd: lines[i + table.used - 1].page });
        stats.tables++;
        i += table.used - 1;
        continue;
      }
    }

    const level = isHeading(l, bodySize);
    if (level) {
      flush();
      out.push({ kind: "heading", text: lineText(l), level, page: l.page });
      continue;
    }

    const text = lineText(l, l.segments.length > 1 ? " | " : " ");
    const p = para as { text: string; page: number; lastY: number; size: number } | null;
    const newPara =
      !p ||
      l.page !== p.page ||
      l.y - p.lastY > l.fontSize * 1.75 ||
      Math.abs(l.fontSize - p.size) > p.size * 0.1 ||
      BULLET.test(text) ||
      CALLOUT.test(text);
    if (newPara) {
      flush();
      para = { text, page: l.page, lastY: l.y, size: l.fontSize };
    } else {
      p!.text = joinLines(p!.text, text);
      p!.lastY = l.y;
    }
  }
  flush();
}

/** Full document layout: reading-order blocks across all pages. */
export function layoutDocument(pages: PageText[]): { blocks: Block[]; stats: LayoutStats } {
  const stats: LayoutStats = { pages: pages.length, emptyPages: [], strippedLines: 0, twoColumnPages: [], tables: 0 };
  const withLines = pages.map((page) => ({ page, lines: toLines(page) }));
  for (const p of withLines) if (!p.lines.length) stats.emptyPages.push(p.page.page);
  stats.strippedLines = stripRunningText(withLines);

  // Body font size = the size carrying the most characters.
  const weight = new Map<number, number>();
  for (const { lines } of withLines) for (const l of lines) {
    const k = Math.round(l.fontSize * 2) / 2;
    weight.set(k, (weight.get(k) ?? 0) + lineText(l).length);
  }
  const bodySize = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;

  const blocks: Block[] = [];
  for (const { page, lines } of withLines) {
    const gutter = findGutter(lines, page.width);
    if (gutter) stats.twoColumnPages.push(page.page);
    for (const stream of orderStreams(lines, gutter)) streamToBlocks(stream, bodySize, blocks, stats);
  }
  return { blocks: mergeSplitTables(blocks), stats };
}

/** A table that runs onto the next page arrives as two blocks; stitch them (dropping a repeated header). */
function mergeSplitTables(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const prev = out[out.length - 1];
    if (b.kind === "table" && prev?.kind === "table" && b.page === prev.pageEnd + 1 && b.rows[0].length === prev.rows[0].length) {
      const sameHeader = b.rows[0].join("|").toLowerCase() === prev.rows[0].join("|").toLowerCase();
      prev.rows.push(...(sameHeader ? b.rows.slice(1) : b.rows));
      prev.pageEnd = b.pageEnd;
      continue;
    }
    out.push(b);
  }
  return out;
}
