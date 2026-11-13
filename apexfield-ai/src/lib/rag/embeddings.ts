/**
 * 1536-dimension embeddings for oem_knowledge_chunks.embedding vector(1536).
 *
 * - gemini: gemini-embedding-001 with outputDimensionality 1536 (reuses GEMINI_API_KEY).
 *   text-embedding-004 is 768-dim only, so it cannot fill a vector(1536) column.
 * - openai: text-embedding-3-small (1536 native).
 *
 * Vectors from different models live in different spaces. Every row records its
 * embedding_model and searches filter on it, so never mix providers per query.
 */
import { GoogleGenAI } from "@google/genai";

export const EMBEDDING_DIMENSIONS = 1536;

export type EmbeddingProvider = "gemini" | "openai";

export interface Embedder {
  provider: EmbeddingProvider;
  /** Stored in oem_knowledge_chunks.embedding_model, e.g. "gemini-embedding-001@1536". */
  model: string;
  embedDocuments(texts: string[], onProgress?: (done: number, total: number) => void): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

const GEMINI_MODEL = "gemini-embedding-001";
const OPENAI_MODEL = "text-embedding-3-small";
const BATCH = { gemini: 100, openai: 100 } as const;

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry 429 / 5xx / network errors with exponential backoff + jitter; honor Retry-After. */
export async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 6): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = e instanceof HttpError ? e.status : ((e as { status?: number })?.status ?? 0);
      const retryable = status === 0 || status === 408 || status === 429 || status >= 500;
      if (!retryable || i === attempts - 1) break;
      const wait = (e instanceof HttpError && e.retryAfterMs) || Math.min(30_000, 1000 * 2 ** i) + Math.random() * 400;
      console.warn(`[embeddings] ${label} failed (${status || "network"}), retry ${i + 1}/${attempts - 1} in ${Math.round(wait)}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

function normalize(v: number[]): number[] {
  const n = Math.hypot(...v);
  return n > 0 ? v.map((x) => x / n) : v;
}

function check(vectors: number[][], expected: number): number[][] {
  if (vectors.length !== expected) throw new Error(`Expected ${expected} embeddings, got ${vectors.length}`);
  for (const v of vectors) {
    if (v.length !== EMBEDDING_DIMENSIONS) throw new Error(`Expected ${EMBEDDING_DIMENSIONS}-dim embeddings, got ${v.length}`);
    if (v.some((x) => !Number.isFinite(x))) throw new Error("Embedding contains a non-finite value");
  }
  return vectors.map(normalize);
}

async function inBatches(texts: string[], size: number, run: (batch: string[]) => Promise<number[][]>, onProgress?: (d: number, t: number) => void) {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += size) {
    out.push(...(await run(texts.slice(i, i + size))));
    onProgress?.(Math.min(i + size, texts.length), texts.length);
  }
  return out;
}

function geminiEmbedder(apiKey: string): Embedder {
  const ai = new GoogleGenAI({ apiKey });
  const embed = async (texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") => {
    const res = await withRetry(
      () => ai.models.embedContent({ model: GEMINI_MODEL, contents: texts, config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS } }),
      `gemini batch of ${texts.length}`,
    );
    return check((res.embeddings ?? []).map((e) => e.values ?? []), texts.length);
  };
  return {
    provider: "gemini",
    model: `${GEMINI_MODEL}@${EMBEDDING_DIMENSIONS}`,
    embedDocuments: (texts, onProgress) => inBatches(texts, BATCH.gemini, (b) => embed(b, "RETRIEVAL_DOCUMENT"), onProgress),
    embedQuery: async (text) => (await embed([text], "RETRIEVAL_QUERY"))[0],
  };
}

function openaiEmbedder(apiKey: string): Embedder {
  const embed = async (texts: string[]) => {
    const json = await withRetry(async () => {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: OPENAI_MODEL, input: texts, dimensions: EMBEDDING_DIMENSIONS }),
      });
      if (!res.ok) {
        const ra = Number(res.headers.get("retry-after"));
        throw new HttpError(`OpenAI embeddings ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status, ra > 0 ? ra * 1000 : undefined);
      }
      return (await res.json()) as { data: { index: number; embedding: number[] }[] };
    }, `openai batch of ${texts.length}`);
    return check([...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding), texts.length);
  };
  return {
    provider: "openai",
    model: `${OPENAI_MODEL}@${EMBEDDING_DIMENSIONS}`,
    embedDocuments: (texts, onProgress) => inBatches(texts, BATCH.openai, embed, onProgress),
    embedQuery: async (text) => (await embed([text]))[0],
  };
}

/** EMBEDDING_PROVIDER wins; otherwise Gemini when GEMINI_API_KEY is set, else OpenAI. */
export function createEmbedder(provider = process.env.EMBEDDING_PROVIDER as EmbeddingProvider | undefined): Embedder {
  const chosen: EmbeddingProvider = provider ?? (process.env.GEMINI_API_KEY ? "gemini" : "openai");
  if (chosen === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set (EMBEDDING_PROVIDER=gemini).");
    return geminiEmbedder(key);
  }
  if (chosen === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set (EMBEDDING_PROVIDER=openai).");
    return openaiEmbedder(key);
  }
  throw new Error(`Unknown EMBEDDING_PROVIDER "${chosen}". Use "gemini" or "openai".`);
}
