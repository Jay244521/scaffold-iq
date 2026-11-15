-- Warehouse Ops — core schema
-- Organizations (tenants), memberships with roles, facilities, invitations, suppliers,
-- receiving exception incidents, comments, evidence, incident history and audit log.
--
-- Security model
--   * Every tenant-owned row carries org_id. Row Level Security (RLS) limits every
--     read and write to members of that organization.
--   * Child rows (comments, evidence, history) use composite foreign keys
--     (incident_id, org_id) so a row can never point at another tenant's incident.
--   * Roles are ordered: viewer < operator < supervisor < manager < admin < owner.
--   * Rules that RLS can't express per column (who may assign, close, change roles)
--     are enforced by BEFORE triggers. History and audit rows are written only by
--     triggers; no user can insert, edit or delete them.
--   * Internal helpers live in the "private" schema, which the Supabase API does not expose.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
-- Declared lowest to highest so roles can be compared with >=.
create type public.app_role as enum ('viewer', 'operator', 'supervisor', 'manager', 'admin', 'owner');
create type public.exception_type as enum ('shortage', 'overage', 'damaged', 'wrong_item', 'other');
create type public.incident_status as enum ('open', 'in_progress', 'resolved', 'closed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  code text check (code is null or code ~ '^[A-Za-z0-9_-]{1,16}$'),
  address text check (address is null or char_length(address) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, name)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.app_role not null check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create index invitations_org_id_idx on public.invitations (org_id);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create unique index suppliers_org_name_uidx on public.suppliers (org_id, lower(name));

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  number integer not null,
  facility_id uuid not null,
  type public.exception_type not null,
  status public.incident_status not null default 'open',
  supplier_id uuid,
  po_number text check (po_number is null or char_length(po_number) <= 64),
  shipment_ref text check (shipment_ref is null or char_length(shipment_ref) <= 64),
  sku text check (sku is null or char_length(sku) <= 64),
  item_description text check (item_description is null or char_length(item_description) <= 300),
  expected_qty numeric(14, 3) check (expected_qty is null or expected_qty >= 0),
  received_qty numeric(14, 3) check (received_qty is null or received_qty >= 0),
  description text not null check (char_length(btrim(description)) between 1 and 5000),
  occurred_at timestamptz not null,
  reported_by uuid references auth.users (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  resolution_notes text check (resolution_notes is null or char_length(resolution_notes) <= 5000),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, number),
  foreign key (facility_id, org_id) references public.facilities (id, org_id),
  foreign key (supplier_id, org_id) references public.suppliers (id, org_id)
);
create index incidents_org_status_idx on public.incidents (org_id, status);
create index incidents_org_occurred_idx on public.incidents (org_id, occurred_at desc);
create index incidents_facility_idx on public.incidents (facility_id);
create index incidents_supplier_idx on public.incidents (supplier_id);
create index incidents_assigned_idx on public.incidents (assigned_to);

create table public.incident_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  incident_id uuid not null,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (incident_id, org_id) references public.incidents (id, org_id) on delete cascade
);
create index incident_comments_incident_idx on public.incident_comments (incident_id);

create table public.incident_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  incident_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (incident_id, org_id) references public.incidents (id, org_id) on delete cascade,
  -- Evidence must be stored under {org_id}/{incident_id}/ — the storage policies rely on this.
  check (storage_path like org_id::text || '/' || incident_id::text || '/%')
);
create index incident_attachments_incident_idx on public.incident_attachments (incident_id);

create table public.incident_events (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  incident_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  from_value text,
  to_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (incident_id, org_id) references public.incidents (id, org_id) on delete cascade
);
create index incident_events_incident_idx on public.incident_events (incident_id, created_at);

-- No foreign key to organizations: audit history outlives deleted records.
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so policies can read memberships
-- without recursive RLS; they only ever answer questions about auth.uid()).
-- ---------------------------------------------------------------------------
create function private.role_in(p_org uuid)
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.memberships m where m.org_id = p_org and m.user_id = (select auth.uid())
$$;

create function private.has_min_role(p_org uuid, p_min public.app_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role >= p_min
  )
$$;

create function private.is_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_min_role(p_org, 'viewer')
$$;

create function private.shares_org_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  )
$$;

-- True when the current statement runs as an end user (browser / app session)
-- rather than a trusted database role (migrations, SQL editor, definer functions).
create function private.is_end_user()
returns boolean
language sql stable set search_path = ''
as $$
  select current_user in ('authenticated', 'anon')
$$;

-- Parse "{org_id}/{incident_id}/{file}" storage paths without throwing on bad input.
create function private.path_uuid(p_name text, p_part integer)
returns uuid
language plpgsql immutable set search_path = ''
as $$
declare
  v text := split_part(p_name, '/', p_part);
begin
  if v ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return v::uuid;
  end if;
  return null;
end
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: profiles
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Triggers: membership guard (role changes and removals)
-- ---------------------------------------------------------------------------
create function private.guard_membership()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_actor_role public.app_role;
  v_other_owners integer;
begin
  if tg_op = 'UPDATE' and (new.org_id <> old.org_id or new.user_id <> old.user_id) then
    raise exception 'Membership organization and user cannot be changed' using errcode = '42501';
  end if;

  if private.is_end_user() then
    v_actor_role := private.role_in(old.org_id);

    if tg_op = 'UPDATE' then
      if old.user_id = (select auth.uid()) then
        raise exception 'You cannot change your own role' using errcode = '42501';
      end if;
      if (old.role = 'owner' or new.role = 'owner') and v_actor_role is distinct from 'owner' then
        raise exception 'Only an owner can grant or change the owner role' using errcode = '42501';
      end if;
    else -- DELETE
      if old.user_id <> (select auth.uid()) and old.role = 'owner' and v_actor_role is distinct from 'owner' then
        raise exception 'Only an owner can remove another owner' using errcode = '42501';
      end if;
    end if;
  end if;

  -- An organization must always keep at least one owner (applies to everyone,
  -- except when the organization itself is being deleted).
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.organizations o where o.id = old.org_id) then
    select count(*) into v_other_owners
    from public.memberships m
    where m.org_id = old.org_id and m.role = 'owner' and m.user_id <> old.user_id;
    if v_other_owners = 0 then
      raise exception 'An organization must keep at least one owner' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create trigger memberships_guard
before update or delete on public.memberships
for each row execute function private.guard_membership();

-- ---------------------------------------------------------------------------
-- Triggers: incidents (numbering, field rules, resolution timestamps)
-- ---------------------------------------------------------------------------
create function private.incident_before_insert()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if private.is_end_user() then
    -- Never trust the browser for who reported it or its workflow state.
    new.reported_by := (select auth.uid());
    new.status := 'open';
    new.resolution_notes := null;
    new.resolved_at := null;
    new.resolved_by := null;
    new.created_at := now();
    if new.assigned_to is not null and not private.has_min_role(new.org_id, 'supervisor') then
      raise exception 'Only supervisors and above can assign incidents' using errcode = '42501';
    end if;
  end if;

  if new.assigned_to is not null and not exists (
    select 1 from public.memberships m where m.org_id = new.org_id and m.user_id = new.assigned_to
  ) then
    raise exception 'Incidents can only be assigned to members of the organization' using errcode = '23514';
  end if;

  -- Per-organization incident numbers (EX-1, EX-2, ...), serialized per org.
  perform pg_advisory_xact_lock(hashtextextended('incident-number:' || new.org_id::text, 0));
  select coalesce(max(i.number), 0) + 1 into new.number from public.incidents i where i.org_id = new.org_id;

  new.updated_at := now();
  return new;
end
$$;

create trigger incidents_before_insert
before insert on public.incidents
for each row execute function private.incident_before_insert();

create function private.incident_before_update()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_is_supervisor boolean;
begin
  if new.org_id <> old.org_id or new.number <> old.number or new.created_at <> old.created_at
     or new.reported_by is distinct from old.reported_by then
    raise exception 'Incident organization, number, reporter and creation time cannot be changed' using errcode = '42501';
  end if;

  if private.is_end_user() then
    v_is_supervisor := private.has_min_role(old.org_id, 'supervisor');

    if new.assigned_to is distinct from old.assigned_to and not v_is_supervisor then
      raise exception 'Only supervisors and above can assign incidents' using errcode = '42501';
    end if;
    if (new.status = 'closed') <> (old.status = 'closed') and not v_is_supervisor then
      raise exception 'Only supervisors and above can close or reopen closed incidents' using errcode = '42501';
    end if;
    if not v_is_supervisor and (
      new.facility_id, new.type, new.supplier_id, new.po_number, new.shipment_ref, new.sku,
      new.item_description, new.expected_qty, new.received_qty, new.description, new.occurred_at
    ) is distinct from (
      old.facility_id, old.type, old.supplier_id, old.po_number, old.shipment_ref, old.sku,
      old.item_description, old.expected_qty, old.received_qty, old.description, old.occurred_at
    ) then
      raise exception 'Only supervisors and above can edit incident details' using errcode = '42501';
    end if;
    -- Resolution timestamps are system-controlled.
    new.resolved_at := old.resolved_at;
    new.resolved_by := old.resolved_by;
  end if;

  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null and not exists (
    select 1 from public.memberships m where m.org_id = new.org_id and m.user_id = new.assigned_to
  ) then
    raise exception 'Incidents can only be assigned to members of the organization' using errcode = '23514';
  end if;

  if new.status in ('resolved', 'closed') then
    if coalesce(btrim(new.resolution_notes), '') = '' then
      raise exception 'Resolution notes are required to resolve or close an incident' using errcode = '23514';
    end if;
    if old.status not in ('resolved', 'closed') then
      new.resolved_at := now();
      new.resolved_by := (select auth.uid());
    end if;
  elsif old.status in ('resolved', 'closed') then
    -- Reopened.
    new.resolved_at := null;
    new.resolved_by := null;
  end if;

  new.updated_at := now();
  return new;
end
$$;

create trigger incidents_before_update
before update on public.incidents
for each row execute function private.incident_before_update();

-- History: written by the database, so it cannot be skipped or forged.
create function private.incident_history()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, to_value)
    values (new.org_id, new.id, v_actor, 'created', new.status::text);
    if new.assigned_to is not null then
      insert into public.incident_events (org_id, incident_id, actor_id, event_type, to_value)
      values (new.org_id, new.id, v_actor, 'assigned', new.assigned_to::text);
    end if;
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, from_value, to_value)
    values (new.org_id, new.id, v_actor, 'status_changed', old.status::text, new.status::text);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, from_value, to_value)
    values (new.org_id, new.id, v_actor, 'assigned', old.assigned_to::text, new.assigned_to::text);
  end if;
  if new.resolution_notes is distinct from old.resolution_notes then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, to_value)
    values (new.org_id, new.id, v_actor, 'resolution_notes_updated', left(new.resolution_notes, 500));
  end if;

  if new.facility_id is distinct from old.facility_id then v_changed := v_changed || 'facility'; end if;
  if new.type is distinct from old.type then v_changed := v_changed || 'type'; end if;
  if new.supplier_id is distinct from old.supplier_id then v_changed := v_changed || 'supplier'; end if;
  if new.po_number is distinct from old.po_number then v_changed := v_changed || 'po_number'; end if;
  if new.shipment_ref is distinct from old.shipment_ref then v_changed := v_changed || 'shipment_ref'; end if;
  if new.sku is distinct from old.sku then v_changed := v_changed || 'sku'; end if;
  if new.item_description is distinct from old.item_description then v_changed := v_changed || 'item_description'; end if;
  if new.expected_qty is distinct from old.expected_qty then v_changed := v_changed || 'expected_qty'; end if;
  if new.received_qty is distinct from old.received_qty then v_changed := v_changed || 'received_qty'; end if;
  if new.description is distinct from old.description then v_changed := v_changed || 'description'; end if;
  if new.occurred_at is distinct from old.occurred_at then v_changed := v_changed || 'occurred_at'; end if;
  if cardinality(v_changed) > 0 then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, metadata)
    values (new.org_id, new.id, v_actor, 'details_updated', jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;
  return null;
end
$$;

create trigger incidents_history
after insert or update on public.incidents
for each row execute function private.incident_history();

create function private.incident_child_history()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'incident_comments' then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type)
    values (new.org_id, new.incident_id, (select auth.uid()), 'comment_added');
  elsif tg_op = 'INSERT' then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, to_value)
    values (new.org_id, new.incident_id, (select auth.uid()), 'evidence_added', new.file_name);
  elsif exists (select 1 from public.incidents i where i.id = old.incident_id) then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, from_value)
    values (old.org_id, old.incident_id, (select auth.uid()), 'evidence_removed', old.file_name);
  end if;
  return null;
end
$$;

create trigger incident_comments_history
after insert on public.incident_comments
for each row execute function private.incident_child_history();

create trigger incident_attachments_history
after insert or delete on public.incident_attachments
for each row execute function private.incident_child_history();

-- Comments are force-attributed to the signed-in user.
create function private.set_author()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if private.is_end_user() then
    if tg_table_name = 'incident_comments' then
      new.author_id := (select auth.uid());
    else
      new.uploaded_by := (select auth.uid());
    end if;
    new.created_at := now();
  end if;
  return new;
end
$$;

create trigger incident_comments_author
before insert on public.incident_comments
for each row execute function private.set_author();

create trigger incident_attachments_uploader
before insert on public.incident_attachments
for each row execute function private.set_author();

create function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger facilities_touch
before update on public.facilities
for each row execute function private.touch_updated_at();

create function private.set_supplier_creator()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if private.is_end_user() then
    new.created_by := (select auth.uid());
  end if;
  new.name := btrim(new.name);
  return new;
end
$$;

create trigger suppliers_creator
before insert on public.suppliers
for each row execute function private.set_supplier_creator();

-- ---------------------------------------------------------------------------
-- Audit log (administrative changes)
-- ---------------------------------------------------------------------------
create function private.audit_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'token_hash' end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'token_hash' end;
  v_org uuid;
begin
  if tg_table_name = 'organizations' then
    v_org := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
  else
    v_org := coalesce(v_new ->> 'org_id', v_old ->> 'org_id')::uuid;
  end if;

  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_org,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'user_id', v_old ->> 'user_id'),
    jsonb_strip_nulls(jsonb_build_object('old', v_old, 'new', v_new))
  );
  return null;
end
$$;

create trigger organizations_audit after insert or update or delete on public.organizations
for each row execute function private.audit_row();
create trigger memberships_audit after insert or update or delete on public.memberships
for each row execute function private.audit_row();
create trigger facilities_audit after insert or update or delete on public.facilities
for each row execute function private.audit_row();
create trigger invitations_audit after insert or update or delete on public.invitations
for each row execute function private.audit_row();
create trigger suppliers_audit after update or delete on public.suppliers
for each row execute function private.audit_row();
create trigger incidents_delete_audit after delete on public.incidents
for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.facilities enable row level security;
alter table public.invitations enable row level security;
alter table public.suppliers enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_comments enable row level security;
alter table public.incident_attachments enable row level security;
alter table public.incident_events enable row level security;
alter table public.audit_log enable row level security;

-- Organizations: created only through create_organization().
create policy "members read their organization" on public.organizations
  for select to authenticated using (private.is_member(id));
create policy "admins update their organization" on public.organizations
  for update to authenticated using (private.has_min_role(id, 'admin')) with check (private.has_min_role(id, 'admin'));

-- Profiles: yourself and people in your organizations.
create policy "read own and teammates' profiles" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or private.shares_org_with(id));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Memberships: created only through create_organization() / accept_invitation().
create policy "members read memberships" on public.memberships
  for select to authenticated using (private.is_member(org_id));
create policy "admins change roles" on public.memberships
  for update to authenticated using (private.has_min_role(org_id, 'admin')) with check (private.has_min_role(org_id, 'admin'));
create policy "admins remove members, members leave" on public.memberships
  for delete to authenticated using (private.has_min_role(org_id, 'admin') or user_id = (select auth.uid()));

-- Facilities
create policy "members read facilities" on public.facilities
  for select to authenticated using (private.is_member(org_id));
create policy "managers create facilities" on public.facilities
  for insert to authenticated with check (private.has_min_role(org_id, 'manager'));
create policy "managers update facilities" on public.facilities
  for update to authenticated using (private.has_min_role(org_id, 'manager')) with check (private.has_min_role(org_id, 'manager'));
create policy "admins delete facilities" on public.facilities
  for delete to authenticated using (private.has_min_role(org_id, 'admin'));

-- Invitations: written only through create_invitation() / revoke_invitation() / accept_invitation().
create policy "admins read invitations" on public.invitations
  for select to authenticated using (private.has_min_role(org_id, 'admin'));

-- Suppliers
create policy "members read suppliers" on public.suppliers
  for select to authenticated using (private.is_member(org_id));
create policy "operators add suppliers" on public.suppliers
  for insert to authenticated with check (private.has_min_role(org_id, 'operator'));
create policy "managers update suppliers" on public.suppliers
  for update to authenticated using (private.has_min_role(org_id, 'manager')) with check (private.has_min_role(org_id, 'manager'));
create policy "managers delete suppliers" on public.suppliers
  for delete to authenticated using (private.has_min_role(org_id, 'manager'));

-- Incidents
create policy "members read incidents" on public.incidents
  for select to authenticated using (private.is_member(org_id));
create policy "operators create incidents" on public.incidents
  for insert to authenticated with check (private.has_min_role(org_id, 'operator'));
create policy "supervisors, assignees and reporters update incidents" on public.incidents
  for update to authenticated
  using (
    private.has_min_role(org_id, 'supervisor')
    or (private.has_min_role(org_id, 'operator') and (assigned_to = (select auth.uid()) or reported_by = (select auth.uid())))
  )
  with check (
    private.has_min_role(org_id, 'supervisor')
    or (private.has_min_role(org_id, 'operator') and (assigned_to = (select auth.uid()) or reported_by = (select auth.uid())))
  );
create policy "admins delete incidents" on public.incidents
  for delete to authenticated using (private.has_min_role(org_id, 'admin'));

-- Comments: append-only.
create policy "members read comments" on public.incident_comments
  for select to authenticated using (private.is_member(org_id));
create policy "operators add comments" on public.incident_comments
  for insert to authenticated with check (private.has_min_role(org_id, 'operator'));

-- Evidence metadata
create policy "members read evidence" on public.incident_attachments
  for select to authenticated using (private.is_member(org_id));
create policy "operators add evidence" on public.incident_attachments
  for insert to authenticated with check (private.has_min_role(org_id, 'operator'));
create policy "supervisors remove evidence" on public.incident_attachments
  for delete to authenticated using (private.has_min_role(org_id, 'supervisor'));

-- History and audit: read-only for users.
create policy "members read incident history" on public.incident_events
  for select to authenticated using (private.is_member(org_id));
create policy "admins read audit log" on public.audit_log
  for select to authenticated using (private.has_min_role(org_id, 'admin'));

-- ---------------------------------------------------------------------------
-- Table privileges (defense in depth on top of RLS)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.organizations, public.memberships, public.invitations,
  public.incident_events, public.audit_log from authenticated;
grant update (name) on public.organizations to authenticated;
grant update (role) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
revoke update, delete on public.incident_comments from authenticated;
revoke update on public.incident_attachments from authenticated;

-- ---------------------------------------------------------------------------
-- RPC functions called by the app
-- ---------------------------------------------------------------------------
create function public.create_organization(p_name text, p_facility_name text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;
  if (select count(*) from public.memberships m where m.user_id = v_uid and m.role = 'owner') >= 5 then
    raise exception 'You already own the maximum number of organizations (5)' using errcode = '54000';
  end if;

  insert into public.organizations (name, created_by) values (btrim(p_name), v_uid) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');
  if coalesce(btrim(p_facility_name), '') <> '' then
    insert into public.facilities (org_id, name) values (v_org, btrim(p_facility_name));
  end if;
  return v_org;
end
$$;

create function public.create_invitation(p_org uuid, p_email text, p_role public.app_role)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text;
begin
  if not private.has_min_role(p_org, 'admin') then
    raise exception 'Only owners and admins can invite team members' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Invitations cannot grant the owner role' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.org_id = p_org and lower(u.email) = v_email
  ) then
    raise exception 'That person is already a member of this organization' using errcode = '23505';
  end if;
  if (select count(*) from public.invitations i
      where i.org_id = p_org and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) >= 100 then
    raise exception 'Too many pending invitations' using errcode = '54000';
  end if;

  update public.invitations set revoked_at = now()
  where org_id = p_org and email = v_email and accepted_at is null and revoked_at is null;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.invitations (org_id, email, role, token_hash, invited_by)
  values (p_org, v_email, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), (select auth.uid()));
  return v_token;
end
$$;

create function public.revoke_invitation(p_invitation uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.invitations where id = p_invitation;
  if v_org is null or not private.has_min_role(v_org, 'admin') then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;
  update public.invitations set revoked_at = now()
  where id = p_invitation and accepted_at is null and revoked_at is null;
end
$$;

create function public.get_invitation_preview(p_token text)
returns table (organization_name text, email text, role public.app_role, status text)
language sql stable security definer set search_path = ''
as $$
  select o.name, i.email, i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'pending'
    end
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

create function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations;
  v_email text;
  v_confirmed timestamptz;
begin
  if v_uid is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'This invitation is no longer valid' using errcode = '22023';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_uid;
  if v_email is distinct from v_inv.email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;
  if v_confirmed is null then
    raise exception 'Please confirm your email address before joining' using errcode = '42501';
  end if;

  insert into public.memberships (org_id, user_id, role) values (v_inv.org_id, v_uid, v_inv.role)
  on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.org_id;
end
$$;

-- Dashboard / reporting summary. SECURITY INVOKER: RLS applies, so non-members get zeros.
create function public.incident_summary(
  p_org uuid,
  p_facility uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with base as (
    select i.* from public.incidents i
    where i.org_id = p_org
      and (p_facility is null or i.facility_id = p_facility)
      and (p_from is null or i.occurred_at >= p_from)
      and (p_to is null or i.occurred_at < p_to)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'by_status', (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
                  from (select status, count(*) as n from base group by status) s),
    'by_type', (select coalesce(jsonb_object_agg(t.type, t.n), '{}'::jsonb)
                from (select type, count(*) as n from base group by type) t),
    'by_supplier', (select coalesce(jsonb_agg(x order by x.total desc, x.name), '[]'::jsonb) from (
        select s.id, s.name, count(*) as total,
          count(*) filter (where b.status in ('open', 'in_progress')) as unresolved,
          mode() within group (order by b.type) as top_type,
          sum(abs(coalesce(b.received_qty, 0) - coalesce(b.expected_qty, 0))) as unit_variance
        from base b join public.suppliers s on s.id = b.supplier_id
        group by s.id, s.name
        order by count(*) desc, s.name
        limit 10
      ) x),
    'avg_resolution_hours', (select round((avg(extract(epoch from (b.resolved_at - b.created_at))) / 3600)::numeric, 1)
                             from base b where b.resolved_at is not null)
  )
$$;

revoke all on function public.create_organization(text, text) from public, anon;
revoke all on function public.create_invitation(uuid, text, public.app_role) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.incident_summary(uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, public.app_role) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.incident_summary(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
