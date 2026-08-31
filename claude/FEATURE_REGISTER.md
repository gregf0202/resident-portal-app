# NaloHub — Feature Register

*The running record of what NaloHub does, what's just been built, and what's on the
horizon. Written for people, not developers — one line per feature, no jargon.*

**Last updated: 30 August 2026** · Maintained at every stage of development.

> _**The master copy lives in the NaloHub Claude Project, at the root as `FEATURE_REGISTER.md`**
> — alongside `ARCHITECTURE.md` — so every new chat starts with the current feature story.
> The app repo keeps a mirror at `claude/FEATURE_REGISTER.md`; **edit the project copy, then
> copy it to the repo**, never the other way round. Whenever a feature is built, planned or
> deferred — in any conversation — an updated copy is issued to replace it, without being asked._

*(A dash of housekeeping: dates are shown where the record is certain; the foundation era
is listed in build order without invented dates.)*

---

## 1 · Core features — the foundation

Everything a building gets on day one. Listed in the order it was built.

**Getting in & getting around**
- **Magic-link sign-in** — no passwords; residents tap a link in their email and they're in.
- **Dashboard** — the building at a glance: weather, quick actions, what's on, and guides.
- **Guided tour & first-run guides** — role-tailored walkthroughs for committee, owners and tenants, which retire themselves once done.
- **Themes & building branding** — each building picks its look, logo and even renames menu sections to suit itself.
- **Add to home screen** — the portal behaves like an app on any phone.

**Everyday resident life**
- **Announcements** — building notices, pinnable, with expiry dates, formal notice types (e.g. Notice of AGM), targeting to all residents / owners / specific people — and real email to residents alongside the in-app notice.
- **Alerts** — every application, vote and issue lands in one feed the moment it happens.
- **Maintenance reporting** — snap it, send it, and watch the repair progress (Reported → Seen → Underway → Done).
- **Applications & Bookings** — BBQ, visitor parking and shared spaces; plus pet, renovation and parking applications with printable permits.
- **Events** — building social calendar with RSVPs.
- **Gallery** — the building's shared photo wall.
- **Marketplace** — neighbour-to-neighbour buy/sell.
- **Messaging** — residents message the committee or manager without hunting for an email address.
- **Directory** — opt-in resident directory, with privacy switches each person controls.
- **Business Directory** — trusted local trades and services, recommended by neighbours.
- **Documents** — by-laws, insurance, minutes and budgets, findable in seconds with visibility controls.
- **Fire Safety** — emergency contacts, safety notes and the building's evacuation plan, front and centre.
- **WhatsApp link** — one tap from the portal into the building's existing group chat.

**Committee engine room**
- **Unit Search** — the 30-second unit health check: owners, tenants, pets, vehicles, keys and history.
- **Voting** — motions decided on phones with comments, automatic majorities, an audit trail, and signable proxy forms.
- **Meetings** — agendas, minutes, motions and attendance in one place.
- **Maintenance Workflow** — a repair run end-to-end: triage → quotes → recommendation → vote → contractor confirmed.
- **Approvals** — new residents and requests reviewed and decided in-app.
- **Action Register** — committee to-dos with owners, due dates and overdue flags.
- **Reports** — the numbers on how the building is running.
- **Registers** — Contracts, Contractors, Asset Register and Key & Fob Register, with expiry warnings before anything renews unnoticed.
- **Walk-Through** — the monthly inspection: tick the checklist, snap photos, export a Word report with evidence.
- **Correspondence Hub** — the building's own two-way email record with strata, insurers, solicitors, council and contractors, on one clean building address (e.g. seahaven@send.nalohub.com). Committee-only, append-only, tamper-evident, with an Unfiled tray for strays.
- **Compliance Calendar** *(premium)* — statutory deadlines with traffic lights, so nothing slips past quietly.
- **Dispute Records** *(premium)* — a tamper-evident, append-only record of complaints and their handling.
- **NaloPilot** *(premium)* — ask questions of strata legislation in plain English.
- **By-Laws** *(premium)* — the building's own rules, searchable.
- **Billing** — the building's plan and invoices, with card payment set-up.
- **Data export** — one tap exports everything the building owns; the building's records belong to the building.
- **Help hub** — themed plain-English Q&A with search, for when anyone gets stuck.

---

## 2 · Built in the last four weeks *(early August → 30 August 2026)*

- **Who maintains the unit register** *(30 August, v0.29)* — the building manager is usually the first to know a tenant has moved or a key has changed hands, but could only watch the register go stale. Now each committee decides for itself: one switch in Settings lets their building manager keep owners, tenants, pets, vehicles and keys current. Off by default, committee-controlled, enforced by the database rather than by hiding buttons, and by-law breaches stay committee-only either way, because recording an allegation against a resident is a committee act rather than register upkeep.
- **Versioned Conditions of Approval** *(30 August, v0.29)* — the integrity fix for committee votes. Until now any committee member could add or remove Conditions of Approval on an open motion at any moment, including after four of six had already voted, with nothing recording who changed what: a member could vote yes on five conditions and the motion pass on three. Now conditions are versioned and a vote only ever counts against the version its voter saw. The inline add and remove are gone, replaced by **Amend**: any BCC member, reason mandatory. Saving snapshots the outgoing conditions and every vote cast against them into the motion's history, bumps the version, sets those votes aside (kept on the record, never erased) and re-alerts every BCC member to vote again on what they can now see. The card shows the version, the tally says which version it counts, and an **Amendment history** panel gives each change with a strike-through diff, who, when, why, and every vote set aside with how it was cast. When the motion passes, the winning version binds and the decision names it.
- **Disputes finally reach the unit they concern** *(30 August, v0.29)* — the Disputes section in Unit Search has been decorative since it was built: nothing ever wrote the unit against a dispute, so it could never populate for any unit in any building. Complaints now carry a lot in both directions, logged from the unit or picked from a list when logging a complaint, and a unit's history finally shows what has been raised about it.
- **A full audit pass** *(31 August, v0.29.2)* — after a morning of bugs surfacing one at a time, the whole app was put through a systematic review rather than more spot checks: every one of the 34 screens rendered for all five roles in both demo and live modes (245 renders), every button on every screen clicked from a clean start (1,058 clicks), every text field typed into character by character (285 fields), and fifteen cross-role journeys run on a shared record so one person's action had to arrive on another person's screen. Three real faults came out of it and are fixed. Unit Search's new "Log a dispute" would have failed on the demo, because it called a function the demo has no answer for. In Documents, the per-file "Release" control sat inside the button for the whole row, which is invalid and makes clicks land on the wrong thing; the row is now reachable by keyboard as well. And three buttons did nothing at all when a field was missing: sending a message without a subject, requesting a booking without a date, and filing a document without a file or category. A resident could write their message, tap Send, and get silence. All three now say what is missing, and a message with no body is no longer accepted. Also confirmed working end to end: a reported repair through triage, quote, recommendation and on to an open motion in Voting; the Word report and CSV exports producing real files; and every role being turned away from the screens they should not reach.
- **Unit Search you can browse** *(30 August, v0.29.1)* — Unit Search assumed you already knew a unit number: it opened on an empty box, offered a row of bare numbers at best, and told you nothing about who lives where. Worse, that row sat behind a check for a live database connection, so on the demo it never appeared at all and a first-time visitor had nothing to click. It now opens on the whole building: every unit listed with its owners, whether it is tenanted and who the tenant is, and small markers for pets, vehicles, keys, a managing agent and unit notes. The search box filters that list as you type, by unit number **or resident name**, and a name matching a single unit opens it. You can find the building's cat owner without knowing a single lot number.
- **A demo building with people in it** *(30 August, v0.29)* — the demo had three lots and four residents, which made Unit Search look like a sample rather than a product. It now carries nineteen lots and thirty-four owners and tenants, with the texture a real building has: co-owners and co-tenants, non-resident investor owners, emergency contacts, managing agents on the tenanted lots, pets including an assistance dog, twenty-two vehicles with bays, twenty-eight keys and fobs including one lost and one returned, three by-law breaches at different stages, past tenants who have moved out, unit notes, and app-account badges (including one amber "possible match" so the distinction is visible). All invented, all plausible.
- **Fields you can actually type in** *(30 August, v0.29)* — a long-standing bug in three places at once: the panel holding the field was rebuilt from scratch on every keystroke, so the box lost focus after a single character and you had to click back in for each letter. It affected editing any unit record, every text box on a motion (comments, questions, and the new amendment reason), and adding or editing an asset. All three fixed, with a regression test that types letter by letter rather than just checking the box appears.
- **Unit Search becomes editable, and knows who has an app account** *(30 August, v0.29)* — the register was add-only: nothing in the app could fix a typo, retire a key or record that a tenant had left. Now every person, pet, vehicle, key and breach has a pencil and a remove, and the unit itself can be edited (lot number, parking spaces, and a new **Unit notes** card, committee and building manager only, which is where a building's imported history finally becomes readable). Owners and tenants are never deleted: **Moved out** archives them with a date and they reappear under "Previously at this unit", restorable in one tap, so the building can still answer "who lived here in 2024?". Adding a new owner or tenant offers to mark the current one as moved out, unticked by default, because co-owners and co-tenants are normal. And the register now recognises its own residents: someone who also signs in to NaloHub carries a green **App account** badge, matched on email, instead of being listed twice; a same-unit name match with a different email shows amber as a **Possible app account** for the committee to confirm rather than being silently merged. App members whose account names a unit but who aren't on the register get their own section with a one-tap "add to register". Emergency contacts and property managers are visible at last, under **Other contacts** — they could always be stored, but nothing displayed them.
- **Curve Birtinya bulk import from the building manager's register** *(30 August, data only, no app release)* — the whole BM spreadsheet (Residents_08_2026.xlsx) loaded straight into Curve Birtinya's unit registry in one go: 56 units, 125 people (88 owners, 25 tenants with a primary tenant contact marked, 12 emergency contacts), 82 vehicles, 11 pets, 230 keys and fobs recorded against their unit, 4 by-law breaches, and managing agent details on 12 tenanted units. Landlines, committee roles and the BM's running notes were kept rather than dropped (person notes and unit notes), every record is tagged "Imported from BM register Aug 2026", and the import wrote an audit entry. Nobody was invited or emailed: the registry is populated, the invitations are a separate step for the committee to take when ready. Two follow-ups: a "Unit notes" card in Unit Search so the imported BM notes are visible (data is stored, display pending), and a general-purpose import tool so the next building does not need Claude at the keyboard.
- **Maintenance Report v2** *(late August, v0.26)* — the report now opens on a summary page: five tiles (including approved spend this period), an amber "waiting on your decision" panel with the dates each item was sent, a waiting-on breakdown, and the oldest open item; detail grouped by what each job is waiting on, resolved items as a compact table. Each maintenance item gains a "Waiting on" button row so the report reads truthfully. Exactly one accepted quote per item, and a nudge when two items share a title. Tested on Demo and Live.
- **Set up by, and Export everything** *(late August, v0.27)* — the building record now says who established it, when, and who funds it, on the committee dashboard and in Settings, with committee-only changes recorded as append-only novations. Beside it, "Export everything": the full record in one download, with a visible log of who exported and when. The proof behind *Your Building, Your Records*. Tested on Demo and Live.
- **Getting Started tracker** *(22 July, v0.21)* — the committee's shared, live launch checklist: 8 phases, 53 steps, clear owners (Admin / Champion / Committee), optional and N/A marks, per-step notes, a progress bar and phase timeline, and a one-tap progress summary to share. Launch timing stays entirely the committee's call; ticking the final gate marks the building launched.
- **Be In the Nalo — welcome & recognition, Phase 1** *(22 July, v0.21)* — the warmth layer: a personal welcome on first sign-in; a live "% of the building aboard" meter with milestone celebrations; badges as little thank-yous (Founding Resident, Explorer, Settled In) earned through the first-week guide; and two-tier controls — a committee-wide Community setting (Full / Gentle / Essentials) and each resident's own Celebrations dial. Gratitude and belonging, never pressure.
- **Minute-ready Maintenance Report** *(late July, v0.22)* — pick a period on the Reports screen and download a Word document ready to table in the minutes: KPI tiles (including average days to resolve), an "open issues for the committee's attention" section, and every issue's full story — updates, quotes, approved works, the workflow trail and the committee's decision.
- **Historical maintenance entry** *(late July, v0.22)* — the building manager or committee can load past jobs with their true dates (backdated "reported on", straight-to-resolved), so the register and its aging figures are honest from day one.
- **Sensible upload limits** *(early August)* — file uploads capped at 5MB, with photos compressed automatically so phone snaps just work.
- **NaloHub Guides** *(5 August, v0.23)* — eight step-by-step guides for the tasks that matter most, built to make every new user comfortable fast. Each guide exists as ONE asset with two faces: an in-app guide drawer you use *with the screen open* — numbered steps naming the exact buttons, a "you'll know it worked when…" checkpoint on each, a "Show me" that highlights the real button, and tick-off progress that survives interruptions — and a matching branded, dated, one-page printable cheat sheet ("Free to copy, print and share"). Guides are role-aware (each person sees only their own), reachable from Help → Guides and a "Step-by-step" pill on the relevant screens. The eight: get in & save NaloHub to your phone (the magic-link story) · record a maintenance issue & send it to vote · export the Maintenance Report for a meeting · run a building walk-through & share it · check an alert, review a motion & vote · bring your neighbours aboard · work the Compliance Calendar · post an announcement.

- **Guides for everyone — sectioned library** *(6 August, v0.24)* — twelve more guides, most of them for ordinary residents, so the library stops reading as committee homework: report a problem & watch it get fixed · book the BBQ or apply for a pet/reno/permit · find any building document in seconds · message your committee or manager · choose what your neighbours can see (privacy switches) · join in (events, marketplace, gallery) · post an event & manage RSVPs · Ask Nalo (what to ask and how to read the answers) · plus, for the committee and BM: set up the building's email address & file every reply · load your maintenance history with true dates · upload documents with the right visibility · log a complaint & keep a defensible, tribunal-ready record. The library is now sectioned — Getting started · Everyday living · Building manager · Committee engine room — and role-filtered, so a resident sees a tidy handful and never glimpses the committee machinery. Twenty guides, every one printable: the makings of a resident welcome pack.

- **Ask Nalo now answers from your building's own by-laws** *(8 August)* — until now NaloPilot knew the state's strata legislation and nothing about *your* building, which meant the By-Laws page quietly promised more than it delivered. Ask a question today and the answer draws on the building's own rules alongside the Act — "can I keep a cat?" gets your by-law, not just the general law. And strictly your building's: a resident is only ever answered from their own building's by-laws, enforced by the database itself rather than by the app remembering to be careful, because one building reading another's rules is not a mistake worth risking. Curve Birtinya is the first building with a real set loaded — all 38 of its by-laws, lifted off an 11-page scan, now live to its residents. The committee-facing upload and approval flow is the half still to come (see Near horizon).

**Companion (outside the app), planned:** **Records Literacy one-pager** *(next free tool, agreed 22 Aug)* — "Who owns your building's information?" in the house style of the existing seventeen free tools: what the record is, who holds it by law in each state, what to ask for at handover, and the four questions to put to any manager.

**Companion (outside the app):** committee onboarding plan & printable launch tracker · resident launch plan (waves, Nalo Nights, value proposition) · welcome & recognition design spec · BM onboarding pathway & committee-member companion guides · **NaloHub Feature Map** *(6 August)* — the register reimagined as a visual, audience-sectioned asset: a stylised tower (committee room · plant room · the floors · the lobby · the foundations) with colour-dot overlays showing which groups each feature serves, in three synced formats — interactive web page (live at nalohub.com/features.html — the site's first content-rich crawlable URL), plus matching A4 Word and PDF for proposals and printing.

---

## 3 · Considered & pending — for a later review

**Near horizon (specified, awaiting build)**
- **General-purpose bulk import (sheet per table)** — the Curve import was run by hand against the database. Turn it into something a committee or building manager can do themselves: upload a workbook of units, people, vehicles, pets, keys, breaches, agents and notes, preview what will change, then commit. Scoped 1 to 2 days. The Curve staging workbook is the working spec.
- **Bulk by-law upload** — today by-laws can only be added one at a time, typed or pasted, which is not a job a volunteer committee will ever finish. This replaces that: upload the document once, we pull out every by-law, and the committee checks the list and publishes. It's built for scanned documents, because that's what buildings actually have — Curve Birtinya's own by-laws arrived as an 11-page scan with no readable text in it, at 5.1 MB, which is over the app's upload limit; extracted, the same 38 by-laws are 46 KB. Three ways in: upload it; ask your strata manager (the wording written for you, sent from Correspondence so the reply lands on the record); or send it to us and we'll load it, with the committee still doing the final approval. Nothing reaches residents or NaloPilot until the committee approves it, and the approval is stamped with who and when, so the by-laws page can honestly say *"current as at"*. The single-by-law form stays, for the amendment passed at an AGM. Worked mock and full build spec exist (`bylaws-upload-mockup.html` and `BYLAWS_INGEST_PROCESS.md`, 8 Aug). **The NaloPilot half of this shipped on 8 August** — Ask Nalo now answers from a building's own by-laws, scoped so residents only ever see their own building's rules — and Curve Birtinya's 38 by-laws are loaded and live as the first real set; what remains to build is the committee-facing upload, review and approval flow.
- **Recognition Phase 2** — activity badges (Loop Closer, Good Neighbour), reactions on notices, "seen by X residents" social proof, and a committee adoption pulse showing the launch working.
- **Suggestion loop** — "Suggest something" with a visible Suggested → Noted → Considered → Actioned trail, and "You asked, we did" announcements. The committee's one promise: answer everything.
- **Recognition Phase 3** — learning badges, resident anniversaries, richer belonging touches.
- **Second-tier guides** — proxy appointments remains the one deferred guide (Correspondence was promoted and built in v0.24). Sections have replaced the flat-list ceiling: the rule is now ~8 per section-view.

**Strategic concepts (decision briefs written, pilot recommended)**
- **"Know Your Building" learning game** — weekly 5-question quizzes built from the building's own by-laws: streaks, levels, badges, opt-in leaderboards, prize draws, and a building-wide "strata-savvy" meter. QLD-first pilot in the demo.
- **Strata micro-learning with certificates** — 5–10 minute modules ("How a motion works", "Levies & the budget") tied to the screen they explain, ending in a Certificate of Understanding. Deliberately not accredited.
- **Committee-training compliance rail** — be the rails, not the exam: track who's completed mandatory committee training (NSW first), deadline nudges, a certificate store, AGM-readiness checks and a removal-risk early warning; accredited delivery via a partner.
- **Your Building, Your Records** *(named core proposition, 22 Aug)* — elevated to sit second only to "calm" in all positioning; headline unchanged. Jurisdictional leads: NSW sells on exposure (s106 six-year window, Fair Trading powers, s180/s181 records duties), QLD on handover pain, VIC on the statutory review. Product backing: Set up by + Export everything above. Global expansion (NZ first, then England and Wales on commonhold passage, then Ontario/BC) parked until a second Australian building is live.
- **BM edition** — the same building, fewer doors open: a building-manager-led deployment shape (BM + read-only committee) with visible, labelled, locked governance features as the upgrade path.

**Banked ideas (parked, revisit when the time's right)**
- Head-to-head quiz duels and floor-vs-floor rivalries · new-resident welcome quest · seasonal challenges (pre-AGM sprint, Fire Safety Fortnight) · resident-sourced quiz questions · multilingual modules · NaloPilot "quiz me / explain this by-law" tie-in.
- Full building compliance calendar expansion (committee training as the wedge) · new-committee induction pack · strata-manager portfolio compliance view (B2B).
- "Certified Strata-Savvy Building" kitemark · knowledge-gap analytics for the committee · sponsored expert modules · agent "strata welcome pack".
- Wave-two resident modules per building as launches mature (bookings, applications, gallery switched on post-launch).

---

## 4 · The story at a glance (secondary view)

| Era | Theme | What arrived |
|---|---|---|
| Foundation | **Run the building** | Sign-in, dashboard, announcements, maintenance, bookings & applications, documents, fire safety, community spaces (events, gallery, marketplace, messaging, directories) |
| Foundation | **Empower the committee** | Unit Search, voting & proxies, meetings, maintenance workflow, approvals, actions, reports, the registers, walk-throughs, billing, data export |
| Foundation | **Protect & inform** *(premium)* | Compliance Calendar, Dispute Records, NaloPilot, By-Laws |
| Early July | **Own the record** | Correspondence Hub — the building's tamper-evident external-email memory |
| Mid July | **Reach every resident** | Emailed notices, one clean building address, live two-way email |
| 22 July | **Launch & belong** | Getting Started tracker + the Be In the Nalo welcome/recognition layer |
| Late July | **Prove the work** | Minute-ready Maintenance Report + historical entry — the BM's evidence, on one button |
| 5 August | **Make it easy** | NaloHub Guides — eight in-app walkthroughs with matching printable cheat sheets |
| 6 August | **Easy for everyone** | Guides grow to twenty — resident guides + sectioned, role-aware library · Feature Map live at nalohub.com/features.html |
| 8 August | **Answer from your own rules** | Ask Nalo reads the building's by-laws as well as the Act — Curve's 38 loaded and live |
| 22 August | **Own the record, named** | *Your Building, Your Records* elevated to core proposition; Set up by + Export everything planned; Records Literacy one-pager queued |
| Late August | **Prove the record** | Maintenance Report v2 (v0.26) · Set up by + Export everything (v0.27) |
| 30 August | **Load the whole building** | Curve Birtinya's full BM register (56 units, 125 people, 230 keys, 82 vehicles) imported in one transaction; nobody invited yet, everything on the record |
| 30 August | **Keep it true** | v0.29: Unit Search editable (corrections, move-outs that archive, unit notes, App account badges) · versioned Conditions of Approval · disputes reach their unit · the committee decides whether the BM maintains the register |
| Next | **Engage & educate** | Recognition Phase 2–3, suggestion loop, learning game, compliance rail |

---

*Maintained by Claude with Greg. Update triggers: any feature built, planned, or deferred —
the register is re-issued the same day.*
