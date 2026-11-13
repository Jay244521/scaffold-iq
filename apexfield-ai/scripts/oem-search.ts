/**
 * Query the OEM knowledge base the same way the live coach will.
 *
 *   npm run oem:search -- "target subcooling at 95 degrees" --manufacturer Carrier --model 24ACC636A003 [--type charging_chart] [--k 5]
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { CHUNK_TYPES, type ChunkType } from "../src/lib/rag/classify";
import { createEmbedder, type EmbeddingProvider } from "../src/lib/rag/embeddings";
import { formatHitsForPrompt, searchOemKnowledge } from "../src/lib/rag/search";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* optional */
}

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    manufacturer: { type: "string" },
    model: { type: "string" },
    type: { type: "string", multiple: true },
    k: { type: "string", default: "5" },
    provider: { type: "string" },
  },
});

async function main() {
  const query = positionals.join(" ").trim();
  if (!query) throw new Error('Usage: npm run oem:search -- "your question" [--manufacturer X] [--model Y] [--type charging_chart]');
  const types = (opts.type ?? []) as string[];
  const bad = types.filter((t) => !(CHUNK_TYPES as readonly string[]).includes(t));
  if (bad.length) throw new Error(`Unknown --type ${bad.join(", ")}. Use: ${CHUNK_TYPES.join(", ")}`);

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const embedder = createEmbedder(opts.provider as EmbeddingProvider | undefined);

  const t0 = Date.now();
  const hits = await searchOemKnowledge(db, embedder, {
    query,
    manufacturer: opts.manufacturer,
    model: opts.model,
    chunkTypes: types as ChunkType[],
    k: Number(opts.k),
  });
  console.log(`${hits.length} hits in ${Date.now() - t0} ms (${embedder.model})\n`);
  for (const h of hits) {
    console.log(`score ${h.score.toFixed(4)} · sim ${h.similarity?.toFixed(3) ?? "—"} · kw ${h.keyword_rank?.toFixed(3) ?? "—"}`);
  }
  console.log(`\n${formatHitsForPrompt(hits)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
