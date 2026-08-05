\set ON_ERROR_STOP on

-- This contract uses the synthetic schema and rows created by the existing
-- lifecycle contract. It does not connect to or inspect production data.
--
-- It verifies that moving the SECURITY DEFINER authorization helper:
--   * preserves its OID, body, settings, and dependent RLS policies;
--   * removes public and anonymous execution;
--   * retains only the access needed for authenticated RLS evaluation;
--   * preserves admin and non-admin RLS behavior.

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
    create role service_role nologin;
  end if;
end;
$$;

-- Reproduce the production execution grants before applying the migration.
grant execute
  on function public.is_admin_user()
  to public, anon, authenticated, service_role;

create temporary table admin_helper_function_snapshot
on commit preserve rows
as
select
  function_record.oid as function_oid,
  function_record.proname as function_name,
  function_record.prosrc as function_source,
  function_record.proowner as function_owner,
  function_record.prosecdef as security_definer,
  function_record.provolatile as volatility,
  function_record.prorettype as return_type,
  function_record.prolang as language_oid,
  function_record.proconfig as configuration
from pg_proc as function_record
join pg_namespace as schema_record
  on schema_record.oid = function_record.pronamespace
where schema_record.nspname = 'public'
  and function_record.proname = 'is_admin_user'
  and function_record.pronargs = 0;

create temporary table admin_helper_policy_snapshot
on commit preserve rows
as
select
  policy_record.oid as policy_oid,
  policy_record.polrelid as table_oid,
  policy_record.polname as policy_name,
  policy_record.polcmd as command,
  policy_record.polpermissive as permissive,
  policy_record.polroles as roles,
  policy_record.polqual::text as using_expression_tree,
  policy_record.polwithcheck::text as with_check_expression_tree
from pg_policy as policy_record
where exists (
  select 1
  from pg_depend as dependency_record
  join admin_helper_function_snapshot as function_snapshot
    on function_snapshot.function_oid = dependency_record.refobjid
  where dependency_record.classid = 'pg_policy'::regclass
    and dependency_record.objid = policy_record.oid
);

do $$
begin
  if (
    select count(*)
    from admin_helper_function_snapshot
  ) <> 1 then
    raise exception
      'expected exactly one public.is_admin_user function snapshot';
  end if;

  if (
    select count(*)
    from admin_helper_policy_snapshot
  ) <> 38 then
    raise exception
      'expected exactly 38 dependent policy snapshots';
  end if;

  if to_regprocedure('private.is_admin_user()') is not null then
    raise exception
      'private.is_admin_user must not exist before the migration';
  end if;

  if not has_function_privilege(
    'anon',
    'public.is_admin_user()',
    'EXECUTE'
  ) then
    raise exception
      'baseline anon execution grant was not reproduced';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.is_admin_user()',
    'EXECUTE'
  ) then
    raise exception
      'baseline authenticated execution grant was not reproduced';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.is_admin_user()',
    'EXECUTE'
  ) then
    raise exception
      'baseline service_role execution grant was not reproduced';
  end if;
end;
$$;

insert into public.insights (
  id,
  type,
  title,
  summary,
  confidence,
  source
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'contract',
  'Admin authorization helper contract',
  'Synthetic admin-only RLS fixture',
  100,
  'contract'
);

set role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  false
);

do $$
declare
  v_count integer;
begin
  if public.is_admin_user() is not true then
    raise exception
      'baseline helper must return true for the synthetic admin';
  end if;

  select count(*)
  into v_count
  from public.insights
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  if v_count <> 1 then
    raise exception
      'baseline admin RLS behavior failed: expected 1 insight, received %',
      v_count;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  false
);

do $$
declare
  v_count integer;
begin
  if public.is_admin_user() is not false then
    raise exception
      'baseline helper must return false for the synthetic non-admin';
  end if;

  select count(*)
  into v_count
  from public.insights
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  if v_count <> 0 then
    raise exception
      'baseline non-admin RLS behavior failed: expected 0 insights, received %',
      v_count;
  end if;
end;
$$;

reset role;

\ir ../../supabase/migrations/20260805104953_internalize_admin_authorization_helper.sql

do $$
begin
  if to_regprocedure('public.is_admin_user()') is not null then
    raise exception
      'public.is_admin_user must no longer exist after the migration';
  end if;

  if to_regprocedure('private.is_admin_user()') is null then
    raise exception
      'private.is_admin_user must exist after the migration';
  end if;

  if exists (
    select 1
    from admin_helper_function_snapshot as snapshot
    left join pg_proc as current_function
      on current_function.oid = snapshot.function_oid
    join pg_namespace as current_namespace
      on current_namespace.oid = current_function.pronamespace
    where current_function.oid is null
       or current_namespace.nspname <> 'private'
       or current_function.proname
            is distinct from snapshot.function_name
       or current_function.prosrc
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
       or current_function.proconfig
            is distinct from snapshot.configuration
  ) then
    raise exception
      'migration changed the helper identity or a non-ACL property';
  end if;

  if exists (
    select 1
    from admin_helper_policy_snapshot as snapshot
    left join pg_policy as current_policy
      on current_policy.oid = snapshot.policy_oid
    where current_policy.oid is null
       or current_policy.polrelid
            is distinct from snapshot.table_oid
       or current_policy.polname
            is distinct from snapshot.policy_name
       or current_policy.polcmd
            is distinct from snapshot.command
       or current_policy.polpermissive
            is distinct from snapshot.permissive
       or current_policy.polroles
            is distinct from snapshot.roles
       or current_policy.polqual::text
            is distinct from snapshot.using_expression_tree
       or current_policy.polwithcheck::text
            is distinct from snapshot.with_check_expression_tree
  ) then
    raise exception
      'migration changed or removed a dependent RLS policy';
  end if;

  if (
    select count(*)
    from pg_policy as policy_record
    where exists (
      select 1
      from pg_depend as dependency_record
      join admin_helper_function_snapshot as function_snapshot
        on function_snapshot.function_oid = dependency_record.refobjid
      where dependency_record.classid = 'pg_policy'::regclass
        and dependency_record.objid = policy_record.oid
    )
  ) <> 38 then
    raise exception
      'all 38 RLS policies must remain bound to the same function OID';
  end if;

  if has_schema_privilege(
    'anon',
    'private',
    'USAGE'
  ) then
    raise exception
      'anon must not have USAGE on private';
  end if;

  if has_function_privilege(
    'anon',
    'private.is_admin_user()',
    'EXECUTE'
  ) then
    raise exception
      'anon must not execute private.is_admin_user';
  end if;

  if not has_schema_privilege(
    'authenticated',
    'private',
    'USAGE'
  ) then
    raise exception
      'authenticated must retain USAGE on private for RLS evaluation';
  end if;

  if has_schema_privilege(
    'authenticated',
    'private',
    'CREATE'
  ) then
    raise exception
      'authenticated must not have CREATE on private';
  end if;

  if not has_function_privilege(
    'authenticated',
    'private.is_admin_user()',
    'EXECUTE'
  ) then
    raise exception
      'authenticated must retain helper execution for RLS evaluation';
  end if;

  if not has_schema_privilege(
    'service_role',
    'private',
    'USAGE'
  ) then
    raise exception
      'service_role must retain USAGE on private';
  end if;

  if has_schema_privilege(
    'service_role',
    'private',
    'CREATE'
  ) then
    raise exception
      'service_role must not have CREATE on private';
  end if;

  if not has_function_privilege(
    'service_role',
    'private.is_admin_user()',
    'EXECUTE'
  ) then
    raise exception
      'service_role must retain helper execution';
  end if;
end;
$$;

set role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  false
);

do $$
declare
  v_count integer;
begin
  if private.is_admin_user() is not true then
    raise exception
      'post-migration helper must return true for the synthetic admin';
  end if;

  select count(*)
  into v_count
  from public.insights
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  if v_count <> 1 then
    raise exception
      'post-migration admin RLS behavior failed: expected 1 insight, received %',
      v_count;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  false
);

do $$
declare
  v_count integer;
begin
  if private.is_admin_user() is not false then
    raise exception
      'post-migration helper must return false for the synthetic non-admin';
  end if;

  select count(*)
  into v_count
  from public.insights
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  if v_count <> 0 then
    raise exception
      'post-migration non-admin RLS behavior failed: expected 0 insights, received %',
      v_count;
  end if;
end;
$$;

reset role;
