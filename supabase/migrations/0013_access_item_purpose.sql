-- Key & Fob Register: what a device is FOR, separate from what it IS.
-- item_type stays the device class (key / fob / remote / swipe_card /
-- digital_card / other). purpose is the new axis, so a master fob is still a
-- fob and can be filtered as one. Existing rows are unit-allocated devices,
-- which is exactly what 'resident' means, so the default backfills them
-- correctly and the committee can re-tag any master/service sets afterwards.
alter table public.unit_access_items
  add column if not exists purpose text not null default 'resident';

alter table public.unit_access_items
  drop constraint if exists unit_access_items_purpose_check;

alter table public.unit_access_items
  add constraint unit_access_items_purpose_check
  check (purpose = any (array['resident'::text, 'master'::text, 'service'::text, 'other'::text]));

comment on column public.unit_access_items.purpose is
  'What the device is for: resident (allocated to a lot), master (opens multiple areas), service (contractor/trade access), other. Independent of item_type, which is what the device physically is.';

-- The register lists a whole building at once and filters on these three.
create index if not exists unit_access_items_building_purpose_idx
  on public.unit_access_items (building_id, purpose);

create index if not exists unit_access_items_building_identifier_idx
  on public.unit_access_items (building_id, identifier);
