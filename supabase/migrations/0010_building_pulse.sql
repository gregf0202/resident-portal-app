-- 0010_building_pulse  (APPLIED to prod 6 Sep 2026 as 0010_building_pulse + 0010b_building_pulse_digest_fix)
-- Building Pulse: free public tool at nalohub.com/pulse.
-- Privacy design: no individual answers are ever stored. Each submission is folded into
-- per-building running totals inside pulse_submit() and the raw scores are discarded.
-- A building's combined picture is only readable once 8 or more people have taken part.
-- Tables have RLS enabled with NO policies and all grants revoked; the only access path is
-- the SECURITY DEFINER functions below, granted to anon/authenticated.

create extension if not exists pgcrypto;

create table public.pulse_buildings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  question_set char(1) not null check (question_set in ('a','b')),
  response_count int not null default 0,
  sums jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.pulse_tokens (
  building_id uuid not null references public.pulse_buildings(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  primary key (building_id, token_hash)
);
create table public.pulse_notify (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.pulse_buildings(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (building_id, email)
);
create table public.pulse_sends (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.pulse_buildings(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
alter table public.pulse_buildings enable row level security;
alter table public.pulse_tokens enable row level security;
alter table public.pulse_notify enable row level security;
alter table public.pulse_sends enable row level security;
revoke all on public.pulse_buildings, public.pulse_tokens, public.pulse_notify, public.pulse_sends from anon, authenticated, public;

create or replace function public.pulse_slug(p_name text) returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_name,'')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.pulse_start(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_slug text := pulse_slug(p_name); v_row pulse_buildings%rowtype; v_set char(1);
begin
  if v_slug is null or length(v_slug) < 3 or length(v_slug) > 120 then
    raise exception 'Building name must be between 3 and 120 characters'; end if;
  select * into v_row from pulse_buildings where slug = v_slug;
  if not found then
    select case when (count(*) % 2) = 0 then 'a' else 'b' end into v_set from pulse_buildings;
    insert into pulse_buildings (slug, name, question_set) values (v_slug, left(trim(p_name), 120), v_set) returning * into v_row;
  end if;
  return jsonb_build_object('id', v_row.id, 'slug', v_row.slug, 'name', v_row.name, 'set', v_row.question_set, 'count', v_row.response_count);
end $$;

create or replace function public.pulse_submit(p_building uuid, p_token text, p_scores jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_dims text[] := array['welcome','communication','community','clean','transparency','committee','manager'];
  v_d text; v_v numeric; v_sums jsonb; v_counts jsonb; v_count int; v_hash text;
begin
  if p_token is null or length(p_token) < 16 then raise exception 'Missing token'; end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  begin
    insert into pulse_tokens (building_id, token_hash) values (p_building, v_hash);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_counted', 'count', (select response_count from pulse_buildings where id = p_building));
  end;
  select sums, counts into v_sums, v_counts from pulse_buildings where id = p_building for update;
  if not found then raise exception 'Unknown building'; end if;
  foreach v_d in array v_dims loop
    if p_scores ? v_d and jsonb_typeof(p_scores->v_d) = 'number' then
      v_v := (p_scores->>v_d)::numeric;
      if v_v < 1 or v_v > 10 then raise exception 'Score out of range'; end if;
      v_sums := v_sums || jsonb_build_object(v_d, coalesce((v_sums->>v_d)::numeric,0) + v_v);
      v_counts := v_counts || jsonb_build_object(v_d, coalesce((v_counts->>v_d)::int,0) + 1);
    end if;
  end loop;
  update pulse_buildings set sums = v_sums, counts = v_counts, response_count = response_count + 1, updated_at = now()
   where id = p_building returning response_count into v_count;
  return jsonb_build_object('ok', true, 'count', v_count);
end $$;

create or replace function public.pulse_building(p_building uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v pulse_buildings%rowtype;
  v_dims text[] := array['welcome','communication','community','clean','transparency','committee','manager'];
  v_d text; v_avg jsonb := '{}'::jsonb; v_n int;
begin
  select * into v from pulse_buildings where id = p_building;
  if not found then raise exception 'Unknown building'; end if;
  if v.response_count < 8 then
    return jsonb_build_object('id', v.id, 'name', v.name, 'set', v.question_set, 'count', v.response_count, 'ready', false); end if;
  foreach v_d in array v_dims loop
    v_n := coalesce((v.counts->>v_d)::int, 0);
    if v_n >= 8 then v_avg := v_avg || jsonb_build_object(v_d, round((v.sums->>v_d)::numeric / v_n, 1));
    else v_avg := v_avg || jsonb_build_object(v_d, null); end if;
  end loop;
  return jsonb_build_object('id', v.id, 'name', v.name, 'set', v.question_set, 'count', v.response_count, 'ready', true, 'scores', v_avg);
end $$;

create or replace function public.pulse_notify_me(p_building uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Invalid email'; end if;
  insert into pulse_notify (building_id, email) values (p_building, lower(trim(p_email))) on conflict (building_id, email) do nothing;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.pulse_slug(text) from public;
revoke execute on function public.pulse_start(text) from public;
revoke execute on function public.pulse_submit(uuid, text, jsonb) from public;
revoke execute on function public.pulse_building(uuid) from public;
revoke execute on function public.pulse_notify_me(uuid, text) from public;
grant execute on function public.pulse_start(text) to anon, authenticated;
grant execute on function public.pulse_submit(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.pulse_building(uuid) to anon, authenticated;
grant execute on function public.pulse_notify_me(uuid, text) to anon, authenticated;
