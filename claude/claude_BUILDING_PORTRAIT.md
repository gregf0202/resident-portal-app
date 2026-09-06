# Building Portrait: "What type of building do you live in?"

Free public tool from NaloHub at https://nalohub.com/portrait/. Built and shipped 6 September 2026. Verified live end to end by Greg the same day (questions, portrait accuracy, email-to-count, free tool links). This document is the full record; the two sections at the end are the entries for ARCHITECTURE.md and FEATURE_REGISTER.md.

## What it is

Sixteen slider questions about everyday building life across eight areas, each drawn as part of a building: the front door (welcome), the noticeboard (communication), the courtyard (community), the lobby floor (cleanliness and care), the windows (transparency), the committee room (committee access), the manager's office (building manager), the letterbox (strata manager). As the person slides, that part of the building lights up. Strong answers pulse slowly and bright, weak ones flicker faint. Both managers can be skipped ("we don't have one").

The result is a portrait of the building, an archetype name, a description built from the actual answers, an area-by-area list with lit / glowing / dim window glyphs, and six suggestions: three for the dimmest area, two for the next, one for the archetype. Each suggestion is tagged by who does it and how long it takes; 20 of the 24 area suggestions link to one of the 21 free tools on nalohub.com; four are tagged "a NaloHub option". A closing panel names NaloHub once, as text, no link.

Archetypes: The Village, The Well-Run House, The Quiet Neighbours, The Fresh Start, The Open Door, The Foundations (flat, mid), The Clean Slate (flat, low), The Whole House (flat, high). An archetype is only awarded when its leading area scores 6.5 or more.

Residents first. A building's combined portrait unlocks at eight counted responses. Anyone who took part can see it, with their own portrait overlaid privately. The committee is a recipient, never a gate: a resident can send them the portrait by email or copy a message template, but nothing depends on the committee saying yes.

## Privacy and integrity (the part to defend)

- No individual answers are ever stored. Answers travel inside the person's own links. On confirmation, `pulse_fold()` adds them to per-building running totals and they are gone.
- A response only counts after a one-tap email confirmation. One email = one response per building, enforced by `pulse_voters (building_id, email_hash)`. The email is stored only as a SHA-256 hash and is never joined to totals.
- The combined picture is only returned once `response_count >= 8`, enforced inside `pulse_building()`, and a dimension is only shown if it has 8+ answers.
- Opt-in "tell me when eight are in" lives in `pulse_notify`, separate from totals. This is the only place an email is kept in the clear and is the lead list.
- Committee sends are logged as a count only; the recipient address is not retained. Three per building per day.
- Confirmation links are throttled to 25 unused per building per hour. Codes expire after seven days.
- All four tables have RLS enabled with no policies and grants revoked from anon/authenticated. The only access path is the SECURITY DEFINER functions. Verified as the anon role: functions callable, tables denied.

## Question sets

Two sets of 16. Set A: everyday moments. Set B: more concrete, slightly cheekier. The set is fixed when a building is first created, alternating A/B by creation order (`pulse_buildings.question_set`), so everyone at one address answers the same set. No user-facing selector. Both sets share the same dimension order, which the confirm-link path relies on.

## Backend (Supabase prod `lipwcsihcxndwwgzhiia`)

Migrations applied 6 Sep: `0010_building_pulse`, `0010b_building_pulse_digest_fix`, `0011_pulse_email_to_count_and_strata`, `0011b_pulse_trim_email`, `0012_pulse_short_confirm_codes`. Repo carries `0010` in full and `0011`, `0012` as record stubs.

Tables: `pulse_buildings` (slug, name, question_set, response_count, sums jsonb, counts jsonb), `pulse_tokens` (legacy, unused since 0011), `pulse_confirm` (token, code, building_id, email_hash, notify, used_at), `pulse_voters`, `pulse_notify`, `pulse_sends`.

Public functions (anon + authenticated): `pulse_start(name)`, `pulse_building(id)`, `pulse_confirm_code(code, scores)`, `pulse_notify_me(id, email)`. Internal (service role only): `pulse_request_confirm`, `pulse_fold`, `pulse_submit` (superseded), `pulse_slug`.

Edge function `pulse-mail` v1.3, `verify_jwt=false` (anonymous callers; re-checks state through `pulse_building` with the service role). Actions: `confirm`, `ready`, `committee`. Sends from `portrait@send.nalohub.com` via the existing `RESEND_API_KEY`. The "pulse" name in table, function and edge-function identifiers is the original working name and was kept to avoid a rename migration; everything user-facing says Building Portrait.

## Frontend

Single file `portrait/index.html` on the marketing site (cPanel `public_html/portrait/`). Inter from Google Fonts; qrcodejs from cdnjs for the A5 lift poster. Calls PostgREST RPC and the edge function directly with the publishable key; no supabase-js. Logo is the hosted `NaloHub-Logo.png` rendered for the dark page with `filter: invert(1) hue-rotate(180deg)`; the poster uses the original on white.

URL forms:
- `/portrait/` start
- `/portrait/?b=<slug>` joins that building (share link, poster QR)
- `/portrait/?b=<slug>&view=building` opens the building view if ready
- `/portrait/?k=<8-char code>-<16 digits>[n][s]` the emailed one-tap confirmation; answers ride in the link
- `/portrait/?b=<slug>#r=<16 digits>[n][s]` the person's private "keep this portrait" link

Share message: "I just answered sixteen quick questions about living at [building]. It draws a portrait of our building and what we could consider trying next. We need eight of us before it shows the whole building. Three minutes, no names, nobody sees anyone's answers."

## Known trade-offs and follow-ups

- Five free-tool filenames were inferred, not confirmed: 03, 10, 11, 13, 17. Greg checked several links on 6 Sep and they opened; confirm the rest as they appear.
- Not on the free-tools page or in the sitemap yet; request indexing once linked.
- Watch `pulse_buildings` for junk addresses in the first fortnight.
- Consider a "results for your building" nudge into NaloHub onboarding once a building reaches eight.

---

## Entry for ARCHITECTURE.md

Paste into §3 (repository layout) under `supabase/migrations/`: `0010_building_pulse.sql`, `0011_pulse_email_to_count_and_strata.sql`, `0012_pulse_short_confirm_codes.sql` (Building Portrait; 0011 and 0012 are record stubs). Under `supabase/functions/`: `pulse-mail` (stub; deployed source is in Supabase).

Paste into §8 (Supabase):

- **Building Portrait (6 Sep 2026).** Free public tool at nalohub.com/portrait, a static page on the marketing site talking straight to PostgREST and one edge function. Tables `pulse_buildings`, `pulse_confirm`, `pulse_voters`, `pulse_notify`, `pulse_sends` (plus legacy `pulse_tokens`), RLS on with no policies and all grants revoked; access only through SECURITY DEFINER functions granted to anon. No individual answers are ever stored: they travel in the person's links and are folded into per-building totals on email confirmation. One email = one response per building. Group view gated at 8 in `pulse_building()`. Edge function `pulse-mail` (`verify_jwt=false`, sends from `portrait@send.nalohub.com`). Full record: `claude_BUILDING_PORTRAIT.md`.

Paste into §11 (recent history), above v0.31.3:

- **Building Portrait (6 Sep 2026, outside the app):** free public tool at nalohub.com/portrait. Migrations 0010 to 0012, edge function `pulse-mail`, page on cPanel. No change to the resident portal app or its version.

## Entry for FEATURE_REGISTER.md

Built in the last 4 weeks:

**Building Portrait (free tool, nalohub.com/portrait), 6 September 2026.** "What type of building do you live in?" Sixteen slider questions light up a drawing of the person's building. They get a portrait, a name for their building, an honest area-by-area read, and six things worth trying, most of which a resident can do without asking anyone, with links to the free tools. Once eight neighbours have answered (each confirmed by one tap on an email, so nobody can answer twice), everyone who took part sees the whole building's portrait. Nobody sees anyone's answers. The committee can be sent the portrait, or not; residents decide. NaloHub is named once, as a labelled option among the suggestions.

Story at a glance, add: 6 Sep 2026, Building Portrait launched as the first interactive free tool, designed to reach residents rather than committees and to make committees a recipient rather than a gate.
