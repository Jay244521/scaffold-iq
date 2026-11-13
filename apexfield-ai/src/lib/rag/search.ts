/**
 * Retrieval over oem_knowledge_chunks via the hybrid_search_oem_chunks RPC
 * (vector similarity fused with full-text rank). Usable from route handlers and scripts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChunkType } from "./classify";
import type { Embedder } from "./embeddings";
import { toVectorLiteral } from "./store";

export type OemSearchParams = {
  query: string;
  manufacturer?: string;
  /** Full equipment model number from the data plate, e.g. "24ACC636A003". */
  model?: string;
  chunkTypes?: ChunkType[];
  k?: number;
};

export type OemSearchHit = {
  id: string;
  document_title: string | null;
  manufacturer: string;
  model_prefix: string;
  chunk_type: string;
  section_path: string;
  page_start: number | null;
  page_end: number | null;
  content: string;
  similarity: number | null;
  keyword_rank: number | null;
  score: number;
};

export async function searchOemKnowledge(db: SupabaseClient, embedder: Embedder, p: OemSearchParams): Promise<OemSearchHit[]> {
  const query = p.query.trim();
  if (!query) return [];
  const embedding = await embedder.embedQuery(query);
  const { data, error } = await db.rpc("hybrid_search_oem_chunks", {
    query_text: query,
    query_embedding: toVectorLiteral(embedding),
    match_count: Math.min(Math.max(p.k ?? 6, 1), 20),
    filter_manufacturer: p.manufacturer ?? null,
    filter_model: p.model ?? null,
    filter_chunk_types: p.chunkTypes?.length ? p.chunkTypes : null,
    filter_embedding_model: embedder.model,
  });
  if (error) throw new Error(`hybrid_search_oem_chunks failed: ${error.message}`);
  return (data ?? []) as OemSearchHit[];
}

/** Compact, citeable context block for an LLM prompt or tool response. */
export function formatHitsForPrompt(hits: OemSearchHit[]): string {
  return hits
    .map((h, i) => {
      const pages = h.page_start ? ` p.${h.page_start}${h.page_end && h.page_end !== h.page_start ? `–${h.page_end}` : ""}` : "";
      const where = [h.document_title, h.section_path].filter(Boolean).join(" › ");
      return `[${i + 1}] ${h.manufacturer}${h.model_prefix ? ` ${h.model_prefix}` : ""} · ${where}${pages} (${h.chunk_type})\n${h.content}`;
    })
    .join("\n\n---\n\n");
}
