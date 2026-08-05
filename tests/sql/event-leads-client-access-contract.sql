\set ON_ERROR_STOP on

-- This contract runs after the existing lifecycle, backup-table, trigger-
-- function, and admin-helper contracts in the same disposable PostgreSQL 17
-- database. It uses synthetic structures and rows only and never connects to
-- production data.
--
-- It reproduces the audited production event_leads shape and ACL boundary,
-- applies the corrective migration, and verifies that only the intended client
-- ACL and explicit deny policy change.

do $$
begin
  if not exists (
    select 1
    from pg_roles
    where rolname = 'anon'
  ) then
    create role anon nologin;
  end if;

  if not exists (
    select 1
    from pg_roles
    where rolname = 'authenticated'
  ) then
    create role authenticated nologin;
  end if;

  if not exists (
    select 1
    from pg_roles
    where rolname = 'service_role'
  ) then
    create role service_role nologin bypassrls;
  else
    alter role service_role bypassrls;
  end if;

  if to_regclass('public.event_leads') is not null then
    raise exception
      'event_leads must not pre-exist in the synthetic contract database';
  end if;

  if to_regprocedure('public.set_event_leads_updated_at()') is null then
    raise exception
      'set_event_leads_updated_at must be created by the prior trigger contract';
  end if;

  if to_regclass('public.orders_test_cleanup_backup') is null
     or to_regclass('public.order_items_test_cleanup_backup') is null then
    raise exception
      'both synthetic backup tables must exist before this contract runs';
  end if;
end;
$$;

create table public.event_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_name text not null
    constraint event_leads_first_name_check
    check (
      char_length(first_name) >= 2
      and char_length(first_name) <= 80
    ),
  email text not null
    constraint event_leads_email_check
    check (char_length(email) <= 254),
  normalized_email text
    generated always as (lower(trim(both from email))) stored,
  phone text,
  interest text not null default 'fitness'
    constraint event_leads_interest_check
    check (
      interest = any (
        array[
          'personal'::text,
          'family'::text,
          'fitness'::text,
          'office'::text
        ]
      )
    ),
  email_consent boolean not null default false,
  consent_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_token text not null
    default encode(gen_random_bytes(24), 'hex')
    constraint event_leads_unsubscribe_token_unique unique,
  source text not null,
  medium text,
  campaign text not null,
  content text,
  referrer text,
  intake_request_id uuid,
  welcome_email_status text not null default 'pending'
    constraint event_leads_welcome_email_status_check
    check (
      welcome_email_status = any (
        array[
          'pending'::text,
          'queued'::text,
          'sent'::text,
          'skipped'::text,
          'failed'::text
        ]
      )
    ),
  welcome_email_attempted_at timestamptz,
  first_order_at timestamptz,
  customer_id text,
  constraint event_leads_identity_unique
    unique (normalized_email, source, campaign)
);

create index event_leads_source_campaign_created_idx
  on public.event_leads (source, campaign, created_at desc);

create trigger event_leads_set_updated_at
before update
on public.event_leads
for each row
execute function public.set_event_leads_updated_at();

alter table public.event_leads enable row level security;

grant all privileges
  on table public.event_leads
  to anon, authenticated, service_role;

insert into public.event_leads (
  id,
  created_at,
  updated_at,
  last_seen_at,
  first_name,
  email,
  phone,
  interest,
  email_consent,
  consent_at,
  unsubscribe_token,
  source,
  medium,
  campaign,
  content,
  referrer,
  intake_request_id,
  welcome_email_status,
  customer_id
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '2026-07-22 01:14:13+00',
    '2026-07-22 01:14:13+00',
    '2026-07-22 01:14:13+00',
    'Amina',
    'amina@example.test',
    '+17035550101',
    'family',
    true,
    '2026-07-22 01:14:13+00',
    '000000000000000000000000000000000000000000000001',
    'landing-page',
    'organic',
    'summer-launch',
    'hero-form',
    'https://example.test/home',
    '20000000-0000-4000-8000-000000000001',
    'sent',
    'synthetic-customer-1'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '2026-07-22 05:30:00+00',
    '2026-07-22 05:30:00+00',
    '2026-07-22 05:30:00+00',
    'Bilal',
    'bilal@example.test',
    null,
    'fitness',
    false,
    '2026-07-22 05:30:00+00',
    '000000000000000000000000000000000000000000000002',
    'landing-page',
    'paid-social',
    'summer-launch',
    'mobile-form',
    null,
    '20000000-0000-4000-8000-000000000002',
    'pending',
    null
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '2026-07-22 12:00:00+00',
    '2026-07-22 12:00:00+00',
    '2026-07-22 12:00:00+00',
    'Hamza',
    'hamza@example.test',
    '+17035550103',
    'office',
    true,
    '2026-07-22 12:00:00+00',
    '000000000000000000000000000000000000000000000003',
    'event',
    'qr-code',
    'summer-launch',
    null,
    'https://example.test/event',
    '20000000-0000-4000-8000-000000000003',
    'queued',
    null
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '2026-07-23 08:15:00+00',
    '2026-07-23 08:15:00+00',
    '2026-07-23 08:15:00+00',
    'Nadia',
    'nadia@example.test',
    null,
    'personal',
    true,
    '2026-07-23 08:15:00+00',
    '000000000000000000000000000000000000000000000004',
    'referral',
    null,
    'summer-launch',
    'friend-referral',
    null,
    '20000000-0000-4000-8000-000000000004',
    'skipped',
    'synthetic-customer-4'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '2026-07-23 12:40:43+00',
    '2026-07-23 12:40:43+00',
    '2026-07-23 12:40:43+00',
    'Omar',
    'omar@example.test',
    '+17035550105',
    'fitness',
    false,
    '2026-07-23 12:40:43+00',
    '000000000000000000000000000000000000000000000005',
    'landing-page',
    'email',
    'summer-launch',
    'footer-form',
    'https://example.test/menu',
    '20000000-0000-4000-8000-000000000005',
    'failed',
    null
  );

create temporary table event_leads_contract_snapshot (
  structure_signature jsonb not null,
  row_signature jsonb not null,
  backup_signature jsonb not null
) on commit preserve rows;

create or replace function pg_temp.event_leads_structure_signature()
returns jsonb
language sql
stable
as $function$
  select jsonb_build_object(
    'table', (
      select jsonb_build_object(
        'oid', table_record.oid,
        'owner', table_record.relowner,
        'rls_enabled', table_record.relrowsecurity,
        'rls_forced', table_record.relforcerowsecurity
      )
      from pg_class as table_record
      where table_record.oid = 'public.event_leads'::regclass
    ),
    'columns', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'ordinal', column_record.attnum,
            'name', column_record.attname,
            'type_oid', column_record.atttypid,
            'type_modifier', column_record.atttypmod,
            'not_null', column_record.attnotnull,
            'identity', column_record.attidentity,
            'generated', column_record.attgenerated,
            'collation_oid', column_record.attcollation,
            'default', pg_get_expr(
              default_record.adbin,
              default_record.adrelid
            )
          )
          order by column_record.attnum
        ),
        '[]'::jsonb
      )
      from pg_attribute as column_record
      left join pg_attrdef as default_record
        on default_record.adrelid = column_record.attrelid
       and default_record.adnum = column_record.attnum
      where column_record.attrelid = 'public.event_leads'::regclass
        and column_record.attnum > 0
        and not column_record.attisdropped
    ),
    'indexes', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'oid', index_record.indexrelid,
            'name', index_class.relname,
            'unique', index_record.indisunique,
            'primary', index_record.indisprimary,
            'valid', index_record.indisvalid,
            'definition', pg_get_indexdef(index_record.indexrelid)
          )
          order by index_class.relname
        ),
        '[]'::jsonb
      )
      from pg_index as index_record
      join pg_class as index_class
        on index_class.oid = index_record.indexrelid
      where index_record.indrelid = 'public.event_leads'::regclass
    ),
    'constraints', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'oid', constraint_record.oid,
            'name', constraint_record.conname,
            'type', constraint_record.contype,
            'deferrable', constraint_record.condeferrable,
            'initially_deferred', constraint_record.condeferred,
            'validated', constraint_record.convalidated,
            'definition', pg_get_constraintdef(
              constraint_record.oid,
              true
            )
          )
          order by constraint_record.conname
        ),
        '[]'::jsonb
      )
      from pg_constraint as constraint_record
      where constraint_record.conrelid = 'public.event_leads'::regclass
    ),
    'triggers', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'oid', trigger_record.oid,
            'name', trigger_record.tgname,
            'function_oid', trigger_record.tgfoid,
            'enabled', trigger_record.tgenabled,
            'definition', pg_get_triggerdef(trigger_record.oid, true)
          )
          order by trigger_record.tgname
        ),
        '[]'::jsonb
      )
      from pg_trigger as trigger_record
      where trigger_record.tgrelid = 'public.event_leads'::regclass
        and not trigger_record.tgisinternal
    )
  );
$function$;

create or replace function pg_temp.event_leads_row_signature()
returns jsonb
language sql
stable
as $function$
  select coalesce(
    jsonb_agg(to_jsonb(event_record) order by event_record.id),
    '[]'::jsonb
  )
  from public.event_leads as event_record;
$function$;

create or replace function pg_temp.backup_state_signature()
returns jsonb
language sql
stable
as $function$
  select jsonb_build_object(
    'tables', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'oid', table_record.oid,
            'name', table_record.relname,
            'owner', table_record.relowner,
            'acl', to_jsonb(table_record.relacl),
            'rls_enabled', table_record.relrowsecurity,
            'rls_forced', table_record.relforcerowsecurity
          )
          order by table_record.relname
        ),
        '[]'::jsonb
      )
      from pg_class as table_record
      join pg_namespace as schema_record
        on schema_record.oid = table_record.relnamespace
      where schema_record.nspname = 'public'
        and table_record.relname in (
          'orders_test_cleanup_backup',
          'order_items_test_cleanup_backup'
        )
    ),
    'columns', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'table', table_record.relname,
            'ordinal', column_record.attnum,
            'name', column_record.attname,
            'type_oid', column_record.atttypid,
            'type_modifier', column_record.atttypmod,
            'not_null', column_record.attnotnull,
            'default', pg_get_expr(
              default_record.adbin,
              default_record.adrelid
            )
          )
          order by table_record.relname, column_record.attnum
        ),
        '[]'::jsonb
      )
      from pg_attribute as column_record
      join pg_class as table_record
        on table_record.oid = column_record.attrelid
      join pg_namespace as schema_record
        on schema_record.oid = table_record.relnamespace
      left join pg_attrdef as default_record
        on default_record.adrelid = column_record.attrelid
       and default_record.adnum = column_record.attnum
      where schema_record.nspname = 'public'
        and table_record.relname in (
          'orders_test_cleanup_backup',
          'order_items_test_cleanup_backup'
        )
        and column_record.attnum > 0
        and not column_record.attisdropped
    ),
    'indexes', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'table', table_record.relname,
            'oid', index_record.indexrelid,
            'name', index_class.relname,
            'definition', pg_get_indexdef(index_record.indexrelid)
          )
          order by table_record.relname, index_class.relname
        ),
        '[]'::jsonb
      )
      from pg_index as index_record
      join pg_class as table_record
        on table_record.oid = index_record.indrelid
      join pg_namespace as schema_record
        on schema_record.oid = table_record.relnamespace
      join pg_class as index_class
        on index_class.oid = index_record.indexrelid
      where schema_record.nspname = 'public'
        and table_record.relname in (
          'orders_test_cleanup_backup',
          'order_items_test_cleanup_backup'
        )
    ),
    'constraints', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'table', table_record.relname,
            'oid', constraint_record.oid,
            'name', constraint_record.conname,
            'definition', pg_get_constraintdef(
              constraint_record.oid,
              true
            )
          )
          order by table_record.relname, constraint_record.conname
        ),
        '[]'::jsonb
      )
      from pg_constraint as constraint_record
      join pg_class as table_record
        on table_record.oid = constraint_record.conrelid
      join pg_namespace as schema_record
        on schema_record.oid = table_record.relnamespace
      where schema_record.nspname = 'public'
        and table_record.relname in (
          'orders_test_cleanup_backup',
          'order_items_test_cleanup_backup'
        )
    ),
    'triggers', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'table', table_record.relname,
            'oid', trigger_record.oid,
            'name', trigger_record.tgname,
            'function_oid', trigger_record.tgfoid,
            'enabled', trigger_record.tgenabled,
            'definition', pg_get_triggerdef(trigger_record.oid, true)
          )
          order by table_record.relname, trigger_record.tgname
        ),
        '[]'::jsonb
      )
      from pg_trigger as trigger_record
      join pg_class as table_record
        on table_record.oid = trigger_record.tgrelid
      join pg_namespace as schema_record
        on schema_record.oid = table_record.relnamespace
      where schema_record.nspname = 'public'
        and table_record.relname in (
          'orders_test_cleanup_backup',
          'order_items_test_cleanup_backup'
        )
        and not trigger_record.tgisinternal
    ),
    'policies', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'table', table_record.relname,
            'oid', policy_record.oid,
            'name', policy_record.polname,
            'command', policy_record.polcmd,
            'permissive', policy_record.polpermissive,
            'roles', to_jsonb(policy_record.polroles),
            'using', pg_get_expr(
              policy_record.polqual,
              policy_record.polrelid
            ),
            'with_check', pg_get_expr(
              policy_record.polwithcheck,
              policy_record.polrelid
            )
          )
          order by table_record.relname, policy_record.polname
        ),
        '[]'::jsonb
      )
      from pg_policy as policy_record
      join pg_class as table_record
        on table_record.oid = policy_record.polrelid
      join pg_namespace as schema_record
        on schema_record.oid = table_record.relnamespace
      where schema_record.nspname = 'public'
        and table_record.relname in (
          'orders_test_cleanup_backup',
          'order_items_test_cleanup_backup'
        )
    ),
    'rows', (
      select coalesce(
        jsonb_agg(to_jsonb(backup_row) order by backup_row.table_name, backup_row.id),
        '[]'::jsonb
      )
      from (
        select
          'orders_test_cleanup_backup'::text as table_name,
          id,
          synthetic_marker
        from public.orders_test_cleanup_backup
        union all
        select
          'order_items_test_cleanup_backup'::text as table_name,
          id,
          synthetic_marker
        from public.order_items_test_cleanup_backup
      ) as backup_row
    )
  );
$function$;

insert into event_leads_contract_snapshot (
  structure_signature,
  row_signature,
  backup_signature
) values (
  pg_temp.event_leads_structure_signature(),
  pg_temp.event_leads_row_signature(),
  pg_temp.backup_state_signature()
);

do $$
declare
  v_privilege text;
begin
  if (
    select jsonb_array_length(structure_signature -> 'columns')
    from event_leads_contract_snapshot
  ) <> 23 then
    raise exception 'expected exactly 23 event_leads columns';
  end if;

  if (
    select jsonb_array_length(structure_signature -> 'indexes')
    from event_leads_contract_snapshot
  ) <> 4 then
    raise exception 'expected exactly four event_leads indexes';
  end if;

  if (
    select jsonb_array_length(structure_signature -> 'constraints')
    from event_leads_contract_snapshot
  ) <> 7 then
    raise exception 'expected exactly seven event_leads constraints';
  end if;

  if (
    select jsonb_array_length(structure_signature -> 'triggers')
    from event_leads_contract_snapshot
  ) <> 1 then
    raise exception 'expected exactly one event_leads trigger';
  end if;

  if (
    select jsonb_array_length(row_signature)
    from event_leads_contract_snapshot
  ) <> 5 then
    raise exception 'expected exactly five synthetic event-lead rows';
  end if;

  if exists (
    select 1
    from pg_policy
    where polrelid = 'public.event_leads'::regclass
  ) then
    raise exception 'baseline event_leads must have no policies';
  end if;

  if not exists (
    select 1
    from pg_class as table_record
    where table_record.oid = 'public.event_leads'::regclass
      and pg_get_userbyid(table_record.relowner) = 'postgres'
      and table_record.relrowsecurity
      and not table_record.relforcerowsecurity
  ) then
    raise exception
      'baseline event_leads ownership or RLS flags are invalid';
  end if;

  foreach v_privilege in array array[
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER',
    'MAINTAIN'
  ]
  loop
    if not has_table_privilege(
      'anon',
      'public.event_leads',
      v_privilege
    ) then
      raise exception
        'baseline anon % privilege was not reproduced',
        v_privilege;
    end if;

    if not has_table_privilege(
      'authenticated',
      'public.event_leads',
      v_privilege
    ) then
      raise exception
        'baseline authenticated % privilege was not reproduced',
        v_privilege;
    end if;

    if not has_table_privilege(
      'service_role',
      'public.event_leads',
      v_privilege
    ) then
      raise exception
        'baseline service_role % privilege was not reproduced',
        v_privilege;
    end if;
  end loop;
end;
$$;

\ir ../../supabase/migrations/20260805181451_lock_down_event_leads_client_access.sql

do $$
declare
  v_privilege text;
  v_anon_oid oid;
  v_authenticated_oid oid;
begin
  select oid
  into v_anon_oid
  from pg_roles
  where rolname = 'anon';

  select oid
  into v_authenticated_oid
  from pg_roles
  where rolname = 'authenticated';

  if pg_temp.event_leads_structure_signature() is distinct from (
    select structure_signature
    from event_leads_contract_snapshot
  ) then
    raise exception
      'migration changed event_leads identity, owner, RLS flags, schema objects, or trigger';
  end if;

  if pg_temp.event_leads_row_signature() is distinct from (
    select row_signature
    from event_leads_contract_snapshot
  ) then
    raise exception 'migration changed event_leads rows';
  end if;

  if (
    select count(*)
    from pg_policy
    where polrelid = 'public.event_leads'::regclass
  ) <> 1 then
    raise exception 'event_leads must have exactly one policy';
  end if;

  if not exists (
    select 1
    from pg_policy as policy_record
    where policy_record.polrelid = 'public.event_leads'::regclass
      and policy_record.polname = 'event_leads_client_deny_all'
      and not policy_record.polpermissive
      and policy_record.polcmd = '*'
      and cardinality(policy_record.polroles) = 2
      and policy_record.polroles @> array[
        v_anon_oid,
        v_authenticated_oid
      ]::oid[]
      and policy_record.polroles <@ array[
        v_anon_oid,
        v_authenticated_oid
      ]::oid[]
      and regexp_replace(
        pg_get_expr(
          policy_record.polqual,
          policy_record.polrelid
        ),
        '[()[:space:]]',
        '',
        'g'
      ) in ('false', 'false::boolean')
      and regexp_replace(
        pg_get_expr(
          policy_record.polwithcheck,
          policy_record.polrelid
        ),
        '[()[:space:]]',
        '',
        'g'
      ) in ('false', 'false::boolean')
  ) then
    raise exception
      'restrictive deny-all policy is missing or has the wrong scope';
  end if;

  foreach v_privilege in array array[
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER',
    'MAINTAIN'
  ]
  loop
    if has_table_privilege(
      'anon',
      'public.event_leads',
      v_privilege
    ) then
      raise exception
        'anon retained % on event_leads',
        v_privilege;
    end if;

    if has_table_privilege(
      'authenticated',
      'public.event_leads',
      v_privilege
    ) then
      raise exception
        'authenticated retained % on event_leads',
        v_privilege;
    end if;

    if not has_table_privilege(
      'service_role',
      'public.event_leads',
      v_privilege
    ) then
      raise exception
        'service_role lost % on event_leads',
        v_privilege;
    end if;
  end loop;
end;
$$;

set role anon;

do $$
begin
  begin
    perform count(*)
    from public.event_leads;

    raise exception 'anon unexpectedly read event_leads';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.event_leads (
      first_name,
      email,
      source,
      campaign
    ) values (
      'Anon',
      'anon@example.test',
      'contract',
      'deny-test'
    );

    raise exception 'anon unexpectedly inserted event_leads';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.event_leads
    set first_name = 'Anon Update'
    where id = '10000000-0000-4000-8000-000000000001';

    raise exception 'anon unexpectedly updated event_leads';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    delete from public.event_leads
    where id = '10000000-0000-4000-8000-000000000001';

    raise exception 'anon unexpectedly deleted event_leads';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

set role authenticated;

do $$
begin
  begin
    perform count(*)
    from public.event_leads;

    raise exception 'authenticated unexpectedly read event_leads';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    insert into public.event_leads (
      first_name,
      email,
      source,
      campaign
    ) values (
      'Authenticated',
      'authenticated@example.test',
      'contract',
      'deny-test'
    );

    raise exception 'authenticated unexpectedly inserted event_leads';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    update public.event_leads
    set first_name = 'Authenticated Update'
    where id = '10000000-0000-4000-8000-000000000001';

    raise exception 'authenticated unexpectedly updated event_leads';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    delete from public.event_leads
    where id = '10000000-0000-4000-8000-000000000001';

    raise exception 'authenticated unexpectedly deleted event_leads';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;

set role service_role;

do $$
declare
  v_count integer;
  v_updated_name text;
  v_updated_at timestamptz;
begin
  select count(*)
  into v_count
  from public.event_leads;

  if v_count <> 5 then
    raise exception
      'service_role expected five preserved rows, received %',
      v_count;
  end if;

  insert into public.event_leads (
    id,
    created_at,
    updated_at,
    last_seen_at,
    first_name,
    email,
    source,
    campaign,
    unsubscribe_token
  ) values (
    '10000000-0000-4000-8000-000000000099',
    '2000-01-01 00:00:00+00',
    '2000-01-01 00:00:00+00',
    '2000-01-01 00:00:00+00',
    'Service',
    'service-role@example.test',
    'contract',
    'service-role-test',
    '000000000000000000000000000000000000000000000099'
  );

  update public.event_leads
  set first_name = 'Service Updated'
  where id = '10000000-0000-4000-8000-000000000099';

  select first_name, updated_at
  into v_updated_name, v_updated_at
  from public.event_leads
  where id = '10000000-0000-4000-8000-000000000099';

  if v_updated_name <> 'Service Updated'
     or v_updated_at <= '2000-01-01 00:00:00+00'::timestamptz then
    raise exception
      'service_role update or event_leads trigger failed';
  end if;

  delete from public.event_leads
  where id = '10000000-0000-4000-8000-000000000099';

  if not found then
    raise exception 'service_role could not delete its synthetic row';
  end if;
end;
$$;

reset role;

do $$
begin
  if pg_temp.event_leads_row_signature() is distinct from (
    select row_signature
    from event_leads_contract_snapshot
  ) then
    raise exception
      'service_role validation did not restore the event-lead fixture';
  end if;

  if pg_temp.backup_state_signature() is distinct from (
    select backup_signature
    from event_leads_contract_snapshot
  ) then
    raise exception
      'migration changed a backup table, ACL, RLS flag, policy, schema object, or row';
  end if;
end;
$$;
