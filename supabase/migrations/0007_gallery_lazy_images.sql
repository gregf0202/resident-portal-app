-- 0007_gallery_lazy_images.sql
--
-- Same treatment as documents (migration 0005), applied to gallery photos.
--
-- gallery.data.image holds a whole photo as a base64 data-URL. A single Curve
-- Birtinya photo is 598 KB, and `loadBuildingStore` was fetching every one of
-- them on every building open, for every resident. Ten photos would have put
-- ~6 MB on the critical path of opening the building — the same failure that
-- made Curve unopenable via documents, just waiting to happen.
--
-- After this migration the building load carries captions, categories and
-- dates only; the Gallery screen fetches the images when it opens.
--
-- Safe to re-run.

-- 1 ---------------------------------------------------------------- metadata view
create or replace view public.gallery_meta
with (security_invoker = true) as
select
  id,
  building_id,
  created_at,
  (data - 'image') as data
from public.gallery;

comment on view public.gallery_meta is
  'gallery without the base64 image payload. Used by loadBuildingStore so opening '
  'a building never downloads photos. security_invoker = true, so row visibility '
  'is governed by the RLS policies on public.gallery.';

grant select on public.gallery_meta to anon, authenticated;

-- 2 ------------------------------------------------------------ preserve payloads
-- persistChange upserts whole records, and the client now holds gallery rows
-- without their image. Without this trigger, any edit to a photo's caption or
-- category would write the row back with the photo missing.
create or replace function public.gallery_preserve_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (new.data ? 'image') and (old.data ? 'image') then
    new.data = new.data || jsonb_build_object('image', old.data -> 'image');
  end if;
  return new;
end;
$$;

comment on function public.gallery_preserve_image() is
  'Re-attaches gallery.data->image when an UPDATE omits it, so a metadata-only '
  'client cannot destroy a stored photo. See migration 0007.';

drop trigger if exists gallery_preserve_image on public.gallery;

create trigger gallery_preserve_image
  before update on public.gallery
  for each row
  execute function public.gallery_preserve_image();
