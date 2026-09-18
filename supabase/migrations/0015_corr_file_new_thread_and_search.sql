-- ============================================================================
-- Correspondence: close the day-one filing hole, and make the record searchable.
--
-- Filing: corr_file_unfiled(p_raw, p_thread) requires an EXISTING thread, and
-- the only way to create one was sendCorrespondence, which sends a real email.
-- So the first inbound email for any building could never be filed: Curve
-- Birtinya had 0 threads, 0 contacts and 7 unfiled items with nowhere to go.
-- corr_file_unfiled_new_thread creates the thread from the email itself and
-- sends nothing.
-- ============================================================================

create or replace function public.corr_file_unfiled_new_thread(
  p_raw uuid,
  p_subject text default null,
  p_contact_name text default null,
  p_party_type text default null,
  p_org text default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_raw record;
  v_contact uuid;
  v_thread uuid;
  v_email text;
  v_name text;
begin
  select * into v_raw from correspondence_inbound_raw where id = p_raw and status = 'unfiled';
  if not found then raise exception 'unfiled item not found'; end if;

  -- A row with no building cannot be filed: there is no scheme to file it into,
  -- and corr_is_committee has nothing to check against. The receiver is what
  -- must stop producing these (see the reply-all duplicate delivery note).
  if v_raw.building_id is null then
    raise exception 'this email is not attached to a building, so it cannot be filed';
  end if;
  if not corr_is_committee(v_raw.building_id) then raise exception 'not permitted'; end if;

  v_email := nullif(btrim(lower(coalesce(v_raw.from_email, ''))), '');
  v_name  := nullif(btrim(coalesce(p_contact_name, v_raw.from_name, '')), '');

  -- Reuse the contact when this sender is already known to the building, so
  -- filing two emails from the same person does not create two contacts.
  if v_email is not null then
    select id into v_contact from correspondence_contacts
    where building_id = v_raw.building_id and btrim(lower(coalesce(email, ''))) = v_email
    order by created_at limit 1;
  end if;

  if v_contact is null then
    insert into correspondence_contacts (building_id, name, org, email, party_type)
    values (
      v_raw.building_id,
      coalesce(v_name, v_email, 'Unknown sender'),
      nullif(btrim(coalesce(p_org, '')), ''),
      v_email,
      coalesce(nullif(btrim(coalesce(p_party_type, '')), ''), 'other')::corr_party_type
    )
    returning id into v_contact;
  end if;

  insert into correspondence_threads (building_id, subject, contact_id, status, visibility, created_by)
  values (
    v_raw.building_id,
    coalesce(nullif(btrim(coalesce(p_subject, '')), ''), nullif(btrim(coalesce(v_raw.subject, '')), ''), '(no subject)'),
    v_contact, 'open', 'committee', auth.uid()
  )
  returning id into v_thread;

  insert into correspondence_messages
    (thread_id, direction, from_name, from_email, subject, body_text, body_html, raw_id, delivery_status)
  values (v_thread, 'inbound', v_raw.from_name, v_raw.from_email, v_raw.subject,
          v_raw.body_text, v_raw.body_html, v_raw.id, 'received');

  update correspondence_inbound_raw set status = 'processed', processed_at = now() where id = p_raw;

  return v_thread;
end $function$;

revoke execute on function public.corr_file_unfiled_new_thread(uuid, text, text, text, text) from public, anon;
grant execute on function public.corr_file_unfiled_new_thread(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Search. A generated tsvector over the fields a committee actually recalls:
-- what it was about, who it was from, and what the email said.
-- NOTE: corr_search is REPLACED by migration 0016, which swaps ts_headline's
-- HTML delimiters for guillemets. Keep both files; 0016 is the live version.
-- ---------------------------------------------------------------------------
alter table public.correspondence_messages
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector('english',
      coalesce(subject, '') || ' ' ||
      coalesce(from_name, '') || ' ' ||
      coalesce(from_email, '') || ' ' ||
      coalesce(body_text, ''))
  ) stored;

create index if not exists correspondence_messages_search_idx
  on public.correspondence_messages using gin (search_tsv);

create index if not exists correspondence_inbound_raw_building_status_idx
  on public.correspondence_inbound_raw (building_id, status, received_at desc);
