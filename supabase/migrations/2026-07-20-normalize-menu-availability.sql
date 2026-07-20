-- Normalize legacy CMS menu availability values to the ops app contract.
-- Run this in the Supabase SQL editor. Safe to run more than once.

update menu_items
set availability = case
  when lower(trim(availability)) in ('active', 'available', 'enabled', 'true') then 'live'
  when lower(trim(availability)) in ('draft', 'pending', 'watch') then 'watch'
  when lower(trim(availability)) in ('inactive', 'disabled', 'false', 'pause', 'paused') then 'paused'
  when lower(replace(trim(availability), '-', ' ')) in ('sold out', 'soldout', 'out', 'unavailable') then 'sold out'
  else 'live'
end
where availability is null
   or lower(trim(availability)) not in ('live', 'watch', 'paused', 'sold out');
