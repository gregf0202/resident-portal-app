-- 0038: the resident directory, done properly.
--
-- Found in the 26 Sep 2026 audit:
--   * "Show me in the directory" had no column, so it reset on every load.
--   * memberships_select lets a resident read only their OWN row, so in production a
--     resident's Directory showed nobody but themselves.
--   * A resident's own phone and show-phone/show-email switches went through
--     persistChange -> memberships.update, which RLS (committee-only) silently ignored.
--   * Tower and floor typed by the committee were never stored.
--
-- This adds the missing columns, a read path that returns ONLY what each person chose
-- to share, and a write path for a person's own directory settings. No existing policy
-- is changed; committee reads and writes are exactly as before.

alter table public.memberships add column if not exists directory_opt_in boolean not null default false;
alter table public.memberships add column if not exists tower text;
alter table public.memberships add column if not exists floor text;
comment on column public.memberships.directory_opt_in is 'The person chose to appear in the resident directory. Default off: nothing of theirs is shown unless they switch it on.';

-- What a member may see of their neighbours: opted-in, active members only, and a
-- phone or email only where that person switched it on. SECURITY DEFINER because
-- memberships_select shows a resident only their own row; the filter below is the
-- whole of what leaves the table.
create or replace function public.directory_for_building(p_building uuid)
returns table (id uuid, full_name text, unit text, role text, tower text, floor text, phone text, email text)
language sql stable security definer set search_path = public as $$
  select m.id, m.full_name, m.unit, m.role, m.tower, m.floor,
         case when m.show_phone then m.phone end,
         case when m.show_email then m.email end
    from memberships m
   where m.building_id = p_building
     and m.status = 'active'
     and m.directory_opt_in
     and m.role in ('owner', 'tenant', 'bcc', 'manager')
     and public.is_member(p_building);
$$;
revoke execute on function public.directory_for_building(uuid) from public, anon;
grant execute on function public.directory_for_building(uuid) to authenticated;

-- A person's own directory settings. Only ever touches the caller's own row.
create or replace function public.update_my_directory(p_building uuid, p_phone text, p_show_phone boolean, p_show_email boolean, p_opt_in boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update memberships
     set phone = p_phone, show_phone = coalesce(p_show_phone, false),
         show_email = coalesce(p_show_email, false), directory_opt_in = coalesce(p_opt_in, false)
   where building_id = p_building and user_id = auth.uid();
  if not found then raise exception 'permission denied: no membership for this building'; end if;
end $$;
revoke execute on function public.update_my_directory(uuid, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_my_directory(uuid, text, boolean, boolean, boolean) to authenticated;
