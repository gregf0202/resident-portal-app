-- 0024_walk_dates_brisbane
-- CURRENT_DATE is evaluated in the database's timezone, which is UTC. Brisbane is
-- UTC+10 with no daylight saving, so any walk started before 10:00 local time was
-- dated the previous day (a walk opened at 09:31 on 20 Sep was stored as 19 Sep).
-- The app now sends the device's own local date; this default is the fallback, in
-- the timezone of every current building's scheme.
alter table public.walkthroughs
  alter column walk_date set default ((now() at time zone 'Australia/Brisbane')::date);

alter table public.walkthrough_findings
  alter column first_raised_on set default ((now() at time zone 'Australia/Brisbane')::date);

comment on column public.walkthroughs.walk_date is
  'Local date of the walk. Sent by the app from the device clock; defaults to the Brisbane date, never the UTC date (0024).';
