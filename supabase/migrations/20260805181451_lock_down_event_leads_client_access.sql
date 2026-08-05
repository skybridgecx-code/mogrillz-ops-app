-- Preserve the existing fail-closed event-lead boundary while removing
-- unnecessary table privileges that row-level security does not govern.
--
-- This migration:
--   * preserves the event_leads table, rows, columns, indexes, and trigger;
--   * preserves postgres and service_role access;
--   * removes every table privilege from anon and authenticated;
--   * makes client denial explicit with a restrictive RLS policy;
--   * does not change the backup tables, application code, or Auth settings.

begin;

revoke all privileges
  on table public.event_leads
  from anon, authenticated;

create policy event_leads_client_deny_all
  on public.event_leads
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

commit;

-- Authorized rollback procedure, not executed by this migration:
--
-- begin;
--
-- drop policy event_leads_client_deny_all
--   on public.event_leads;
--
-- grant all privileges
--   on table public.event_leads
--   to anon, authenticated;
--
-- commit;
