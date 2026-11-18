-- ApexField: session lifecycle, AI escalations, consent trail, and demo-request leads.
-- Additive and safe to re-run.

-- service_sessions.status values in use: in_progress | escalated | completed | ended
--   ended = the technician stopped (or closed the app) before a root cause was confirmed.
alter table public.service_sessions
  add column if not exists escalation_reason text check (escalation_reason is null or char_length(escalation_reason) <= 600),
  add column if not exists escalated_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists consent_acknowledged_at timestamptz;

create index if not exists idx_sessions_org_started on public.service_sessions (org_id, started_at desc);

-- "Book a live field demo" form on the marketing site. Written only by the server
-- (service role); no client access at all.
create table if not exists public.demo_requests (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null check (char_length(full_name) between 2 and 80),
  company     text not null check (char_length(company) between 2 and 120),
  fleet_size  text not null,
  email       text not null check (char_length(email) <= 254),
  phone       text check (phone is null or char_length(phone) <= 40),
  source      text not null default 'site',
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_demo_requests_created on public.demo_requests (created_at desc);
alter table public.demo_requests enable row level security;
revoke all on public.demo_requests from anon, authenticated;
