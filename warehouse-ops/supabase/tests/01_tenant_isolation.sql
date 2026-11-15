-- Tenant isolation: a member of Organization B must not be able to read or modify
-- anything belonging to Organization A — through tables, RPC functions or storage.
begin;

-- ---------------------------------------------------------------- setup (as superuser)
select tests.create_user('alice', 'alice@a-warehouse.test');   -- owner, Org A
select tests.create_user('olive', 'olive@a-warehouse.test');   -- operator, Org A
select tests.create_user('bob', 'bob@b-logistics.test');       -- owner, Org B
select tests.create_user('mallory', 'mallory@nowhere.test');   -- signed up, no organization

select tests.login('alice');
select tests.remember('orgA', public.create_organization('A Warehouse Co', 'Dallas DC'));
select tests.logout();
select tests.login('bob');
select tests.remember('orgB', public.create_organization('B Logistics', 'Memphis Hub'));
select tests.logout();

insert into public.memberships (org_id, user_id, role) values (tests.id('orgA'), tests.id('olive'), 'operator');
select tests.remember('facA', (select id from public.facilities where org_id = tests.id('orgA')));
select tests.remember('facB', (select id from public.facilities where org_id = tests.id('orgB')));

select tests.login('alice');
insert into public.suppliers (org_id, name) values (tests.id('orgA'), 'Acme Packaging');
select tests.remember('supA', (select id from public.suppliers where org_id = tests.id('orgA')));
insert into public.incidents (org_id, facility_id, type, supplier_id, po_number, expected_qty, received_qty, description, occurred_at)
values (tests.id('orgA'), tests.id('facA'), 'shortage', tests.id('supA'), 'PO-1001', 100, 92, 'Eight cartons short on inbound PO-1001', now());
select tests.remember('incA', (select id from public.incidents where org_id = tests.id('orgA')));
insert into public.incident_comments (org_id, incident_id, body) values (tests.id('orgA'), tests.id('incA'), 'Called carrier, awaiting BOL copy');
insert into public.incident_attachments (org_id, incident_id, storage_path, file_name, mime_type, size_bytes)
values (tests.id('orgA'), tests.id('incA'), tests.id('orgA') || '/' || tests.id('incA') || '/x-photo.jpg', 'photo.jpg', 'image/jpeg', 1000);
insert into storage.objects (bucket_id, name) values ('incident-evidence', tests.id('orgA') || '/' || tests.id('incA') || '/x-photo.jpg');
select public.create_invitation(tests.id('orgA'), 'new.hire@a-warehouse.test', 'operator');
select tests.logout();

select tests.login('bob');
insert into public.incidents (org_id, facility_id, type, description, occurred_at)
values (tests.id('orgB'), tests.id('facB'), 'damaged', 'Crushed pallet', now());
select tests.remember('incB', (select id from public.incidents where org_id = tests.id('orgB')));
select tests.logout();

-- ---------------------------------------------------------------- reads across tenants
select tests.login('bob');
select tests.eq((select count(*) from public.organizations where id = tests.id('orgA')), 0, 'B cannot read Org A');
select tests.eq((select count(*) from public.organizations), 1, 'B sees only its own organization');
select tests.eq((select count(*) from public.memberships where org_id = tests.id('orgA')), 0, 'B cannot read Org A memberships');
select tests.eq((select count(*) from public.facilities where org_id = tests.id('orgA')), 0, 'B cannot read Org A facilities');
select tests.eq((select count(*) from public.suppliers where org_id = tests.id('orgA')), 0, 'B cannot read Org A suppliers');
select tests.eq((select count(*) from public.incidents where org_id = tests.id('orgA')), 0, 'B cannot read Org A incidents');
select tests.eq((select count(*) from public.incidents where id = tests.id('incA')), 0, 'B cannot read an Org A incident by id');
select tests.eq((select count(*) from public.incident_comments where org_id = tests.id('orgA')), 0, 'B cannot read Org A comments');
select tests.eq((select count(*) from public.incident_attachments where org_id = tests.id('orgA')), 0, 'B cannot read Org A evidence records');
select tests.eq((select count(*) from public.incident_events where org_id = tests.id('orgA')), 0, 'B cannot read Org A incident history');
select tests.eq((select count(*) from public.invitations where org_id = tests.id('orgA')), 0, 'B cannot read Org A invitations');
select tests.eq((select count(*) from public.audit_log where org_id = tests.id('orgA')), 0, 'B cannot read Org A audit log');
select tests.eq((select count(*) from public.profiles where id = tests.id('alice')), 0, 'B cannot read Org A member profiles');
select tests.eq((select count(*) from storage.objects where name like tests.id('orgA') || '/%'), 0, 'B cannot list Org A evidence files');
select tests.eq((select (public.incident_summary(tests.id('orgA')) ->> 'total')::bigint), 0, 'B gets an empty dashboard summary for Org A');

-- ---------------------------------------------------------------- writes across tenants
select tests.throws(format($$insert into public.incidents (org_id, facility_id, type, description, occurred_at)
  values (%L, %L, 'other', 'spoofed', now())$$, tests.id('orgA'), tests.id('facA')),
  'B cannot create an incident in Org A');
select tests.throws(format($$insert into public.incidents (org_id, facility_id, type, description, occurred_at)
  values (%L, %L, 'other', 'cross-tenant facility', now())$$, tests.id('orgB'), tests.id('facA')),
  'B cannot attach its incident to an Org A facility');
select tests.throws(format($$insert into public.incidents (org_id, facility_id, type, supplier_id, description, occurred_at)
  values (%L, %L, 'other', %L, 'cross-tenant supplier', now())$$, tests.id('orgB'), tests.id('facB'), tests.id('supA')),
  'B cannot reference an Org A supplier');
select tests.throws(format($$insert into public.incidents (org_id, facility_id, type, description, occurred_at, assigned_to)
  values (%L, %L, 'other', 'assign outsider', now(), %L)$$, tests.id('orgB'), tests.id('facB'), tests.id('alice')),
  'B cannot assign its incident to a user outside Org B');
select tests.eq(tests.affected(format($$update public.incidents set description = 'tampered' where id = %L$$, tests.id('incA'))), 0,
  'B cannot update an Org A incident');
select tests.eq(tests.affected(format($$update public.incidents set status = 'closed', resolution_notes = 'x' where org_id = %L$$, tests.id('orgA'))), 0,
  'B cannot close Org A incidents');
select tests.eq(tests.affected(format($$delete from public.incidents where id = %L$$, tests.id('incA'))), 0,
  'B cannot delete an Org A incident');
select tests.throws(format($$update public.incidents set org_id = %L where id = %L$$, tests.id('orgA'), tests.id('incB')),
  'B cannot move its incident into Org A');
select tests.eq(tests.affected(format($$update public.facilities set name = 'hijacked' where org_id = %L$$, tests.id('orgA'))), 0,
  'B cannot update Org A facilities');
select tests.eq(tests.affected(format($$delete from public.facilities where org_id = %L$$, tests.id('orgA'))), 0,
  'B cannot delete Org A facilities');
select tests.throws(format($$insert into public.facilities (org_id, name) values (%L, 'Rogue DC')$$, tests.id('orgA')),
  'B cannot create a facility in Org A');
select tests.eq(tests.affected(format($$update public.organizations set name = 'hijacked' where id = %L$$, tests.id('orgA'))), 0,
  'B cannot rename Org A');
select tests.eq(tests.affected(format($$update public.memberships set role = 'viewer' where org_id = %L$$, tests.id('orgA'))), 0,
  'B cannot change Org A roles');
select tests.eq(tests.affected(format($$delete from public.memberships where org_id = %L$$, tests.id('orgA'))), 0,
  'B cannot remove Org A members');
select tests.throws(format($$insert into public.memberships (org_id, user_id, role) values (%L, %L, 'owner')$$, tests.id('orgA'), tests.id('bob')),
  'B cannot add itself to Org A');
select tests.throws(format($$insert into public.incident_comments (org_id, incident_id, body) values (%L, %L, 'spam')$$, tests.id('orgA'), tests.id('incA')),
  'B cannot comment on an Org A incident');
select tests.throws(format($$insert into public.incident_comments (org_id, incident_id, body) values (%L, %L, 'spam')$$, tests.id('orgB'), tests.id('incA')),
  'B cannot comment on an Org A incident by mislabeling the organization');
select tests.throws(format($$insert into public.incident_attachments (org_id, incident_id, storage_path, file_name, mime_type, size_bytes)
  values (%L, %L, %L, 'a.jpg', 'image/jpeg', 10)$$, tests.id('orgA'), tests.id('incA'), tests.id('orgA') || '/' || tests.id('incA') || '/b.jpg'),
  'B cannot add evidence to an Org A incident');
select tests.throws(format($$insert into public.suppliers (org_id, name) values (%L, 'Fake Supplier')$$, tests.id('orgA')),
  'B cannot add suppliers to Org A');
select tests.throws(format($$select public.create_invitation(%L, 'spy@b-logistics.test', 'admin')$$, tests.id('orgA')),
  'B cannot invite people into Org A');

-- Storage
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('incident-evidence', %L)$$,
  tests.id('orgA') || '/' || tests.id('incA') || '/evil.jpg'),
  'B cannot upload files into Org A evidence folders');
select tests.throws(format($$insert into storage.objects (bucket_id, name) values ('incident-evidence', %L)$$,
  tests.id('orgB') || '/' || tests.id('incA') || '/evil.jpg'),
  'B cannot upload under its own org folder using an Org A incident id');
select tests.lives(format($$insert into storage.objects (bucket_id, name) values ('incident-evidence', %L)$$,
  tests.id('orgB') || '/' || tests.id('incB') || '/ok.jpg'),
  'B can upload evidence to its own incident');
select tests.eq(tests.affected(format($$delete from storage.objects where name like %L$$, tests.id('orgA') || '/%')), 0,
  'B cannot delete Org A evidence files');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('incident-evidence', 'not-a-uuid/whatever/x.jpg')$$,
  'Malformed storage paths are rejected');
select tests.logout();

-- ---------------------------------------------------------------- users with no organization
select tests.login('mallory');
select tests.eq((select count(*) from public.incidents), 0, 'A user with no organization sees no incidents');
select tests.eq((select count(*) from public.organizations), 0, 'A user with no organization sees no organizations');
select tests.eq((select count(*) from public.profiles), 1, 'A user with no organization sees only their own profile');
select tests.eq((select count(*) from storage.objects), 0, 'A user with no organization sees no files');
select tests.logout();

-- ---------------------------------------------------------------- anonymous visitors
select tests.login_anon();
select tests.throws('select count(*) from public.incidents', 'Anonymous visitors cannot query incidents');
select tests.throws('select count(*) from public.organizations', 'Anonymous visitors cannot query organizations');
select tests.throws($$select public.create_organization('anon org')$$, 'Anonymous visitors cannot create organizations');
select tests.eq((select count(*) from storage.objects), 0, 'Anonymous visitors cannot list evidence files');
select tests.logout();

-- ---------------------------------------------------------------- same-tenant sanity
select tests.login('olive');
select tests.eq((select count(*) from public.incidents), 1, 'Org A operator sees Org A incidents');
select tests.eq((select count(*) from storage.objects), 1, 'Org A operator can see Org A evidence files');
select tests.eq((select (public.incident_summary(tests.id('orgA')) ->> 'total')::bigint), 1, 'Org A dashboard summary counts Org A incidents');
select tests.logout();

rollback;
