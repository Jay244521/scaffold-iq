-- Remove the unused, empty dfw_leads table and the trigger function that only
-- it used. Dropping the table also drops trg_dfw_leads_updated_at.
drop table if exists public.dfw_leads;
drop function if exists public.set_updated_at();
