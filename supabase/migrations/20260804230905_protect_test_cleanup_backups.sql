-- Protect retained cleanup-backup data from public Data API roles.
--
-- This migration:
--   * preserves both tables and every existing row;
--   * removes table privileges from anon and authenticated;
--   * enables RLS as a second default-deny boundary;
--   * does not alter owner or service_role privileges;
--   * intentionally creates no public access policies.

begin;

revoke all privileges
  on table public.orders_test_cleanup_backup
  from anon, authenticated;

revoke all privileges
  on table public.order_items_test_cleanup_backup
  from anon, authenticated;

alter table public.orders_test_cleanup_backup
  enable row level security;

alter table public.order_items_test_cleanup_backup
  enable row level security;

commit;

-- Emergency rollback procedure
-- ----------------------------
-- Run only under separate production authorization after confirming that
-- restoring the former broad client-role access is required.
--
-- begin;
--
-- alter table public.orders_test_cleanup_backup
--   disable row level security;
--
-- alter table public.order_items_test_cleanup_backup
--   disable row level security;
--
-- grant select, insert, update, delete, truncate, references, trigger
--   on table public.orders_test_cleanup_backup
--   to anon, authenticated;
--
-- grant select, insert, update, delete, truncate, references, trigger
--   on table public.order_items_test_cleanup_backup
--   to anon, authenticated;
--
-- commit;
