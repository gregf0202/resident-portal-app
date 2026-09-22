-- 0029 Broadcast audiences and saved distribution lists (v0.37.0)
--
-- Notices used to reach only people with an active NaloHub app account. The
-- recipient source is now the unit register (current owners and tenants)
-- merged with app members, de-duplicated on email. Nothing here sends email:
-- sending remains a deliberate action in the notice composer.

-- 1. Does this owner live here? NULL means "follow the tenancy": an owner of a
--    lot with no current tenant is assumed to live there. Set explicitly to
--    true/false when the committee knows better (vacant lot, holiday let,
--    owner living with their tenant). Tenants always count as living here.
alter table public.unit_people add column if not exists lives_here boolean;

-- 2. Saved distribution lists.
--    kind 'manual': members is a jsonb array of keys, 'up:<unit_people.id>' or
--                   'm:<memberships.id>'. Archived register rows drop out.
--    kind 'rule'  : rule is {audience, levels[], units[], pets:boolean}.
create table if not exists public.distribution_lists (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('manual','rule')),
  members jsonb not null default '[]'::jsonb,
  rule jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists distribution_lists_building_idx on public.distribution_lists(building_id);
alter table public.distribution_lists enable row level security;
drop policy if exists distribution_lists_posters on public.distribution_lists;
create policy distribution_lists_posters on public.distribution_lists for all
  using (public.has_role(building_id, array['admin','bcc','strata','manager']))
  with check (public.has_role(building_id, array['admin','bcc','strata','manager']));

-- 3. What was actually sent, to whom. Committee-side record so "was I told?"
--    has an answer. Never readable by ordinary residents.
create table if not exists public.announcement_sends (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  announcement_id text,
  subject text,
  audience text not null,
  list_id uuid,
  list_name text,
  recipients jsonb not null default '[]'::jsonb,
  people_count int not null default 0,
  emailed_count int not null default 0,
  no_email_count int not null default 0,
  sent_by uuid,
  sent_at timestamptz not null default now()
);
create index if not exists announcement_sends_building_idx on public.announcement_sends(building_id, sent_at desc);
alter table public.announcement_sends enable row level security;
drop policy if exists announcement_sends_read on public.announcement_sends;
create policy announcement_sends_read on public.announcement_sends for select
  using (public.has_role(building_id, array['admin','bcc','strata','manager']));
-- inserts come only from the send-announcement function (service role)

-- 4. The one resolver. Used for the composer preview (as the signed-in poster)
--    and by send-announcement (service role). Returns one row per person,
--    de-duplicated on email, so the preview and the send can never disagree.
create or replace function public.broadcast_recipients(
  p_building uuid, p_audience text, p_list uuid default null, p_people jsonb default '[]'::jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_aud text := coalesce(p_audience, 'all');
  v_rule jsonb := '{}'::jsonb;
  v_keys jsonb := coalesce(p_people, '[]'::jsonb);
  v_list_name text;
  v_out jsonb;
begin
  if auth.uid() is not null and not public.has_role(p_building, array['admin','bcc','strata','manager']) then
    raise exception 'not permitted for this building';
  end if;

  if v_aud = 'list' then
    select case when kind = 'rule' then rule else '{}'::jsonb end,
           case when kind = 'manual' then members else null end, name
      into v_rule, v_keys, v_list_name
      from distribution_lists where id = p_list and building_id = p_building;
    if v_list_name is null then raise exception 'list not found'; end if;
    if v_keys is null then v_aud := coalesce(v_rule->>'audience', 'all'); else v_aud := 'specific'; end if;
  end if;

  with u as (
    select u.id, u.unit_number,
      case when u.unit_number ~ '^([A-Za-z]|[0-9]+)[0-9]{2}$'
           then upper(substring(u.unit_number from '^([A-Za-z]|[0-9]+)[0-9]{2}$')) end as level,
      exists (select 1 from unit_people t where t.unit_id = u.id and t.is_current and t.person_type = 'tenant') as tenanted,
      exists (select 1 from unit_pets pt where pt.unit_id = u.id) as has_pet
    from units u where u.building_id = p_building
  ),
  reg as (
    select 'up:' || p.id as key, p.full_name, nullif(trim(p.email), '') as email, u.unit_number, u.level, u.has_pet,
      p.person_type as kind,
      case when p.person_type = 'tenant' then true else coalesce(p.lives_here, not u.tenanted) end as lives_here,
      true as on_register
    from unit_people p join u on u.id = p.unit_id
    where p.is_current and p.person_type in ('owner','tenant')
  ),
  mem as (
    select 'm:' || m.id as key, m.full_name, nullif(trim(m.email), '') as email, m.unit as unit_number,
      case when m.unit ~ '^([A-Za-z]|[0-9]+)[0-9]{2}$' then upper(substring(m.unit from '^([A-Za-z]|[0-9]+)[0-9]{2}$')) end as level,
      false as has_pet,
      case when m.role = 'tenant' then 'tenant' else 'owner' end as kind,
      true as lives_here, false as on_register, m.id as membership_id
    from memberships m
    where m.building_id = p_building and m.status = 'active' and m.role in ('owner','tenant','bcc')
  ),
  people as (
    select r.*, (select m.membership_id from mem m where m.email is not null and lower(m.email) = lower(r.email) limit 1) as membership_id from reg r
    union all
    select m.key, m.full_name, m.email, m.unit_number, m.level, m.has_pet, m.kind, m.lives_here, m.on_register, m.membership_id
    from mem m
    where m.email is null or not exists (select 1 from reg r where lower(r.email) = lower(m.email))
  ),
  picked as (
    select * from people p
    where case v_aud
      when 'all' then true
      when 'owners' then p.kind = 'owner'
      when 'tenants' then p.kind = 'tenant'
      when 'residents' then p.lives_here
      when 'offsite' then p.kind = 'owner' and not p.lives_here
      when 'specific' then v_keys ? p.key
          or (p.membership_id is not null and v_keys ? ('m:' || p.membership_id))
      else false end
    and (jsonb_array_length(coalesce(v_rule->'levels', '[]')) = 0 or (p.level is not null and (v_rule->'levels') ? p.level))
    and (jsonb_array_length(coalesce(v_rule->'units', '[]')) = 0 or (v_rule->'units') ? p.unit_number)
    and (coalesce((v_rule->>'pets')::boolean, false) = false or p.has_pet)
  ),
  dedup as (
    select distinct on (coalesce(lower(email), key)) *
    from picked order by coalesce(lower(email), key), on_register desc, kind
  )
  select jsonb_build_object(
    'audience', coalesce(p_audience, 'all'),
    'list_name', v_list_name,
    'people', coalesce(jsonb_agg(jsonb_build_object(
        'key', key, 'name', full_name, 'email', email, 'unit', unit_number, 'kind', kind,
        'lives_here', lives_here, 'membership_id', membership_id) order by unit_number, full_name), '[]'::jsonb),
    'count', count(*),
    'emailable', count(email),
    'no_email', count(*) - count(email),
    'units', count(distinct unit_number)
  ) into v_out from dedup;
  return v_out;
end $$;

revoke all on function public.broadcast_recipients(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.broadcast_recipients(uuid, text, uuid, jsonb) to authenticated, service_role;
