-- 0006_restore_parked_document_blobs.sql
--
-- RUN THIS ONLY AFTER the lazy-loading frontend (migration 0005 + the db.js /
-- ResidentPortal.jsx changes) is deployed and verified in production.
--
-- On 1 Aug 2026 the three oversized Curve Birtinya document payloads were
-- moved out of documents.data into public.document_blobs so the building
-- would open at all. Once the app stops fetching file bytes on building load,
-- the payloads can go back where they belong and the parking table retired.
--
-- Verify first:
--   select document_id, length(file_data) from public.document_blobs;
--
-- Safe to re-run.

begin;

-- Put the payloads back and clear the parking markers.
update public.documents d
set data = (d.data - 'fileParked' - 'fileBytes' - 'fileParkedAt')
        || jsonb_build_object('fileData', b.file_data)
from public.document_blobs b
where b.document_id = d.id;

-- Confirm every parked blob landed before dropping anything.
do $$
declare missing integer;
begin
  select count(*) into missing
  from public.document_blobs b
  join public.documents d on d.id = b.document_id
  where coalesce(d.data ->> 'fileData', '') <> b.file_data;

  if missing > 0 then
    raise exception 'Restore incomplete: % document(s) did not match. Rolling back.', missing;
  end if;
end;
$$;

commit;

-- Only once the above committed cleanly and the app has been re-checked:
--
--   drop table public.document_blobs;
