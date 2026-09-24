-- 0035 An owner flagged msc ("member of the strata committee") IS a committee
-- member: they already receive committee notices by email (broadcast_recipients
-- counts them), so they must be able to open one. is_committee() covers only
-- bcc/admin, which would have emailed them a notice they could not read.
create or replace function public.is_committee_member(bid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.building_id = bid and m.status = 'active'
      and (m.role in ('bcc','admin') or (m.msc = true and m.role <> 'manager'))
  );
$$;
revoke all on function public.is_committee_member(uuid) from public, anon;
grant execute on function public.is_committee_member(uuid) to authenticated, service_role;

drop policy if exists committee_notices_read on public.committee_notices;
create policy committee_notices_read on public.committee_notices for select
  using (public.is_committee_member(building_id)
      or (audience = 'committee_bm' and public.has_role(building_id, array['manager'])));

drop policy if exists committee_notices_write on public.committee_notices;
create policy committee_notices_write on public.committee_notices for insert
  with check (public.is_committee_member(building_id));

drop policy if exists committee_notices_delete on public.committee_notices;
create policy committee_notices_delete on public.committee_notices for delete
  using (public.is_committee_member(building_id));
