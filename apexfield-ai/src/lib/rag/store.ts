/**
 * Supabase writes for OEM manual ingestion.
 *
 * Re-ingesting a manual is blue/green: new chunks are inserted under a fresh
 * ingest_run_id, and the previous run's chunks are deleted only after every batch
 * has landed. A failure midway removes the partial new run and leaves the old
 * chunks serving queries.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chunk } from "./chunker";

export type DocumentMeta = {
  sha256: string;
  manufacturer: string;
  modelPrefix: string;
  title: string;
  docType: string;
  sourceFile: string;
  pageCount: number;
};

const INSERT_BATCH = 50;

/** pgvector text literal: unambiguous through PostgREST regardless of JSON→vector casting. */
export const toVectorLiteral = (v: number[]) => `[${v.map((x) => (Number.isInteger(x) ? x : Number(x.toPrecision(8)))).join(",")}]`;

export async function findDocument(db: SupabaseClient, sha256: string) {
  const { data, error } = await db.from("oem_documents").select("id, embedding_model, chunk_count").eq("sha256", sha256).maybeSingle();
  if (error) throw new Error(`oem_documents lookup failed: ${error.message}`);
  return data as { id: string; embedding_model: string; chunk_count: number } | null;
}

export async function ingestDocument(
  db: SupabaseClient,
  doc: DocumentMeta,
  chunks: Chunk[],
  embeddings: number[][],
  embeddingModel: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ documentId: string; inserted: number; replaced: number }> {
  if (chunks.length !== embeddings.length) throw new Error("chunks and embeddings length mismatch");

  const { data: docRow, error: docErr } = await db
    .from("oem_documents")
    .upsert(
      {
        sha256: doc.sha256,
        manufacturer: doc.manufacturer,
        model_prefix: doc.modelPrefix,
        title: doc.title,
        doc_type: doc.docType,
        source_file: doc.sourceFile,
        page_count: doc.pageCount,
        embedding_model: embeddingModel,
      },
      { onConflict: "sha256" },
    )
    .select("id")
    .single();
  if (docErr) throw new Error(`oem_documents upsert failed: ${docErr.message}`);
  const documentId = docRow.id as string;
  const runId = randomUUID();

  try {
    for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
      const rows = chunks.slice(i, i + INSERT_BATCH).map((c, j) => ({
        document_id: documentId,
        ingest_run_id: runId,
        chunk_index: c.chunkIndex,
        manufacturer: doc.manufacturer,
        model_prefix: doc.modelPrefix,
        chunk_type: c.chunkType,
        content: c.content,
        section_path: c.sectionPath.join(" > "),
        page_start: c.pageStart,
        page_end: c.pageEnd,
        token_count: c.tokenCount,
        model_numbers: c.modelNumbers,
        content_hash: c.contentHash,
        embedding_model: embeddingModel,
        embedding: toVectorLiteral(embeddings[i + j]),
        metadata: { doc_type: doc.docType, is_table: c.isTable, source_file: doc.sourceFile },
      }));
      const { error } = await db.from("oem_knowledge_chunks").insert(rows);
      if (error) throw new Error(`chunk insert failed at ${i}: ${error.message}`);
      onProgress?.(Math.min(i + INSERT_BATCH, chunks.length), chunks.length);
    }
  } catch (e) {
    await db.from("oem_knowledge_chunks").delete().eq("document_id", documentId).eq("ingest_run_id", runId);
    throw e;
  }

  // Swap: drop every older run (including legacy rows with no run id) for this document.
  const { count: replaced, error: delErr } = await db
    .from("oem_knowledge_chunks")
    .delete({ count: "exact" })
    .eq("document_id", documentId)
    .or(`ingest_run_id.is.null,ingest_run_id.neq.${runId}`);
  if (delErr) throw new Error(`old chunk cleanup failed: ${delErr.message}`);

  const { error: updErr } = await db.from("oem_documents").update({ chunk_count: chunks.length, ingested_at: new Date().toISOString() }).eq("id", documentId);
  if (updErr) throw new Error(`oem_documents update failed: ${updErr.message}`);

  return { documentId, inserted: chunks.length, replaced: replaced ?? 0 };
}
