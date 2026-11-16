-- Signed BOL / delivery receipt: a distinct kind of evidence, so the proof of what was
-- signed for at the dock is easy to find later. Same private storage and policies.
alter table public.incident_attachments
  add column kind text not null default 'evidence' check (kind in ('evidence', 'signed_bol'));
create index incident_attachments_kind_idx on public.incident_attachments (incident_id) where kind = 'signed_bol';

-- History says "signed BOL" instead of generic evidence.
create or replace function private.incident_child_history()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'incident_comments' then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type)
    values (new.org_id, new.incident_id, (select auth.uid()), 'comment_added');
  elsif tg_op = 'INSERT' then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, to_value, metadata)
    values (new.org_id, new.incident_id, (select auth.uid()),
            case when new.kind = 'signed_bol' then 'signed_bol_added' else 'evidence_added' end,
            new.file_name, jsonb_build_object('kind', new.kind));
  elsif exists (select 1 from public.incidents i where i.id = old.incident_id) then
    insert into public.incident_events (org_id, incident_id, actor_id, event_type, from_value, metadata)
    values (old.org_id, old.incident_id, (select auth.uid()),
            case when old.kind = 'signed_bol' then 'signed_bol_removed' else 'evidence_removed' end,
            old.file_name, jsonb_build_object('kind', old.kind));
  end if;
  return null;
end
$$;
