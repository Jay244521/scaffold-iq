-- ApexField AI: OEM manual RAG storage.
--
-- Additive migration on top of the existing public.oem_knowledge_chunks table
-- (id, manufacturer, model_prefix, chunk_type, content, embedding vector(1536), created_at).
-- Safe to re-run: every statement is IF NOT EXISTS / CREATE OR REPLACE.
-- pgvector lives in the "extensions" schema on Supabase.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Source documents (one row per ingested PDF, keyed by file hash)
-- ---------------------------------------------------------------------------
create table if not exists public.oem_documents (
  id              uuid primary key default gen_random_uuid(),
  sha256          text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  manufacturer    text not null,
  model_prefix    text not null default '',
  title           text not null,
  doc_type        text not null default 'service_manual',
  source_file     text not null,
  page_count      integer not null check (page_count > 0),
  chunk_count     integer not null default 0,
  embedding_model text not null,
  ingested_at     timestamptz not null default now()
);

alter table public.oem_documents enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'oem_documents' and policyname = 'authenticated read oem documents') then
    create policy "authenticated read oem documents" on public.oem_documents for select to authenticated using (true);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Chunk metadata for retrieval, citations and idempotent re-ingestion
-- ---------------------------------------------------------------------------
alter table public.oem_knowledge_chunks
  add column if not exists document_id     uuid references public.oem_documents (id) on delete cascade,
  add column if not exists chunk_index     integer,
  add column if not exists section_path    text not null default '',
  add column if not exists page_start      integer,
  add column if not exists page_end        integer,
  add column if not exists token_count     integer,
  add column if not exists model_numbers   text[] not null default '{}',
  add column if not exists embedding_model text,
  add column if not exists ingest_run_id   uuid,
  add column if not exists content_hash    text,
  add column if not exists metadata        jsonb not null default '{}'::jsonb;

-- Keyword side of hybrid search: exact model numbers, error codes and part names
-- are where pure vector search is weakest.
alter table public.oem_knowledge_chunks
  add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(section_path, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored;

create unique index if not exists oem_chunks_document_chunk_uidx
  on public.oem_knowledge_chunks (document_id, chunk_index, ingest_run_id);
create index if not exists oem_chunks_document_idx on public.oem_knowledge_chunks (document_id);
create index if not exists oem_chunks_type_idx on public.oem_knowledge_chunks (chunk_type);
create index if not exists oem_chunks_fts_idx on public.oem_knowledge_chunks using gin (fts);
create index if not exists oem_chunks_models_idx on public.oem_knowledge_chunks using gin (model_numbers);

-- ---------------------------------------------------------------------------
-- HNSW cosine index (verify, don't duplicate)
-- The project already has idx_oem_embedding (hnsw, vector_cosine_ops). A second
-- HNSW index on the same column doubles write cost and memory for no gain, so
-- only create one when no cosine HNSW index exists yet.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'oem_knowledge_chunks'
      and indexdef ilike '%using hnsw%vector_cosine_ops%'
  ) then
    create index idx_oem_chunks_hnsw on public.oem_knowledge_chunks
      using hnsw (embedding extensions.vector_cosine_ops);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Retrieval functions
-- SECURITY INVOKER: callers see only what RLS lets them see (authenticated read,
-- or everything for the service role used by the Next.js server).
-- ---------------------------------------------------------------------------

-- Shared filter: brand, equipment model (a chunk applies when its model_prefix is
-- blank / brand-wide, is a prefix of the model, or the model appears in the chunk),
-- chunk types, and embedding model (never mix vectors from different models).
create or replace function public.oem_chunk_matches_filters(
  c public.oem_knowledge_chunks,
  filter_manufacturer text,
  filter_model text,
  filter_chunk_types text[],
  filter_embedding_model text
) returns boolean
language sql immutable parallel safe
set search_path = public, extensions
as $$
  select (filter_manufacturer is null or lower(c.manufacturer) = lower(filter_manufacturer))
     and (filter_model is null
          or c.model_prefix = ''
          or starts_with(upper(filter_model), upper(c.model_prefix))
          or upper(filter_model) = any (c.model_numbers))
     and (filter_chunk_types is null or c.chunk_type = any (filter_chunk_types))
     and (filter_embedding_model is null or c.embedding_model = filter_embedding_model)
$$;

-- Turn on pgvector 0.8+ iterative index scans so filtered queries still return
-- match_count rows; silently skipped on older pgvector.
create or replace function public.oem_tune_vector_scan(candidates integer)
returns void
language plpgsql volatile
set search_path = public, extensions
as $$
begin
  begin
    perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  exception when others then
    null;
  end;
  perform set_config('hnsw.ef_search', least(1000, greatest(40, candidates))::text, true);
end;
$$;

-- Pure semantic search.
create or replace function public.match_oem_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 8,
  filter_manufacturer text default null,
  filter_model text default null,
  filter_chunk_types text[] default null,
  filter_embedding_model text default null,
  min_similarity double precision default 0
) returns table (
  id uuid,
  document_id uuid,
  document_title text,
  manufacturer text,
  model_prefix text,
  chunk_type text,
  section_path text,
  page_start integer,
  page_end integer,
  content text,
  similarity double precision
)
language plpgsql volatile
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  perform public.oem_tune_vector_scan(match_count * 4);
  return query
  select c.id, c.document_id, d.title, c.manufacturer, c.model_prefix, c.chunk_type,
         c.section_path, c.page_start, c.page_end, c.content,
         (1 - (c.embedding <=> query_embedding))::double precision as similarity
  from public.oem_knowledge_chunks c
  left join public.oem_documents d on d.id = c.document_id
  where c.embedding is not null
    and public.oem_chunk_matches_filters(c, filter_manufacturer, filter_model, filter_chunk_types, filter_embedding_model)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
end;
$$;

-- Hybrid search: reciprocal rank fusion of vector similarity and full-text rank.
create or replace function public.hybrid_search_oem_chunks(
  query_text text,
  query_embedding extensions.vector(1536),
  match_count integer default 8,
  filter_manufacturer text default null,
  filter_model text default null,
  filter_chunk_types text[] default null,
  filter_embedding_model text default null,
  semantic_weight double precision default 1.0,
  keyword_weight double precision default 1.0,
  rrf_k integer default 60
) returns table (
  id uuid,
  document_id uuid,
  document_title text,
  manufacturer text,
  model_prefix text,
  chunk_type text,
  section_path text,
  page_start integer,
  page_end integer,
  content text,
  similarity double precision,
  keyword_rank double precision,
  score double precision
)
language plpgsql volatile
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  k integer := least(greatest(match_count, 1), 50);
  pool integer := least(greatest(match_count, 1), 50) * 4;
  -- websearch syntax (quoted phrases, -exclusions) but OR between plain terms: a spoken question
  -- like "subcooling at 95 degrees" should still match a chart that never says "degrees".
  q tsquery := nullif(replace(websearch_to_tsquery('english', coalesce(query_text, ''))::text, ' & ', ' | '), '')::tsquery;
begin
  perform public.oem_tune_vector_scan(pool);
  return query
  with semantic as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rn,
           (1 - (c.embedding <=> query_embedding))::double precision as sim
    from public.oem_knowledge_chunks c
    where c.embedding is not null
      and public.oem_chunk_matches_filters(c, filter_manufacturer, filter_model, filter_chunk_types, filter_embedding_model)
    order by c.embedding <=> query_embedding
    limit pool
  ),
  keyword as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, q) desc) as rn,
           ts_rank_cd(c.fts, q)::double precision as rank
    from public.oem_knowledge_chunks c
    where q is not null and c.fts @@ q
      and public.oem_chunk_matches_filters(c, filter_manufacturer, filter_model, filter_chunk_types, filter_embedding_model)
    order by ts_rank_cd(c.fts, q) desc
    limit pool
  ),
  fused as (
    select coalesce(s.id, kw.id) as id,
           s.sim,
           kw.rank,
           coalesce(semantic_weight / (rrf_k + s.rn), 0) + coalesce(keyword_weight / (rrf_k + kw.rn), 0) as score
    from semantic s
    full outer join keyword kw on kw.id = s.id
  )
  select c.id, c.document_id, d.title, c.manufacturer, c.model_prefix, c.chunk_type,
         c.section_path, c.page_start, c.page_end, c.content,
         f.sim, f.rank, f.score
  from fused f
  join public.oem_knowledge_chunks c on c.id = f.id
  left join public.oem_documents d on d.id = c.document_id
  order by f.score desc
  limit k;
end;
$$;

-- Functions are executable by PUBLIC by default; keep these off the anonymous API.
revoke execute on function public.oem_chunk_matches_filters(public.oem_knowledge_chunks, text, text, text[], text) from public, anon;
revoke execute on function public.oem_tune_vector_scan(integer) from public, anon;
revoke execute on function public.match_oem_chunks(extensions.vector, integer, text, text, text[], text, double precision) from public, anon;
revoke execute on function public.hybrid_search_oem_chunks(text, extensions.vector, integer, text, text, text[], text, double precision, double precision, integer) from public, anon;
grant execute on function public.oem_chunk_matches_filters(public.oem_knowledge_chunks, text, text, text[], text) to authenticated, service_role;
grant execute on function public.oem_tune_vector_scan(integer) to authenticated, service_role;
grant execute on function public.match_oem_chunks(extensions.vector, integer, text, text, text[], text, double precision) to authenticated, service_role;
grant execute on function public.hybrid_search_oem_chunks(text, extensions.vector, integer, text, text, text[], text, double precision, double precision, integer) to authenticated, service_role;
