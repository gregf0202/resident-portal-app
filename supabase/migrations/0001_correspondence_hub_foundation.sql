-- ============================================================================
-- Correspondence Hub — durable spine (Phase 1 foundation)
-- Additive only: creates new tables; does not touch existing data.
-- Guardrails baked in: append-only + tamper-evident messages, raw-first inbound.
-- Applied to project lipwcsihcxndwwgzhiia (NaloHub prod).
-- ============================================================================

-- ---- Enums -----------------------------------------------------------------
do $$ begin if not exists (select 1 from pg_type where typname='corr_party_type') then
  create type corr_party_type as enum ('strata_manager','insurer','solicitor','council','auditor','contractor','agent','owner','other'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type where typname='corr_context_type') then
  create type corr_context_type as enum ('general','maintenance','contract','compliance','dispute','application'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type where typname='corr_direction') then
  create type corr_direction as enum ('outbound','inbound'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type where typname='corr_status') then
  create type corr_status as enum ('open','awaiting_reply','closed'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type where typname='corr_visibility') then
  create type corr_visibility as enum ('committee','restricted'); end if; end $$;

-- ---- Tables ----------------------------------------------------------------
create table if not exists building_mailboxes (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  slug text not null unique,
  inbound_address text,
  from_name text,
  created_at timestamptz not null default now(),
  unique (building_id)
);

create table if not exists correspondence_contacts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  name text not null,
  org text,
  email text,
  phone text,
  party_type corr_party_type not null default 'other',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists correspondence_threads (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  subject text,
  contact_id uuid references correspondence_contacts(id) on delete set null,
  context_type corr_context_type not null default 'general',
  context_id uuid,
  status corr_status not null default 'open',
  visibility corr_visibility not null default 'committee',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists correspondence_thread_members (
  thread_id uuid not null references correspondence_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (thread_id, user_id)
);

create table if not exists correspondence_inbound_raw (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete set null,
  provider_message_id text,
  raw_mime_path text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received'
);

create table if not exists correspondence_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references correspondence_threads(id),
  direction corr_direction not null,
  from_name text,
  from_email text,
  to_email text,
  cc text,
  subject text,
  body_text text,
  body_html text,
  sent_by uuid references auth.users(id) on delete set null,
  external_message_id text,
  in_reply_to text,
  delivery_status text,
  raw_id uuid references correspondence_inbound_raw(id) on delete set null,
  content_hash text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists correspondence_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references correspondence_messages(id) on delete cascade,
  file_name text,
  mime text,
  storage_path text,
  size bigint,
  created_at timestamptz not null default now()
);

-- ---- Indexes ---------------------------------------------------------------
create index if not exists idx_corr_threads_building on correspondence_threads(building_id);
create index if not exists idx_corr_threads_activity on correspondence_threads(last_activity_at desc);
create index if not exists idx_corr_messages_thread on correspondence_messages(thread_id);
create index if not exists idx_corr_messages_created on correspondence_messages(created_at);
create index if not exists idx_corr_contacts_building on correspondence_contacts(building_id);
create index if not exists idx_corr_inbound_status on correspondence_inbound_raw(status);

-- ---- Guardrail 2: append-only + tamper-evident messages --------------------
create or replace function corr_messages_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'correspondence_messages is append-only; hard delete is not permitted';
  end if;
  -- Block edits to immutable content; allow delivery_status, deleted_at, raw_id,
  -- external_message_id, in_reply_to to be updated.
  if new.subject      is distinct from old.subject
  or new.body_text    is distinct from old.body_text
  or new.body_html    is distinct from old.body_html
  or new.from_email   is distinct from old.from_email
  or new.to_email     is distinct from old.to_email
  or new.direction    is distinct from old.direction
  or new.thread_id    is distinct from old.thread_id
  or new.created_at   is distinct from old.created_at
  or new.content_hash is distinct from old.content_hash then
    raise exception 'correspondence_messages is append-only; message content cannot be edited';
  end if;
  return new;
end $$;

drop trigger if exists corr_messages_guard_trg on correspondence_messages;
create trigger corr_messages_guard_trg before update or delete on correspondence_messages
  for each row execute function corr_messages_guard();

create or replace function corr_messages_hash() returns trigger language plpgsql as $$
begin
  if new.content_hash is null then
    new.content_hash := encode(sha256(convert_to(
      coalesce(new.subject,'') || E'\n' || coalesce(new.body_text, new.body_html, ''), 'UTF8')), 'hex');
  end if;
  return new;
end $$;

drop trigger if exists corr_messages_hash_trg on correspondence_messages;
create trigger corr_messages_hash_trg before insert on correspondence_messages
  for each row execute function corr_messages_hash();

-- ---- RLS helper ------------------------------------------------------------
create or replace function corr_is_committee(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.building_id = bid and m.status = 'active'
      and (m.role in ('bcc','admin','manager') or m.msc = true)
  );
$$;

-- ---- RLS -------------------------------------------------------------------
alter table building_mailboxes            enable row level security;
alter table correspondence_contacts       enable row level security;
alter table correspondence_threads        enable row level security;
alter table correspondence_thread_members enable row level security;
alter table correspondence_inbound_raw    enable row level security;
alter table correspondence_messages       enable row level security;
alter table correspondence_attachments    enable row level security;

-- mailboxes + contacts: committee of the building
create policy corr_mailboxes_committee on building_mailboxes
  for all using (corr_is_committee(building_id)) with check (corr_is_committee(building_id));
create policy corr_contacts_committee on correspondence_contacts
  for all using (corr_is_committee(building_id)) with check (corr_is_committee(building_id));

-- threads: read respects visibility; write requires committee (no delete policy = no client deletes)
create policy corr_threads_select on correspondence_threads for select using (
  corr_is_committee(building_id) and (
    visibility = 'committee' or created_by = auth.uid()
    or exists (select 1 from correspondence_thread_members tm where tm.thread_id = id and tm.user_id = auth.uid())
  )
);
create policy corr_threads_insert on correspondence_threads for insert
  with check (corr_is_committee(building_id));
create policy corr_threads_update on correspondence_threads for update using (
  corr_is_committee(building_id) and (
    visibility = 'committee' or created_by = auth.uid()
    or exists (select 1 from correspondence_thread_members tm where tm.thread_id = id and tm.user_id = auth.uid())
  )
) with check (corr_is_committee(building_id));

-- thread members: committee of the thread's building
create policy corr_thread_members_all on correspondence_thread_members for all using (
  exists (select 1 from correspondence_threads th where th.id = thread_id and corr_is_committee(th.building_id))
) with check (
  exists (select 1 from correspondence_threads th where th.id = thread_id and corr_is_committee(th.building_id))
);

-- messages: read respects thread visibility; insert requires committee; update allowed (trigger blocks content edits)
create policy corr_messages_select on correspondence_messages for select using (
  exists (select 1 from correspondence_threads th where th.id = thread_id
    and corr_is_committee(th.building_id)
    and (th.visibility = 'committee' or th.created_by = auth.uid()
      or exists (select 1 from correspondence_thread_members tm where tm.thread_id = th.id and tm.user_id = auth.uid())))
);
create policy corr_messages_insert on correspondence_messages for insert with check (
  exists (select 1 from correspondence_threads th where th.id = thread_id and corr_is_committee(th.building_id))
);
create policy corr_messages_update on correspondence_messages for update using (
  exists (select 1 from correspondence_threads th where th.id = thread_id and corr_is_committee(th.building_id))
) with check (true);

-- attachments: via message -> thread
create policy corr_attach_select on correspondence_attachments for select using (
  exists (select 1 from correspondence_messages msg join correspondence_threads th on th.id = msg.thread_id
    where msg.id = message_id and corr_is_committee(th.building_id)
    and (th.visibility = 'committee' or th.created_by = auth.uid()
      or exists (select 1 from correspondence_thread_members tm where tm.thread_id = th.id and tm.user_id = auth.uid())))
);
create policy corr_attach_insert on correspondence_attachments for insert with check (
  exists (select 1 from correspondence_messages msg join correspondence_threads th on th.id = msg.thread_id
    where msg.id = message_id and corr_is_committee(th.building_id))
);

-- correspondence_inbound_raw: no client policies -> RLS denies all client access.
-- Only the inbound edge function (service role, which bypasses RLS) writes/reads it.
