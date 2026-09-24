-- 0034 broadcast_recipients gains the committee audiences (applied 24 Sep 2026
-- together with 0032). 'committee' is every active bcc member plus any member
-- flagged msc; 'committee_bm' adds the building manager. Both come from
-- memberships, so they follow the role rather than a saved list of names.
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

  -- Role audiences: the people who run the building, not the people who live in it.
  if v_aud in ('committee', 'committee_bm') then
    select jsonb_build_object(
      'audience', coalesce(p_audience, v_aud), 'list_name', v_list_name,
      'people', coalesce(jsonb_agg(jsonb_build_object(
          'key', 'm:' || id, 'name', full_name, 'email', email, 'unit', unit,
          'kind', kind, 'lives_here', true, 'membership_id', id,
          'level', null, 'pet', false) order by kind, full_name), '[]'::jsonb),
      'count', count(*), 'emailable', count(email),
      'no_email', count(*) - count(email), 'units', 0)
      into v_out
    from (
      select distinct on (coalesce(lower(nullif(trim(m.email), '')), m.id::text))
        m.id, m.full_name, nullif(trim(m.email), '') as email, m.unit,
        case when m.role = 'manager' then 'manager' else 'committee' end as kind
      from memberships m
      where m.building_id = p_building and m.status = 'active'
        and ((m.role = 'bcc' or m.msc = true)
          or (v_aud = 'committee_bm' and m.role = 'manager'))
      order by coalesce(lower(nullif(trim(m.email), '')), m.id::text)
    ) x;
    return v_out;
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
        'lives_here', lives_here, 'membership_id', membership_id,
        'level', level, 'pet', has_pet) order by unit_number, full_name), '[]'::jsonb),
    'count', count(*),
    'emailable', count(email),
    'no_email', count(*) - count(email),
    'units', count(distinct unit_number)
  ) into v_out from dedup;
  return v_out;
end $$;

revoke all on function public.broadcast_recipients(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.broadcast_recipients(uuid, text, uuid, jsonb) to authenticated, service_role;
