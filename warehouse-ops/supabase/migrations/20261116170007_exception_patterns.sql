-- Rules-based pattern detection (no AI). SECURITY INVOKER, so Row Level Security applies.
--   supplier_trends: supplier + exception type with >= 3 in the last 30 days and at least
--                    double their average for the previous 60 days (per 30 days)
--   repeat_skus:     SKUs with 2+ exceptions in the last 30 days
--   stale_open:      unresolved exceptions reported more than 7 days ago
create function public.exception_patterns(p_org uuid, p_facility uuid default null)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with base as (
    select i.*, s.name as supplier_name
    from public.incidents i
    left join public.suppliers s on s.id = i.supplier_id
    where i.org_id = p_org
      and (p_facility is null or i.facility_id = p_facility)
      and i.occurred_at >= now() - interval '90 days'
  ),
  sup as (
    select supplier_id, supplier_name, type,
      count(*) filter (where occurred_at >= now() - interval '30 days') as cur,
      count(*) filter (where occurred_at < now() - interval '30 days') as prev60
    from base where supplier_id is not null
    group by supplier_id, supplier_name, type
  ),
  skus as (
    select sku, count(*) as cnt, count(distinct supplier_id) as suppliers,
      mode() within group (order by type) as top_type
    from base
    where sku is not null and btrim(sku) <> '' and occurred_at >= now() - interval '30 days'
    group by sku having count(*) >= 2
  )
  select jsonb_build_object(
    'supplier_trends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'supplier_id', supplier_id, 'supplier', supplier_name, 'type', type,
        'current', cur, 'previous_avg', round(prev60 / 2.0, 1)) order by cur desc, supplier_name)
      from sup where cur >= 3 and cur >= 2 * (prev60 / 2.0)), '[]'::jsonb),
    'repeat_skus', coalesce((
      select jsonb_agg(jsonb_build_object('sku', sku, 'count', cnt, 'suppliers', suppliers, 'top_type', top_type) order by cnt desc, sku)
      from (select * from skus order by cnt desc, sku limit 10) t), '[]'::jsonb),
    'stale_open', (
      select count(*) from public.incidents i
      where i.org_id = p_org and (p_facility is null or i.facility_id = p_facility)
        and i.status in ('open', 'in_progress') and i.created_at < now() - interval '7 days')
  )
$$;

revoke all on function public.exception_patterns(uuid, uuid) from public, anon;
grant execute on function public.exception_patterns(uuid, uuid) to authenticated;
