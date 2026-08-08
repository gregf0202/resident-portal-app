# NaloHub — Feature Register

*The running record of what NaloHub does, what's just been built, and what's on the
horizon. Written for people, not developers — one line per feature, no jargon.*

**Last updated: 8 August 2026** · Maintained at every stage of development.

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

## 2 · Built in the last four weeks *(mid July → 8 August 2026)*

- **Getting Started tracker** *(22 July, v0.21)* — the committee's shared, live launch checklist: 8 phases, 53 steps, clear owners (Admin / Champion / Committee), optional and N/A marks, per-step notes, a progress bar and phase timeline, and a one-tap progress summary to share. Launch timing stays entirely the committee's call; ticking the final gate marks the building launched.
- **Be In the Nalo — welcome & recognition, Phase 1** *(22 July, v0.21)* — the warmth layer: a personal welcome on first sign-in; a live "% of the building aboard" meter with milestone celebrations; badges as little thank-yous (Founding Resident, Explorer, Settled In) earned through the first-week guide; and two-tier controls — a committee-wide Community setting (Full / Gentle / Essentials) and each resident's own Celebrations dial. Gratitude and belonging, never pressure.
- **Minute-ready Maintenance Report** *(late July, v0.22)* — pick a period on the Reports screen and download a Word document ready to table in the minutes: KPI tiles (including average days to resolve), an "open issues for the committee's attention" section, and every issue's full story — updates, quotes, approved works, the workflow trail and the committee's decision.
- **Historical maintenance entry** *(late July, v0.22)* — the building manager or committee can load past jobs with their true dates (backdated "reported on", straight-to-resolved), so the register and its aging figures are honest from day one.
- **Sensible upload limits** *(early August)* — file uploads capped at 5MB, with photos compressed automatically so phone snaps just work.
- **NaloHub Guides** *(5 August, v0.23)* — eight step-by-step guides for the tasks that matter most, built to make every new user comfortable fast. Each guide exists as ONE asset with two faces: an in-app guide drawer you use *with the screen open* — numbered steps naming the exact buttons, a "you'll know it worked when…" checkpoint on each, a "Show me" that highlights the real button, and tick-off progress that survives interruptions — and a matching branded, dated, one-page printable cheat sheet ("Free to copy, print and share"). Guides are role-aware (each person sees only their own), reachable from Help → Guides and a "Step-by-step" pill on the relevant screens. The eight: get in & save NaloHub to your phone (the magic-link story) · record a maintenance issue & send it to vote · export the Maintenance Report for a meeting · run a building walk-through & share it · check an alert, review a motion & vote · bring your neighbours aboard · work the Compliance Calendar · post an announcement.

- **Guides for everyone — sectioned library** *(6 August, v0.24)* — twelve more guides, most of them for ordinary residents, so the library stops reading as committee homework: report a problem & watch it get fixed · book the BBQ or apply for a pet/reno/permit · find any building document in seconds · message your committee or manager · choose what your neighbours can see (privacy switches) · join in (events, marketplace, gallery) · post an event & manage RSVPs · Ask Nalo (what to ask and how to read the answers) · plus, for the committee and BM: set up the building's email address & file every reply · load your maintenance history with true dates · upload documents with the right visibility · log a complaint & keep a defensible, tribunal-ready record. The library is now sectioned — Getting started · Everyday living · Building manager · Committee engine room — and role-filtered, so a resident sees a tidy handful and never glimpses the committee machinery. Twenty guides, every one printable: the makings of a resident welcome pack.

- **Ask Nalo now answers from your building's own by-laws** *(8 August)* — until now NaloPilot knew the state's strata legislation and nothing about *your* building, which meant the By-Laws page quietly promised more than it delivered. Ask a question today and the answer draws on the building's own rules alongside the Act — "can I keep a cat?" gets your by-law, not just the general law. And strictly your building's: a resident is only ever answered from their own building's by-laws, enforced by the database itself rather than by the app remembering to be careful, because one building reading another's rules is not a mistake worth risking. Curve Birtinya is the first building with a real set loaded — all 38 of its by-laws, lifted off an 11-page scan, now live to its residents. The committee-facing upload and approval flow is the half still to come (see Near horizon).

**Companion (outside the app):** committee onboarding plan & printable launch tracker · resident launch plan (waves, Nalo Nights, value proposition) · welcome & recognition design spec · BM onboarding pathway & committee-member companion guides · **NaloHub Feature Map** *(6 August)* — the register reimagined as a visual, audience-sectioned asset: a stylised tower (committee room · plant room · the floors · the lobby · the foundations) with colour-dot overlays showing which groups each feature serves, in three synced formats — interactive web page (live at nalohub.com/features.html — the site's first content-rich crawlable URL), plus matching A4 Word and PDF for proposals and printing.

---

## 3 · Considered & pending — for a later review

**Near horizon (specified, awaiting build)**
- **Bulk by-law upload** — today by-laws can only be added one at a time, typed or pasted, which is not a job a volunteer committee will ever finish. This replaces that: upload the document once, we pull out every by-law, and the committee checks the list and publishes. It's built for scanned documents, because that's what buildings actually have — Curve Birtinya's own by-laws arrived as an 11-page scan with no readable text in it, at 5.1 MB, which is over the app's upload limit; extracted, the same 38 by-laws are 46 KB. Three ways in: upload it; ask your strata manager (the wording written for you, sent from Correspondence so the reply lands on the record); or send it to us and we'll load it, with the committee still doing the final approval. Nothing reaches residents or NaloPilot until the committee approves it, and the approval is stamped with who and when, so the by-laws page can honestly say *"current as at"*. The single-by-law form stays, for the amendment passed at an AGM. Worked mock and full build spec exist (`bylaws-upload-mockup.html` and `BYLAWS_INGEST_PROCESS.md`, 8 Aug). **The NaloPilot half of this shipped on 8 August** — Ask Nalo now answers from a building's own by-laws, scoped so residents only ever see their own building's rules — and Curve Birtinya's 38 by-laws are loaded and live as the first real set; what remains to build is the committee-facing upload, review and approval flow.
- **Maintenance Report v2** — three cuts of data the report already holds: a "waiting on" field per open item, an "awaiting a committee decision — N items (with dates sent)" headline, and a period total for approved spend; summary page first, detail after. Worked mock exists (`Maintenance_Report_v2.pdf`, 4 Aug). Two data-model fixes ride along: exactly one ACCEPTED quote per item, distinct titles per item.
- **Recognition Phase 2** — activity badges (Loop Closer, Good Neighbour), reactions on notices, "seen by X residents" social proof, and a committee adoption pulse showing the launch working.
- **Suggestion loop** — "Suggest something" with a visible Suggested → Noted → Considered → Actioned trail, and "You asked, we did" announcements. The committee's one promise: answer everything.
- **Recognition Phase 3** — learning badges, resident anniversaries, richer belonging touches.
- **Second-tier guides** — proxy appointments remains the one deferred guide (Correspondence was promoted and built in v0.24). Sections have replaced the flat-list ceiling: the rule is now ~8 per section-view.

**Strategic concepts (decision briefs written, pilot recommended)**
- **"Know Your Building" learning game** — weekly 5-question quizzes built from the building's own by-laws: streaks, levels, badges, opt-in leaderboards, prize draws, and a building-wide "strata-savvy" meter. QLD-first pilot in the demo.
- **Strata micro-learning with certificates** — 5–10 minute modules ("How a motion works", "Levies & the budget") tied to the screen they explain, ending in a Certificate of Understanding. Deliberately not accredited.
- **Committee-training compliance rail** — be the rails, not the exam: track who's completed mandatory committee training (NSW first), deadline nudges, a certificate store, AGM-readiness checks and a removal-risk early warning; accredited delivery via a partner.
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
| Next | **Engage & educate** | Maintenance Report v2, Recognition Phase 2–3, suggestion loop, learning game, compliance rail |

---

*Maintained by Claude with Greg. Update triggers: any feature built, planned, or deferred —
the register is re-issued the same day.*
