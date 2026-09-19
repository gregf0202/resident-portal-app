-- Applied to production 2026-09-19 (schema_migrations 20260919100940).
-- The Caretaker's annual audit, in one call.
--
-- Three scopes in one result so a single export covers the whole exercise:
--   'unit'         one row per unit x descriptor that has an entitlement or any device
--   'stock'        unallocated building stock, for the fob/remote count on hand
--   'unclassified' devices with no descriptor yet, so they are never silently
--                  excluded from the reconciliation. Curve has 230 of these.
--
-- SECURITY INVOKER: RLS on unit_access_items, access_descriptors and
-- unit_access_entitlements already says who may see this. A definer copy would
-- be a second access model free to drift from the first.
create or replace function public.access_audit(p_building uuid)
returns table (
  scope text,
  unit_id uuid,
  unit_number text,
  descriptor_id uuid,
  descriptor text,
  item_type text,
  purpose text,
  stock_tracked boolean,
  sort integer,
  entitlement integer,
  issued integer,
  on_hand integer,
  suspended integer,
  returned integer,
  held integer,
  variance integer
)
language sql
stable
set search_path to 'public'
as $function$
  with d as (
    select * from access_descriptors where building_id = p_building and active
  ),
  u as (
    select id, unit_number from units where building_id = p_building
  ),
  -- Only pairs that mean something: an entitlement was set, or a device exists.
  -- A cross join of 56 units x 13 descriptors would otherwise report 728 rows
  -- of nothing.
  pairs as (
    select u.id as unit_id, u.unit_number, d.id as descriptor_id
    from u cross join d
    where exists (
        select 1 from unit_access_entitlements e
        where e.unit_id = u.id and e.descriptor_id = d.id and e.entitlement > 0)
      or exists (
        select 1 from unit_access_items i
        where i.unit_id = u.id and i.descriptor_id = d.id)
  )
  select
    'unit'::text, p.unit_id, p.unit_number, d.id, d.name, d.item_type, d.purpose,
    d.stock_tracked, d.sort,
    coalesce(e.entitlement, 0)::integer,
    coalesce(c.issued, 0)::integer,
    coalesce(c.on_hand, 0)::integer,
    coalesce(c.suspended, 0)::integer,
    coalesce(c.returned, 0)::integer,
    (coalesce(c.issued, 0) + coalesce(c.on_hand, 0))::integer,
    (coalesce(c.issued, 0) + coalesce(c.on_hand, 0) - coalesce(e.entitlement, 0))::integer
  from pairs p
  join d on d.id = p.descriptor_id
  left join unit_access_entitlements e
    on e.unit_id = p.unit_id and e.descriptor_id = d.id
  left join lateral (
    select
      count(*) filter (where i.status = 'issued')                  as issued,
      count(*) filter (where i.status = 'on_hand')                 as on_hand,
      count(*) filter (where i.status in ('suspended','lost'))     as suspended,
      count(*) filter (where i.status = 'returned')                as returned
    from unit_access_items i
    where i.unit_id = p.unit_id and i.descriptor_id = d.id
  ) c on true

  union all

  -- Unallocated building stock: no unit, so it belongs to the building. This is
  -- what the yearly fob and remote count on hand is checked against.
  select
    'stock'::text, null::uuid, null::text, d.id, d.name, d.item_type, d.purpose,
    d.stock_tracked, d.sort,
    0,
    coalesce(c.issued, 0)::integer,
    coalesce(c.on_hand, 0)::integer,
    coalesce(c.suspended, 0)::integer,
    coalesce(c.returned, 0)::integer,
    (coalesce(c.issued, 0) + coalesce(c.on_hand, 0))::integer,
    0
  from d
  join lateral (
    select
      count(*) filter (where i.status = 'issued')                  as issued,
      count(*) filter (where i.status = 'on_hand')                 as on_hand,
      count(*) filter (where i.status in ('suspended','lost'))     as suspended,
      count(*) filter (where i.status = 'returned')                as returned
    from unit_access_items i
    where i.building_id = p_building and i.unit_id is null and i.descriptor_id = d.id
  ) c on true
  where d.stock_tracked or c.issued + c.on_hand + c.suspended + c.returned > 0

  union all

  -- Devices with no descriptor yet. Never hidden: until these are classified the
  -- entitlement reconciliation above is incomplete, and the report should say so
  -- rather than quietly leave them out.
  select
    'unclassified'::text, i.unit_id, un.unit_number, null::uuid,
    'Not yet classified'::text, i.item_type, i.purpose, false, 9999,
    0,
    count(*) filter (where i.status = 'issued')::integer,
    count(*) filter (where i.status = 'on_hand')::integer,
    count(*) filter (where i.status in ('suspended','lost'))::integer,
    count(*) filter (where i.status = 'returned')::integer,
    count(*) filter (where i.status in ('issued','on_hand'))::integer,
    0
  from unit_access_items i
  left join units un on un.id = i.unit_id
  where i.building_id = p_building and i.descriptor_id is null
  group by i.unit_id, un.unit_number, i.item_type, i.purpose

  order by 9, 3 nulls first, 5;
$function$;

revoke execute on function public.access_audit(uuid) from public, anon;
grant execute on function public.access_audit(uuid) to authenticated;

comment on function public.access_audit(uuid) is
  'Annual key audit: per unit and descriptor entitlement vs issued vs on hand vs suspended, plus unallocated stock and anything not yet classified. SECURITY INVOKER so RLS governs.';
