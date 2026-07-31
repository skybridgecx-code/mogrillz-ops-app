-- Operations schema reconciliation and order lifecycle hardening.
-- Apply before deploying application code that calls transition_order_status().

alter table public.menu_items add column if not exists image_url text;
alter table public.menu_items add column if not exists image_path text;
alter table public.menu_items add column if not exists image_bucket text;
alter table public.menu_items add column if not exists sort_order integer not null default 0;
alter table public.menu_items add column if not exists is_featured boolean not null default false;
alter table public.menu_items add column if not exists is_active boolean not null default false;
alter table public.menu_items add column if not exists calories integer;
alter table public.menu_items add column if not exists protein_g integer;
alter table public.menu_items add column if not exists carbs_g integer;
alter table public.menu_items add column if not exists fat_g integer;

update public.menu_items
set is_active = lower(trim(coalesce(availability, ''))) in ('live', 'active', 'available', 'enabled', 'true')
where is_active is distinct from (
  lower(trim(coalesce(availability, ''))) in ('live', 'active', 'available', 'enabled', 'true')
);

alter table public.orders add column if not exists operator_note text;
alter table public.orders add column if not exists service_date date;
alter table public.orders add column if not exists version bigint not null default 0;
alter table public.orders add column if not exists prep_started_at timestamptz;
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists picked_up_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text not null,
  to_status text not null,
  order_version bigint not null,
  changed_by uuid references auth.users(id) on delete set null,
  request_id uuid not null unique,
  changed_at timestamptz not null default now()
);

create index if not exists idx_order_status_events_order_changed_at
  on public.order_status_events (order_id, changed_at desc);
create index if not exists idx_order_status_events_changed_by_changed_at
  on public.order_status_events (changed_by, changed_at desc);

grant select, insert on public.order_status_events to authenticated;
alter table public.order_status_events enable row level security;

drop policy if exists "order_status_events_select" on public.order_status_events;
create policy "order_status_events_select"
on public.order_status_events
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "order_status_events_insert" on public.order_status_events;
create policy "order_status_events_insert"
on public.order_status_events
for insert
to authenticated
with check (public.is_admin_user() and changed_by = (select auth.uid()));

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_next_status text,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current_status text;
  v_current_normalized text;
  v_next_normalized text;
  v_next_storage text;
  v_version bigint;
  v_now timestamptz := now();
  v_existing_event public.order_status_events%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'unauthorized');
  end if;

  if not public.is_admin_user() then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select *
  into v_existing_event
  from public.order_status_events
  where request_id = p_request_id
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'id', v_existing_event.order_id,
      'status', v_existing_event.to_status,
      'version', v_existing_event.order_version,
      'request_id', v_existing_event.request_id,
      'replayed', true
    );
  end if;

  v_next_normalized := lower(trim(coalesce(p_next_status, '')));
  v_next_normalized := replace(replace(v_next_normalized, '_', ' '), '-', ' ');
  v_next_normalized := regexp_replace(v_next_normalized, '\s+', ' ', 'g');

  if v_next_normalized = 'delivered' then
    v_next_normalized := 'picked up';
  elsif v_next_normalized = 'ready for pickup' then
    v_next_normalized := 'ready';
  end if;

  if v_next_normalized not in ('new', 'in prep', 'ready', 'picked up', 'cancelled') then
    return jsonb_build_object('success', false, 'error', 'invalid_status');
  end if;

  select status, version
  into v_current_status, v_version
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  v_current_normalized := lower(trim(coalesce(v_current_status, '')));
  v_current_normalized := replace(replace(v_current_normalized, '_', ' '), '-', ' ');
  v_current_normalized := regexp_replace(v_current_normalized, '\s+', ' ', 'g');

  if v_current_normalized = 'delivered' then
    v_current_normalized := 'picked up';
  elsif v_current_normalized = 'ready for pickup' then
    v_current_normalized := 'ready';
  end if;

  if v_current_normalized = v_next_normalized then
    return jsonb_build_object(
      'success', false,
      'error', 'conflict',
      'current_status', v_current_normalized,
      'version', v_version
    );
  end if;

  if not (
    (v_current_normalized = 'new' and v_next_normalized = 'in prep')
    or (v_current_normalized = 'in prep' and v_next_normalized = 'ready')
    or (v_current_normalized = 'ready' and v_next_normalized = 'picked up')
    or (
      v_current_normalized in ('new', 'in prep', 'ready')
      and v_next_normalized = 'cancelled'
    )
  ) then
    return jsonb_build_object(
      'success', false,
      'error', 'invalid_transition',
      'current_status', v_current_normalized,
      'requested_status', v_next_normalized,
      'version', v_version
    );
  end if;

  v_next_storage := v_next_normalized;

  update public.orders
  set
    status = v_next_storage,
    version = version + 1,
    prep_started_at = case
      when v_next_normalized = 'in prep' then coalesce(prep_started_at, v_now)
      else prep_started_at
    end,
    ready_at = case
      when v_next_normalized = 'ready' then coalesce(ready_at, v_now)
      else ready_at
    end,
    picked_up_at = case
      when v_next_normalized = 'picked up' then coalesce(picked_up_at, v_now)
      else picked_up_at
    end,
    cancelled_at = case
      when v_next_normalized = 'cancelled' then coalesce(cancelled_at, v_now)
      else cancelled_at
    end
  where id = p_order_id
  returning version into v_version;

  insert into public.order_status_events (
    order_id,
    from_status,
    to_status,
    order_version,
    changed_by,
    request_id,
    changed_at
  ) values (
    p_order_id,
    v_current_normalized,
    v_next_normalized,
    v_version,
    auth.uid(),
    p_request_id,
    v_now
  );

  return jsonb_build_object(
    'success', true,
    'id', p_order_id,
    'status', v_next_normalized,
    'version', v_version,
    'request_id', p_request_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.transition_order_status(uuid, text, uuid) from public;
grant execute on function public.transition_order_status(uuid, text, uuid) to authenticated;

create or replace function public.ops_schema_version()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select 2026073001::bigint;
$$;

revoke all on function public.ops_schema_version() from public;
grant execute on function public.ops_schema_version() to authenticated;
grant execute on function public.ops_schema_version() to service_role;

comment on function public.transition_order_status(uuid, text, uuid)
  is 'Atomically validates and records an administrative order status transition.';
comment on function public.ops_schema_version()
  is 'Returns the minimum application-compatible operations schema revision.';
