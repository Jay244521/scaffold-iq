/**
 * Ingest OEM HVAC manuals (PDF) into Supabase pgvector.
 *
 *   npm run oem:ingest -- <file.pdf|folder> [more...] --manufacturer Carrier --model-prefix 24ACC6
 *
 * Options
 *   --manufacturer <name>   Brand. Auto-detected from the text when omitted.
 *   --model-prefix <p>      Model family this manual covers (e.g. 24ACC6). Blank = brand-wide.
 *   --doc-type <t>          installation | service_manual | wiring | spec_sheet | ... (default service_manual)
 *   --title <t>             Override the document title (default: PDF metadata, then file name).
 *   --dry-run               Parse + chunk only. No API keys, no database writes.
 *   --out <file.json>       Write the chunks (dry run or not) to a JSON file for review.
 *   --force                 Re-embed even when this exact file was already ingested.
 *   --provider <p>          gemini | openai (default: EMBEDDING_PROVIDER, else whichever key is set).
 *   --max-tokens <n>        Chunk size cap (default 450).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY or OPENAI_API_KEY.
 * Reads .env.local when present.
 */
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { extractPdf } from "../src/lib/rag/pdf-extract";
import { layoutDocument } from "../src/lib/rag/layout";
import { DEFAULT_CHUNK_OPTIONS, chunkBlocks, embeddingText, type Chunk } from "../src/lib/rag/chunker";
import { detectManufacturer, extractModelNumbers } from "../src/lib/rag/classify";
import { createEmbedder, type EmbeddingProvider } from "../src/lib/rag/embeddings";
import { findDocument, ingestDocument } from "../src/lib/rag/store";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* optional */
}

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    manufacturer: { type: "string" },
    "model-prefix": { type: "string", default: "" },
    "doc-type": { type: "string", default: "service_manual" },
    title: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    out: { type: "string" },
    force: { type: "boolean", default: false },
    provider: { type: "string" },
    "max-tokens": { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

async function collectPdfs(inputs: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const input of inputs) {
    const s = await stat(input);
    if (s.isDirectory()) {
      for (const entry of await readdir(input, { recursive: true })) {
        if (entry.toLowerCase().endsWith(".pdf")) files.push(path.join(input, entry));
      }
    } else if (input.toLowerCase().endsWith(".pdf")) files.push(input);
    else console.warn(`skip (not a PDF): ${input}`);
  }
  return [...new Set(files)].sort();
}

function summarize(chunks: Chunk[]) {
  const byType = new Map<string, number>();
  for (const c of chunks) byType.set(c.chunkType, (byType.get(c.chunkType) ?? 0) + 1);
  const tokens = chunks.map((c) => c.tokenCount);
  return {
    chunks: chunks.length,
    tables: chunks.filter((c) => c.isTable).length,
    avgTokens: tokens.length ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length) : 0,
    maxTokens: tokens.length ? Math.max(...tokens) : 0,
    byType: Object.fromEntries([...byType.entries()].sort((a, b) => b[1] - a[1])),
  };
}

async function main() {
  if (opts.help || positionals.length === 0) {
    console.log("Usage: npm run oem:ingest -- <file.pdf|folder> [--manufacturer X] [--model-prefix Y] [--dry-run] [--out chunks.json]");
    process.exit(positionals.length ? 0 : 1);
  }
  const dryRun = opts["dry-run"];
  const maxTokens = opts["max-tokens"] ? Number(opts["max-tokens"]) : DEFAULT_CHUNK_OPTIONS.maxTokens;
  if (!Number.isFinite(maxTokens) || maxTokens < 100 || maxTokens > 2000) throw new Error("--max-tokens must be between 100 and 2000");

  const files = await collectPdfs(positionals);
  if (!files.length) throw new Error("No PDF files found.");

  const db = dryRun
    ? null
    : (() => {
        const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or use --dry-run).");
        return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      })();
  const embedder = dryRun ? null : createEmbedder(opts.provider as EmbeddingProvider | undefined);
  if (embedder) console.log(`embedding model: ${embedder.model}`);

  const report: unknown[] = [];
  let failures = 0;

  for (const file of files) {
    const label = path.basename(file);
    try {
      const bytes = new Uint8Array(await readFile(file));
      const sha256 = createHash("sha256").update(bytes).digest("hex");

      if (db && embedder && !opts.force) {
        const existing = await findDocument(db, sha256);
        if (existing && existing.embedding_model === embedder.model && existing.chunk_count > 0) {
          console.log(`= ${label}: already ingested (${existing.chunk_count} chunks). Use --force to re-embed.`);
          continue;
        }
      }

      const pdf = await extractPdf(bytes);
      const { blocks, stats } = layoutDocument(pdf.pages);
      const fullText = blocks.map((b) => (b.kind === "table" ? b.rows.flat().join(" ") : b.text)).join("\n");

      const manufacturer = opts.manufacturer ?? detectManufacturer(fullText);
      if (!manufacturer) throw new Error("could not detect the manufacturer; pass --manufacturer");
      const modelPrefix = (opts["model-prefix"] ?? "").trim().toUpperCase();
      const title = opts.title ?? pdf.title ?? label.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      const chunks = chunkBlocks(blocks, { ...DEFAULT_CHUNK_OPTIONS, maxTokens });

      const summary = summarize(chunks);
      console.log(
        `\n# ${label}\n  ${manufacturer}${modelPrefix ? ` ${modelPrefix}` : " (brand-wide)"} · "${title}" · ${pdf.pageCount} pages` +
          `\n  layout: ${stats.tables} tables, two-column pages [${stats.twoColumnPages.join(", ") || "none"}], ${stats.strippedLines} header/footer lines removed` +
          (pdf.rotatedItemsSkipped ? `, ${pdf.rotatedItemsSkipped} rotated labels skipped` : "") +
          `\n  chunks: ${summary.chunks} (${summary.tables} tables) · avg ${summary.avgTokens} / max ${summary.maxTokens} tokens · ${JSON.stringify(summary.byType)}`,
      );
      if (stats.emptyPages.length) {
        console.warn(`  ! no extractable text on pages ${stats.emptyPages.join(", ")} (scanned images need OCR first)`);
      }
      if (!modelPrefix) {
        const models = extractModelNumbers(fullText, 8);
        if (models.length) console.log(`  model numbers seen: ${models.join(", ")} (consider --model-prefix)`);
      }

      const doc = { sha256, manufacturer, modelPrefix, title, docType: opts["doc-type"]!, sourceFile: label, pageCount: pdf.pageCount };
      report.push({ file: label, document: doc, summary, chunks });

      if (!chunks.length) {
        console.warn("  ! nothing to ingest");
        continue;
      }
      if (!db || !embedder) continue;

      const texts = chunks.map((c) => embeddingText(doc, c));
      const vectors = await embedder.embedDocuments(texts, (d, t) => process.stdout.write(`\r  embedding ${d}/${t}`));
      process.stdout.write("\n");
      const res = await ingestDocument(db, doc, chunks, vectors, embedder.model, (d, t) => process.stdout.write(`\r  storing ${d}/${t}`));
      process.stdout.write("\n");
      console.log(`  ✓ stored ${res.inserted} chunks (document ${res.documentId}${res.replaced ? `, replaced ${res.replaced} old` : ""})`);
    } catch (e) {
      failures++;
      console.error(`✗ ${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (opts.out) {
    await writeFile(opts.out, JSON.stringify(report, null, 2));
    console.log(`\nwrote ${opts.out}`);
  }
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
