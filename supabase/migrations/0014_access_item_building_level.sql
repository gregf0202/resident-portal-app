-- Master and service devices belong to the building, not to a lot.
-- unit_id was NOT NULL, which is why the Curve Birtinya import had to skip the
-- Building Manager, Fire Warden Key Set and Emergency Access Lock Box rows:
-- there was nowhere to put a device that isn't a unit's.
--
-- Relaxing it is safe for every existing read path:
--   * unit_health_check joins units on a.unit_id (inner), so building-level
--     rows simply never appear under a unit, which is correct.
--   * RLS (access_items_committee / access_items_own) keys off building_id and
--     issued_to_user_id, never unit_id.
--   * exportBuildingData selects by building_id.
-- The Key & Fob Register renders a null unit_id as "Common property".
alter table public.unit_access_items
  alter column unit_id drop not null;

comment on column public.unit_access_items.unit_id is
  'The lot this device is allocated to, or NULL for a building-level device (master, service, lock box) that belongs to common property rather than a unit.';
