-- ============================================================================
-- 0002 Correspondence Hub — fix RLS infinite recursion
-- The 0001 policies recursed: correspondence_threads.select referenced
-- correspondence_thread_members, whose policy referenced correspondence_threads.
-- Postgres aborts such queries ("infinite recursion detected in policy"), so
-- every committee read of threads/messages returned empty. Sends were unaffected
-- (the edge function uses the service role, which bypasses RLS).
--
-- Fix: break the cycle with SECURITY DEFINER helpers (function owner is the table
-- owner and bypasses RLS), so policy subqueries no longer re-trigger each other.
-- Applied to project lipwcsihcxndwwgzhiia (NaloHub prod).
-- ============================================================================

create or replace function corr_is_thread_member(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from correspondence_thread_members tm
    where tm.thread_id = tid and tm.user_id = auth.uid()
  );
$$;

create or replace function corr_thread_committee(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from correspondence_threads th
    where th.id = tid and corr_is_committee(th.building_id)
  );
$$;

-- threads: use definer helper instead of inline thread_members subquery
drop policy if exists corr_threads_select on correspondence_threads;
create policy corr_threads_select on correspondence_threads for select using (
  corr_is_committee(building_id) and (
    visibility = 'committee' or created_by = auth.uid() or corr_is_thread_member(id)
  )
);
drop policy if exists corr_threads_update on correspondence_threads;
create policy corr_threads_update on correspondence_threads for update using (
  corr_is_committee(building_id) and (
    visibility = 'committee' or created_by = auth.uid() or corr_is_thread_member(id)
  )
) with check (corr_is_committee(building_id));

-- thread_members: use definer helper instead of inline threads subquery (the loop source)
drop policy if exists corr_thread_members_all on correspondence_thread_members;
create policy corr_thread_members_all on correspondence_thread_members for all using (
  corr_thread_committee(thread_id)
) with check (
  corr_thread_committee(thread_id)
);

-- messages: use definer helper for the member check
drop policy if exists corr_messages_select on correspondence_messages;
create policy corr_messages_select on correspondence_messages for select using (
  exists (select 1 from correspondence_threads th where th.id = correspondence_messages.thread_id
    and corr_is_committee(th.building_id)
    and (th.visibility = 'committee' or th.created_by = auth.uid() or corr_is_thread_member(th.id)))
);

-- attachments: use definer helper for the member check
drop policy if exists corr_attach_select on correspondence_attachments;
create policy corr_attach_select on correspondence_attachments for select using (
  exists (select 1 from correspondence_messages msg join correspondence_threads th on th.id = msg.thread_id
    where msg.id = correspondence_attachments.message_id and corr_is_committee(th.building_id)
    and (th.visibility = 'committee' or th.created_by = auth.uid() or corr_is_thread_member(th.id)))
);
