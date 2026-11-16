-- Pattern detection: correct results for members, nothing for other companies.
begin;
select tests.create_user('owner', 'owner@pat-a.test');
select tests.create_user('rival', 'rival@pat-b.test');
select tests.login('owner');
select tests.remember('org', public.create_organization('Patterns A', 'Main DC'));
select tests.logout();
select tests.login('rival');
select tests.remember('orgB', public.create_organization('Patterns B', 'Other DC'));
select tests.logout();
select tests.remember('fac', (select id from public.facilities where org_id = tests.id('org')));

insert into public.suppliers (org_id, name) values (tests.id('org'), 'Rising Supplier'), (tests.id('org'), 'Steady Supplier');
select tests.remember('rise', (select id from public.suppliers where name = 'Rising Supplier'));
select tests.remember('steady', (select id from public.suppliers where name = 'Steady Supplier'));

-- Rising: 4 damaged in the last 30 days, 1 in the previous 60. Steady: 3 now, 6 before.
insert into public.incidents (org_id, facility_id, type, supplier_id, sku, description, occurred_at, reported_by, created_at)
select tests.id('org'), tests.id('fac'), 'damaged', tests.id('rise'), 'SKU-R', 'd', now() - (g || ' days')::interval, tests.id('owner'), now() - (g || ' days')::interval
from unnest(array[1, 5, 9, 20, 45]) g;
insert into public.incidents (org_id, facility_id, type, supplier_id, sku, description, occurred_at, reported_by, created_at)
select tests.id('org'), tests.id('fac'), 'shortage', tests.id('steady'), 'SKU-S' || g, 's', now() - (g || ' days')::interval, tests.id('owner'), now() - (g || ' days')::interval
from unnest(array[2, 12, 22, 35, 40, 50, 60, 70, 80]) g;

select tests.login('owner');
select tests.ok((select jsonb_array_length(p -> 'supplier_trends') = 1 and p -> 'supplier_trends' -> 0 ->> 'supplier' = 'Rising Supplier'
  and (p -> 'supplier_trends' -> 0 ->> 'current')::int = 4 and p -> 'supplier_trends' -> 0 ->> 'type' = 'damaged'
  from (select public.exception_patterns(tests.id('org')) as p) x), 'Rising supplier exceptions are flagged; steady ones are not');
select tests.ok((select p -> 'repeat_skus' -> 0 ->> 'sku' = 'SKU-R' and (p -> 'repeat_skus' -> 0 ->> 'count')::int = 4 and jsonb_array_length(p -> 'repeat_skus') = 1
  from (select public.exception_patterns(tests.id('org')) as p) x), 'SKUs with repeat exceptions are flagged');
select tests.ok((select (p ->> 'stale_open')::int = 11 from (select public.exception_patterns(tests.id('org')) as p) x),
  'Unresolved exceptions older than 7 days are counted');
select tests.logout();

select tests.login('rival');
select tests.ok((select jsonb_array_length(p -> 'supplier_trends') = 0 and jsonb_array_length(p -> 'repeat_skus') = 0 and (p ->> 'stale_open')::int = 0
  from (select public.exception_patterns(tests.id('org')) as p) x), 'Another company gets no patterns for this organization');
select tests.logout();
select tests.login_anon();
select tests.throws(format($$select public.exception_patterns(%L)$$, tests.id('org')), 'Anonymous visitors cannot read patterns');
select tests.logout();
rollback;
