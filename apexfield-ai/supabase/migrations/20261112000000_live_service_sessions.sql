-- ApexField AI: live Gemini coaching sessions.
-- Written only by Next.js route handlers using the service-role key.
-- RLS is enabled with no policies, so the anon/authenticated keys cannot read or write these tables.

create table if not exists public.equipment_units (
  id               uuid primary key default gen_random_uuid(),
  manufacturer     text not null,
  model_number     text not null,
  serial_number    text,
  equipment_type   text not null,
  refrigerant_type text,
  tonnage          numeric(6, 2) check (tonnage is null or tonnage > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint equipment_units_identity unique nulls not distinct (manufacturer, model_number, serial_number)
);

create table if not exists public.service_sessions (
  id                          uuid primary key default gen_random_uuid(),
  status                      text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  model                       text not null,
  equipment_unit_id           uuid references public.equipment_units (id) on delete set null,
  safety_disconnect_verified  boolean not null default false,
  safety_verification_method  text check (safety_verification_method in ('visual_frame', 'verbal_confirmation')),
  safety_verification_notes   text,
  safety_verified_at          timestamptz,
  confirmed_root_cause        text,
  parts_replaced              text[] not null default '{}',
  dispatch_summary_report     text,
  started_at                  timestamptz not null default now(),
  completed_at                timestamptz
);

create table if not exists public.diagnostic_readings (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.service_sessions (id) on delete cascade,
  reading_type     text not null check (reading_type in (
                     'suction_psi', 'liquid_psi', 'superheat', 'subcooling',
                     'amp_draw', 'voltage', 'static_pressure', 'capacitance_uf')),
  numeric_value    double precision not null,
  unit             text not null,
  is_within_spec   boolean not null,
  target_spec_note text not null default '',
  recorded_at      timestamptz not null default now()
);

create table if not exists public.diagnostic_steps (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.service_sessions (id) on delete cascade,
  step_number     smallint not null check (step_number between 1 and 5),
  instruction     text not null,
  expected_target text not null,
  status          text not null check (status in ('passed', 'failed', 'in_progress')),
  recorded_at     timestamptz not null default now()
);

create index if not exists service_sessions_equipment_idx on public.service_sessions (equipment_unit_id);
create index if not exists diagnostic_readings_session_idx on public.diagnostic_readings (session_id, recorded_at);
create index if not exists diagnostic_steps_session_idx on public.diagnostic_steps (session_id, recorded_at);

alter table public.equipment_units     enable row level security;
alter table public.service_sessions    enable row level security;
alter table public.diagnostic_readings enable row level security;
alter table public.diagnostic_steps    enable row level security;
