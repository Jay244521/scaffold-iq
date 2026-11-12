-- Enable pgvector for OEM manual & error code retrieval
create extension if not exists vector;

-- 1. Organizations (HVAC Contractors)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_tier text not null default 'pilot', -- 'pilot', 'pro', 'enterprise'
  created_at timestamptz not null default now()
);

-- 2. Technicians (Extends Supabase auth.users)
create table technicians (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  full_name text not null,
  role text not null default 'tech', -- 'apprentice', 'tech', 'lead_tech', 'admin'
  experience_years int default 0,
  created_at timestamptz not null default now()
);

-- 3. Equipment Registry (Scanned Units)
create table equipment_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  manufacturer text not null,
  model_number text not null,
  serial_number text,
  equipment_type text not null, -- 'split_ac', 'heat_pump', 'gas_furnace', 'rtu'
  refrigerant_type text, -- 'R-410A', 'R-454B', 'R-32', 'R-22'
  tonnage numeric(4,2),
  data_plate_image_url text,
  created_at timestamptz not null default now()
);

-- 4. Service Sessions (The Core Coaching Loop)
create table service_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  tech_id uuid references technicians(id) on delete set null,
  equipment_id uuid references equipment_units(id) on delete set null,
  reported_symptom text not null,
  status text not null default 'in_progress', -- 'in_progress', 'escalated', 'completed'
  current_step_index int not null default 1,
  safety_disconnect_verified boolean not null default false,
  confirmed_root_cause text,
  parts_replaced jsonb default '[]'::jsonb,
  ai_summary_report text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 5. Diagnostic Steps & State Machine Logs
create table diagnostic_steps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references service_sessions(id) on delete cascade,
  step_number int not null,
  instruction text not null,
  expected_target text, -- e.g., '24V AC across Y and C'
  tech_observation text,
  captured_frame_url text,
  status text not null default 'pending', -- 'pending', 'passed', 'failed', 'skipped'
  created_at timestamptz not null default now()
);

-- 6. Structured Telemetry / Readings (The Data Moat)
create table diagnostic_readings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references service_sessions(id) on delete cascade,
  reading_type text not null, -- 'suction_psi', 'liquid_psi', 'superheat', 'subcooling', 'amp_draw', 'voltage', 'static_pressure'
  numeric_value numeric(10,2) not null,
  unit text not null, -- 'psi', 'degF', 'amps', 'volts', 'inWC'
  is_within_spec boolean,
  recorded_at timestamptz not null default now()
);

-- 7. OEM Manuals & Diagnostic Knowledge Base (RAG)
create table oem_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model_prefix text not null,
  chunk_type text not null, -- 'error_code', 'wiring_spec', 'charging_chart', 'sequence_of_ops'
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Indexes for fast lookup
create index idx_sessions_tech on service_sessions(tech_id);
create index idx_sessions_status on service_sessions(status);
create index idx_readings_session on diagnostic_readings(session_id);
create index idx_oem_model on oem_knowledge_chunks(manufacturer, model_prefix);
