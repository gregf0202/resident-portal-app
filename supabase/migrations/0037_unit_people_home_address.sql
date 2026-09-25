-- 0037: an address for owners who live somewhere other than this building.
-- QLD roll requires each owner's residential or business address. For an owner who
-- lives here that is the unit; for everyone else the register had nowhere to put it.
-- Not a new category: an owner who lives elsewhere is still person_type 'owner'.
-- Unit Search shows them with a small Investor dot (lives_here = false, or blank on a
-- tenanted lot). Readable only through unit_people RLS (can_edit_unit_registry).
alter table public.unit_people add column if not exists home_address text;
comment on column public.unit_people.home_address is 'Residential or business address when it is not this building (QLD roll: name, residential or business address of each owner). Read and written only through unit_people RLS (can_edit_unit_registry). An owner who lives elsewhere is shown as Investor in Unit Search; the person_type stays owner.';
