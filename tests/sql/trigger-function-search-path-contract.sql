\set ON_ERROR_STOP on

-- This contract uses synthetic tables and values only.
-- It does not connect to or inspect production Supabase data.
--
-- It reproduces the two production trigger-function definitions, applies the
-- corrective migration, and verifies that only their execution search paths
-- change.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.set_event_leads_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- Reproduce the production warning state before the corrective migration.
alter function public.set_updated_at()
  reset search_path;

alter function public.set_event_leads_updated_at()
  reset search_path;

drop table if exists public.updated_at_trigger_fixture cascade;
drop table if exists public.event_leads_trigger_fixture cascade;

create table public.updated_at_trigger_fixture (
  id integer primary key,
  payload text not null,
  updated_at timestamptz not null
);

create table public.event_leads_trigger_fixture (
  id integer primary key,
  payload text not null,
  updated_at timestamptz not null
);

create trigger updated_at_trigger_fixture_set_updated_at
before update
on public.updated_at_trigger_fixture
for each row
execute function public.set_updated_at();

create trigger event_leads_trigger_fixture_set_updated_at
before update
on public.event_leads_trigger_fixture
for each row
execute function public.set_event_leads_updated_at();

insert into public.updated_at_trigger_fixture (
  id,
  payload,
  updated_at
) values (
  1,
  'before',
  '2000-01-01 00:00:00+00'
);

insert into public.event_leads_trigger_fixture (
  id,
  payload,
  updated_at
) values (
  1,
  'before',
  '2000-01-01 00:00:00+00'
);

create temporary table trigger_function_snapshot
on commit preserve rows
as
select
  function_record.proname as function_name,
  function_record.oid as function_oid,
  function_record.prosrc as function_source,
  function_record.proowner as function_owner,
  function_record.prosecdef as security_definer,
  function_record.provolatile as volatility,
  function_record.prorettype as return_type,
  function_record.prolang as language_oid,
  function_record.proacl as function_acl
from pg_proc as function_record
join pg_namespace as schema_record
  on schema_record.oid = function_record.pronamespace
where schema_record.nspname = 'public'
  and function_record.proname in (
    'set_updated_at',
    'set_event_leads_updated_at'
  )
  and function_record.pronargs = 0;

create temporary table trigger_snapshot
on commit preserve rows
as
select
  trigger_record.tgname as trigger_name,
  trigger_record.tgfoid as function_oid,
  trigger_record.tgenabled as trigger_enabled,
  trigger_record.tgrelid as table_oid
from pg_trigger as trigger_record
where not trigger_record.tgisinternal
  and trigger_record.tgname in (
    'updated_at_trigger_fixture_set_updated_at',
    'event_leads_trigger_fixture_set_updated_at'
  );

do $$
begin
  if (
    select count(*)
    from trigger_function_snapshot
  ) <> 2 then
    raise exception 'expected exactly two trigger-function snapshots';
  end if;

  if (
    select count(*)
    from trigger_snapshot
  ) <> 2 then
    raise exception 'expected exactly two trigger snapshots';
  end if;

  if exists (
    select 1
    from pg_proc as function_record
    join pg_namespace as schema_record
      on schema_record.oid = function_record.pronamespace
    where schema_record.nspname = 'public'
      and function_record.proname in (
        'set_updated_at',
        'set_event_leads_updated_at'
      )
      and function_record.pronargs = 0
      and function_record.proconfig is not null
  ) then
    raise exception
      'baseline trigger functions must reproduce mutable search paths';
  end if;
end;
$$;

\ir ../../supabase/migrations/20260805033309_freeze_trigger_function_search_paths.sql

do $$
begin
  if exists (
    select 1
    from trigger_function_snapshot as snapshot
    join pg_proc as current_function
      on current_function.oid = snapshot.function_oid
    where current_function.prosrc
            is distinct from snapshot.function_source
       or current_function.proowner
            is distinct from snapshot.function_owner
       or current_function.prosecdef
            is distinct from snapshot.security_definer
       or current_function.provolatile
            is distinct from snapshot.volatility
       or current_function.prorettype
            is distinct from snapshot.return_type
       or current_function.prolang
            is distinct from snapshot.language_oid
       or current_function.proacl
            is distinct from snapshot.function_acl
  ) then
    raise exception
      'migration changed a trigger-function property other than search_path';
  end if;

  if exists (
    select 1
    from trigger_function_snapshot as snapshot
    left join pg_proc as current_function
      on current_function.oid = snapshot.function_oid
    where current_function.oid is null
  ) then
    raise exception
      'migration replaced or removed a trigger function';
  end if;

  if exists (
    select 1
    from pg_proc as function_record
    join pg_namespace as schema_record
      on schema_record.oid = function_record.pronamespace
    where schema_record.nspname = 'public'
      and function_record.proname in (
        'set_updated_at',
        'set_event_leads_updated_at'
      )
      and function_record.pronargs = 0
      and function_record.proconfig
            is distinct from array['search_path=pg_catalog']::text[]
  ) then
    raise exception
      'both trigger functions must have search_path=pg_catalog';
  end if;

  if (
    select count(*)
    from pg_proc as function_record
    join pg_namespace as schema_record
      on schema_record.oid = function_record.pronamespace
    where schema_record.nspname = 'public'
      and function_record.proname in (
        'set_updated_at',
        'set_event_leads_updated_at'
      )
      and function_record.pronargs = 0
  ) <> 2 then
    raise exception
      'both trigger functions must remain present';
  end if;

  if exists (
    select 1
    from trigger_snapshot as snapshot
    left join pg_trigger as current_trigger
      on current_trigger.tgname = snapshot.trigger_name
     and current_trigger.tgrelid = snapshot.table_oid
    where current_trigger.oid is null
       or current_trigger.tgfoid
            is distinct from snapshot.function_oid
       or current_trigger.tgenabled
            is distinct from snapshot.trigger_enabled
  ) then
    raise exception
      'migration changed or removed a trigger';
  end if;
end;
$$;

do $$
declare
  v_expected_updated_at timestamptz := now();
  v_standard_updated_at timestamptz;
  v_event_updated_at timestamptz;
begin
  update public.updated_at_trigger_fixture
  set payload = 'after'
  where id = 1;

  update public.event_leads_trigger_fixture
  set payload = 'after'
  where id = 1;

  select updated_at
  into v_standard_updated_at
  from public.updated_at_trigger_fixture
  where id = 1;

  select updated_at
  into v_event_updated_at
  from public.event_leads_trigger_fixture
  where id = 1;

  if v_standard_updated_at is distinct from v_expected_updated_at then
    raise exception
      'set_updated_at behavior changed: expected %, received %',
      v_expected_updated_at,
      v_standard_updated_at;
  end if;

  if v_event_updated_at is distinct from v_expected_updated_at then
    raise exception
      'set_event_leads_updated_at behavior changed: expected %, received %',
      v_expected_updated_at,
      v_event_updated_at;
  end if;
end;
$$;
