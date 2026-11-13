-- Fixes from the Supabase security advisor after the first two migrations.

-- 1. Move the RLS helper out of the API-exposed `public` schema so it can't be
--    called as /rest/v1/rpc/current_org_id. Policies reference the function by
--    OID, so they keep working after the move.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.current_org_id() set schema private;
revoke execute on function private.current_org_id() from anon, public;
grant execute on function private.current_org_id() to authenticated;

-- 2. Keep pgvector out of `public`. Columns and indexes reference the type and
--    operator class by OID, so they are unaffected.
alter extension vector set schema extensions;
