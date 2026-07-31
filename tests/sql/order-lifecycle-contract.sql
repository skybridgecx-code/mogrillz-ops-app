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
end;
$$;

grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function auth.jwt() to authenticated;

\ir ../../supabase/schema.sql
\ir ../../supabase/migrations/2026-07-31-order-lifecycle-hardening.sql

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
  '2026-07-31',
  'pickup',
  '5:00 PM',
  'Reston',
  2500,
  'paid'
);

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select set_config('request.jwt.claim.email', 'admin@example.com', false);

do $$
declare
  v_result jsonb;
  v_count integer;
  v_version bigint;
  v_prep_started_at timestamptz;
  v_ready_at timestamptz;
  v_picked_up_at timestamptz;
begin
  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'In Prep',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  );

  if coalesce((v_result ->> 'success')::boolean, false) is not true
     or v_result ->> 'status' <> 'in prep'
     or (v_result ->> 'version')::bigint <> 1 then
    raise exception 'expected first transition to succeed: %', v_result;
  end if;

  select count(*) into v_count
  from public.order_status_events
  where request_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  if v_count <> 1 then
    raise exception 'expected exactly one first audit event, found %', v_count;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'In Prep',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  );
  if coalesce((v_result ->> 'replayed')::boolean, false) is not true then
    raise exception 'expected identical retry to replay: %', v_result;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Ready',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  );
  if v_result ->> 'error' <> 'idempotency_conflict' then
    raise exception 'expected idempotency conflict: %', v_result;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Ready',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  );
  if coalesce((v_result ->> 'success')::boolean, false) is not true
     or (v_result ->> 'version')::bigint <> 2 then
    raise exception 'expected ready transition to succeed: %', v_result;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'In Prep',
    'ffffffff-ffff-4fff-8fff-ffffffffffff'
  );
  if v_result ->> 'error' <> 'invalid_transition' then
    raise exception 'expected backward transition to fail: %', v_result;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Picked Up',
    '77777777-7777-4777-8777-777777777777'
  );
  if coalesce((v_result ->> 'success')::boolean, false) is not true
     or (v_result ->> 'version')::bigint <> 3 then
    raise exception 'expected completion transition to succeed: %', v_result;
  end if;

  v_result := public.transition_order_status(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Cancelled',
    '88888888-8888-4888-8888-888888888888'
  );
  if v_result ->> 'error' <> 'invalid_transition' then
    raise exception 'expected completed order cancellation to fail: %', v_result;
  end if;

  select version, prep_started_at, ready_at, picked_up_at
  into v_version, v_prep_started_at, v_ready_at, v_picked_up_at
  from public.orders
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  if v_version <> 3
     or v_prep_started_at is null
     or v_ready_at is null
     or v_picked_up_at is null then
    raise exception 'unexpected lifecycle state after completion';
  end if;

  select count(*) into v_count
  from public.order_status_events
  where order_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if v_count <> 3 then
    raise exception 'expected three successful audit events, found %', v_count;
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
