-- 0033 A building manager flagged as an MSC member must still follow the
-- building's Correspondence switch. msc ("member of the strata committee") is
-- meant for OWNERS who sit on the committee; Curve has a manager carrying it,
-- which would have walked straight past 0032's toggle.
create or replace function public.corr_is_committee(bid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.building_id = bid and m.status = 'active'
      and (m.role in ('bcc','admin')
        or (m.msc = true and m.role <> 'manager')
        or (m.role = 'manager' and coalesce(
              (select b.data->>'bmCorrespondence' from buildings b where b.id = bid), 'false') = 'true'))
  );
$$;
