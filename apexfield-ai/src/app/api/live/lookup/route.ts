import { NextResponse } from "next/server";
import { parseLookupArgs } from "@/lib/ai/hvac-tools";
import { createEmbedder, type Embedder } from "@/lib/rag/embeddings";
import { searchOemKnowledge, type OemSearchHit } from "@/lib/rag/search";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { allowAnonymousLive, getAuthContext } from "@/lib/supabase/server-auth";
import { guardRequest } from "@/lib/server/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many excerpts go back to the model, and how long each may be. Keeps tool responses small. */
const MAX_HITS = 4;
const MAX_EXCERPT_CHARS = 1200;
/** Drop weak matches: keep a hit if it matched keywords or is semantically close enough. */
const MIN_SIMILARITY = 0.45;
const CACHE_MS = 5 * 60_000;

let embedder: Embedder | null | undefined;
function getEmbedder(): Embedder | null {
  if (embedder === undefined) {
    try {
      embedder = createEmbedder();
    } catch {
      embedder = null;
    }
  }
  return embedder;
}

type LookupResult = { source: string; chunk_type: string; pages: string | null; excerpt: string; similarity: number | null };
type LookupBody = { found: boolean; results: LookupResult[]; available: boolean; reason?: string };

const cache = new Map<string, { at: number; body: LookupBody }>();

function toResult(h: OemSearchHit): LookupResult {
  const pages = h.page_start ? `p.${h.page_start}${h.page_end && h.page_end !== h.page_start ? `–${h.page_end}` : ""}` : null;
  const source = [`${h.manufacturer}${h.model_prefix ? ` ${h.model_prefix}` : ""}`, h.document_title, h.section_path].filter(Boolean).join(" › ");
  const excerpt = h.content.length > MAX_EXCERPT_CHARS ? `${h.content.slice(0, MAX_EXCERPT_CHARS)}…` : h.content;
  return { source: pages ? `${source} (${pages})` : source, chunk_type: h.chunk_type, pages, excerpt, similarity: h.similarity };
}

/**
 * POST /api/live/lookup
 * Body: { query: string, chunk_type?: string, manufacturer: string, model: string }
 *
 * Backs the live coach's lookup_oem_spec tool. The browser supplies brand and model
 * from the equipment registered in the session, so results are always filtered to
 * that unit's manuals. Read-only; nothing is persisted.
 */
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth?.tech && !allowAnonymousLive()) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const blocked = guardRequest(req, { key: "live-lookup", limit: 60, windowMs: 60_000, subject: auth?.user.id });
  if (blocked) return blocked;

  let body: { query?: unknown; chunk_type?: unknown; manufacturer?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseLookupArgs({ query: body.query, chunk_type: body.chunk_type });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const manufacturer = typeof body.manufacturer === "string" ? body.manufacturer.trim().slice(0, 80) : "";
  const model = typeof body.model === "string" ? body.model.trim().toUpperCase().slice(0, 40) : "";
  if (!manufacturer || !model) {
    return NextResponse.json({ error: "manufacturer and model are required (register the data plate first)" }, { status: 400 });
  }

  // Signed in: search as the user (oem_knowledge_chunks is readable by any authenticated tech).
  const db = auth?.tech ? auth.supabase : getSupabaseAdmin();
  const emb = getEmbedder();
  if (!db || !emb) {
    const reason = !db ? "Supabase is not configured on this server." : "No embedding API key is configured on this server.";
    return NextResponse.json({ found: false, results: [], available: false, reason } satisfies LookupBody);
  }

  const key = JSON.stringify([manufacturer.toLowerCase(), model, parsed.args.chunk_type ?? "", parsed.args.query.toLowerCase()]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.body);

  try {
    const hits = await searchOemKnowledge(db, emb, {
      query: parsed.args.query,
      manufacturer,
      model,
      chunkTypes: parsed.args.chunk_type ? [parsed.args.chunk_type] : undefined,
      k: MAX_HITS * 2,
    });
    const results = hits
      .filter((h) => (h.keyword_rank ?? 0) > 0 || (h.similarity ?? 0) >= MIN_SIMILARITY)
      .slice(0, MAX_HITS)
      .map(toResult);
    const out: LookupBody = { found: results.length > 0, results, available: true };
    cache.set(key, { at: Date.now(), body: out });
    if (cache.size > 500) for (const [k, v] of cache) if (Date.now() - v.at > CACHE_MS) cache.delete(k);
    return NextResponse.json(out);
  } catch (e) {
    console.error("[live/lookup]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Manual lookup failed." }, { status: 502 });
  }
}
