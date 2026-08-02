\set ON_ERROR_STOP on

-- Run the full lifecycle contract first so this remains an additive ACL check.
\ir order-lifecycle-contract.sql

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end;
$$;

-- Reproduce the stale explicit production grant that the corrective migration removes.
grant execute
on function public.transition_order_status(uuid, text, uuid)
to anon;

\ir ../../supabase/migrations/2026-08-02-order-lifecycle-function-acl.sql

do $$
begin
  if has_function_privilege(
    'anon',
    'public.transition_order_status(uuid,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'anon must not be able to execute transition_order_status';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.transition_order_status(uuid,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must retain execute permission on transition_order_status';
  end if;
end;
$$;
