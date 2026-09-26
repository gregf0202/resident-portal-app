-- 0040: every request gets an answer (audit Release 2, 26 Sep 2026).
--
-- 1. decide_motion_at_meeting(): the committee can close an open motion as decided at a
--    meeting, with the date, minute reference and the count. Needed because a motion whose
--    threshold counts members who never sign in (Curve, Sep 2026) can otherwise never close.
-- 2. An application the applicant withdraws also withdraws its open motion.
-- 3. execute_motion_outcome(): a withdrawn maintenance motion is recorded on the job's trail,
--    and a decided one tells the resident who reported the job, in plain words, on the job
--    itself (maintenance.data.updates) so the Maintenance screen stops saying "No updates yet".
-- 4. notify_maintenance_activity(): the resident who reported a job is alerted when it is
--    triaged, sent to the committee, decided, booked and resolved.
-- 5. Building managers may read and decide BOOKINGS (not applications), matching the
--    Approvals screen they already have.
-- 6. Approving a pending member emails them (the app has said "welcome email sent" since
--    launch without sending anything), and the first sign-in welcome email gets the
--    two-route Add to Home Screen instruction (iOS 26 Compact layout, v0.31.3 rule).
-- 7. Vote reminders: send_vote_reminders() emails committee members who have not voted on a
--    motion open for 3 days or more (then every 7 days, at most 3 times per motion), with a
--    record in vote_reminders. NOT scheduled here: turning the daily run on is Greg's call.

-- 1 ---------------------------------------------------------------------------------------
create or replace function public.decide_motion_at_meeting(
  p_motion uuid, p_passed boolean, p_meeting_date date, p_minute_ref text,
  p_for int, p_against int, p_abstain int)
returns void language plpgsql security invoker set search_path = public as $$
declare m public.motions%rowtype;
begin
  select * into m from public.motions where id = p_motion for update;
  if not found then raise exception 'That motion could not be found.'; end if;
  if not public.is_committee(m.building_id) then
    raise exception 'permission denied: only the committee can record a meeting decision';
  end if;
  if m.status <> 'open' then raise exception 'This motion has already been decided or withdrawn.'; end if;
  if p_meeting_date is null or p_meeting_date > public.today_local() then
    raise exception 'The meeting date must be today or earlier.';
  end if;
  if coalesce(p_for, 0) < 0 or coalesce(p_against, 0) < 0 or coalesce(p_abstain, 0) < 0 then
    raise exception 'Vote counts cannot be negative.';
  end if;
  if p_passed and coalesce(p_for, 0) <= coalesce(p_against, 0) then
    raise exception 'For the motion to pass, more members must have voted for it than against it.';
  end if;
  if not p_passed and coalesce(p_for, 0) > coalesce(p_against, 0) then
    raise exception 'More members voted for it than against, so it passed. Choose Passed.';
  end if;
  update public.motions
     set status = case when p_passed then 'passed' else 'failed' end,
         decided_at = now(),
         outcome_note = 'Decided at the committee meeting on ' || to_char(p_meeting_date, 'FMDD Mon YYYY')
           || coalesce(' (minutes ' || nullif(trim(p_minute_ref), '') || ')', '')
           || ': ' || coalesce(p_for, 0) || ' for, ' || coalesce(p_against, 0) || ' against'
           || case when coalesce(p_abstain, 0) > 0 then ', ' || p_abstain || ' abstained' else '' end,
         details = details || jsonb_build_object('meeting_decision', jsonb_build_object(
           'date', p_meeting_date, 'minute_ref', nullif(trim(p_minute_ref), ''),
           'for', coalesce(p_for, 0), 'against', coalesce(p_against, 0), 'abstain', coalesce(p_abstain, 0),
           'recorded_by', auth.uid(), 'recorded_at', now()))
   where id = p_motion;
end $$;
revoke execute on function public.decide_motion_at_meeting(uuid, boolean, date, text, int, int, int) from public, anon;
grant execute on function public.decide_motion_at_meeting(uuid, boolean, date, text, int, int, int) to authenticated;

-- 2 ---------------------------------------------------------------------------------------
create or replace function public.withdraw_application_motion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'withdrawn' and old.status is distinct from 'withdrawn' then
    update public.motions
       set status = 'withdrawn', decided_at = now(),
           outcome_note = 'Withdrawn: the applicant withdrew the application.'
     where context_type = 'application' and context_id = new.id::text and status = 'open';
  end if;
  return new;
end $$;
drop trigger if exists trg_withdraw_application_motion on public.applications;
create trigger trg_withdraw_application_motion after update on public.applications
  for each row execute function public.withdraw_application_motion();

-- 3 ---------------------------------------------------------------------------------------
-- Adds a resident-facing line to a maintenance job. The job lives in maintenance.data.
create or replace function public.maintenance_resident_update(p_id text, p_text text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.maintenance
     set data = jsonb_set(
           case when p_status is not null and coalesce(data->>'status', 'new') not in ('resolved', p_status)
                then jsonb_set(data, '{status}', to_jsonb(p_status)) else data end,
           '{updates}',
           coalesce(data->'updates', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
             'id', 'up' || substr(md5(random()::text), 1, 6), 'text', p_text,
             'by', 'Your committee', 'date', public.today_local()::text)))
   where id = p_id;
end $$;
revoke execute on function public.maintenance_resident_update(text, text, text) from public, anon, authenticated;

create or replace function public.execute_motion_outcome()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('passed','failed') and old.status = 'open' then
    insert into audit_log (building_id, actor, action, target, detail)
    values (new.building_id, null, 'motion_' || new.status, new.id::text,
            jsonb_build_object('title', new.title, 'outcome', new.outcome_note,
                               'conditions', new.details->'conditions'));
    insert into app_notifications (building_id, recipient_role, kind, ref_table, ref_id, title, body)
    values (new.building_id, 'bcc', 'motion_decided', 'motions', new.id::text,
            'Motion ' || new.status || ': ' || new.title, coalesce(new.outcome_note,''));
    if new.context_type = 'application' and new.context_id is not null then
      update applications
      set status = case when new.status = 'passed' then 'approved' else 'declined' end,
          decided_at = now(),
          decision_note = 'Decided by BCC vote: ' || coalesce(new.outcome_note,'')
            || case when new.status = 'passed' and jsonb_array_length(coalesce(new.details->'conditions','[]'::jsonb)) > 0
                    then ' — approval subject to the attached conditions' else '' end,
          details = details || case when new.status = 'passed' and new.details ? 'conditions'
                    then jsonb_build_object('conditions', new.details->'conditions') else '{}'::jsonb end
      where id = new.context_id::uuid and status in ('submitted','under_review');
    end if;
    if new.context_type = 'maintenance' and new.context_id is not null then
      insert into maintenance_activity (building_id, maintenance_id, kind, body, data, created_by)
      values (new.building_id, new.context_id, 'decision',
              'Motion ' || new.status || ': ' || new.title || ' (' || coalesce(new.outcome_note,'') || ')',
              jsonb_build_object('motion_id', new.id, 'quote_id', new.details->>'quote_id', 'outcome', new.status), null);
      if new.status = 'passed' and coalesce(new.details->>'quote_id','') <> '' then
        update maintenance_quotes set status = 'accepted' where id = (new.details->>'quote_id')::uuid;
        update maintenance_quotes set status = 'rejected'
          where maintenance_id = new.context_id and id <> (new.details->>'quote_id')::uuid
            and status in ('received','shortlisted','recommended');
      end if;
      perform public.maintenance_resident_update(new.context_id,
        case when new.status = 'passed'
             then 'The committee has approved the work. A contractor will be booked next.'
             else 'The committee did not approve that quote. The maintenance team is looking at other options.' end,
        'in_progress');
    end if;
  elsif new.status = 'withdrawn' and old.status = 'open'
        and new.context_type = 'maintenance' and new.context_id is not null then
    insert into maintenance_activity (building_id, maintenance_id, kind, body, data, created_by)
    values (new.building_id, new.context_id, 'decision',
            'Motion withdrawn: ' || new.title,
            jsonb_build_object('motion_id', new.id, 'quote_id', new.details->>'quote_id', 'outcome', 'withdrawn'), null);
  end if;
  return new;
end $$;

-- 4 ---------------------------------------------------------------------------------------
create or replace function public.notify_maintenance_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare job jsonb; reporter uuid; resident_kind boolean; t text; b text;
begin
  if new.kind in ('triage','quote_added','recommendation','decision','contractor_confirmed','status_change') then
    insert into app_notifications (building_id, recipient_user_id, kind, ref_table, ref_id, title, body)
    select new.building_id, m.user_id, 'maintenance_' || new.kind, 'maintenance', new.maintenance_id,
           replace(initcap(new.kind), '_', ' ') || ' on issue ' || new.maintenance_id,
           left(coalesce(new.body,''), 200)
    from memberships m
    where m.building_id = new.building_id and m.status = 'active' and m.user_id is not null
      and (m.role in ('bcc','admin','manager') or m.msc)
      and m.user_id <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  -- The person who reported the job hears about the steps that matter to them.
  resident_kind := new.kind in ('triage','vote_opened','decision','contractor_confirmed')
                   or (new.kind = 'status_change' and new.data->>'status' = 'resolved');
  if resident_kind then
    select data into job from maintenance where id = new.maintenance_id;
    reporter := nullif(job->>'raisedByAuth', '')::uuid;
    if reporter is null and coalesce(job->>'raisedBy', '') <> '' then
      select (array_agg(m.user_id))[1] into reporter from memberships m
       where m.building_id = new.building_id and m.status = 'active' and m.user_id is not null
         and lower(trim(m.full_name)) = lower(trim(job->>'raisedBy'))
      having count(*) = 1;
    end if;
    if reporter is not null
       and reporter <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid)
       and not exists (select 1 from memberships m where m.building_id = new.building_id
                        and m.user_id = reporter and m.status = 'active'
                        and (m.role in ('bcc','admin','manager') or m.msc)) then
      t := 'Update on your report: ' || coalesce(job->>'title', 'maintenance issue');
      b := case new.kind
             when 'triage' then 'Your report has been looked at and someone is on it.'
             when 'vote_opened' then 'A quote for the work has gone to the committee for approval.'
             when 'decision' then case new.data->>'outcome' when 'passed' then 'The committee has approved the work.'
                                   when 'failed' then 'The committee is looking at other options for this job.'
                                   else 'The committee is reviewing the next step for this job.' end
             when 'contractor_confirmed' then 'A contractor has been booked for the work.'
             else 'This has been fixed. Thanks for reporting it.' end;
      insert into app_notifications (building_id, recipient_user_id, kind, ref_table, ref_id, title, body)
      values (new.building_id, reporter, 'maintenance_update', 'maintenance', new.maintenance_id, t, b);
    end if;
  end if;
  return new;
end $$;

-- 5 ---------------------------------------------------------------------------------------
drop policy if exists app_select_manager_bookings on public.applications;
create policy app_select_manager_bookings on public.applications for select
  using (kind = 'booking' and public.has_role(building_id, array['manager']));
drop policy if exists app_update_manager_bookings on public.applications;
create policy app_update_manager_bookings on public.applications for update
  using (kind = 'booking' and public.has_role(building_id, array['manager']))
  with check (kind = 'booking' and public.has_role(building_id, array['manager']));
drop policy if exists app_att_manager_bookings on public.application_attachments;
create policy app_att_manager_bookings on public.application_attachments for select
  using (exists (select 1 from public.applications a where a.id = application_attachments.application_id
                 and a.kind = 'booking' and public.has_role(a.building_id, array['manager'])));

-- 6 ---------------------------------------------------------------------------------------
create or replace function public.welcome_email_html(first_name text)
returns text language sql immutable set search_path = public as $$
  select '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a2b4a;line-height:1.6">'
  || '<h2>Welcome to NaloHub</h2>'
  || '<p>' || case when coalesce(first_name,'') <> '' then 'G''day ' || first_name || ',' else 'G''day,' end || '</p>'
  || '<p>Thanks for joining. Buildings run on people who show up, and you just did.</p>'
  || '<p>NaloHub is your building''s engine room: maintenance requests, notices, documents, and the stuff that usually gets lost in the group chat, all in one place.</p>'
  || '<p><strong>Three things worth doing first:</strong></p>'
  || '<ol><li><strong>Choose what neighbours see</strong> in the Directory</li>'
  || '<li><strong>Check the noticeboard</strong> for what''s happening in your building</li>'
  || '<li><strong>Log anything that needs fixing</strong>: leaky tap, flickering light. Just Nalo it.</li></ol>'
  || '<p><strong>Put NaloHub on your Home Screen</strong> so you always know where to find it:</p>'
  || '<ul><li><strong>iPhone:</strong> open <a href="https://portal.nalohub.com">portal.nalohub.com</a> in Safari. If you see the Share icon (a box with an arrow), tap it. If you see "..." instead, tap that, then Share. Then tap <em>Add to Home Screen</em>.</li>'
  || '<li><strong>Android:</strong> open <a href="https://portal.nalohub.com">portal.nalohub.com</a> in Chrome, tap the three-dot menu, then <em>Add to Home screen</em>.</li></ul>'
  || '<p>Questions? Just reply. A real person reads these.</p>'
  || '<p>Greg<br>NaloHub</p></div>'
$$;

create or replace function public.send_access_approved_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare tok text; bname text; first_name text;
  pub constant text := 'sb_publishable_cBYse3rucX4_o8xtL9ubEQ_WOxTJrDZ';
begin
  if not (tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active') then return new; end if;
  if coalesce(new.email, '') = '' then return new; end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'internal_email_token' limit 1;
  select coalesce(data->>'name', 'your building') into bname from public.buildings where id = new.building_id;
  first_name := split_part(trim(coalesce(new.full_name, '')), ' ', 1);
  perform net.http_post(
    url := 'https://lipwcsihcxndwwgzhiia.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || pub,
                                  'apikey', pub, 'x-nalo-internal', tok),
    body := jsonb_build_object(
      'to', new.email,
      'subject', 'You''re in: ' || bname || ' on NaloHub',
      'html', '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a2b4a;line-height:1.6">'
        || '<h2>Your access is approved</h2>'
        || '<p>' || case when first_name <> '' then 'G''day ' || first_name || ',' else 'G''day,' end || '</p>'
        || '<p>Your committee has approved your access to <strong>' || bname || '</strong> on NaloHub.</p>'
        || '<p><a href="https://portal.nalohub.com" style="display:inline-block;background:#0B2545;color:#64A5B7;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Open NaloHub</a></p>'
        || '<p>Sign in with this email address. We''ll send you a link and a code; either works.</p>'
        || '<p style="color:#5a6b7b">Just Nalo it.</p></div>',
      'reply_to', 'info@nalohub.com'));
  return new;
exception when others then
  return new; -- never block an approval if email fails
end $$;
drop trigger if exists trg_access_approved_email on public.memberships;
create trigger trg_access_approved_email after update on public.memberships
  for each row execute function public.send_access_approved_email();

-- 7 ---------------------------------------------------------------------------------------
create table if not exists public.vote_reminders (
  id uuid primary key default gen_random_uuid(),
  motion_id uuid not null references public.motions(id) on delete cascade,
  membership_id uuid not null references public.memberships(id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index if not exists vote_reminders_motion_member on public.vote_reminders (motion_id, membership_id, sent_at desc);
alter table public.vote_reminders enable row level security;
drop policy if exists vote_reminders_committee on public.vote_reminders;
create policy vote_reminders_committee on public.vote_reminders for select
  using (exists (select 1 from public.motions m where m.id = vote_reminders.motion_id and public.is_committee(m.building_id)));

create or replace function public.send_vote_reminders(p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; tok text; sent int := 0; items text; bname text; first_name text; plan jsonb := '[]'::jsonb;
  pub constant text := 'sb_publishable_cBYse3rucX4_o8xtL9ubEQ_WOxTJrDZ';
begin
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'internal_email_token' limit 1;
  for r in
    with due as (
      select mo.id motion_id, mo.title, mo.building_id, mo.opened_at, m.id membership_id, m.email, m.full_name, m.user_id
        from public.motions mo
        join public.memberships m on m.building_id = mo.building_id and m.role = 'bcc' and m.status = 'active'
       where mo.status = 'open' and mo.opened_at <= now() - interval '3 days'
         and coalesce(m.email, '') <> ''
         and coalesce((select b.data->>'internal' from public.buildings b where b.id = mo.building_id), 'false') <> 'true'
         and not exists (select 1 from public.motion_votes v where v.motion_id = mo.id and m.user_id is not null
                          and (v.voter_user_id = m.user_id or v.proxy_for_user_id = m.user_id))
         and (select count(*) from public.vote_reminders vr where vr.motion_id = mo.id and vr.membership_id = m.id) < 3
         and not exists (select 1 from public.vote_reminders vr where vr.motion_id = mo.id and vr.membership_id = m.id
                          and vr.sent_at > now() - interval '7 days')
    )
    select membership_id, email, full_name, user_id, building_id,
           array_agg(motion_id) motion_ids, array_agg(title order by opened_at) titles
      from due group by membership_id, email, full_name, user_id, building_id
  loop
    select coalesce(data->>'name', 'your building') into bname from public.buildings where id = r.building_id;
    first_name := split_part(trim(coalesce(r.full_name, '')), ' ', 1);
    select string_agg('<li>' || replace(replace(t, '<', '&lt;'), '>', '&gt;') || '</li>', '') into items from unnest(r.titles) t;
    plan := plan || jsonb_build_object('membership', r.membership_id, 'motions', to_jsonb(r.motion_ids), 'signed_in', r.user_id is not null);
    if not p_dry_run then
      perform net.http_post(
        url := 'https://lipwcsihcxndwwgzhiia.supabase.co/functions/v1/send-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || pub,
                                      'apikey', pub, 'x-nalo-internal', tok),
        body := jsonb_build_object(
          'to', r.email,
          'subject', bname || ': your vote is waiting',
          'html', '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a2b4a;line-height:1.6">'
            || '<p>' || case when first_name <> '' then 'G''day ' || first_name || ',' else 'G''day,' end || '</p>'
            || '<p>' || case when array_length(r.titles, 1) = 1 then 'A committee motion at <strong>' || bname || '</strong> is waiting on your vote:'
                             else array_length(r.titles, 1) || ' committee motions at <strong>' || bname || '</strong> are waiting on your vote:' end || '</p>'
            || '<ul>' || items || '</ul>'
            || '<p>Each one needs a majority of the committee, so it can''t be decided until enough members vote.</p>'
            || '<p><a href="https://portal.nalohub.com" style="display:inline-block;background:#0B2545;color:#64A5B7;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Vote in NaloHub</a></p>'
            || case when r.user_id is null then '<p>First time? Open the link and sign in with this email address. We''ll email you a link and a code; either works.</p>' else '' end
            || '<p style="color:#5a6b7b">Just Nalo it.</p></div>',
          'reply_to', 'info@nalohub.com'));
      insert into public.vote_reminders (motion_id, membership_id) select unnest(r.motion_ids), r.membership_id;
      sent := sent + 1;
    end if;
  end loop;
  return jsonb_build_object('dry_run', p_dry_run, 'emails', case when p_dry_run then jsonb_array_length(plan) else sent end, 'plan', plan);
end $$;
revoke execute on function public.send_vote_reminders(boolean) from public, anon, authenticated;

-- 8 ---------------------------------------------------------------------------------------
-- Two permits approved at the same moment could both count N and be numbered PP-(N+1).
-- Serialise numbering per building with a transaction-scoped advisory lock. Rewritten in
-- place from the live definition; fails loudly if the anchor text is not found.
do $$
declare def text; newdef text;
begin
  select pg_get_functiondef('public.issue_parking_permit()'::regprocedure) into def;
  newdef := replace(def, E'    select ''PP-'' || lpad', E'    perform pg_advisory_xact_lock(hashtext(''permit_no:'' || new.building_id::text));\n    select ''PP-'' || lpad');
  if newdef = def then raise exception '0040: issue_parking_permit numbering anchor not found'; end if;
  execute newdef;
end $$;
