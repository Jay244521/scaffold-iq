-- Merge a duplicate supplier into another (managers and above). Moves every incident from
-- the duplicate to the surviving supplier, then deletes the duplicate. Incident history
-- records the supplier change; the audit log records the deletion.
create function public.merge_suppliers(p_from uuid, p_into uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_from public.suppliers;
  v_into public.suppliers;
  v_moved integer;
begin
  if p_from = p_into then
    raise exception 'Choose two different suppliers' using errcode = '22023';
  end if;
  select * into v_from from public.suppliers where id = p_from for update;
  select * into v_into from public.suppliers where id = p_into for update;
  if v_from.id is null or v_into.id is null or v_from.org_id <> v_into.org_id
     or not private.has_min_role(v_from.org_id, 'manager') then
    raise exception 'Supplier not found' using errcode = '42501';
  end if;

  update public.incidents set supplier_id = p_into where supplier_id = p_from and org_id = v_from.org_id;
  get diagnostics v_moved = row_count;
  delete from public.suppliers where id = p_from;
  return v_moved;
end
$$;

revoke all on function public.merge_suppliers(uuid, uuid) from public, anon;
grant execute on function public.merge_suppliers(uuid, uuid) to authenticated;
