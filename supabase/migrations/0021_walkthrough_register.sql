-- 0021_walkthrough_register.sql
-- The Walk Through becomes an auditable register.
--
-- Problem this solves: walkthrough_results is keyed to (walkthrough_id, item_id), so a finding
-- exists only as a note on one walk's row. There is nowhere for an issue to live across walks.
-- Measured against Curve's own paper records, carry-over between the June/August and September
-- walkarounds is running at roughly one item in ten, and the items lost are disproportionately
-- the ones recorded as "no visible improvement": including an unremedied WHS hazard.
--
-- Shape follows 0019: per-building rows rather than a fixed list, a generic axis kept alongside
-- the building's own words so cross-building reporting still works, and nothing is ever hard
-- deleted. The append-only guard follows corr_messages_guard.
--
-- What is preserved: walkthroughs, walkthrough_items and walkthrough_results all keep working
-- unchanged. walkthrough_results remains the per-walk answer to a question, which is what makes
-- a nil return ("inspected, nothing raised") a dated, positive record rather than an absence.
-- Curve's three existing walks and SeaHaven's two are untouched.

-- ---------------------------------------------------------------------------
-- 1. Sections: the reporting groups, per building, in the building's own words
-- ---------------------------------------------------------------------------

create table if not exists public.walkthrough_sections (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid not null references public.buildings(id) on delete cascade,
  name           text not null,                    -- the committee's own words
  duty_category  text not null,                    -- generic axis, for cross-building reporting
  duty_reference text,                             -- e.g. 'Sch 1: Rubbish Collection'
  zone           text,                             -- walk-route axis; capture order
  route_sort     integer not null default 0,       -- order walked
  sort           integer not null default 0,       -- order reported
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists walkthrough_sections_bld
  on public.walkthrough_sections (building_id, sort);

-- ---------------------------------------------------------------------------
-- 2. Questions: walkthrough_items gains its duty anchor and its frequency
-- ---------------------------------------------------------------------------
-- `area` is retained and still required, so the existing checklist UI keeps working while the
-- new screens are built. The seed sets area = section name.

alter table public.walkthrough_items
  add column if not exists section_id     uuid references public.walkthrough_sections(id) on delete set null,
  add column if not exists duty_reference text,
  add column if not exists frequency      text,
  add column if not exists guidance       text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'walkthrough_items_frequency_chk') then
    alter table public.walkthrough_items
      add constraint walkthrough_items_frequency_chk
      check (frequency is null or frequency in
        ('daily','weekly','fortnightly','monthly','quarterly','biannually','annually','as_required'));
  end if;
end $$;

create index if not exists walkthrough_items_section on public.walkthrough_items (section_id);

-- ---------------------------------------------------------------------------
-- 3. Walks: the record of the walk itself
-- ---------------------------------------------------------------------------

alter table public.walkthroughs
  add column if not exists areas_not_walked text,   -- an unwalked area must be visible, not absent
  add column if not exists weather          text,
  add column if not exists issued_at        timestamptz,
  add column if not exists issued_by        uuid references auth.users(id);

-- ---------------------------------------------------------------------------
-- 4. Findings: the register. The object that was missing.
-- ---------------------------------------------------------------------------

create table if not exists public.walkthrough_findings (
  id                   uuid primary key default gen_random_uuid(),
  building_id          uuid not null references public.buildings(id) on delete cascade,
  ref                  text not null,                       -- CB-0147, assigned by trigger
  class                text not null
                         check (class in ('S','R','C','H','L','G')),
  section_id           uuid references public.walkthrough_sections(id) on delete set null,
  item_id              uuid references public.walkthrough_items(id)    on delete set null,
                         -- nullable: every section allows a free observation
  location             text,
  observation          text not null,
  standard_snapshot    text,          -- the duty text as at capture
  standard_is_general  boolean not null default false,
                         -- true where the item rests on cl 3.2/3.4 rather than a Schedule 1 line
  required_outcome     text,
  owner                text,
  due_date             date,
  frequency            text,          -- for S-class recurring duties, instead of a date
  status               text not null default 'open'
                         check (status in ('open','closed','promoted','superseded')),
  risk_rating          text check (risk_rating in ('low','medium','high','critical')),
  first_raised_walk_id uuid references public.walkthroughs(id) on delete set null,
  first_raised_on      date not null default current_date,
  closed_walk_id       uuid references public.walkthroughs(id) on delete set null,
  closed_at            timestamptz,
  closed_by            uuid references auth.users(id),
  superseded_by        uuid references public.walkthrough_findings(id) on delete set null,
  maintenance_id       text references public.maintenance(id) on delete set null,
  created_by           uuid default auth.uid(),
  created_at           timestamptz not null default now(),
  constraint walkthrough_findings_ref_uniq unique (building_id, ref),
  -- a hazard without a rating is the failure this register exists to prevent
  constraint walkthrough_findings_hazard_rated
    check (class <> 'H' or risk_rating is not null),
  -- S-class never promotes: standards escalate by recurrence, not by becoming a job
  constraint walkthrough_findings_s_never_promotes
    check (not (class = 'S' and maintenance_id is not null))
);

create index if not exists walkthrough_findings_open
  on public.walkthrough_findings (building_id, status, class);
create index if not exists walkthrough_findings_section
  on public.walkthrough_findings (section_id);
create index if not exists walkthrough_findings_item
  on public.walkthrough_findings (item_id);
create index if not exists walkthrough_findings_first_walk
  on public.walkthrough_findings (first_raised_walk_id);
create index if not exists walkthrough_findings_closed_walk
  on public.walkthrough_findings (closed_walk_id);
create index if not exists walkthrough_findings_superseded
  on public.walkthrough_findings (superseded_by);
create index if not exists walkthrough_findings_maint
  on public.walkthrough_findings (maintenance_id);

-- ---------------------------------------------------------------------------
-- 5. Event trail: append-only
-- ---------------------------------------------------------------------------

create table if not exists public.walkthrough_finding_events (
  id             bigint generated always as identity primary key,
  finding_id     uuid not null references public.walkthrough_findings(id) on delete cascade,
  walkthrough_id uuid references public.walkthroughs(id) on delete set null,
  event          text not null
                   check (event in ('raised','observed_again','updated','closed',
                                    'reopened','promoted','superseded')),
  note           text,
  photo_path     text,
  actor          uuid default auth.uid(),
  occurred_at    timestamptz not null default now()
);

create index if not exists walkthrough_finding_events_finding
  on public.walkthrough_finding_events (finding_id, occurred_at);
create index if not exists walkthrough_finding_events_walk
  on public.walkthrough_finding_events (walkthrough_id);

-- ---------------------------------------------------------------------------
-- 6. Per-building reference counter
-- ---------------------------------------------------------------------------

create table if not exists public.walkthrough_finding_counters (
  building_id uuid primary key references public.buildings(id) on delete cascade,
  ref_prefix  text not null default 'WT',
  last_seq    integer not null default 0
);

create or replace function public.walkthrough_assign_ref()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_prefix text;
  v_seq    integer;
begin
  if new.ref is not null and new.ref <> '' then
    return new;                                   -- explicit ref (backfill) is honoured
  end if;

  insert into public.walkthrough_finding_counters as c (building_id, last_seq)
       values (new.building_id, 1)
  on conflict (building_id) do update set last_seq = c.last_seq + 1
    returning c.ref_prefix, c.last_seq into v_prefix, v_seq;

  new.ref := v_prefix || '-' || lpad(v_seq::text, 4, '0');
  return new;
end $$;

drop trigger if exists walkthrough_findings_ref on public.walkthrough_findings;
create trigger walkthrough_findings_ref
  before insert on public.walkthrough_findings
  for each row execute function public.walkthrough_assign_ref();

-- ---------------------------------------------------------------------------
-- 7. Guards
-- ---------------------------------------------------------------------------
-- Closure is the committee's act, not the caretaker's. Per building, because the BM edition
-- inverts this: buildings.data->>'walkthrough_closure' = 'committee' (default) | 'maint'.

create or replace function public.walkthrough_findings_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_mode text;
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

    if new.status = 'closed' and old.status is distinct from 'closed' then
      select coalesce(b.data->>'walkthrough_closure', 'committee')
        into v_mode
        from public.buildings b
       where b.id = new.building_id;

      if v_mode = 'committee'
         and not public.is_committee(new.building_id)
         and not public.is_platform_admin() then
        raise exception
          'closing a walk-through finding requires committee verification at this building';
      end if;

      if new.closed_at is null then new.closed_at := now();       end if;
      if new.closed_by is null then new.closed_by := auth.uid();  end if;
    end if;

    -- reopening clears the closure, so a reopened item never reads as closed
    if new.status = 'open' and old.status = 'closed' then
      new.closed_at      := null;
      new.closed_by      := null;
      new.closed_walk_id := null;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists walkthrough_findings_guard_t on public.walkthrough_findings;
create trigger walkthrough_findings_guard_t
  before update or delete on public.walkthrough_findings
  for each row execute function public.walkthrough_findings_guard();

create or replace function public.walkthrough_finding_events_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'walkthrough_finding_events is append-only; hard delete is not permitted';
  end if;
  if new.finding_id  is distinct from old.finding_id
  or new.event       is distinct from old.event
  or new.occurred_at is distinct from old.occurred_at
  or new.actor       is distinct from old.actor then
    raise exception 'walkthrough_finding_events is append-only; the trail cannot be rewritten';
  end if;
  return new;
end $$;

drop trigger if exists walkthrough_finding_events_guard_t on public.walkthrough_finding_events;
create trigger walkthrough_finding_events_guard_t
  before update or delete on public.walkthrough_finding_events
  for each row execute function public.walkthrough_finding_events_guard();

-- Every finding opens with a 'raised' event, so walks_open is never short by one.

create or replace function public.walkthrough_findings_raise_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.walkthrough_finding_events (finding_id, walkthrough_id, event, note)
       values (new.id, new.first_raised_walk_id, 'raised', new.observation);
  return new;
end $$;

drop trigger if exists walkthrough_findings_raise_event_t on public.walkthrough_findings;
create trigger walkthrough_findings_raise_event_t
  after insert on public.walkthrough_findings
  for each row execute function public.walkthrough_findings_raise_event();

-- ---------------------------------------------------------------------------
-- 8. walks_open, derived rather than stored
-- ---------------------------------------------------------------------------

create or replace view public.walkthrough_findings_expanded
with (security_invoker = true) as
select f.*,
       s.name          as section_name,
       s.duty_category as duty_category,
       (select count(*) from public.walkthrough_finding_events e
         where e.finding_id = f.id
           and e.event in ('raised','observed_again'))          as walks_open,
       (select max(e.occurred_at) from public.walkthrough_finding_events e
         where e.finding_id = f.id)                             as last_event_at,
       (f.status = 'open'
         and f.due_date is not null
         and f.due_date < current_date)                         as overdue
  from public.walkthrough_findings f
  left join public.walkthrough_sections s on s.id = f.section_id;

-- ---------------------------------------------------------------------------
-- 9. RLS: matches the existing walkthrough policies (can_maint)
-- ---------------------------------------------------------------------------

alter table public.walkthrough_sections          enable row level security;
alter table public.walkthrough_findings          enable row level security;
alter table public.walkthrough_finding_events    enable row level security;
alter table public.walkthrough_finding_counters  enable row level security;

drop policy if exists wt_sections_write on public.walkthrough_sections;
create policy wt_sections_write on public.walkthrough_sections
  for all using (public.can_maint(building_id))
          with check (public.can_maint(building_id));

drop policy if exists wt_findings_write on public.walkthrough_findings;
create policy wt_findings_write on public.walkthrough_findings
  for all using (public.can_maint(building_id))
          with check (public.can_maint(building_id));

drop policy if exists wt_finding_events_write on public.walkthrough_finding_events;
create policy wt_finding_events_write on public.walkthrough_finding_events
  for all using (exists (select 1 from public.walkthrough_findings f
                          where f.id = walkthrough_finding_events.finding_id
                            and public.can_maint(f.building_id)))
          with check (exists (select 1 from public.walkthrough_findings f
                          where f.id = walkthrough_finding_events.finding_id
                            and public.can_maint(f.building_id)));

drop policy if exists wt_counters_write on public.walkthrough_finding_counters;
create policy wt_counters_write on public.walkthrough_finding_counters
  for all using (public.can_maint(building_id))
          with check (public.can_maint(building_id));

revoke execute on function public.walkthrough_assign_ref()            from public;
revoke execute on function public.walkthrough_findings_guard()        from public;
revoke execute on function public.walkthrough_findings_raise_event()  from public;
