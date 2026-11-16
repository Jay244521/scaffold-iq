-- Role-based permissions, incident workflow rules, append-only history and invitations
-- inside a single organization.
begin;

select tests.create_user('owner', 'owner@acme.test');
select tests.create_user('admin', 'admin@acme.test');
select tests.create_user('manager', 'manager@acme.test');
select tests.create_user('super', 'super@acme.test');
select tests.create_user('op', 'op@acme.test');
select tests.create_user('op2', 'op2@acme.test');
select tests.create_user('viewer', 'viewer@acme.test');
select tests.create_user('invitee', 'invitee@acme.test');
select tests.create_user('outsider', 'outsider@other.test');

select tests.login('owner');
select tests.remember('org', public.create_organization('Acme 3PL', 'Main DC'));
select tests.logout();
insert into public.memberships (org_id, user_id, role) values
  (tests.id('org'), tests.id('admin'), 'admin'),
  (tests.id('org'), tests.id('manager'), 'manager'),
  (tests.id('org'), tests.id('super'), 'supervisor'),
  (tests.id('org'), tests.id('op'), 'operator'),
  (tests.id('org'), tests.id('op2'), 'operator'),
  (tests.id('org'), tests.id('viewer'), 'viewer');
select tests.remember('fac', (select id from public.facilities where org_id = tests.id('org')));

-- ---------------------------------------------------------------- organization & limits
select tests.login('owner');
select tests.eq((select count(*) from public.memberships where org_id = tests.id('org') and user_id = tests.id('owner') and role = 'owner'), 1,
  'Creating an organization makes the creator its owner');
select tests.eq((select count(*) from public.facilities where org_id = tests.id('org')), 1, 'Onboarding can create the first facility');
select tests.logout();

-- ---------------------------------------------------------------- facilities
select tests.login('op');
select tests.throws(format($$insert into public.facilities (org_id, name) values (%L, 'Op DC')$$, tests.id('org')), 'Operators cannot create facilities');
select tests.eq(tests.affected(format($$update public.facilities set name = 'Renamed' where id = %L$$, tests.id('fac'))), 0, 'Operators cannot edit facilities');
select tests.logout();
select tests.login('manager');
select tests.lives(format($$insert into public.facilities (org_id, name, code) values (%L, 'North DC', 'NDC')$$, tests.id('org')), 'Managers can create facilities');
select tests.eq(tests.affected(format($$update public.facilities set is_active = false where org_id = %L and code = 'NDC'$$, tests.id('org'))), 1, 'Managers can deactivate facilities');
select tests.logout();

-- ---------------------------------------------------------------- incident creation
select tests.login('viewer');
select tests.throws(format($$insert into public.incidents (org_id, facility_id, type, description, occurred_at) values (%L, %L, 'other', 'v', now())$$,
  tests.id('org'), tests.id('fac')), 'Viewers cannot create incidents');
select tests.logout();

select tests.login('op');
-- Try to spoof the reporter, status and resolution fields.
insert into public.incidents (org_id, facility_id, type, description, occurred_at, reported_by, status, resolution_notes, resolved_at, resolved_by, number)
values (tests.id('org'), tests.id('fac'), 'damaged', 'Two pallets crushed', now(), tests.id('owner'), 'closed', 'fake', now(), tests.id('owner'), 999);
select tests.remember('inc', (select id from public.incidents where org_id = tests.id('org') order by created_at desc limit 1));
select tests.ok((select reported_by = tests.id('op') from public.incidents where id = tests.id('inc')), 'Reporter is forced to the signed-in user');
select tests.ok((select status = 'open' and resolved_at is null and resolved_by is null and resolution_notes is null from public.incidents where id = tests.id('inc')),
  'New incidents always start open with no resolution');
select tests.eq((select number from public.incidents where id = tests.id('inc')), 1, 'Incident numbers are assigned per organization');
select tests.throws(format($$insert into public.incidents (org_id, facility_id, type, description, occurred_at, assigned_to) values (%L, %L, 'other', 'x', now(), %L)$$,
  tests.id('org'), tests.id('fac'), tests.id('op2')), 'Operators cannot assign incidents');
select tests.logout();

select tests.login('super');
insert into public.incidents (org_id, facility_id, type, description, occurred_at)
values (tests.id('org'), tests.id('fac'), 'wrong_item', 'Received SKU 123 instead of 132', now());
select tests.remember('inc2', (select id from public.incidents where org_id = tests.id('org') and number = 2));
select tests.logout();

-- ---------------------------------------------------------------- operator update rules
select tests.login('op2');
select tests.eq(tests.affected(format($$update public.incidents set status = 'in_progress' where id = %L$$, tests.id('inc'))), 0,
  'Operators cannot update incidents they neither reported nor are assigned to');
select tests.logout();

select tests.login('op');
select tests.eq(tests.affected(format($$update public.incidents set status = 'in_progress' where id = %L$$, tests.id('inc'))), 1,
  'The reporting operator can move their incident to in progress');
select tests.throws(format($$update public.incidents set description = 'rewritten' where id = %L$$, tests.id('inc')),
  'Operators cannot rewrite incident details');
select tests.throws(format($$update public.incidents set assigned_to = %L where id = %L$$, tests.id('op'), tests.id('inc')),
  'Operators cannot assign incidents to themselves');
select tests.throws(format($$update public.incidents set status = 'resolved' where id = %L$$, tests.id('inc')),
  'Resolving requires resolution notes');
select tests.throws(format($$update public.incidents set status = 'closed', resolution_notes = 'done' where id = %L$$, tests.id('inc')),
  'Operators cannot close incidents');
select tests.eq(tests.affected(format($$update public.incidents set status = 'resolved', resolution_notes = 'Supplier credited 2 pallets', resolved_at = '2000-01-01' where id = %L$$, tests.id('inc'))), 1,
  'The reporting operator can resolve with notes');
select tests.ok((select resolved_at > now() - interval '1 minute' and resolved_by = tests.id('op') from public.incidents where id = tests.id('inc')),
  'Resolution time and resolver are recorded by the system, not the browser');
select tests.logout();

-- ---------------------------------------------------------------- supervisor rules
select tests.login('super');
select tests.eq(tests.affected(format($$update public.incidents set assigned_to = %L where id = %L$$, tests.id('op2'), tests.id('inc2'))), 1,
  'Supervisors can assign incidents to members');
select tests.throws(format($$update public.incidents set assigned_to = %L where id = %L$$, tests.id('outsider'), tests.id('inc2')),
  'Incidents cannot be assigned to non-members');
select tests.eq(tests.affected(format($$update public.incidents set status = 'closed' where id = %L$$, tests.id('inc'))), 1,
  'Supervisors can close resolved incidents');
select tests.eq(tests.affected(format($$update public.incidents set status = 'open' where id = %L$$, tests.id('inc'))), 1,
  'Supervisors can reopen incidents');
select tests.ok((select resolved_at is null and resolved_by is null from public.incidents where id = tests.id('inc')),
  'Reopening clears the resolution timestamp');
select tests.eq(tests.affected(format($$update public.incidents set po_number = 'PO-777', description = 'Corrected description' where id = %L$$, tests.id('inc2'))), 1,
  'Supervisors can edit incident details');
select tests.ok(exists (select 1 from public.incident_events where incident_id = tests.id('inc2') and event_type = 'details_updated'
  and metadata -> 'fields' ? 'po_number' and metadata -> 'fields' ? 'description'), 'Detail edits are recorded in history with the changed fields');
select tests.throws(format($$update public.incidents set number = 50 where id = %L$$, tests.id('inc')), 'Incident numbers are immutable');
select tests.throws(format($$update public.incidents set reported_by = %L where id = %L$$, tests.id('super'), tests.id('inc')), 'Reporter is immutable');
select tests.logout();

select tests.login('op2');
select tests.eq(tests.affected(format($$update public.incidents set status = 'in_progress' where id = %L$$, tests.id('inc2'))), 1,
  'The assigned operator can update status');
select tests.logout();

-- ---------------------------------------------------------------- history & comments
select tests.login('op');
insert into public.incident_comments (org_id, incident_id, body, author_id)
values (tests.id('org'), tests.id('inc'), 'Photos uploaded', tests.id('owner'));
select tests.ok((select author_id = tests.id('op') from public.incident_comments where incident_id = tests.id('inc') limit 1),
  'Comment author is forced to the signed-in user');
select tests.throws($$update public.incident_comments set body = 'edited'$$, 'Comments cannot be edited');
select tests.throws($$delete from public.incident_comments$$, 'Comments cannot be deleted');
select tests.ok((select count(*) >= 6 from public.incident_events where incident_id = tests.id('inc')), 'Incident history is recorded automatically');
select tests.ok(exists (select 1 from public.incident_events where incident_id = tests.id('inc') and event_type = 'status_changed' and from_value = 'in_progress' and to_value = 'resolved'),
  'Status changes are recorded with before and after values');
select tests.ok(exists (select 1 from public.incident_events where incident_id = tests.id('inc') and event_type = 'comment_added'), 'Comments are recorded in history');
select tests.throws(format($$insert into public.incident_events (org_id, incident_id, event_type) values (%L, %L, 'forged')$$, tests.id('org'), tests.id('inc')),
  'Users cannot forge history entries');
select tests.throws($$update public.incident_events set event_type = 'x'$$, 'Users cannot edit history');
select tests.throws($$delete from public.incident_events$$, 'Users cannot delete history');
select tests.logout();

select tests.login('viewer');
select tests.throws(format($$insert into public.incident_comments (org_id, incident_id, body) values (%L, %L, 'hi')$$, tests.id('org'), tests.id('inc')),
  'Viewers cannot comment');
select tests.eq(tests.affected(format($$update public.incidents set status = 'resolved', resolution_notes = 'x' where id = %L$$, tests.id('inc2'))), 0,
  'Viewers cannot update incidents');
select tests.ok((select count(*) = 2 from public.incidents), 'Viewers can read incidents');
select tests.logout();

-- ---------------------------------------------------------------- evidence
select tests.login('viewer');
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('incident-evidence', %L)$$, tests.id('org') || '/' || tests.id('inc') || '/v.jpg'),
  'Viewers cannot upload evidence');
select tests.logout();
select tests.login('op');
-- owner_id is what the Storage API records for the uploader.
select tests.lives(format($$insert into storage.objects (bucket_id, name, owner_id) values ('incident-evidence', %L, %L)$$, tests.id('org') || '/' || tests.id('inc') || '/a.jpg', tests.id('op')),
  'Operators can upload evidence');
select tests.throws(format($$insert into public.incident_attachments (org_id, incident_id, storage_path, file_name, mime_type, size_bytes) values (%L, %L, %L, 'a.exe', 'application/x-msdownload', 10)$$,
  tests.id('org'), tests.id('inc'), tests.id('org') || '/' || tests.id('inc') || '/a.exe'), 'Disallowed file types are rejected');
select tests.throws(format($$insert into public.incident_attachments (org_id, incident_id, storage_path, file_name, mime_type, size_bytes) values (%L, %L, %L, 'a.jpg', 'image/jpeg', 20000000)$$,
  tests.id('org'), tests.id('inc'), tests.id('org') || '/' || tests.id('inc') || '/b.jpg'), 'Files over 10 MB are rejected');
select tests.throws(format($$insert into public.incident_attachments (org_id, incident_id, storage_path, file_name, mime_type, size_bytes) values (%L, %L, %L, 'a.jpg', 'image/jpeg', 10)$$,
  tests.id('org'), tests.id('inc'), 'elsewhere/a.jpg'), 'Evidence records must point inside the incident''s folder');
select tests.logout();
select tests.login('op2');
select tests.eq(tests.affected($$delete from storage.objects$$), 0, 'Operators cannot delete other people''s evidence files');
select tests.logout();
select tests.login('op');
select tests.eq(tests.affected($$delete from storage.objects$$), 1, 'Operators can remove a file they uploaded themselves');
select tests.logout();
select tests.ok((select public from storage.buckets where id = 'incident-evidence') = false, 'The evidence bucket is private');

-- ---------------------------------------------------------------- memberships
select tests.login('admin');
select tests.throws(format($$update public.memberships set role = 'owner' where org_id = %L and user_id = %L$$, tests.id('org'), tests.id('manager')),
  'Admins cannot grant the owner role');
select tests.throws(format($$delete from public.memberships where org_id = %L and user_id = %L$$, tests.id('org'), tests.id('owner')),
  'Admins cannot remove an owner');
select tests.throws(format($$update public.memberships set role = 'owner' where org_id = %L and user_id = %L$$, tests.id('org'), tests.id('admin')),
  'Members cannot change their own role');
select tests.eq(tests.affected(format($$update public.memberships set role = 'supervisor' where org_id = %L and user_id = %L$$, tests.id('org'), tests.id('op2'))), 1,
  'Admins can change an operator''s role');
select tests.throws(format($$update public.memberships set user_id = %L where org_id = %L and user_id = %L$$, tests.id('outsider'), tests.id('org'), tests.id('op2')),
  'Membership user cannot be swapped');
select tests.logout();

select tests.login('manager');
select tests.eq(tests.affected(format($$update public.memberships set role = 'admin' where org_id = %L and user_id = %L$$, tests.id('org'), tests.id('op'))), 0,
  'Managers cannot change roles');
select tests.eq(tests.affected(format($$delete from public.memberships where org_id = %L and user_id = %L$$, tests.id('org'), tests.id('op'))), 0,
  'Managers cannot remove members');
select tests.logout();

select tests.login('owner');
select tests.throws(format($$delete from public.memberships where org_id = %L and user_id = %L$$, tests.id('org'), tests.id('owner')),
  'The last owner cannot leave the organization');
select tests.lives(format($$update public.memberships set role = 'owner' where org_id = %L and user_id = %L$$, tests.id('org'), tests.id('admin')),
  'Owners can promote another owner');
select tests.logout();

-- ---------------------------------------------------------------- invitations
select tests.login('manager');
select tests.throws(format($$select public.create_invitation(%L, 'x@acme.test', 'operator')$$, tests.id('org')), 'Managers cannot invite');
select tests.eq((select count(*) from public.invitations), 0, 'Managers cannot read invitations');
select tests.logout();

select tests.login('super');
select tests.throws(format($$select public.create_invitation(%L, 'x@acme.test', 'owner')$$, tests.id('org')), 'Nobody can invite an owner');
select tests.logout();

select tests.login('owner');
select tests.throws(format($$select public.create_invitation(%L, 'x@acme.test', 'owner')$$, tests.id('org')), 'Invitations cannot grant owner');
select tests.throws(format($$select public.create_invitation(%L, 'OP@acme.test', 'viewer')$$, tests.id('org')), 'Existing members cannot be re-invited');
create temp table invite_token on commit drop as
  select public.create_invitation(tests.id('org'), ' Invitee@Acme.test ', 'operator') as token;
select tests.ok((select token_hash <> (select token from invite_token) and email = 'invitee@acme.test' from public.invitations limit 1),
  'Only a hash of the invitation token is stored');
select tests.logout();

grant select on invite_token to authenticated;

select tests.login('outsider');
select tests.ok((select status = 'pending' from public.get_invitation_preview((select token from invite_token))), 'Invitation preview works with the token');
select tests.throws($$select public.accept_invitation((select token from invite_token))$$, 'Invitations cannot be accepted by a different email address');
select tests.throws($$select public.accept_invitation('not-a-real-token')$$, 'Unknown invitation tokens are rejected');
select tests.logout();

update auth.users set email_confirmed_at = null where id = tests.id('invitee');
select tests.login('invitee');
select tests.throws($$select public.accept_invitation((select token from invite_token))$$, 'Unconfirmed email addresses cannot accept invitations');
select tests.logout();
update auth.users set email_confirmed_at = now() where id = tests.id('invitee');

select tests.login('invitee');
select tests.ok(public.accept_invitation((select token from invite_token)) = tests.id('org'), 'The invited email address can accept');
select tests.ok((select role = 'operator' from public.memberships where user_id = tests.id('invitee')), 'Accepting grants the invited role');
select tests.throws($$select public.accept_invitation((select token from invite_token))$$, 'Invitations cannot be reused');
select tests.logout();

-- ---------------------------------------------------------------- audit log
select tests.login('owner');
select tests.ok((select count(*) > 0 from public.audit_log where entity_type = 'memberships'), 'Owners can read the audit log of membership changes');
select tests.throws(format($$insert into public.audit_log (org_id, action, entity_type) values (%L, 'forged', 'x')$$, tests.id('org')), 'Nobody can write audit entries directly');
select tests.throws($$delete from public.audit_log$$, 'Nobody can delete audit entries');
select tests.logout();
select tests.login('op');
select tests.eq((select count(*) from public.audit_log), 0, 'Operators cannot read the audit log');
select tests.logout();

-- ---------------------------------------------------------------- dashboard summary
select tests.login('viewer');
select tests.ok((select (s ->> 'total')::int = 2 and (s -> 'by_type' ->> 'damaged')::int = 1 and (s -> 'by_status' ->> 'in_progress')::int = 1
  from (select public.incident_summary(tests.id('org')) as s) x), 'Dashboard summary counts by status and type');
select tests.logout();

rollback;
