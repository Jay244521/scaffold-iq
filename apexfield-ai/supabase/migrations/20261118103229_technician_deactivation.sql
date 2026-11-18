-- ApexField: managers can deactivate a technician (sign-in banned in Auth) without
-- deleting their session history. Additive and safe to re-run.
alter table public.technicians
  add column if not exists deactivated_at timestamptz;
