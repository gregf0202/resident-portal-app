-- 0032 Committee notices, committee audiences, and building-manager access (v0.39.0)
--
-- Committee-to-committee communication gets its own home. Announcements means
-- "to residents"; this is the committee's own board, invisible to owners and
-- tenants, and to the building manager unless a notice is shared with them.
-- Separately: the building manager's access to Correspondence stops being a
-- constant in the app source (on for every building, uncontrollable by the
-- committee) and becomes a per-building switch enforced in the database.

-- 1. The notices themselves. A separate table, not the announcements jsonb
--    store, because hiding a notice in the UI is not the same as a resident
--    being unable to read it: this one is refused by the database.
create table if not exists public.committee_notices (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  audience text not null default 'committee' check (audience in ('committee','committee_bm')),
  emailed_detail boolean not null default false,
  emailed_count int not null default 0,
  created_by uuid default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists committee_notices_building_idx on public.committee_notices(building_id, created_at desc);
alter table public.committee_notices enable row level security;

drop policy if exists committee_notices_read on public.committee_notices;
create policy committee_notices_read on public.committee_notices for select
  using (public.is_committee(building_id)
      or (audience = 'committee_bm' and public.has_role(building_id, array['manager'])));

drop policy if exists committee_notices_write on public.committee_notices;
create policy committee_notices_write on public.committee_notices for insert
  with check (public.is_committee(building_id));

drop policy if exists committee_notices_delete on public.committee_notices;
create policy committee_notices_delete on public.committee_notices for delete
  using (public.is_committee(building_id));

-- 2. Correspondence for the building manager becomes a per-building choice,
--    off unless buildings.data.bmCorrespondence is true.
create or replace function public.corr_is_committee(bid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.building_id = bid and m.status = 'active'
      and (m.role in ('bcc','admin') or m.msc = true
        or (m.role = 'manager' and coalesce(
              (select b.data->>'bmCorrespondence' from buildings b where b.id = bid), 'false') = 'true'))
  );
$$;

-- Buildings run by their manager with no committee on the app would otherwise
-- lose Correspondence entirely, so they keep it; committee-led buildings start off.
-- (Applied 24 Sep 2026: Regatta Waterfront Apartments and On The River.)
update public.buildings b set data = jsonb_set(b.data, '{bmCorrespondence}', 'true'::jsonb, true)
where not exists (select 1 from memberships m where m.building_id = b.id and m.status = 'active' and m.role = 'bcc')
  and exists (select 1 from memberships m where m.building_id = b.id and m.status = 'active' and m.role = 'manager');

-- 3. Committee audiences for broadcast_recipients, resolved from memberships
--    (a role) and never from the unit register, so they follow whoever holds
--    the role today: a committee changes at every AGM and a saved list would not.
--    Applied here and kept in full in 0034_broadcast_committee_audiences.sql.
