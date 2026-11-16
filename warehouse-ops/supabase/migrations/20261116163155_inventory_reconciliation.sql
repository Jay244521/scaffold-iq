-- Inventory discrepancy management.
--
-- inventory_items        the recorded on-hand quantity per facility / SKU / location
-- inventory_imports      an uploaded CSV (physical count or system export), awaiting review
-- inventory_import_lines each row of that file, compared with the record at upload time
-- inventory_adjustments  append-only log of every change actually made to a record
--
-- Rules enforced by the database (not just the app):
--   * Users cannot insert, update or delete inventory records directly. The ONLY way a
--     quantity changes is apply_inventory_import(), and only for lines a manager approved.
--   * Every applied change is written to inventory_adjustments with the approver.
--   * If a record changed after the file was uploaded, the line is marked "stale" and is
--     not applied (no silent overwrite of newer data).

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  facility_id uuid not null,
  sku text not null check (char_length(btrim(sku)) between 1 and 64),
  location text not null default '' check (char_length(location) <= 64),
  description text check (description is null or char_length(description) <= 300),
  on_hand numeric(14, 3) not null check (on_hand >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (id, org_id),
  unique (org_id, facility_id, sku, location),
  foreign key (facility_id, org_id) references public.facilities (id, org_id)
);
create index inventory_items_facility_idx on public.inventory_items (facility_id, sku);

create table public.inventory_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  facility_id uuid not null,
  source text not null check (source in ('count', 'system')),
  file_name text not null check (char_length(file_name) between 1 and 200),
  status text not null default 'pending_review' check (status in ('pending_review', 'applied', 'discarded')),
  total_rows integer not null default 0,
  invalid_rows integer not null default 0,
  discrepancy_rows integer not null default 0,
  new_rows integer not null default 0,
  match_rows integer not null default 0,
  applied_rows integer not null default 0,
  stale_rows integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  unique (id, org_id),
  foreign key (facility_id, org_id) references public.facilities (id, org_id)
);
create index inventory_imports_org_idx on public.inventory_imports (org_id, created_at desc);

create table public.inventory_import_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  import_id uuid not null,
  line_no integer not null,
  sku text,
  location text not null default '',
  description text,
  qty numeric(14, 3),
  unit_cost numeric(14, 4),
  recorded_qty numeric(14, 3),
  status text not null check (status in ('match', 'discrepancy', 'new_item', 'invalid', 'stale')),
  error text,
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'rejected', 'not_applicable')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  applied_at timestamptz,
  foreign key (import_id, org_id) references public.inventory_imports (id, org_id) on delete cascade
);
create index inventory_import_lines_import_idx on public.inventory_import_lines (import_id, line_no);

create table public.inventory_adjustments (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  item_id uuid not null,
  facility_id uuid not null,
  sku text not null,
  location text not null,
  old_qty numeric(14, 3),
  new_qty numeric(14, 3) not null,
  import_id uuid,
  import_line_id uuid,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (item_id, org_id) references public.inventory_items (id, org_id) on delete cascade
);
create index inventory_adjustments_org_idx on public.inventory_adjustments (org_id, created_at desc);
create index inventory_adjustments_item_idx on public.inventory_adjustments (item_id);

-- ---------------------------------------------------------------------------
-- RLS: members read; nobody writes directly (all writes go through the functions below).
-- ---------------------------------------------------------------------------
alter table public.inventory_items enable row level security;
alter table public.inventory_imports enable row level security;
alter table public.inventory_import_lines enable row level security;
alter table public.inventory_adjustments enable row level security;

create policy "members read inventory" on public.inventory_items
  for select to authenticated using (private.is_member(org_id));
create policy "members read inventory imports" on public.inventory_imports
  for select to authenticated using (private.is_member(org_id));
create policy "members read inventory import lines" on public.inventory_import_lines
  for select to authenticated using (private.is_member(org_id));
create policy "members read inventory adjustments" on public.inventory_adjustments
  for select to authenticated using (private.is_member(org_id));

revoke all on public.inventory_items, public.inventory_imports, public.inventory_import_lines,
  public.inventory_adjustments from anon;
revoke insert, update, delete, truncate on public.inventory_items, public.inventory_imports,
  public.inventory_import_lines, public.inventory_adjustments from authenticated;

create trigger inventory_items_audit after insert or update or delete on public.inventory_items
for each row execute function private.audit_row();
create trigger inventory_imports_audit after insert or update on public.inventory_imports
for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Save an uploaded file for review. The database re-validates every line and compares it
-- with the current record; it changes NO inventory quantities.
create function public.create_inventory_import(
  p_org uuid,
  p_facility uuid,
  p_source text,
  p_file_name text,
  p_lines jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_import uuid;
  v_n integer := coalesce(jsonb_array_length(p_lines), 0);
begin
  if not private.has_min_role(p_org, 'operator') then
    raise exception 'Only operators and above can import inventory files' using errcode = '42501';
  end if;
  if not exists (select 1 from public.facilities f where f.id = p_facility and f.org_id = p_org and f.is_active) then
    raise exception 'Choose one of your active facilities' using errcode = '42501';
  end if;
  if p_source not in ('count', 'system') then
    raise exception 'Invalid import type' using errcode = '22023';
  end if;
  if v_n < 1 or v_n > 5000 then
    raise exception 'An import must have between 1 and 5,000 rows' using errcode = '22023';
  end if;

  insert into public.inventory_imports (org_id, facility_id, source, file_name, created_by)
  values (p_org, p_facility, p_source, left(coalesce(nullif(btrim(p_file_name), ''), 'inventory.csv'), 200), (select auth.uid()))
  returning id into v_import;

  insert into public.inventory_import_lines (org_id, import_id, line_no, sku, location, description, qty, unit_cost, recorded_qty, status, error, decision)
  select p_org, v_import, x.line_no, x.sku, x.location, x.description, x.qty, x.unit_cost, r.on_hand,
    case
      when x.err is not null then 'invalid'
      when r.on_hand is null then 'new_item'
      when r.on_hand = x.qty then 'match'
      else 'discrepancy'
    end,
    x.err,
    case when x.err is not null or r.on_hand = x.qty then 'not_applicable' else 'pending' end
  from (
    select l.line_no,
      nullif(btrim(l.sku), '') as sku,
      coalesce(btrim(l.location), '') as location,
      left(nullif(btrim(l.description), ''), 300) as description,
      l.qty, l.unit_cost,
      case
        when nullif(btrim(l.error), '') is not null then left(l.error, 300)
        when nullif(btrim(l.sku), '') is null then 'Missing SKU'
        when char_length(btrim(l.sku)) > 64 then 'SKU is longer than 64 characters'
        when char_length(coalesce(btrim(l.location), '')) > 64 then 'Location is longer than 64 characters'
        when l.qty is null then 'Missing or invalid quantity'
        when l.qty < 0 then 'Quantity cannot be negative'
        when l.qty > 99999999999 then 'Quantity is too large'
        when l.unit_cost is not null and (l.unit_cost < 0 or l.unit_cost > 9999999999) then 'Invalid unit cost'
      end as err
    from jsonb_to_recordset(p_lines) as l(line_no integer, sku text, location text, description text, qty numeric, unit_cost numeric, error text)
  ) x
  left join public.inventory_items r
    on r.org_id = p_org and r.facility_id = p_facility and r.sku = x.sku and r.location = x.location and x.err is null;

  -- The same SKU + location twice in one file is ambiguous: mark every copy invalid.
  update public.inventory_import_lines l
  set status = 'invalid', decision = 'not_applicable', recorded_qty = null,
      error = 'Duplicate SKU and location in this file (lines ' || d.lines || ')'
  from (
    select sku, location, string_agg(line_no::text, ', ' order by line_no) as lines
    from public.inventory_import_lines
    where import_id = v_import and status <> 'invalid'
    group by sku, location having count(*) > 1
  ) d
  where l.import_id = v_import and l.sku = d.sku and l.location = d.location and l.status <> 'invalid';

  update public.inventory_imports i set
    total_rows = c.total, invalid_rows = c.invalid, discrepancy_rows = c.disc, new_rows = c.new, match_rows = c.match
  from (
    select count(*) as total,
      count(*) filter (where status = 'invalid') as invalid,
      count(*) filter (where status = 'discrepancy') as disc,
      count(*) filter (where status = 'new_item') as new,
      count(*) filter (where status = 'match') as match
    from public.inventory_import_lines where import_id = v_import
  ) c
  where i.id = v_import;

  return v_import;
end
$$;

-- Approve or reject proposed corrections (managers and above). Does not change inventory.
create function public.decide_inventory_lines(p_import uuid, p_line_ids uuid[], p_decision text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_imp public.inventory_imports;
  v_count integer;
begin
  select * into v_imp from public.inventory_imports where id = p_import;
  if v_imp.id is null or not private.has_min_role(v_imp.org_id, 'manager') then
    raise exception 'Only managers and above can approve inventory corrections' using errcode = '42501';
  end if;
  if v_imp.status <> 'pending_review' then
    raise exception 'This import has already been closed' using errcode = '22023';
  end if;
  if p_decision not in ('approved', 'rejected', 'pending') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  update public.inventory_import_lines
  set decision = p_decision,
      decided_by = case when p_decision = 'pending' then null else (select auth.uid()) end,
      decided_at = case when p_decision = 'pending' then null else now() end
  where import_id = p_import and id = any (p_line_ids) and status in ('discrepancy', 'new_item');
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Apply approved corrections (managers and above). The only way inventory quantities change.
create function public.apply_inventory_import(p_import uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_imp public.inventory_imports;
  v_uid uuid := (select auth.uid());
  v_line record;
  v_item public.inventory_items;
  v_applied integer := 0;
  v_stale integer := 0;
begin
  select * into v_imp from public.inventory_imports where id = p_import for update;
  if v_imp.id is null or not private.has_min_role(v_imp.org_id, 'manager') then
    raise exception 'Only managers and above can apply inventory corrections' using errcode = '42501';
  end if;
  if v_imp.status <> 'pending_review' then
    raise exception 'This import has already been closed' using errcode = '22023';
  end if;

  for v_line in
    select * from public.inventory_import_lines
    where import_id = p_import and decision = 'approved' and status in ('discrepancy', 'new_item') and applied_at is null
    order by line_no
  loop
    select * into v_item from public.inventory_items
    where org_id = v_imp.org_id and facility_id = v_imp.facility_id and sku = v_line.sku and location = v_line.location
    for update;

    if v_line.status = 'new_item' then
      if v_item.id is not null then
        update public.inventory_import_lines set status = 'stale', error = 'A record for this SKU was created after the file was uploaded' where id = v_line.id;
        v_stale := v_stale + 1;
        continue;
      end if;
      insert into public.inventory_items (org_id, facility_id, sku, location, description, on_hand, updated_by)
      values (v_imp.org_id, v_imp.facility_id, v_line.sku, v_line.location, v_line.description, v_line.qty, v_uid)
      returning * into v_item;
      insert into public.inventory_adjustments (org_id, item_id, facility_id, sku, location, old_qty, new_qty, import_id, import_line_id, approved_by)
      values (v_imp.org_id, v_item.id, v_imp.facility_id, v_line.sku, v_line.location, null, v_line.qty, p_import, v_line.id, v_uid);
    else
      if v_item.id is null or v_item.on_hand <> v_line.recorded_qty then
        update public.inventory_import_lines set status = 'stale', error = 'The record changed after the file was uploaded; review it again' where id = v_line.id;
        v_stale := v_stale + 1;
        continue;
      end if;
      update public.inventory_items set on_hand = v_line.qty, updated_at = now(), updated_by = v_uid,
        description = coalesce(v_line.description, description)
      where id = v_item.id;
      insert into public.inventory_adjustments (org_id, item_id, facility_id, sku, location, old_qty, new_qty, import_id, import_line_id, approved_by)
      values (v_imp.org_id, v_item.id, v_imp.facility_id, v_line.sku, v_line.location, v_line.recorded_qty, v_line.qty, p_import, v_line.id, v_uid);
    end if;

    update public.inventory_import_lines set applied_at = now() where id = v_line.id;
    v_applied := v_applied + 1;
  end loop;

  update public.inventory_imports
  set status = 'applied', closed_by = v_uid, closed_at = now(), applied_rows = v_applied, stale_rows = v_stale
  where id = p_import;

  return jsonb_build_object('applied', v_applied, 'stale', v_stale);
end
$$;

-- Close an import without applying anything (managers, or the person who uploaded it).
create function public.discard_inventory_import(p_import uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_imp public.inventory_imports;
begin
  select * into v_imp from public.inventory_imports where id = p_import for update;
  if v_imp.id is null or not (
    private.has_min_role(v_imp.org_id, 'manager')
    or (v_imp.created_by = (select auth.uid()) and private.has_min_role(v_imp.org_id, 'operator'))
  ) then
    raise exception 'You cannot discard this import' using errcode = '42501';
  end if;
  if v_imp.status <> 'pending_review' then
    raise exception 'This import has already been closed' using errcode = '22023';
  end if;
  update public.inventory_imports set status = 'discarded', closed_by = (select auth.uid()), closed_at = now() where id = p_import;
end
$$;

revoke all on function public.create_inventory_import(uuid, uuid, text, text, jsonb) from public, anon;
revoke all on function public.decide_inventory_lines(uuid, uuid[], text) from public, anon;
revoke all on function public.apply_inventory_import(uuid) from public, anon;
revoke all on function public.discard_inventory_import(uuid) from public, anon;
grant execute on function public.create_inventory_import(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.decide_inventory_lines(uuid, uuid[], text) to authenticated;
grant execute on function public.apply_inventory_import(uuid) to authenticated;
grant execute on function public.discard_inventory_import(uuid) to authenticated;
