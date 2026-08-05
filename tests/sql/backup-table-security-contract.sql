\set ON_ERROR_STOP on

-- This contract uses synthetic structures and values only.
-- It does not connect to or inspect production Supabase data.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  else
    alter role service_role bypassrls;
  end if;
end;
$$;

create table public.orders_test_cleanup_backup (
  id integer primary key,
  synthetic_marker text not null
);

create table public.order_items_test_cleanup_backup (
  id integer primary key,
  synthetic_marker text not null
);

insert into public.orders_test_cleanup_backup (
  id,
  synthetic_marker
)
select
  generated_id,
  'synthetic-order-' || generated_id
from generate_series(1, 13) as generated_id;

insert into public.order_items_test_cleanup_backup (
  id,
  synthetic_marker
)
select
  generated_id,
  'synthetic-item-' || generated_id
from generate_series(1, 18) as generated_id;

-- Reproduce the broad access observed before the corrective migration.
grant all privileges
  on table public.orders_test_cleanup_backup
  to anon, authenticated, service_role;

grant all privileges
  on table public.order_items_test_cleanup_backup
  to anon, authenticated, service_role;

do $$
declare
  v_orders_count integer;
  v_orders_sum bigint;
  v_items_count integer;
  v_items_sum bigint;
begin
  select count(*), sum(id)
  into v_orders_count, v_orders_sum
  from public.orders_test_cleanup_backup;

  select count(*), sum(id)
  into v_items_count, v_items_sum
  from public.order_items_test_cleanup_backup;

  if v_orders_count <> 13 or v_orders_sum <> 91 then
    raise exception
      'invalid synthetic orders fixture: count %, sum %',
      v_orders_count,
      v_orders_sum;
  end if;

  if v_items_count <> 18 or v_items_sum <> 171 then
    raise exception
      'invalid synthetic order-items fixture: count %, sum %',
      v_items_count,
      v_items_sum;
  end if;

  if not has_table_privilege(
    'anon',
    'public.orders_test_cleanup_backup',
    'SELECT'
  ) then
    raise exception 'baseline anon orders privilege was not reproduced';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.order_items_test_cleanup_backup',
    'SELECT'
  ) then
    raise exception
      'baseline authenticated order-items privilege was not reproduced';
  end if;
end;
$$;

\ir ../../supabase/migrations/20260804230905_protect_test_cleanup_backups.sql

do $$
declare
  v_orders_count integer;
  v_orders_sum bigint;
  v_items_count integer;
  v_items_sum bigint;
  v_privilege text;
begin
  if to_regclass('public.orders_test_cleanup_backup') is null then
    raise exception 'orders backup table must be preserved';
  end if;

  if to_regclass('public.order_items_test_cleanup_backup') is null then
    raise exception 'order-items backup table must be preserved';
  end if;

  select count(*), sum(id)
  into v_orders_count, v_orders_sum
  from public.orders_test_cleanup_backup;

  select count(*), sum(id)
  into v_items_count, v_items_sum
  from public.order_items_test_cleanup_backup;

  if v_orders_count <> 13 or v_orders_sum <> 91 then
    raise exception
      'orders backup rows changed: count %, sum %',
      v_orders_count,
      v_orders_sum;
  end if;

  if v_items_count <> 18 or v_items_sum <> 171 then
    raise exception
      'order-items backup rows changed: count %, sum %',
      v_items_count,
      v_items_sum;
  end if;

  if exists (
    select 1
    from pg_class as table_record
    join pg_namespace as schema_record
      on schema_record.oid = table_record.relnamespace
    where schema_record.nspname = 'public'
      and table_record.relname in (
        'orders_test_cleanup_backup',
        'order_items_test_cleanup_backup'
      )
      and (
        not table_record.relrowsecurity
        or table_record.relforcerowsecurity
      )
  ) then
    raise exception
      'both backup tables must have non-forced RLS enabled';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid in (
      'public.orders_test_cleanup_backup'::regclass,
      'public.order_items_test_cleanup_backup'::regclass
    )
  ) then
    raise exception 'backup tables must not have public RLS policies';
  end if;

  foreach v_privilege in array array[
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER'
  ]
  loop
    if has_table_privilege(
      'anon',
      'public.orders_test_cleanup_backup',
      v_privilege
    ) then
      raise exception
        'anon retained % on orders backup',
        v_privilege;
    end if;

    if has_table_privilege(
      'anon',
      'public.order_items_test_cleanup_backup',
      v_privilege
    ) then
      raise exception
        'anon retained % on order-items backup',
        v_privilege;
    end if;

    if has_table_privilege(
      'authenticated',
      'public.orders_test_cleanup_backup',
      v_privilege
    ) then
      raise exception
        'authenticated retained % on orders backup',
        v_privilege;
    end if;

    if has_table_privilege(
      'authenticated',
      'public.order_items_test_cleanup_backup',
      v_privilege
    ) then
      raise exception
        'authenticated retained % on order-items backup',
        v_privilege;
    end if;

    if not has_table_privilege(
      'service_role',
      'public.orders_test_cleanup_backup',
      v_privilege
    ) then
      raise exception
        'service_role lost % on orders backup',
        v_privilege;
    end if;

    if not has_table_privilege(
      'service_role',
      'public.order_items_test_cleanup_backup',
      v_privilege
    ) then
      raise exception
        'service_role lost % on order-items backup',
        v_privilege;
    end if;
  end loop;
end;
$$;

set role service_role;

do $$
declare
  v_orders_count integer;
  v_items_count integer;
begin
  select count(*)
  into v_orders_count
  from public.orders_test_cleanup_backup;

  select count(*)
  into v_items_count
  from public.order_items_test_cleanup_backup;

  if v_orders_count <> 13 or v_items_count <> 18 then
    raise exception
      'service_role could not read preserved rows: orders %, items %',
      v_orders_count,
      v_items_count;
  end if;
end;
$$;

reset role;
