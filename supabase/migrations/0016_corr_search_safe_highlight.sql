-- ts_headline's default StartSel/StopSel are <b> and </b>. Rendering that in the
-- app would mean dangerouslySetInnerHTML on inbound email content, which is the
-- exact sink the 5 Aug XSS review removed from ResidentPortal.jsx (zero remain).
-- Use non-HTML guillemets instead: the snippet stays plain text, the client
-- splits on them and emphasises the matched run as ordinary JSX. No HTML ever
-- crosses the boundary, so there is nothing to escape and nothing to trust.
-- Verified against a real body containing <quattrors50@gmail.com>.
--
-- SECURITY INVOKER is deliberate: the existing RLS on correspondence_threads
-- and correspondence_messages already encodes who may see what, including the
-- restricted-thread rule that keeps the BM and MSC out. A SECURITY DEFINER
-- version would be a second copy of the access model, free to drift.
create or replace function public.corr_search(p_building uuid, p_q text)
returns table (
  thread_id uuid,
  thread_subject text,
  contact_name text,
  contact_email text,
  thread_status text,
  message_id uuid,
  direction text,
  matched_in text,
  snippet text,
  occurred_at timestamptz
)
language sql
stable
set search_path to 'public'
as $function$
  with q as (
    select websearch_to_tsquery('english', coalesce(p_q, '')) as tsq,
           '%' || btrim(lower(coalesce(p_q, ''))) || '%' as lik
  )
  select t.id, t.subject, c.name, c.email, t.status::text,
         m.id, m.direction::text, 'message'::text,
         ts_headline('english',
           left(coalesce(m.body_text, m.subject, ''), 4000),
           (select tsq from q),
           'StartSel=«, StopSel=», MaxWords=26, MinWords=10, ShortWord=2, MaxFragments=1, FragmentDelimiter= … '),
         m.created_at
  from correspondence_messages m
  join correspondence_threads t on t.id = m.thread_id
  left join correspondence_contacts c on c.id = t.contact_id
  cross join q
  where t.building_id = p_building
    and m.deleted_at is null
    and btrim(coalesce(p_q, '')) <> ''
    and (m.search_tsv @@ q.tsq or lower(coalesce(m.from_email, '')) like q.lik)

  union all

  select t.id, t.subject, c.name, c.email, t.status::text,
         null::uuid, null::text, 'thread'::text,
         null::text,
         t.last_activity_at
  from correspondence_threads t
  left join correspondence_contacts c on c.id = t.contact_id
  cross join q
  where t.building_id = p_building
    and btrim(coalesce(p_q, '')) <> ''
    and (lower(coalesce(t.subject, '')) like q.lik
      or lower(coalesce(c.name, '')) like q.lik
      or lower(coalesce(c.email, '')) like q.lik
      or lower(coalesce(c.org, '')) like q.lik)

  order by 10 desc
  limit 100;
$function$;

revoke execute on function public.corr_search(uuid, text) from public, anon;
grant execute on function public.corr_search(uuid, text) to authenticated;
