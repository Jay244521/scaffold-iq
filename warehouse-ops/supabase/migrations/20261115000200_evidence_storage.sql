-- Private evidence storage for incident photos and documents.
--
-- Files live at  incident-evidence/{org_id}/{incident_id}/{random-id}-{file name}
-- * The bucket is private: there are no public URLs. The app hands out short-lived
--   signed URLs only after the database confirms the user belongs to the organization.
-- * Size (10 MB) and file types are enforced by Storage itself, again by the app
--   (including a file-signature check), and again by incident_attachments constraints.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-evidence',
  'incident-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "wo_evidence_read_members" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'incident-evidence'
    and private.is_member(private.path_uuid(name, 1))
  );

create policy "wo_evidence_upload_operators" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'incident-evidence'
    and private.has_min_role(private.path_uuid(name, 1), 'operator')
    and exists (
      select 1 from public.incidents i
      where i.id = private.path_uuid(name, 2) and i.org_id = private.path_uuid(name, 1)
    )
  );

create policy "wo_evidence_delete_supervisors" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'incident-evidence'
    and private.has_min_role(private.path_uuid(name, 1), 'supervisor')
  );
