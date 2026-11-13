import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractPdf } from "@/lib/rag/pdf-extract";
import { layoutDocument } from "@/lib/rag/layout";
import { chunkBlocks } from "@/lib/rag/chunker";

const pdfPath = path.join(mkdtempSync(path.join(tmpdir(), "apex-")), "sample.pdf");
execFileSync(process.execPath, ["--import", "tsx", "scripts/fixtures/make-sample-manual.ts", pdfPath], { stdio: "ignore" });

test("synthetic manual: two-column order, stitched cross-page chart, wrapped cells, header repeat on split", async () => {
  const pdf = await extractPdf(new Uint8Array(readFileSync(pdfPath)));
  const { blocks, stats } = layoutDocument(pdf.pages);
  assert.deepEqual(stats.twoColumnPages, [1]);
  assert.ok(stats.strippedLines >= 8, "running headers/footers stripped");

  const chunks = chunkBlocks(blocks);
  const warning = chunks.find((c) => c.content.startsWith("WARNING"))!;
  assert.match(warning.content, /Failure to follow this warning could result/, "wrapped warning stays one paragraph");
  assert.equal(warning.chunkType, "safety");

  const chart = chunks.find((c) => c.content.includes("Liquid Pressure (PSIG)"))!;
  const rows = chart.content.split("\n").filter((l) => l.startsWith("| ") && !l.includes("---"));
  assert.equal(rows.length, 22, "header + 21 rows across the page break");
  assert.equal(rows.filter((r) => r.includes("Outdoor Ambient")).length, 1);
  assert.equal(`${chart.pageStart}-${chart.pageEnd}`, "3-4");
  assert.match(chart.content, /^Table 3\./, "caption travels with the table");

  const faults = chunks.find((c) => c.content.includes("| Code |"))!;
  assert.match(faults.content, /Locked rotor: compressor amp draw above LRA for 3 consecutive starts/);
  assert.equal(faults.chunkType, "error_codes");

  const small = chunkBlocks(blocks, { maxTokens: 120, minTokens: 60, overlapTokens: 60 }).filter((c) => c.content.includes("Liquid Pressure (PSIG)") && c.isTable);
  assert.ok(small.length >= 2);
  for (const piece of small) assert.match(piece.content.split("\n").find((l) => l.startsWith("|"))!, /Outdoor Ambient/);
});
