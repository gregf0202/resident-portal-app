-- 0039: the Maintenance Sub-Committee (MSC) flag means maintenance, not committee.
--
-- Decided by Greg, 26 Sep 2026: an owner with the MSC tick may triage, gather quotes,
-- resolve a job that needs no vote, and send a recommendation to the committee's vote.
-- They do NOT vote, do NOT read or receive committee-only notices, and do NOT see
-- Correspondence. A building manager with the tick is still just the building manager.
--
-- Before this, 0033/0035/0036 treated an MSC owner as a committee member, and the
-- committee-notice recipient rule let ANY msc membership through, so Curve's building
-- manager (who carries the tick) was emailed committee-only notices.
--
-- Unchanged: can_maint() (bcc, admin, manager or msc) and every maintenance,
-- walk-through, quote and asset policy built on it; the maintenance notification
-- triggers; votes_insert (bcc only).

-- 1. Committee means the committee: bcc and admin roles only.
create or replace function public.is_committee_member(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(bid, array['bcc','admin']);
$$;

-- 2. Correspondence: committee, plus the building manager only where the committee
--    switched that on. The MSC branch is removed.
create or replace function public.corr_is_committee(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.building_id = bid and m.status = 'active'
      and (m.role in ('bcc','admin')
        or (m.role = 'manager' and coalesce(
              (select b.data->>'bmCorrespondence' from buildings b where b.id = bid), 'false') = 'true'))
  );
$$;

-- 3. Committee-notice recipients: bcc members only (plus the manager when the notice is
--    shared with them, unchanged). Rewritten in place from the live definition so
--    nothing else in the function moves; fails loudly if the text is not found.
do $$
declare def text; newdef text;
begin
  select pg_get_functiondef('public.broadcast_recipients(uuid,text,uuid,jsonb,jsonb)'::regprocedure) into def;
  newdef := replace(def, 'and ((m.role = ''bcc'' or m.msc = true)', 'and ((m.role = ''bcc'')');
  if newdef = def then raise exception '0039: broadcast_recipients committee rule not found'; end if;
  execute newdef;
end $$;

-- 4. An MSC owner may send a maintenance recommendation to the committee's vote, and
--    follow that motion, but cannot vote on it (votes_insert stays bcc-only).
create or replace function public.is_msc(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m
    where m.building_id = bid and m.user_id = auth.uid() and m.status = 'active'
      and m.msc = true and m.role <> 'manager');
$$;
revoke execute on function public.is_msc(uuid) from public, anon;
grant execute on function public.is_msc(uuid) to authenticated;

drop policy if exists motions_insert on public.motions;
create policy motions_insert on public.motions for insert with check (
  opened_by = auth.uid()
  and (public.is_committee(building_id) or (context_type = 'maintenance' and public.is_msc(building_id)))
);

drop policy if exists motions_select on public.motions;
create policy motions_select on public.motions for select using (
  public.is_committee(building_id) or (context_type = 'maintenance' and public.is_msc(building_id))
);
