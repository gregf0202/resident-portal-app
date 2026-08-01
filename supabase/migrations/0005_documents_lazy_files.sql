-- 0005_documents_lazy_files.sql
--
-- Opening a building must never download document file bytes.
--
-- Background: `loadBuildingStore` reads every CONTENT table with
-- `select id, data`. `documents.data` holds whole files as base64 data-URLs,
-- so Curve Birtinya's 43.3 MB of scanned PDFs added ~20 s to every open of
-- that building and made it fall back to "Your buildings" on slower links.
-- See INCIDENT_2026-08-01_CURVE_LOAD.md.
--
-- This migration adds:
--   1. documents_meta  — the documents table minus the file payload, used for
--                        building load. security_invoker so the caller's RLS
--                        on `documents` still decides what they can see.
--   2. a BEFORE UPDATE trigger that re-attaches fileData when an update omits
--      it, so a metadata-only client can never blank a stored file.
--
-- Safe to re-run.

-- 1 ---------------------------------------------------------------- metadata view
create or replace view public.documents_meta
with (security_invoker = true) as
select
  id,
  building_id,
  created_at,
  (data - 'fileData') as data
from public.documents;

comment on view public.documents_meta is
  'documents without the base64 fileData payload. Used by loadBuildingStore so '
  'opening a building never downloads file bytes. security_invoker = true, so '
  'row visibility is governed by the RLS policies on public.documents.';

grant select on public.documents_meta to anon, authenticated;

-- 2 ------------------------------------------------------- preserve file payloads
-- The app diff-syncs whole records: persistChange() upserts `data` as the
-- entire in-memory object. Because the client now loads documents WITHOUT
-- fileData, an ordinary edit (e.g. "Release") would otherwise write the row
-- back with the file missing. This trigger makes that impossible.
create or replace function public.documents_preserve_file()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (new.data ? 'fileData') and (old.data ? 'fileData') then
    new.data = new.data || jsonb_build_object('fileData', old.data -> 'fileData');
  end if;
  return new;
end;
$$;

comment on function public.documents_preserve_file() is
  'Re-attaches documents.data->fileData when an UPDATE omits it, so a '
  'metadata-only client cannot destroy a stored file. See migration 0005.';

drop trigger if exists documents_preserve_file on public.documents;

create trigger documents_preserve_file
  before update on public.documents
  for each row
  execute function public.documents_preserve_file();
