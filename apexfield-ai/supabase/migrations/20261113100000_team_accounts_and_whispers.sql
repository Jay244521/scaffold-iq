-- ApexField: team accounts, manager whispers and a realtime fleet feed.
--
-- * technicians gets a truck label and a copy of the sign-in email for the manager's roster
--   (auth.users isn't readable from the client).
-- * private.is_org_manager(): admin / lead_tech of the signed-in user's org.
-- * manager_whispers: guidance a manager pushes to a technician's live session. Managers in
--   the session's org can insert; the session's technician can mark it delivered; the org can read.
-- * Coaching tables join the supabase_realtime publication. Realtime evaluates RLS per
--   subscriber, so managers only receive their own org's rows.

alter table public.technicians
  add column if not exists truck_label text check (truck_label is null or char_length(truck_label) <= 24),
  add column if not exists email text;

create or replace function private.is_org_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select t.role in ('admin', 'lead_tech') from public.technicians t where t.id = auth.uid()), false)
$$;
revoke all on function private.is_org_manager() from public, anon;
grant execute on function private.is_org_manager() to authenticated;

create table if not exists public.manager_whispers (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.service_sessions (id) on delete cascade,
  org_id       uuid not null references public.organizations (id) on delete cascade,
  author_id    uuid references public.technicians (id) on delete set null,
  body         text not null check (char_length(btrim(body)) between 1 and 500),
  created_at   timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists idx_whispers_session on public.manager_whispers (session_id, created_at);
create index if not exists idx_whispers_org on public.manager_whispers (org_id);
create index if not exists idx_whispers_author on public.manager_whispers (author_id);

alter table public.manager_whispers enable row level security;

drop policy if exists "org reads whispers" on public.manager_whispers;
create policy "org reads whispers" on public.manager_whispers
  for select to authenticated
  using (org_id = (select private.current_org_id()));

drop policy if exists "managers send whispers" on public.manager_whispers;
create policy "managers send whispers" on public.manager_whispers
  for insert to authenticated
  with check (
    org_id = (select private.current_org_id())
    and author_id = (select auth.uid())
    and (select private.is_org_manager())
    and exists (select 1 from public.service_sessions s where s.id = session_id and s.org_id = manager_whispers.org_id)
  );

drop policy if exists "session tech marks delivered" on public.manager_whispers;
create policy "session tech marks delivered" on public.manager_whispers
  for update to authenticated
  using (exists (select 1 from public.service_sessions s where s.id = session_id and s.tech_id = (select auth.uid())))
  with check (exists (select 1 from public.service_sessions s where s.id = session_id and s.tech_id = (select auth.uid())));

-- The technician may only stamp delivered_at, never rewrite what the manager said.
revoke update on public.manager_whispers from authenticated, anon;
grant update (delivered_at) on public.manager_whispers to authenticated;
revoke all on public.manager_whispers from anon;

-- Realtime feed for the fleet dashboard and whisper delivery.
do $$
declare t text;
begin
  foreach t in array array['service_sessions', 'diagnostic_readings', 'diagnostic_steps', 'manager_whispers'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
