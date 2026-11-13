-- Row Level Security for the HVAC coaching schema.
-- Supabase exposes every table in `public` through its REST API, so without RLS
-- anyone holding the anon key could read and write every org's data.
-- Every tenant-owned row is scoped to the signed-in technician's org.
-- Writes to organizations, technicians, and oem_knowledge_chunks go through the
-- service role (admin tooling / ingestion jobs), which bypasses RLS.

-- Org of the signed-in technician. SECURITY DEFINER so policies on
-- `technicians` can call it without recursing into their own RLS check.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.technicians where id = auth.uid()
$$;

revoke all on function public.current_org_id() from public;
grant execute on function public.current_org_id() to authenticated;

alter table organizations        enable row level security;
alter table technicians          enable row level security;
alter table equipment_units      enable row level security;
alter table service_sessions     enable row level security;
alter table diagnostic_steps     enable row level security;
alter table diagnostic_readings  enable row level security;
alter table oem_knowledge_chunks enable row level security;

-- Organizations: members can see their own org.
create policy "members read own org" on organizations
  for select to authenticated
  using (id = (select public.current_org_id()));

-- Technicians: members can see their org's roster.
create policy "members read org technicians" on technicians
  for select to authenticated
  using (org_id = (select public.current_org_id()));

-- Equipment: full access within the org.
create policy "org equipment access" on equipment_units
  for all to authenticated
  using (org_id = (select public.current_org_id()))
  with check (org_id = (select public.current_org_id()));

-- Sessions: full access within the org.
create policy "org session access" on service_sessions
  for all to authenticated
  using (org_id = (select public.current_org_id()))
  with check (org_id = (select public.current_org_id()));

-- Steps and readings inherit access from their session.
create policy "org step access" on diagnostic_steps
  for all to authenticated
  using (exists (
    select 1 from service_sessions s
    where s.id = session_id and s.org_id = (select public.current_org_id())))
  with check (exists (
    select 1 from service_sessions s
    where s.id = session_id and s.org_id = (select public.current_org_id())));

create policy "org reading access" on diagnostic_readings
  for all to authenticated
  using (exists (
    select 1 from service_sessions s
    where s.id = session_id and s.org_id = (select public.current_org_id())))
  with check (exists (
    select 1 from service_sessions s
    where s.id = session_id and s.org_id = (select public.current_org_id())));

-- OEM knowledge base: shared reference data, readable by any signed-in tech.
create policy "authenticated read oem knowledge" on oem_knowledge_chunks
  for select to authenticated
  using (true);

-- Indexes on foreign keys used by the policies and joins above.
create index idx_technicians_org      on technicians(org_id);
create index idx_equipment_org        on equipment_units(org_id);
create index idx_sessions_org         on service_sessions(org_id);
create index idx_sessions_equipment   on service_sessions(equipment_id);
create index idx_steps_session        on diagnostic_steps(session_id, step_number);

-- Approximate nearest-neighbour index for RAG similarity search (cosine).
create index idx_oem_embedding on oem_knowledge_chunks
  using hnsw (embedding vector_cosine_ops);
