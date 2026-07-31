\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

create schema if not exists auth;

create table auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
    'email', nullif(current_setting('request.jwt.claim.email', true), '')
  );
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$$;

grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
grant execute on function auth.jwt() to authenticated, service_role;

\ir ../../supabase/schema.sql
\ir ../../supabase/migrations/2026-07-19-meal-prep-macros.sql
\ir ../../supabase/migrations/2026-07-30-order-lifecycle-hardening.sql

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'admin@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'viewer@example.com');

insert into public.admin_memberships (
  user_id,
  email,
  display_name,
  role,
  is_active,
  approved_at
) values (
  '11111111-1111-4111-8111-111111111111',
  'admin@example.com',
  'Test Admin',
  'owner',
  true,
  now()
);

insert into public.orders (
  id,
  order_number,
  customer_name,
  status,
  service_date,
  fulfillment_method,
  delivery_window,
  zone,
  total_cents,
  payment_status
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'TEST-001',
  'Contract Test Customer',
  'new',
  '2026-07-30',
  'pickup',
  '5:00 PM',
  'Reston',
  2500,
  'paid'
);

insert into public.inventory_items (id, name, unit, on_hand_qty, par_level, status)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Healthy Item', 'units', 10, 10, 'healthy'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Low Item', 'units', 1, 10, 'low');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select set_config('request.jwt.claim.email', 'admin@example.com', false);

do $$
declare
  v_result jsonb;
  v_count integer;
  v_version bigint;
begin
  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'In Prep',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  );

  if coalesce((v_result ->> 'success')::boolean, false) is not true then
    raise exception 'expected first transition to succeed: %', v_result;
  end if;
  if v_result ->> 'status' <> 'in prep' then
    raise exception 'unexpected first transition status: %', v_result;
  end if;
  if (v_result ->> 'version')::bigint <> 1 then
    raise exception 'expected order version 1: %', v_result;
  end if;

  select count(*) into v_count
  from public.order_status_events
  where request_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  if v_count <> 1 then
    raise exception 'expected exactly one audit event, found %', v_count;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'In Prep',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  );
  if coalesce((v_result ->> 'replayed')::boolean, false) is not true then
    raise exception 'expected identical retry to replay: %', v_result;
  end if;

  select version into v_version
  from public.orders
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_version <> 1 then
    raise exception 'idempotent replay changed order version to %', v_version;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Ready',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  );
  if v_result ->> 'error' <> 'idempotency_conflict' then
    raise exception 'expected cross-operation key reuse conflict: %', v_result;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Ready',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  );
  if coalesce((v_result ->> 'success')::boolean, false) is not true then
    raise exception 'expected second valid transition to succeed: %', v_result;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'In Prep',
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  );
  if v_result ->> 'error' <> 'invalid_transition' then
    raise exception 'expected backward transition to fail: %', v_result;
  end if;
end;
$$;

do $$
declare
  v_metrics jsonb;
begin
  v_metrics := public.get_ops_dashboard_metrics('2026-07-30');

  if (v_metrics ->> 'today_order_count')::integer <> 1 then
    raise exception 'unexpected today order count: %', v_metrics;
  end if;
  if (v_metrics ->> 'recognized_revenue_cents')::integer <> 2500 then
    raise exception 'unexpected recognized revenue: %', v_metrics;
  end if;
  if (v_metrics ->> 'low_stock_count')::integer <> 1 then
    raise exception 'unexpected low-stock count: %', v_metrics;
  end if;
  if (v_metrics ->> 'inventory_count')::integer <> 2 then
    raise exception 'unexpected inventory count: %', v_metrics;
  end if;
  if (v_metrics ->> 'healthy_inventory_count')::integer <> 1 then
    raise exception 'unexpected healthy inventory count: %', v_metrics;
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
select set_config('request.jwt.claim.email', 'viewer@example.com', false);

do $$
declare
  v_result jsonb;
begin
  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Picked Up',
    '99999999-9999-4999-8999-999999999999'
  );
  if v_result ->> 'error' <> 'forbidden' then
    raise exception 'expected non-admin transition to be forbidden: %', v_result;
  end if;
end;
$$;

reset role;

do $$
declare
  v_version bigint;
  v_event_count integer;
begin
  select public.ops_schema_version() into v_version;
  if v_version <> 2026073002 then
    raise exception 'unexpected schema version %', v_version;
  end if;

  select count(*) into v_event_count from public.order_status_events;
  if v_event_count <> 2 then
    raise exception 'expected two successful transition events, found %', v_event_count;
  end if;
end;
$$;
