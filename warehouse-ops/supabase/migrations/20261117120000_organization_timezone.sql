-- Company time zone, used for date filters, reports and exports (e.g. "Nov 14" means Nov 14 in Texas).
alter table public.organizations add column timezone text not null default 'America/Chicago'
  check (char_length(timezone) between 1 and 64);

-- Reject names PostgreSQL doesn't recognize as time zones.
create function private.validate_timezone()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown time zone: %', left(new.timezone, 64) using errcode = '22023';
  end if;
  return new;
end
$$;

create trigger organizations_timezone_valid
before insert or update of timezone on public.organizations
for each row execute function private.validate_timezone();

-- Admins may change the name and the time zone (RLS already limits updates to admins).
grant update (timezone) on public.organizations to authenticated;
