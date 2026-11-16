-- Supplier management: rename and merge permissions, tenant isolation, history.
begin;
select tests.create_user('owner', 'owner@sup-a.test');
select tests.create_user('mgr', 'mgr@sup-a.test');
select tests.create_user('sup', 'sup@sup-a.test');
select tests.create_user('rival', 'rival@sup-b.test');
select tests.login('owner');
select tests.remember('org', public.create_organization('Suppliers A', 'Main DC'));
select tests.logout();
select tests.login('rival');
select tests.remember('orgB', public.create_organization('Suppliers B', 'Other DC'));
select tests.logout();
insert into public.memberships (org_id, user_id, role) values (tests.id('org'), tests.id('mgr'), 'manager'), (tests.id('org'), tests.id('sup'), 'supervisor');
select tests.remember('fac', (select id from public.facilities where org_id = tests.id('org')));
insert into public.suppliers (org_id, name) values (tests.id('org'), 'Acme'), (tests.id('org'), 'ACME Inc.'), (tests.id('orgB'), 'Rival Co');
select tests.remember('acme', (select id from public.suppliers where name = 'Acme'));
select tests.remember('acmeinc', (select id from public.suppliers where name = 'ACME Inc.'));
select tests.remember('rivalco', (select id from public.suppliers where name = 'Rival Co'));
insert into public.incidents (org_id, facility_id, type, supplier_id, description, occurred_at, reported_by)
select tests.id('org'), tests.id('fac'), 'shortage', s, 'x', now(), tests.id('owner')
from unnest(array[tests.id('acme'), tests.id('acme'), tests.id('acmeinc')]) s;

select tests.login('sup');
select tests.eq(tests.affected(format($$update public.suppliers set name = 'Renamed' where id = %L$$, tests.id('acme'))), 0, 'Supervisors cannot rename suppliers');
select tests.throws(format($$select public.merge_suppliers(%L, %L)$$, tests.id('acmeinc'), tests.id('acme')), 'Supervisors cannot merge suppliers');
select tests.logout();

select tests.login('rival');
select tests.throws(format($$select public.merge_suppliers(%L, %L)$$, tests.id('acmeinc'), tests.id('acme')), 'Another company cannot merge these suppliers');
select tests.throws(format($$select public.merge_suppliers(%L, %L)$$, tests.id('rivalco'), tests.id('acme')), 'Suppliers from different companies cannot be merged');
select tests.eq(tests.affected(format($$update public.suppliers set name = 'Hijacked' where id = %L$$, tests.id('acme'))), 0, 'Another company cannot rename suppliers');
select tests.logout();

select tests.login('mgr');
select tests.throws(format($$update public.suppliers set name = 'acme inc.' where id = %L$$, tests.id('acme')), 'Renaming to an existing name (any letter case) is refused');
select tests.eq(tests.affected(format($$update public.suppliers set name = 'Acme Packaging' where id = %L$$, tests.id('acme'))), 1, 'Managers can rename suppliers');
select tests.eq(public.merge_suppliers(tests.id('acmeinc'), tests.id('acme')), 1, 'Merging moves the duplicate''s incidents');
select tests.eq((select count(*) from public.incidents where supplier_id = tests.id('acme')), 3, 'All incidents now point to the surviving supplier');
select tests.eq((select count(*) from public.suppliers where id = tests.id('acmeinc')), 0, 'The duplicate supplier is removed');
select tests.ok(exists (select 1 from public.incident_events where event_type = 'details_updated' and metadata -> 'fields' ? 'supplier' and actor_id = tests.id('mgr')),
  'Incident history records the supplier change and who made it');
select tests.throws(format($$select public.merge_suppliers(%L, %L)$$, tests.id('acme'), tests.id('acme')), 'A supplier cannot be merged into itself');
select tests.logout();

select tests.login('owner');
select tests.ok(exists (select 1 from public.audit_log where entity_type = 'suppliers' and action = 'delete'), 'The merge appears in the audit log');
select tests.logout();
rollback;
