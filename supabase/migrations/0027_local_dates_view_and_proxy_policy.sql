-- 0027_local_dates_view_and_proxy_policy
-- 0025 swept functions and column defaults for UTC CURRENT_DATE. Two more lived in a view
-- and a row-level security policy, which that sweep did not cover:
--  * walkthrough_findings_expanded.overdue: a finding due today read as overdue from 10:00
--    the day before, in Brisbane terms.
--  * motion_votes votes_insert: a proxy vote is allowed only while CURRENT_DATE is within
--    the appointment's dates, so a proxy starting today could not vote before 10:00, and one
--    that ended yesterday could still vote until 10:00 today.
-- Both are rebuilt from their live definitions with CURRENT_DATE replaced, so nothing else
-- in them changes, and the migration fails if either did not change.
do $$
declare v text; p record; w text;
begin
  v := pg_get_viewdef('public.walkthrough_findings_expanded'::regclass, true);
  if v !~ 'CURRENT_DATE' then raise exception '0027: view has no CURRENT_DATE'; end if;
  execute 'create or replace view public.walkthrough_findings_expanded with (security_invoker = true) as '
          || replace(v, 'CURRENT_DATE', 'public.today_local()');

  select * into p from pg_policies where schemaname = 'public' and tablename = 'motion_votes' and policyname = 'votes_insert';
  if p.with_check is null or p.with_check !~ 'CURRENT_DATE' then raise exception '0027: votes_insert has no CURRENT_DATE'; end if;
  w := replace(p.with_check, 'CURRENT_DATE', 'public.today_local()');
  execute 'drop policy votes_insert on public.motion_votes';
  execute 'create policy votes_insert on public.motion_votes for insert to public with check (' || w || ')';
end $$;
