/**
 * Section-aware chunking of layout blocks for retrieval.
 *
 * Rules that matter for HVAC manuals:
 * - A chunk never crosses a heading, so a spec never gets attributed to the wrong section.
 * - Tables are never split mid-row. Long tables (charging charts, fault codes) split
 *   into row groups and every piece repeats the header row, so "PSI at 95°F" is still
 *   answerable from a lone piece.
 * - Prose splits at sentence boundaries with a small overlap.
 * - Identical chunks (the same WARNING repeated on every page) are stored once.
 */
import { createHash } from "node:crypto";
import type { Block } from "./layout";
import { classifyChunk, extractModelNumbers, type ChunkType } from "./classify";

export type ChunkOptions = {
  /** Soft cap per chunk. Tables may exceed it by 30% to avoid a split. */
  maxTokens: number;
  /** Smaller trailing pieces merge into the previous chunk of the same section. */
  minTokens: number;
  /** Prose carried into the next chunk when a section is split. */
  overlapTokens: number;
};

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { maxTokens: 450, minTokens: 60, overlapTokens: 60 };

export type Chunk = {
  chunkIndex: number;
  content: string;
  sectionPath: string[];
  pageStart: number;
  pageEnd: number;
  chunkType: ChunkType;
  tokenCount: number;
  modelNumbers: string[];
  contentHash: string;
  isTable: boolean;
};

/** ~4 characters per token for English technical prose; good enough for sizing. */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function splitSentences(text: string): string[] {
  // Split on sentence ends, but not on "No. 2", decimals, or abbreviations like "approx."
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(•\d])/)
    .reduce<string[]>((acc, s) => {
      const prev = acc[acc.length - 1];
      if (prev && /\b(No|Fig|approx|Approx|e\.g|i\.e|vs|min|max|Ref)\.$/.test(prev)) acc[acc.length - 1] = `${prev} ${s}`;
      else acc.push(s);
      return acc;
    }, [])
    .filter(Boolean);
}

const escapeCell = (c: string) => c.replace(/\|/g, "\\|").trim() || " ";

export function renderTable(rows: string[][]): string {
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const [head, ...body] = rows.map(pad);
  return [
    `| ${head.map(escapeCell).join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...body.map((r) => `| ${r.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

type Draft = { parts: string[]; tokens: number; pageStart: number; pageEnd: number; isTable: boolean; tableHeader?: string[] };

export function chunkBlocks(blocks: Block[], opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS): Chunk[] {
  const path: { level: number; text: string }[] = [];
  const drafts: { draft: Draft; section: string[] }[] = [];
  let buf: Draft | null = null;

  const section = () => path.map((p) => p.text);
  const emit = (d: Draft) => drafts.push({ draft: d, section: section() });

  const flush = () => {
    const d = buf;
    buf = null;
    if (!d || !d.parts.length) return;
    // Merge a small tail into the previous prose chunk of the same section.
    const prev = drafts[drafts.length - 1];
    if (
      d.tokens < opts.minTokens &&
      prev &&
      !prev.draft.isTable &&
      prev.section.join("\u0000") === section().join("\u0000") &&
      prev.draft.tokens + d.tokens <= opts.maxTokens * 1.2
    ) {
      prev.draft.parts.push(...d.parts);
      prev.draft.tokens += d.tokens;
      prev.draft.pageEnd = Math.max(prev.draft.pageEnd, d.pageEnd);
      return;
    }
    emit(d);
  };

  const overlapFrom = (d: Draft): string[] => {
    const sentences = splitSentences(d.parts[d.parts.length - 1] ?? "");
    const carried: string[] = [];
    let t = 0;
    for (let i = sentences.length - 1; i >= 0; i--) {
      const st = estimateTokens(sentences[i]);
      if (t + st > opts.overlapTokens) break;
      carried.unshift(sentences[i]);
      t += st;
    }
    return carried.length ? [carried.join(" ")] : [];
  };

  const addProse = (text: string, page: number) => {
    const tokens = estimateTokens(text);
    if (tokens > opts.maxTokens) {
      // Oversized paragraph: split into sentence groups.
      let group: string[] = [];
      let gt = 0;
      for (const s of splitSentences(text)) {
        const st = estimateTokens(s);
        if (gt + st > opts.maxTokens && group.length) {
          addProse(group.join(" "), page);
          group = [];
          gt = 0;
        }
        group.push(s);
        gt += st;
      }
      if (group.length) addProse(group.join(" "), page);
      return;
    }
    if (buf && !buf.isTable && buf.tokens + tokens > opts.maxTokens) {
      const carry = overlapFrom(buf);
      flush();
      buf = { parts: carry, tokens: estimateTokens(carry.join(" ")), pageStart: page, pageEnd: page, isTable: false };
    }
    if (!buf || buf.isTable) {
      flush();
      buf = { parts: [], tokens: 0, pageStart: page, pageEnd: page, isTable: false };
    }
    buf.parts.push(text);
    buf.tokens += tokens;
    buf.pageEnd = Math.max(buf.pageEnd, page);
  };

  const addTable = (rows: string[][], page: number, pageEnd: number) => {
    // A short lead-in ("Table 3. Charging chart:") travels with the table as its caption.
    let caption: string | null = null;
    const pending = buf as Draft | null;
    const last = pending && !pending.isTable ? pending.parts[pending.parts.length - 1] : undefined;
    if (pending && last && estimateTokens(last) <= 80 && /(:$|^\s*(table|chart|fig(ure)?)\b)/i.test(last)) {
      caption = last;
      pending.parts.pop();
      pending.tokens -= estimateTokens(last);
    }
    flush();

    const [header, ...body] = rows;
    const whole = renderTable(rows);
    const capTokens = caption ? estimateTokens(caption) : 0;
    if (estimateTokens(whole) + capTokens <= opts.maxTokens * 1.3 || body.length <= 1) {
      emit({ parts: caption ? [caption, whole] : [whole], tokens: estimateTokens(whole) + capTokens, pageStart: page, pageEnd, isTable: true, tableHeader: header });
      return;
    }
    const headerTokens = estimateTokens(renderTable([header]));
    let group: string[][] = [];
    let gt = headerTokens + capTokens;
    const emitGroup = () => {
      const t = renderTable([header, ...group]);
      emit({ parts: caption ? [`${caption.replace(/:\s*$/, "")} (continued):`, t] : [t], tokens: estimateTokens(t) + capTokens, pageStart: page, pageEnd, isTable: true, tableHeader: header });
    };
    for (const row of body) {
      const rt = estimateTokens(renderTable([row])) / 2;
      if (gt + rt > opts.maxTokens && group.length) {
        emitGroup();
        group = [];
        gt = headerTokens + capTokens;
      }
      group.push(row);
      gt += rt;
    }
    if (group.length) emitGroup();
  };

  for (const b of blocks) {
    if (b.kind === "heading") {
      flush();
      while (path.length && path[path.length - 1].level >= b.level) path.pop();
      path.push({ level: b.level, text: b.text.replace(/\s+/g, " ").trim() });
    } else if (b.kind === "paragraph") addProse(b.text, b.page);
    else addTable(b.rows, b.page, b.pageEnd);
  }
  flush();

  // Finalize: classify, extract model numbers, dedupe identical content.
  const seen = new Set<string>();
  const chunks: Chunk[] = [];
  for (const { draft, section: sec } of drafts) {
    const content = draft.parts.join("\n\n").trim();
    if (!content) continue;
    const hash = sha256(content);
    if (seen.has(hash)) continue;
    seen.add(hash);
    chunks.push({
      chunkIndex: chunks.length,
      content,
      sectionPath: sec,
      pageStart: draft.pageStart,
      pageEnd: draft.pageEnd,
      chunkType: classifyChunk(content, sec.join(" > "), draft.tableHeader),
      tokenCount: estimateTokens(content),
      modelNumbers: extractModelNumbers(content),
      contentHash: hash,
      isTable: draft.isTable,
    });
  }
  return chunks;
}

/** Text that gets embedded: document context + section path + content. Stored content stays clean. */
export function embeddingText(doc: { manufacturer: string; modelPrefix: string; title: string }, c: Chunk): string {
  const head = [doc.manufacturer, doc.modelPrefix].filter(Boolean).join(" ");
  return [
    `${head} — ${doc.title}`,
    c.sectionPath.length ? `Section: ${c.sectionPath.join(" > ")}` : null,
    `Content type: ${c.chunkType.replace("_", " ")}`,
    "",
    c.content,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
