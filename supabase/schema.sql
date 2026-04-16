-- MoGrillz Ops database scaffold
-- First-pass schema for the admin app. Safe to apply in a fresh Supabase project.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists admin_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  is_active boolean not null default true,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  zone text not null,
  total_orders integer not null default 0,
  lifetime_value_cents integer not null default 0,
  notes text,
  loyalty_tier text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists drop_reminders (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'website',
  signup_location text,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  notes text,
  last_requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  price_cents integer not null,
  availability text not null default 'live',
  allocation_limit integer not null default 0,
  description text not null,
  image_url text,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null,
  on_hand_qty numeric(12,2) not null default 0,
  par_level numeric(12,2) not null default 0,
  status text not null default 'healthy',
  location text,
  reorder_threshold numeric(12,2) not null default 0,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists inventory_item_menu_links (
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (inventory_item_id, menu_item_id)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null,
  customer_email text,
  status text not null default 'new',
  drop_day text,
  service_date date,
  fulfillment_method text not null default 'pickup',
  delivery_window text not null,
  zone text not null,
  total_cents integer not null default 0,
  custom_request text,
  operator_note text,
  delivery_notes text,
  payment_provider text not null default 'Stripe',
  payment_status text not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders add column if not exists operator_note text;
alter table customers add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
alter table menu_items add column if not exists image_url text;
alter table menu_items add column if not exists sort_order integer not null default 0;
alter table orders add column if not exists service_date date;
alter table orders alter column drop_day drop not null;
alter table orders alter column fulfillment_method set default 'pickup';

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,
  quantity integer not null default 1,
  unit_price_cents integer not null default 0,
  customizations jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  summary text not null,
  confidence integer not null default 0,
  action_text text,
  source text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_status_created_at on orders (status, created_at desc);
create index if not exists idx_orders_drop_day_created_at on orders (drop_day, created_at desc);
create index if not exists idx_orders_service_date_created_at on orders (service_date, created_at desc);
create index if not exists idx_orders_customer_id on orders (customer_id);
create index if not exists idx_orders_customer_email on orders (customer_email);
create index if not exists idx_order_items_order_id on order_items (order_id);
create index if not exists idx_order_items_menu_item_id on order_items (menu_item_id);
create index if not exists idx_inventory_status_name on inventory_items (status, name);
create index if not exists idx_inventory_item_menu_links_inventory_item_id on inventory_item_menu_links (inventory_item_id);
create index if not exists idx_inventory_item_menu_links_menu_item_id on inventory_item_menu_links (menu_item_id);
create index if not exists idx_drop_reminders_status_created_at on drop_reminders (status, created_at desc);
create index if not exists idx_menu_items_category_availability on menu_items (category, availability);
create index if not exists idx_menu_items_sort_order on menu_items (sort_order, updated_at desc);
create index if not exists idx_customers_zone_tier on customers (zone, loyalty_tier);
create index if not exists idx_customers_auth_user_id on customers (auth_user_id);
create index if not exists idx_insights_type_active on insights (type, is_active, created_at desc);
create index if not exists idx_admin_memberships_user_id on admin_memberships (user_id);
create index if not exists idx_admin_memberships_email on admin_memberships (email);
create index if not exists idx_admin_memberships_role_active on admin_memberships (role, is_active);

drop trigger if exists trg_admin_memberships_updated_at on admin_memberships;
create trigger trg_admin_memberships_updated_at
before update on admin_memberships
for each row execute function set_updated_at();

drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at
before update on customers
for each row execute function set_updated_at();

drop trigger if exists trg_drop_reminders_updated_at on drop_reminders;
create trigger trg_drop_reminders_updated_at
before update on drop_reminders
for each row execute function set_updated_at();

drop trigger if exists trg_menu_items_updated_at on menu_items;
create trigger trg_menu_items_updated_at
before update on menu_items
for each row execute function set_updated_at();

drop trigger if exists trg_inventory_items_updated_at on inventory_items;
create trigger trg_inventory_items_updated_at
before update on inventory_items
for each row execute function set_updated_at();

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row execute function set_updated_at();

drop trigger if exists trg_insights_updated_at on insights;
create trigger trg_insights_updated_at
before update on insights
for each row execute function set_updated_at();

create or replace function is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_memberships admin_memberships
    where admin_memberships.user_id = (select auth.uid())
      and admin_memberships.is_active = true
  );
$$;

create or replace function current_auth_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

grant usage on schema public to authenticated;
grant execute on function is_admin_user() to authenticated;
grant execute on function current_auth_email() to authenticated;
grant select, insert, update, delete on admin_memberships to authenticated;
grant select, insert, update, delete on customers to authenticated;
grant select, insert, update, delete on drop_reminders to authenticated;
grant select, insert, update, delete on menu_items to authenticated;
grant select, insert, update, delete on inventory_items to authenticated;
grant select, insert, update, delete on inventory_item_menu_links to authenticated;
grant select, insert, update, delete on orders to authenticated;
grant select, insert, update, delete on order_items to authenticated;
grant select, insert, update, delete on insights to authenticated;

alter table admin_memberships enable row level security;
alter table customers enable row level security;
alter table drop_reminders enable row level security;
alter table menu_items enable row level security;
alter table inventory_items enable row level security;
alter table inventory_item_menu_links enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table insights enable row level security;

drop policy if exists "admin_memberships_select" on admin_memberships;
create policy "admin_memberships_select"
on admin_memberships
for select
to authenticated
using (user_id = (select auth.uid()) or public.is_admin_user());

drop policy if exists "admin_memberships_insert" on admin_memberships;
create policy "admin_memberships_insert"
on admin_memberships
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "admin_memberships_update" on admin_memberships;
create policy "admin_memberships_update"
on admin_memberships
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "admin_memberships_delete" on admin_memberships;
create policy "admin_memberships_delete"
on admin_memberships
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "customers_select" on customers;
create policy "customers_select"
on customers
for select
to authenticated
using (
  public.is_admin_user()
  or auth_user_id = (select auth.uid())
  or lower(coalesce(email, '')) = public.current_auth_email()
);

drop policy if exists "customers_insert" on customers;
create policy "customers_insert"
on customers
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "customers_update" on customers;
create policy "customers_update"
on customers
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "customers_delete" on customers;
create policy "customers_delete"
on customers
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "drop_reminders_select" on drop_reminders;
create policy "drop_reminders_select"
on drop_reminders
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "drop_reminders_insert" on drop_reminders;
create policy "drop_reminders_insert"
on drop_reminders
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "drop_reminders_update" on drop_reminders;
create policy "drop_reminders_update"
on drop_reminders
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "drop_reminders_delete" on drop_reminders;
create policy "drop_reminders_delete"
on drop_reminders
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "menu_items_select" on menu_items;
create policy "menu_items_select"
on menu_items
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "menu_items_insert" on menu_items;
create policy "menu_items_insert"
on menu_items
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "menu_items_update" on menu_items;
create policy "menu_items_update"
on menu_items
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "menu_items_delete" on menu_items;
create policy "menu_items_delete"
on menu_items
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "inventory_items_select" on inventory_items;
create policy "inventory_items_select"
on inventory_items
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "inventory_items_insert" on inventory_items;
create policy "inventory_items_insert"
on inventory_items
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "inventory_items_update" on inventory_items;
create policy "inventory_items_update"
on inventory_items
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "inventory_items_delete" on inventory_items;
create policy "inventory_items_delete"
on inventory_items
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "inventory_item_menu_links_select" on inventory_item_menu_links;
create policy "inventory_item_menu_links_select"
on inventory_item_menu_links
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "inventory_item_menu_links_insert" on inventory_item_menu_links;
create policy "inventory_item_menu_links_insert"
on inventory_item_menu_links
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "inventory_item_menu_links_update" on inventory_item_menu_links;
create policy "inventory_item_menu_links_update"
on inventory_item_menu_links
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "inventory_item_menu_links_delete" on inventory_item_menu_links;
create policy "inventory_item_menu_links_delete"
on inventory_item_menu_links
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "orders_select" on orders;
create policy "orders_select"
on orders
for select
to authenticated
using (
  public.is_admin_user()
  or lower(coalesce(customer_email, '')) = public.current_auth_email()
  or customer_id in (
    select id
    from public.customers
    where auth_user_id = (select auth.uid())
  )
);

drop policy if exists "orders_insert" on orders;
create policy "orders_insert"
on orders
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "orders_update" on orders;
create policy "orders_update"
on orders
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "orders_delete" on orders;
create policy "orders_delete"
on orders
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "order_items_select" on order_items;
create policy "order_items_select"
on order_items
for select
to authenticated
using (
  public.is_admin_user()
  or order_id in (
    select id
    from public.orders
    where lower(coalesce(customer_email, '')) = public.current_auth_email()
       or customer_id in (
         select id
         from public.customers
         where auth_user_id = (select auth.uid())
       )
  )
);

drop policy if exists "order_items_insert" on order_items;
create policy "order_items_insert"
on order_items
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "order_items_update" on order_items;
create policy "order_items_update"
on order_items
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "order_items_delete" on order_items;
create policy "order_items_delete"
on order_items
for delete
to authenticated
using (public.is_admin_user());

drop policy if exists "insights_select" on insights;
create policy "insights_select"
on insights
for select
to authenticated
using (public.is_admin_user());

drop policy if exists "insights_insert" on insights;
create policy "insights_insert"
on insights
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "insights_update" on insights;
create policy "insights_update"
on insights
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "insights_delete" on insights;
create policy "insights_delete"
on insights
for delete
to authenticated
using (public.is_admin_user());

-- ============================================================================
-- AUTH-TO-CUSTOMER LINKING
-- Called by mobile app after successful magic-link sign-in
-- ============================================================================

create or replace function link_auth_user_to_customer()
returns jsonb
language plpgsql
security definer
set search_path = public
as 
$$
declare
  v_user_id uuid;
  v_user_email text;
  v_customer_id uuid;
  v_updated boolean := false;
begin
  -- Get current auth user
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Get user email from JWT
  v_user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_user_email = '' then
    return jsonb_build_object('success', false, 'error', 'No email in auth token');
  end if;

  -- Check if already linked
  select id into v_customer_id
  from customers
  where auth_user_id = v_user_id
  limit 1;

  if v_customer_id is not null then
    return jsonb_build_object(
      'success', true,
      'already_linked', true,
      'customer_id', v_customer_id
    );
  end if;

  -- Find customer by email and link
  update customers
  set auth_user_id = v_user_id,
      updated_at = now()
  where lower(email) = v_user_email
    and auth_user_id is null
  returning id into v_customer_id;

  if v_customer_id is not null then
    return jsonb_build_object(
      'success', true,
      'linked', true,
      'customer_id', v_customer_id
    );
  end if;

  -- No customer record found for this email
  return jsonb_build_object(
    'success', true,
    'linked', false,
    'message', 'No customer record found for this email'
  );
end;
$$
;

grant execute on function link_auth_user_to_customer() to authenticated;
