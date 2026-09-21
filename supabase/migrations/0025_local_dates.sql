-- 0025_local_dates
-- Postgres evaluates CURRENT_DATE, and casts a timestamptz to date, in the database
-- timezone, which is UTC. In Queensland that is still yesterday until 10:00, so every
-- date NaloHub derived from "today" or from a timestamp was a day behind for the first
-- ten hours of each day. The billing job runs at 06:00 Brisbane (20:00 UTC), so it ran
-- every day against the previous day. 0024 fixed the walk-through defaults; this fixes
-- the rest and gives every future date a single source.

create or replace function public.today_local()
returns date
language sql
stable
set search_path to 'public'
as $$ select (now() at time zone 'Australia/Brisbane')::date $$;

comment on function public.today_local() is
  'Today''s calendar date in Brisbane. Use this, never CURRENT_DATE, for any date a person will read (0025).';

-- Column defaults
alter table public.invoices             alter column issue_date      set default public.today_local();
alter table public.parking_permits      alter column approval_date   set default public.today_local();
alter table public.proxy_appointments   alter column date_from       set default public.today_local();
alter table public.walkthroughs         alter column walk_date       set default public.today_local();
alter table public.walkthrough_findings alter column first_raised_on set default public.today_local();

-- Functions: rewrite each body in place so nothing else in it changes. Every function
-- must actually change, or the migration fails rather than silently doing nothing.
do $$
declare r record; src text; dst text;
begin
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('billing_daily', 'gen_building_invoice', 'create_adhoc_invoice',
                        'expire_lapsed_proxies', 'issue_parking_permit')
  loop
    src := pg_get_functiondef(r.oid);
    dst := replace(src, 'current_date', 'public.today_local()');
    dst := replace(dst, 'new.decided_at::date', '(new.decided_at at time zone ''Australia/Brisbane'')::date');
    if dst = src then
      raise exception '0025: % did not change', r.proname;
    end if;
    execute dst;
  end loop;
end $$;
