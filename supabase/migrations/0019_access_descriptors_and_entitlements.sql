-- Applied to production 2026-09-19 (schema_migrations 20260919100838).
-- ============================================================================
-- Key & Fob Register: descriptors, entitlements, issuance and stock.
--
-- Requested by the Curve Birtinya BCC as "thirteen descriptors", but eight of
-- the thirteen differ only by which level, and two ("Building Key - Master",
-- "Building Key - Service") are the `purpose` axis added in 0013 welded back
-- into a string. Adding them as thirteen fixed values would undo 0013, make a
-- new level a schema migration, prevent asking "how many fire stairs keys are
-- out", and bake ONE building's floor plan into every building's schema.
--
-- So the descriptor list is per-building DATA. Curve's thirteen are seeded
-- verbatim below, so the committee sees its own words, while each descriptor
-- still carries the item_type/purpose classification underneath so the existing
-- filters and any cross-building reporting keep working.
-- ============================================================================

create table if not exists public.access_descriptors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  item_type text not null default 'key'
    check (item_type = any (array['key','fob','remote','swipe_card','digital_card','other'])),
  purpose text not null default 'resident'
    check (purpose = any (array['resident','master','service','other'])),
  -- Fobs and remotes are counted as stock on hand at the annual audit; keys are
  -- audited but not stock-counted. The BCC drew that distinction explicitly.
  stock_tracked boolean not null default false,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists access_descriptors_building_name_uniq
  on public.access_descriptors (building_id, lower(btrim(name)));
create index if not exists access_descriptors_building_sort_idx
  on public.access_descriptors (building_id, sort);

-- A unit's static entitlement per descriptor: how many it is ENTITLED to hold,
-- independent of how many are currently issued or sitting with the BM.
create table if not exists public.unit_access_entitlements (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  descriptor_id uuid not null references public.access_descriptors(id) on delete cascade,
  entitlement integer not null default 0 check (entitlement >= 0),
  notes text,
  updated_at timestamptz not null default now()
);

create unique index if not exists unit_access_entitlements_uniq
  on public.unit_access_entitlements (unit_id, descriptor_id);
create index if not exists unit_access_entitlements_building_idx
  on public.unit_access_entitlements (building_id);

-- ---------------------------------------------------------------------------
-- unit_access_items: what the device IS now comes from the descriptor, and an
-- issuance records who signed for it.
-- ---------------------------------------------------------------------------
alter table public.unit_access_items
  add column if not exists descriptor_id uuid references public.access_descriptors(id) on delete set null,
  -- Keys are still issued TO THE UNIT; the person is an attribute of the
  -- issuance, which is the framework the BCC asked to keep.
  add column if not exists issued_to_role text,
  add column if not exists owner_authority boolean not null default false,
  add column if not exists owner_authority_by text,
  add column if not exists receipt_path text,
  add column if not exists receipt_uploaded_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

alter table public.unit_access_items
  drop constraint if exists unit_access_items_issued_to_role_check;
alter table public.unit_access_items
  add constraint unit_access_items_issued_to_role_check
  check (issued_to_role is null or issued_to_role = any (array[
    'owner','managing_agent','tenant','building_manager','contractor','other']));

-- 'on_hand'  = counted against a unit's entitlement but physically with the BM,
--              or, when unit_id is null, unallocated building stock.
-- 'suspended'= lost or withdrawn. The BCC was explicit that these are suspended
--              and never deleted, and stay recorded against the unit or stock.
alter table public.unit_access_items
  drop constraint if exists unit_access_items_status_check;
alter table public.unit_access_items
  add constraint unit_access_items_status_check
  check (status = any (array['issued','on_hand','returned','lost','suspended','deactivated']));

create index if not exists unit_access_items_descriptor_idx
  on public.unit_access_items (building_id, descriptor_id);
create index if not exists unit_access_items_unit_status_idx
  on public.unit_access_items (unit_id, status);

comment on column public.unit_access_items.descriptor_id is
  'Which of the building''s own descriptors this device is. Null means not yet classified: the 230 rows imported from the BM register in Aug 2026 arrived as one undifferentiated "Key or fob".';
comment on column public.unit_access_items.issued_to_role is
  'Who physically signed for it. A tenant issue requires owner_authority per the BCC rule that tenants receive keys only on the owner''s authority.';

-- ---------------------------------------------------------------------------
-- RLS: same rule as the register itself (committee, or the building manager
-- when the per-building bmRegistryWrite switch is on).
-- ---------------------------------------------------------------------------
alter table public.access_descriptors enable row level security;
alter table public.unit_access_entitlements enable row level security;

drop policy if exists access_descriptors_committee on public.access_descriptors;
create policy access_descriptors_committee on public.access_descriptors
  for all using (can_edit_unit_registry(building_id))
  with check (can_edit_unit_registry(building_id));

drop policy if exists unit_access_entitlements_committee on public.unit_access_entitlements;
create policy unit_access_entitlements_committee on public.unit_access_entitlements
  for all using (can_edit_unit_registry(building_id))
  with check (can_edit_unit_registry(building_id));

-- ---------------------------------------------------------------------------
-- Seed Curve Birtinya's thirteen, exactly as the BCC wrote them.
-- ---------------------------------------------------------------------------
insert into public.access_descriptors (building_id, name, item_type, purpose, stock_tracked, sort)
select 'ecd3d712-c949-4dec-b20c-9a5d36df0eb6'::uuid, x.name, x.item_type, x.purpose, x.stock, x.sort
from (values
  ('Building Key - Master',                          'key',    'master',   false,  10),
  ('Building Key - Service',                         'key',    'service',  false,  20),
  ('Building and Fire Stairs Key - Ground Floor',    'key',    'resident', false,  30),
  ('Building and Fire Stairs Key - Level 1',         'key',    'resident', false,  40),
  ('Building and Fire Stairs Key - Level 2',         'key',    'resident', false,  50),
  ('Building and Fire Stairs Key - Level 3',         'key',    'resident', false,  60),
  ('Building and Fire Stairs Key - Level 4',         'key',    'resident', false,  70),
  ('Building and Fire Stairs Key - Level 5',         'key',    'resident', false,  80),
  ('Building and Fire Stairs Key - Level 6',         'key',    'resident', false,  90),
  ('Building and Fire Stairs Key - Level 7',         'key',    'resident', false, 100),
  ('Fob',                                            'fob',    'resident', true,  110),
  ('Remote',                                         'remote', 'resident', true,  120),
  ('Unit door metal lock key',                       'key',    'resident', false, 130)
) as x(name, item_type, purpose, stock, sort)
on conflict do nothing;
