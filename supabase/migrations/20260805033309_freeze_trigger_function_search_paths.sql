-- Freeze the execution search path for the two updated_at trigger functions.
--
-- This migration:
--   * does not replace either function body;
--   * does not change ownership, grants, triggers, tables, or rows;
--   * limits unqualified name resolution to PostgreSQL system objects.

begin;

alter function public.set_updated_at()
  set search_path = pg_catalog;

alter function public.set_event_leads_updated_at()
  set search_path = pg_catalog;

commit;

-- Authorized rollback procedure, not executed by this migration:
--
-- begin;
--
-- alter function public.set_updated_at()
--   reset search_path;
--
-- alter function public.set_event_leads_updated_at()
--   reset search_path;
--
-- commit;
