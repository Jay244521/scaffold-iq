-- Fix: recording "details_updated" history failed because `text[] || 'literal'` is parsed
-- as array concatenation with a malformed array literal. Use array_append instead.
create or replace function private.incident_history()
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

  if new.facility_id is distinct from old.facility_id then v_changed := array_append(v_changed, 'facility'); end if;
  if new.type is distinct from old.type then v_changed := array_append(v_changed, 'type'); end if;
  if new.supplier_id is distinct from old.supplier_id then v_changed := array_append(v_changed, 'supplier'); end if;
  if new.po_number is distinct from old.po_number then v_changed := array_append(v_changed, 'po_number'); end if;
  if new.shipment_ref is distinct from old.shipment_ref then v_changed := array_append(v_changed, 'shipment_ref'); end if;
  if new.sku is distinct from old.sku then v_changed := array_append(v_changed, 'sku'); end if;
  if new.item_description is distinct from old.item_description then v_changed := array_append(v_changed, 'item_description'); end if;
  if new.expected_qty is distinct from old.expected_qty then v_changed := array_append(v_changed, 'expected_qty'); end if;
  if new.received_qty is distinct from old.received_qty then v_changed := array_append(v_changed, 'received_qty'); end if;
  if new.description is distinct from old.description then v_changed := array_append(v_changed, 'description'); end if;
  if new.occurred_at is distinct from old.occurred_at then v_changed := array_append(v_changed, 'occurred_at'); end if;
  if cardinality(v_changed) > 0 then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, metadata)
    values (new.org_id, new.id, v_actor, 'details_updated', jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;
  return null;
end
$$;
