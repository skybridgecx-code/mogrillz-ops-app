-- Menu image storage metadata.
-- Run this in the Supabase SQL editor. Safe to run more than once.

alter table menu_items add column if not exists image_path text;
alter table menu_items add column if not exists image_bucket text;

comment on column menu_items.image_path is 'Supabase Storage object path for the current menu item image';
comment on column menu_items.image_bucket is 'Supabase Storage bucket that contains the current menu item image';
