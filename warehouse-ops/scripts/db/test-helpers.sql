-- Tiny assertion helpers for the SQL test files (test databases only).
create schema tests;
grant usage on schema tests to anon, authenticated;

create table tests.ids (key text primary key, id uuid not null);
grant select on tests.ids to anon, authenticated;

-- Create a confirmed user and remember their id under a short name.
create function tests.create_user(p_key text, p_email text) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (gen_random_uuid(), p_email, now(), jsonb_build_object('full_name', initcap(p_key)))
  returning id into v;
  insert into tests.ids values (p_key, v);
  return v;
end $$;

create function tests.id(p_key text) returns uuid language sql stable as $$
  select id from tests.ids where key = p_key
$$;
create function tests.remember(p_key text, p_id uuid) returns void language sql security definer as $$
  insert into tests.ids values (p_key, p_id) on conflict (key) do update set id = excluded.id
$$;

-- Act as a signed-in user (role "authenticated" + JWT claims), like a browser session.
create function tests.login(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.id(p_key), 'role', 'authenticated')::text, true);
  -- The Storage API sets this before deleting objects, then relies on RLS policies.
  perform set_config('storage.allow_delete_query', 'true', true);
  execute 'set local role authenticated';
end $$;

create function tests.login_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create function tests.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAIL: %', p_msg;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

create function tests.eq(p_got bigint, p_want bigint, p_msg text) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then
    raise exception 'FAIL: % (got %, want %)', p_msg, p_got, p_want;
  end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Assert a statement fails (permission error, RLS violation or trigger rule).
create function tests.throws(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok - % [%]', p_msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % (statement succeeded: %)', p_msg, p_sql;
end $$;

-- Assert a statement succeeds.
create function tests.lives(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise notice 'ok - %', p_msg;
exception when others then
  raise exception 'FAIL: % [%]', p_msg, sqlerrm;
end $$;

-- Number of rows a statement affects (0 means RLS silently filtered it).
create function tests.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema tests to anon, authenticated;
