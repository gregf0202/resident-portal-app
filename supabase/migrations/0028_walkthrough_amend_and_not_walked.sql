-- 0028_walkthrough_amend_and_not_walked
-- 1. Amending a finding is now possible, and can only happen with a reason on the record.
--    Before this, anyone with can_maint could change a finding's class, owner or due date
--    with a plain UPDATE and nothing recorded it. Now any change to those fields must carry
--    a reason (set by amend_walk_finding), is a committee act where closure is (per building,
--    walkthrough_closure), is refused on a closed finding, and writes an 'updated' event with
--    every field's before and after. The trail is forced by the database, not by the screen.
-- 2. The event trail is tightened: a note or photo can be added to an entry that has none,
--    but never changed once written, and the structured change record is immutable.
-- 3. A closed finding is a fixed record. Reopening is refused (platform admin excepted, for
--    correcting a mistaken closure); a problem that comes back is a new finding.
-- 4. walkthroughs.sections_not_walked records which duty groups were not walked on a walk,
--    so the report stops counting them as "inspected, nothing raised".
-- Proven 22 Sep 2026 as a Curve committee member inside a rolled-back transaction: direct
-- edit refused, short reason refused, amendment recorded with before/after and reason, note
-- rewrite refused, closed amend refused, reopen refused, not-walked saved, owner refused.

alter table public.walkthrough_finding_events add column if not exists changes jsonb;
alter table public.walkthroughs add column if not exists sections_not_walked jsonb not null default '[]'::jsonb;

create or replace function public.walkthrough_finding_events_guard()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'walkthrough_finding_events is append-only; hard delete is not permitted';
  end if;
  if new.finding_id  is distinct from old.finding_id
  or new.event       is distinct from old.event
  or new.occurred_at is distinct from old.occurred_at
  or new.actor       is distinct from old.actor
  or new.changes     is distinct from old.changes
  or (new.walkthrough_id is distinct from old.walkthrough_id and new.walkthrough_id is not null) then
    raise exception 'walkthrough_finding_events is append-only; the trail cannot be rewritten';
  end if;
  if old.note is not null and new.note is distinct from old.note then
    raise exception 'walkthrough_finding_events is append-only; a recorded note cannot be changed';
  end if;
  if old.photo_path is not null and new.photo_path is distinct from old.photo_path then
    raise exception 'walkthrough_finding_events is append-only; a recorded photo cannot be replaced';
  end if;
  return new;
end $function$;

create or replace function public.walkthrough_findings_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_mode text;
  k text;
  v_amended boolean := false;
begin
  if tg_op = 'DELETE' then
    raise exception
      'walkthrough_findings is append-only; set status = ''superseded'' instead of deleting';
  end if;

  if tg_op = 'UPDATE' then
    if new.ref is distinct from old.ref then
      raise exception 'walkthrough finding ref is immutable';
    end if;
    if new.first_raised_on is distinct from old.first_raised_on then
      raise exception 'walkthrough finding first_raised_on is immutable';
    end if;

    select coalesce(b.data->>'walkthrough_closure', 'committee')
      into v_mode
      from public.buildings b
     where b.id = new.building_id;

    foreach k in array array['class','location','observation','required_outcome','owner','due_date','risk_rating','section_id'] loop
      if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then v_amended := true; end if;
    end loop;

    if v_amended then
      if old.status is distinct from 'open' then
        raise exception 'only an open finding can be amended; a closed finding is a fixed record';
      end if;
      if v_mode = 'committee'
         and not public.is_committee(new.building_id)
         and not public.is_platform_admin() then
        raise exception 'amending a walk-through finding is a committee act at this building';
      end if;
      if coalesce(btrim(current_setting('nalohub.amend_reason', true)), '') = '' then
        raise exception 'amending a walk-through finding needs a reason on the record';
      end if;
    end if;

    if new.status = 'closed' and old.status is distinct from 'closed' then
      if v_mode = 'committee'
         and not public.is_committee(new.building_id)
         and not public.is_platform_admin() then
        raise exception
          'closing a walk-through finding requires committee verification at this building';
      end if;

      if new.closed_at is null then new.closed_at := now();       end if;
      if new.closed_by is null then new.closed_by := auth.uid();  end if;
    end if;

    if new.status = 'open' and old.status = 'closed' then
      if not public.is_platform_admin() then
        raise exception 'a closed finding is a fixed record; if the problem has come back, raise it as a new finding';
      end if;
      new.closed_at      := null;
      new.closed_by      := null;
      new.closed_walk_id := null;
    end if;
  end if;

  return new;
end $function$;

create or replace function public.walkthrough_findings_amend_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c jsonb := '{}'::jsonb;
  k text;
begin
  foreach k in array array['class','location','observation','required_outcome','owner','due_date','risk_rating','section_id'] loop
    if (to_jsonb(old) -> k) is distinct from (to_jsonb(new) -> k) then
      c := c || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k));
    end if;
  end loop;
  if c = '{}'::jsonb then return new; end if;
  insert into public.walkthrough_finding_events (finding_id, event, note, changes)
       values (new.id, 'updated', btrim(current_setting('nalohub.amend_reason', true)), c);
  return new;
end $function$;

drop trigger if exists walkthrough_findings_amend_event_t on public.walkthrough_findings;
create trigger walkthrough_findings_amend_event_t
  after update on public.walkthrough_findings
  for each row execute function public.walkthrough_findings_amend_event();

create or replace function public.amend_walk_finding(p_id uuid, p_patch jsonb, p_reason text)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  if coalesce(length(btrim(p_reason)), 0) < 3 then
    raise exception 'say why this finding is being amended';
  end if;
  perform set_config('nalohub.amend_reason', btrim(p_reason), true);
  update public.walkthrough_findings set
    class            = case when p_patch ? 'class'            then p_patch->>'class' else class end,
    location         = case when p_patch ? 'location'         then nullif(p_patch->>'location', '') else location end,
    observation      = case when p_patch ? 'observation'      then coalesce(nullif(p_patch->>'observation', ''), observation) else observation end,
    required_outcome = case when p_patch ? 'required_outcome' then nullif(p_patch->>'required_outcome', '') else required_outcome end,
    owner            = case when p_patch ? 'owner'            then nullif(p_patch->>'owner', '') else owner end,
    due_date         = case when p_patch ? 'due_date'         then nullif(p_patch->>'due_date', '')::date else due_date end,
    risk_rating      = case when p_patch ? 'risk_rating'      then nullif(p_patch->>'risk_rating', '') else risk_rating end
  where id = p_id;
  if not found then
    raise exception 'finding not found, or not one you can amend';
  end if;
  perform set_config('nalohub.amend_reason', '', true);
end $function$;

revoke all on function public.amend_walk_finding(uuid, jsonb, text) from public, anon;
grant execute on function public.amend_walk_finding(uuid, jsonb, text) to authenticated;
