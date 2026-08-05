-- Move the RLS-only admin authorization helper out of the exposed public
-- schema while preserving its identity and all dependent policy bindings.
--
-- This migration:
--   * preserves the existing function body and OID;
--   * preserves all dependent RLS policies;
--   * removes PUBLIC and anonymous execution;
--   * retains authenticated execution solely for RLS evaluation;
--   * does not change tables, policies, rows, or application code.

begin;

create schema private authorization postgres;

revoke all
  on schema private
  from public;

grant usage
  on schema private
  to authenticated, service_role;

alter function public.is_admin_user()
  set schema private;

revoke execute
  on function private.is_admin_user()
  from public, anon;

grant execute
  on function private.is_admin_user()
  to authenticated, service_role;

commit;

-- Authorized rollback procedure, not executed by this migration:
--
-- begin;
--
-- alter function private.is_admin_user()
--   set schema public;
--
-- grant execute
--   on function public.is_admin_user()
--   to public, anon, authenticated, service_role;
--
-- drop schema private;
--
-- commit;
