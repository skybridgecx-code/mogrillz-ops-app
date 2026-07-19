-- Meal prep support: nutrition macros on menu items.
-- Run this in the Supabase SQL editor. Safe to run more than once.

alter table menu_items add column if not exists calories integer;
alter table menu_items add column if not exists protein_g integer;
alter table menu_items add column if not exists carbs_g integer;
alter table menu_items add column if not exists fat_g integer;

comment on column menu_items.calories is 'Optional nutrition label: kcal per serving';
comment on column menu_items.protein_g is 'Optional nutrition label: grams protein per serving';
comment on column menu_items.carbs_g is 'Optional nutrition label: grams carbs per serving';
comment on column menu_items.fat_g is 'Optional nutrition label: grams fat per serving';
