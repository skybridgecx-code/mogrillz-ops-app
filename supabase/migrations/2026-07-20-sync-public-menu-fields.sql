-- Align ops menu records with the public website menu contract.
-- Run this in the Supabase SQL editor. Safe to run more than once.

alter table menu_items add column if not exists image_alt text not null default '';
alter table menu_items add column if not exists is_popular boolean not null default false;
alter table menu_items add column if not exists is_active boolean not null default false;

update menu_items
set is_active = case
  when lower(trim(coalesce(availability, ''))) = 'live' then true
  else false
end
where is_active is distinct from case
  when lower(trim(coalesce(availability, ''))) = 'live' then true
  else false
end;

update menu_items
set availability = case
  when is_active then 'live'
  when lower(trim(coalesce(availability, ''))) in ('sold out', 'soldout', 'out', 'unavailable') then 'sold out'
  when lower(trim(coalesce(availability, ''))) in ('watch', 'draft', 'pending') then 'watch'
  else 'paused'
end
where availability is null
   or lower(trim(availability)) not in ('live', 'watch', 'paused', 'sold out')
   or (is_active and lower(trim(availability)) <> 'live');
