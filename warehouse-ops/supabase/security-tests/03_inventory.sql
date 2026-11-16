-- Inventory reconciliation: tenant isolation, roles, and "never silently overwrite".
begin;

select tests.create_user('owner', 'owner@inv-a.test');
select tests.create_user('mgr', 'mgr@inv-a.test');
select tests.create_user('op', 'op@inv-a.test');
select tests.create_user('viewer', 'viewer@inv-a.test');
select tests.create_user('rival', 'rival@inv-b.test');

select tests.login('owner');
select tests.remember('org', public.create_organization('Inventory A', 'Main DC'));
select tests.logout();
select tests.login('rival');
select tests.remember('orgB', public.create_organization('Inventory B', 'Rival DC'));
select tests.logout();
insert into public.memberships (org_id, user_id, role) values
  (tests.id('org'), tests.id('mgr'), 'manager'),
  (tests.id('org'), tests.id('op'), 'operator'),
  (tests.id('org'), tests.id('viewer'), 'viewer');
select tests.remember('fac', (select id from public.facilities where org_id = tests.id('org')));
select tests.remember('facB', (select id from public.facilities where org_id = tests.id('orgB')));

-- Existing records (loaded as a trusted setup step).
insert into public.inventory_items (org_id, facility_id, sku, location, on_hand) values
  (tests.id('org'), tests.id('fac'), 'SKU-1', 'A-01', 100),
  (tests.id('org'), tests.id('fac'), 'SKU-2', '', 50),
  (tests.id('org'), tests.id('fac'), 'SKU-3', '', 10);
select tests.remember('item1', (select id from public.inventory_items where sku = 'SKU-1'));

-- ---------------------------------------------------------------- direct writes are impossible
select tests.login('owner');
select tests.throws(format($$update public.inventory_items set on_hand = 1 where id = %L$$, tests.id('item1')),
  'Even owners cannot change inventory quantities directly');
select tests.throws(format($$insert into public.inventory_items (org_id, facility_id, sku, on_hand) values (%L, %L, 'X', 1)$$, tests.id('org'), tests.id('fac')),
  'Inventory records cannot be inserted directly');
select tests.throws(format($$delete from public.inventory_items where id = %L$$, tests.id('item1')), 'Inventory records cannot be deleted directly');
select tests.logout();

-- ---------------------------------------------------------------- creating an import
select tests.login('viewer');
select tests.throws(format($$select public.create_inventory_import(%L, %L, 'count', 'c.csv', '[{"line_no":2,"sku":"SKU-1","location":"A-01","qty":90}]')$$,
  tests.id('org'), tests.id('fac')), 'Viewers cannot import inventory files');
select tests.logout();

select tests.login('op');
select tests.remember('imp', public.create_inventory_import(tests.id('org'), tests.id('fac'), 'count', 'count.csv', '[
  {"line_no":2, "sku":"SKU-1", "location":"A-01", "qty":90},
  {"line_no":3, "sku":"SKU-2", "location":"", "qty":50},
  {"line_no":4, "sku":"SKU-NEW", "location":"B-02", "qty":7, "description":"New tote"},
  {"line_no":5, "sku":"", "location":"", "qty":3},
  {"line_no":6, "sku":"SKU-3", "location":"", "qty":-2},
  {"line_no":7, "sku":"SKU-9", "location":"", "qty":null},
  {"line_no":8, "sku":"SKU-DUP", "location":"", "qty":1},
  {"line_no":9, "sku":"SKU-DUP", "location":"", "qty":2},
  {"line_no":10, "sku":"SKU-3", "location":"", "qty":12, "error":"Server flagged"}
]'::jsonb));
select tests.ok((select status = 'discrepancy' and recorded_qty = 100 and decision = 'pending' from public.inventory_import_lines where import_id = tests.id('imp') and line_no = 2),
  'A different count is flagged as a discrepancy against the record');
select tests.ok((select status = 'match' and decision = 'not_applicable' from public.inventory_import_lines where import_id = tests.id('imp') and line_no = 3), 'Equal counts are matches');
select tests.ok((select status = 'new_item' from public.inventory_import_lines where import_id = tests.id('imp') and line_no = 4), 'Unknown SKUs are proposed as new records');
select tests.ok((select status = 'invalid' and error = 'Missing SKU' from public.inventory_import_lines where import_id = tests.id('imp') and line_no = 5), 'Missing SKU is invalid');
select tests.ok((select status = 'invalid' and error like '%negative%' from public.inventory_import_lines where import_id = tests.id('imp') and line_no = 6), 'Negative quantities are invalid');
select tests.ok((select status = 'invalid' and error like 'Missing or invalid quantity%' from public.inventory_import_lines where import_id = tests.id('imp') and line_no = 7), 'Missing quantities are invalid');
select tests.ok((select bool_and(status = 'invalid' and error like 'Duplicate%') from public.inventory_import_lines where import_id = tests.id('imp') and sku = 'SKU-DUP'), 'Duplicate SKU/location rows are invalid');
select tests.ok((select total_rows = 9 and invalid_rows = 6 and discrepancy_rows = 1 and new_rows = 1 and match_rows = 1 from public.inventory_imports where id = tests.id('imp')), 'Import summary counts are correct');
select tests.ok((select on_hand = 100 from public.inventory_items where id = tests.id('item1')), 'Uploading a file changes no inventory quantities');
select tests.throws(format($$select public.decide_inventory_lines(%L, array(select id from public.inventory_import_lines where import_id = %L), 'approved')$$, tests.id('imp'), tests.id('imp')),
  'Operators cannot approve corrections');
select tests.throws(format($$select public.apply_inventory_import(%L)$$, tests.id('imp')), 'Operators cannot apply corrections');
select tests.throws(format($$update public.inventory_import_lines set decision = 'approved' where import_id = %L$$, tests.id('imp')), 'Lines cannot be approved by editing them directly');
select tests.logout();

-- ---------------------------------------------------------------- another company
select tests.login('rival');
select tests.eq((select count(*) from public.inventory_items where org_id = tests.id('org')), 0, 'Another company cannot read inventory records');
select tests.eq((select count(*) from public.inventory_imports where org_id = tests.id('org')), 0, 'Another company cannot read inventory imports');
select tests.eq((select count(*) from public.inventory_import_lines where org_id = tests.id('org')), 0, 'Another company cannot read import lines');
select tests.throws(format($$select public.create_inventory_import(%L, %L, 'count', 'x.csv', '[{"line_no":2,"sku":"SKU-1","location":"A-01","qty":1}]')$$, tests.id('org'), tests.id('fac')),
  'Another company cannot import into this organization');
select tests.throws(format($$select public.create_inventory_import(%L, %L, 'count', 'x.csv', '[{"line_no":2,"sku":"SKU-1","location":"A-01","qty":1}]')$$, tests.id('orgB'), tests.id('fac')),
  'Another company cannot import against this organization''s facility');
select tests.throws(format($$select public.decide_inventory_lines(%L, array(select id from public.inventory_import_lines), 'approved')$$, tests.id('imp')),
  'Another company cannot approve corrections');
select tests.throws(format($$select public.apply_inventory_import(%L)$$, tests.id('imp')), 'Another company cannot apply corrections');
select tests.throws(format($$select public.discard_inventory_import(%L)$$, tests.id('imp')), 'Another company cannot discard imports');
select tests.logout();

-- ---------------------------------------------------------------- review and apply
select tests.login('mgr');
select tests.eq(public.decide_inventory_lines(tests.id('imp'),
  array(select id from public.inventory_import_lines where import_id = tests.id('imp') and line_no in (2, 4, 5, 3)), 'approved'), 2,
  'Managers approve discrepancies and new items; invalid and matching lines cannot be approved');
select tests.logout();

-- Someone else's correction lands between upload and apply: SKU-1 is now 95.
reset role;
select tests.login('op');
select tests.remember('imp2', public.create_inventory_import(tests.id('org'), tests.id('fac'), 'count', 'recount.csv', '[{"line_no":2,"sku":"SKU-1","location":"A-01","qty":95}]'::jsonb));
select tests.logout();
select tests.login('mgr');
select public.decide_inventory_lines(tests.id('imp2'), array(select id from public.inventory_import_lines where import_id = tests.id('imp2')), 'approved');
select tests.eq((public.apply_inventory_import(tests.id('imp2')) ->> 'applied')::bigint, 1, 'Approved correction is applied');
select tests.ok((select on_hand = 95 from public.inventory_items where id = tests.id('item1')), 'Record now shows the approved quantity');

-- Now apply the first import, whose SKU-1 line was based on the old record (100).
select tests.ok((select (r ->> 'applied')::int = 1 and (r ->> 'stale')::int = 1 from (select public.apply_inventory_import(tests.id('imp')) as r) x),
  'A correction based on outdated data is held back as stale, not applied');
select tests.ok((select on_hand = 95 from public.inventory_items where id = tests.id('item1')), 'The newer quantity was not silently overwritten');
select tests.ok((select status = 'stale' from public.inventory_import_lines where import_id = tests.id('imp') and line_no = 2), 'The stale line is marked for re-review');
select tests.ok((select on_hand = 7 and description = 'New tote' from public.inventory_items where sku = 'SKU-NEW'), 'Approved new item was created');
select tests.ok((select on_hand = 10 from public.inventory_items where sku = 'SKU-3'), 'Invalid lines changed nothing');
select tests.ok((select count(*) = 2 and bool_and(approved_by = tests.id('mgr')) from public.inventory_adjustments where org_id = tests.id('org')),
  'Every applied change is logged with the approving manager');
select tests.ok((select old_qty = 100 and new_qty = 95 from public.inventory_adjustments where sku = 'SKU-1'), 'Adjustment log records before and after quantities');
select tests.throws(format($$select public.apply_inventory_import(%L)$$, tests.id('imp')), 'An import can only be applied once');
select tests.throws($$update public.inventory_adjustments set new_qty = 0$$, 'Adjustment history cannot be edited');
select tests.throws($$delete from public.inventory_adjustments$$, 'Adjustment history cannot be deleted');
select tests.logout();

-- Rejected lines are never applied; discarding closes an import with no changes.
select tests.login('op');
select tests.remember('imp3', public.create_inventory_import(tests.id('org'), tests.id('fac'), 'system', 'wms.csv', '[{"line_no":2,"sku":"SKU-2","location":"","qty":0}]'::jsonb));
select tests.logout();
select tests.login('mgr');
select public.decide_inventory_lines(tests.id('imp3'), array(select id from public.inventory_import_lines where import_id = tests.id('imp3')), 'rejected');
select tests.eq((public.apply_inventory_import(tests.id('imp3')) ->> 'applied')::bigint, 0, 'Rejected corrections are not applied');
select tests.ok((select on_hand = 50 from public.inventory_items where sku = 'SKU-2'), 'Record unchanged after rejection');
select tests.logout();
select tests.login('op');
select tests.remember('imp4', public.create_inventory_import(tests.id('org'), tests.id('fac'), 'count', 'mistake.csv', '[{"line_no":2,"sku":"SKU-2","location":"","qty":1}]'::jsonb));
select tests.lives(format($$select public.discard_inventory_import(%L)$$, tests.id('imp4')), 'The uploader can discard their own import');
select tests.throws(format($$select public.decide_inventory_lines(%L, array(select id from public.inventory_import_lines where import_id = %L), 'approved')$$, tests.id('imp4'), tests.id('imp4')),
  'Closed imports cannot be changed');
select tests.logout();

select tests.login('owner');
select tests.ok((select count(*) > 0 from public.audit_log where entity_type = 'inventory_items'), 'Inventory record changes appear in the audit log');
select tests.logout();

rollback;
