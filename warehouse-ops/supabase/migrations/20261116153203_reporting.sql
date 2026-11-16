-- Reporting: one call returns everything the Reports page needs for a date range.
-- SECURITY INVOKER, so Row Level Security applies: non-members get empty results.

create function public.incident_report(
  p_org uuid,
  p_facility uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with base as (
    select i.*,
           extract(epoch from (i.resolved_at - i.created_at)) / 3600 as hours_to_resolve,
           extract(epoch from (now() - i.created_at)) / 86400 as age_days
    from public.incidents i
    where i.org_id = p_org
      and (p_facility is null or i.facility_id = p_facility)
      and (p_from is null or i.occurred_at >= p_from)
      and (p_to is null or i.occurred_at < p_to)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'unresolved', (select count(*) from base where status in ('open', 'in_progress')),
    'resolved', (select count(*) from base where resolved_at is not null),
    'avg_hours', (select round(avg(hours_to_resolve)::numeric, 1) from base where resolved_at is not null),
    'median_hours', (select round((percentile_cont(0.5) within group (order by hours_to_resolve))::numeric, 1)
                     from base where resolved_at is not null),
    'by_supplier', (select coalesce(jsonb_agg(x order by x.total desc, x.name), '[]'::jsonb) from (
        select coalesce(s.name, 'No supplier recorded') as name, s.id,
               count(*) as total,
               count(*) filter (where b.status in ('open', 'in_progress')) as unresolved,
               count(*) filter (where b.type = 'shortage') as shortage,
               count(*) filter (where b.type = 'overage') as overage,
               count(*) filter (where b.type = 'damaged') as damaged,
               count(*) filter (where b.type = 'wrong_item') as wrong_item,
               count(*) filter (where b.type = 'other') as other,
               sum(abs(coalesce(b.received_qty, 0) - coalesce(b.expected_qty, 0))) as unit_variance,
               round(avg(b.hours_to_resolve)::numeric, 1) as avg_hours
        from base b left join public.suppliers s on s.id = b.supplier_id
        group by s.id, s.name
      ) x),
    'by_type', (select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select b.type, count(*) as total,
               count(*) filter (where b.status in ('open', 'in_progress')) as unresolved,
               round(avg(b.hours_to_resolve)::numeric, 1) as avg_hours,
               round((percentile_cont(0.5) within group (order by b.hours_to_resolve))::numeric, 1) as median_hours
        from base b group by b.type
      ) x),
    'aging', (select jsonb_build_object(
        'd0_2', count(*) filter (where age_days < 3),
        'd3_7', count(*) filter (where age_days >= 3 and age_days < 8),
        'd8_30', count(*) filter (where age_days >= 8 and age_days < 31),
        'd31_plus', count(*) filter (where age_days >= 31))
      from base where status in ('open', 'in_progress'))
  )
$$;

revoke all on function public.incident_report(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.incident_report(uuid, uuid, timestamptz, timestamptz) to authenticated;
