# NaloHub — App Architecture Baseline

> Living reference for the NaloHub resident-portal app. **Read this at the start of any
> work session; update it in the same commit whenever the architecture changes.**
> Last updated: 2026-08-08 · App version: v0.25.0 (By-law display fixes + NaloPilot reads the building's by-laws). Nothing pending.
> Note: v0.22.0 (minute-ready Maintenance Report + historical maintenance entry) and the
> 5MB upload cap shipped without a doc update — both are now recorded below.
>
> _A synced copy of this doc lives in the NaloHub Claude Project so every new chat starts
> with current context._

---

## 1. What this is

NaloHub is a private resident portal for apartment buildings and body-corporate
communities — committees, owners, tenants, building managers and strata managers.
This repo (`resident-portal-app`) is the web app. It ships as two things from one codebase:

- **Production app** — real users, real data, Supabase backend.
- **Demo** (`demo.nalohub.com`) — the same UI running on seeded in-memory sample data,
  no backend, so anyone can explore every feature. Everything built for the app appears
  in the demo automatically.

The marketing site (`nalohub.com`) is **separate** — a static site on cPanel/Uptime Web
Hosting, not part of this repo.

---

## 2. Stack

- **Build:** Vite 5 + `@vitejs/plugin-react` (config is minimal — `vite.config.js`).
- **UI:** React 18, Tailwind (via CDN in `index.html`), `lucide-react` icons.
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions).
- **Docs/exports:** `jspdf` (invoices/permits), `docx` (Word exports).
- **Email (correspondence & auth):** Resend, via Supabase Edge Functions.
- **Hosting:** Netlify (two sites — see §7). Marketing site on cPanel/Uptime.

---

## 3. Repository layout

Canonical repo folder on Greg's Mac:
`~/Documents/Apps/Resident App/App Code/resident-portal-app 5` — **this is the one with
`.git`** and remote `github.com/gregf0202/resident-portal-app` (branch `main`).

> ⚠️ There are several near-duplicate copies alongside it (`resident-portal-app`,
> `… 2`, `… 3`, `… 4`, `resident-portal-app-220626`). Only **`resident-portal-app 5`**
> is the live repo. The others are stale copies and should be cleaned up to avoid editing
> the wrong one. Stray uncommitted files in the repo (`esb1.txt`, `esb2.txt`, `index.ts`,
> `*.bak-preATH`) are leftovers and safe to ignore/remove.

Key files:

| Path | Role |
| --- | --- |
| `src/main.jsx` | Entry. Renders **prod** (`App.jsx`) or **demo** (`ResidentPortal.jsx`) based on `VITE_DEMO_MODE`. |
| `src/App.jsx` | **Production shell.** Supabase auth, loads real data via `db.js`, provides context with `backend: true`, renders `<BuildingApp/>`. |
| `src/ResidentPortal.jsx` | **The whole UI (~520 KB, single file)** + the **demo app** default export. All screens, `NAV`, `ViewRouter`, `AppCtx`/`useApp`, theme live here. Exports `AppCtx, BuildingApp, Toast, themeById` for `App.jsx`. |
| `src/db.js` | **Data layer.** Real Supabase functions for prod; a `if (DEMO_MODE)` block rebinds them to an in-memory seeded dataset (`DS`) for the demo. |
| `src/supabaseClient.js` | Creates the Supabase client from env vars (placeholders in demo). |
| `src/billing.js`, `invoicePdf.js`, `csv.js`, `theme.js`, `styles.css` | Billing, PDF/Excel/CSV export, theming. |
| `src/components/` | `SignIn`, `PlatformConsole`, `AddToHomeScreen`, `GuidedTour`, `AnimatedHeader`, `BillingPanel`, `ui.jsx`. |
| `supabase/migrations/` | `0001_correspondence_hub_foundation.sql`, `0002_correspondence_rls_recursion_fix.sql`. |
| `supabase/functions/` | `send-correspondence`, `receive-correspondence`, `maintenance-reminders` (Deno edge functions). |
| `netlify.toml` | Build (`npm run build` → `dist`) + SPA redirect. |
| `.env.example` | Template for `.env` (never commit real `.env`). |

---

## 4. The two-app model (important)

There is **one UI, two wrappers**:

- `ResidentPortal.jsx` holds every screen and the `AppCtx` React context. Its **default
  export is the demo**: it builds an in-memory store of SeaHaven sample data, sets
  `backend: false`, and includes the **"Viewing as" PreviewSwitcher** so you can see the
  portal through any role.
- `App.jsx` is **production**: it imports `BuildingApp` (and `AppCtx`, `Toast`,
  `themeById`) from `ResidentPortal.jsx`, wires real Supabase auth/data, and provides
  `backend: true`.

**Consequence for edits:** changing a screen/component in `ResidentPortal.jsx` (e.g.
`CorrespondenceView`, `NAV`) affects **both prod and demo** — they share that code.
Changes inside `db.js`'s `if (DEMO_MODE)` block affect **only the demo**. The real,
Supabase-backed `db.js` functions serve prod.

The `backend` flag (from `useApp()`) is how shared components tell the two apart at
runtime: `backend === true` = production (real data, live email); `backend === false` =
demo (seeded data, simulated actions). `DEMO_MODE` in `db.js` is the data-layer twin,
true when `VITE_DEMO_MODE=true` **or** no `VITE_SUPABASE_URL` is set.

---

## 5. Roles & access model

Roles live on the user record: `admin`, `bcc` (committee), `manager` (building manager),
`strata` (strata manager), `owner`, `tenant`. Plus a boolean `msc` (maintenance
sub-committee) flag on any user.

- `isCommittee(role)` = `role === "bcc" || role === "admin"`.
- Menu visibility is driven by each `NAV` entry's `show(role)` function, filtered in the
  nav rail; `strata` is additionally limited to dashboard/announcements/help.
- Committee-only screens guard **themselves** internally (e.g. `VotingView`,
  `CorrespondenceView`) because `ViewRouter` renders purely off the `view` state with no
  role check — so a role switch mid-screen must be caught by the view, not the router.

**Correspondence access** (single source of truth, top of `ResidentPortal.jsx`):

```js
const CORR_ALLOW_BM = true; // building manager sees Correspondence — flip to false to remove
const canSeeCorr = (u) => isCommittee(u.role) || (CORR_ALLOW_BM && u.role === "manager") || u.msc === true;
```

`canSeeCorr` gates both the `NAV` entry and the `CorrespondenceView` guard, so they can't
drift. Owners/tenants/strata get no access. **Restricted** threads are shown only to the
committee proper (`isCommittee`), mirroring the database RLS — the building manager and
MSC see ordinary committee threads but not restricted ones.

---

## 6. Correspondence Hub

The building's two-way record of external email (strata manager, insurer, solicitor,
council, auditor, contractor, agent). Committee/BM/MSC only; append-only and
tamper-evident at the database level.

- **Data:** tables `building_mailboxes`, `correspondence_contacts`,
  `correspondence_threads`, `correspondence_thread_members`, `correspondence_inbound_raw`,
  `correspondence_messages`, `correspondence_attachments` (migrations 0001/0002). RLS on
  all; messages append-only (soft-delete only, content-hashed).
- **Sending:** `sendCorrespondence()` → `send-correspondence` edge function (holds the
  Resend key + service role, re-checks committee membership). Reply-To is plus-addressed
  (`<slug>+<threadId>@send.nalohub.com`) so replies thread deterministically.
- **Receiving:** `receive-correspondence` edge function files inbound by token, then
  sender+subject, else into an **Unfiled tray** for one-click filing.
- **In the app:** `CorrespondenceView` in `ResidentPortal.jsx` (list, thread, compose,
  reply, contacts, unfiled). Reads via `db.js` `listCorrThreads/getCorrThread/…`.
- **In the demo:** `db.js` `DEMO_MODE` block seeds `DS.corr` (sample threads/contacts/
  unfiled) and simulates send/reply (with a fake auto-reply); a visible "Demo mode —
  simulated" banner sits atop the screen. No real email ever leaves the browser in demo.
- Full design/risk detail: `CORRESPONDENCE_UI_SESSION.md` in this repo, plus the
  `nalohub-correspondence-hub-spec` and `-cost-and-risk` docs in Greg's Drive.

---

## 7. Environments & deploy

**One repo, two Netlify sites, both auto-building from `main`:**

| Site | `VITE_DEMO_MODE` | Supabase env | Domain |
| --- | --- | --- | --- |
| Production app | not set (falsey) | real `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | *(app domain — confirm/fill in)* |
| Demo | `true` | none needed | `demo.nalohub.com` |

**Env vars** (`.env.example`): `VITE_SUPABASE_URL` = `https://lipwcsihcxndwwgzhiia.supabase.co`,
`VITE_SUPABASE_ANON_KEY` = publishable key. Local `.env` is git-ignored; never commit it.

**Deploy flow — the standard path (incremental, use this):**

```bash
cd "~/Documents/Apps/Resident App/App Code/resident-portal-app 5"
git add <changed files>          # stage only what you changed
git commit -m "clear message"
git push origin main             # Netlify auto-builds prod + demo
```

Netlify then builds both sites (`npm run build` → `dist`) and publishes in ~1–2 min.

> ⚠️ **Do not use `push-to-github.command`.** It's a stale v0.10.0 one-shot that runs
> `rm -rf .git` and `git push --force`, overwriting history. The incremental flow above
> is the correct one.
>
> ⚠️ **CDN cache:** Netlify can briefly serve a cached `index.html`, so a just-deployed
> change may not show until a hard refresh (Cmd+Shift+R) or a cache-busting query
> (`?cb=1`). If something "didn't deploy," check for cache before assuming a code problem.

---

## 8. Supabase

- Project **NaloHub (prod):** ref `lipwcsihcxndwwgzhiia`, region `ap-southeast-2`.
- Migrations applied to prod live in `supabase/migrations/`.
- **`documents_meta` view + `documents_preserve_file` trigger (migration 0005, APPLIED to prod
  1 Aug 2026).** `loadBuildingStore` now reads documents through `documents_meta`
  (`data - 'fileData'`, `security_invoker = true`, so the RLS on `documents` still governs who
  sees which row) — **opening a building never downloads file bytes.** `getDocumentFile(id)` in
  `db.js` fetches a single document's payload on demand when someone clicks it; the Documents
  screen and `FileChip` await it and show a "fetching…" state. Because `persistChange` upserts
  whole records, a BEFORE UPDATE trigger re-attaches `fileData` whenever an update omits it, so
  a metadata-only client can never blank a stored file (verified by test).
  Built because Curve Birtinya's 43 MB of base64 PDFs made that building effectively unopenable —
  see `INCIDENT_2026-08-01_CURVE_LOAD.md`. `document_blobs` is the temporary parking table from
  that incident; **migration 0006 restores those payloads and should be run once this frontend is
  deployed**, after which `document_blobs` can be dropped.
- **`gallery_meta` view + `gallery_preserve_image` trigger (migration 0007, APPLIED to prod
  1 Aug 2026).** Identical treatment for gallery photos, which are base64 data-URLs under
  `gallery.data.image` — a single Curve photo is 598 KB. The building load now carries captions,
  categories and dates only (`gallery_meta` is 230 bytes vs 598 KB for the table); the Gallery
  screen calls `getGalleryImages(buildingId)` on mount, one request for the whole building, and
  renders through a `src(g)` helper that prefers an image already in hand. Same preserve trigger,
  because editing a caption would otherwise write the photo away.
- Edge functions in `supabase/functions/` (Deno): `send-correspondence` (Resend send,
  `verify_jwt=true`), `receive-correspondence` (inbound webhook), `maintenance-reminders`,
  **`send-announcement`** (emails an announcement to the residents it targets, resolving
  recipients server-side from memberships; `verify_jwt=true`. **v2, 2026-07-20:** `reply_to`
  now routes to the building's inbox `<slug>@send.nalohub.com` so notice replies land in
  Correspondence, falling back to the committee email only if no mailbox exists), and
  **`ensure-mailbox`** (returns/creates a building's single clean public inbound address,
  e.g. `seahaven@send.nalohub.com`; committee-only; `verify_jwt=true`).
- ⚠️ **The repo's `supabase/functions/` is not the full source of truth.** Production actually
  runs ~12 functions (also `send-email`, `inbound-email`, `ingest-legislation`, `nalo-answer`,
  `permit-pdf`, `proxy-form-pdf`, `stripe-billing`, `stripe-webhook`, `billing-cron`) that live
  outside this repo folder. Deploy new functions with `supabase functions deploy <name>`
  (or the Supabase MCP). `send-announcement` was deployed to prod on 2026-07-19.
- **Inbound email is LIVE (verified 2026-07-19/20).** `send.nalohub.com` has Resend **Receiving**
  enabled (Tokyo `ap-northeast-1`); the MX is set at Uptime cPanel → `inbound-smtp.ap-northeast-1.amazonaws.com`
  (a subdomain MX, so it never touches `nalohub.com`'s own cPanel mail); the `email.received` webhook
  points at `.../functions/v1/receive-correspondence`. Any address `<local>@send.nalohub.com` is caught
  and filed to a building by matching the local part to a `building_mailboxes.slug` (plus-addressed
  `<slug>+<threadId>@` threads deterministically by the thread UUID, so a mailbox can be renamed without
  breaking old reply-tos). Confirmed working: real inbound emails thread into Correspondence / the Unfiled
  tray. **Prod SeaHaven's public address is `seahaven@send.nalohub.com`** (slug cleaned from the old
  `seahaven-c724de` on 2026-07-19).
- Secrets used by functions: `RESEND_API_KEY` (send), `RESEND_RECEIVE_KEY` (full-access, reads inbound),
  `RESEND_WEBHOOK_SECRET` (Svix signature), `CORR_MAIL_DOMAIN` (default `send.nalohub.com`).

---

## 9. Conventions & gotchas

- **Single big file:** almost the entire UI is in `ResidentPortal.jsx`. Edit it surgically
  (targeted `Edit`s); it's ~520 KB.
- **Verifying a build without polluting `node_modules`:** the Mac `node_modules` is macOS-
  native, so a Linux sandbox `npm run build` fails on `@rollup/rollup-linux-x64-gnu`. To
  verify: copy `src/`, `index.html`, `package.json`, `vite.config.js`, `public/` to a temp
  dir, `npm install`, then `VITE_DEMO_MODE=true npm run build`. Or a quick parse check with
  a standalone `esbuild.transformSync(code, { loader: "jsx" })`.
- **Never `select id, data` a content table that can hold base64 payloads.** `documents`,
  `gallery` and `buildings` all store files as data-URLs inside JSONB. One 20 MB scanned PDF in a
  building's documents adds ~20 s to that building's load *for every user, every visit* — and the
  failure mode is a silent bounce back to Your Buildings, not an error, so it doesn't look like a
  bug. Fetch metadata on load and file bytes on demand: `documents` goes through `documents_meta`
  + `getDocumentFile()` and `gallery` through `gallery_meta` + `getGalleryImages()` (§8).
  **`buildings.data.logoImage` is the last one left** (244 KB base64 PNG on Curve, `buildings`
  20 MB overall) — deliberately deferred, since it's one row per building and it's needed at
  first paint. Any *new* content table that can hold a data-URL must get the same treatment:
  add it to `HEAVY_TABLES` in `db.js` and give it a `_meta` view + preserve trigger.
- **Anything loaded metadata-only must be protected at the DB level**, because `persistChange`
  writes whole records back. See the `documents_preserve_file` trigger — without it, clicking
  Release on a document would have silently erased the file.
- **Upload limits live in `ResidentPortal.jsx` (`MAX_UPLOAD_MB` = 5).** Two different rules,
  because they solve different problems: **images are resized and re-encoded, never rejected**
  (`compressImage` → 1600 px max, JPEG q0.82; logos 512 px, PNG, alpha preserved), while
  **everything else is hard-capped at 5 MB**, since the browser can't compress a PDF. Use
  `readUpload(file, cb, flash)` for any file input and `readImage(file, cb, flash, opts)` for
  image-only ones — `readUpload` routes images through the compressor automatically. Both fall
  back to the original data-URL if re-encoding would make the file *bigger* (a real case: flat-
  colour PNG logos). Measured on live Curve data: gallery photo 584 KB → 71 KB (8.2×), building
  logo 238 KB → 34 KB (7×), both purely from PNG → JPEG at unchanged dimensions; a 12 MP phone
  photo loses a further ~6× to the 1600 px resize. Rationale for 5 MB: base64-in-JSONB inflates
  by 33%, so at a 5 MB average roughly 58 buildings fit the 8 GB Pro plan — at 10 MB it'd be ~11.
  The oversize message tells the uploader to re-scan at 150 DPI greyscale, which is the actual
  fix for the 20 MB scans that caused the 1 Aug incident.
- **Role checks belong in the view**, not the router (see §5).
- **JSX attribute strings do NOT interpret backslash escapes.** `sell="\u201C…"` renders the literal
  characters `\u201C`, not a curly quote (the backslash even looks like `|` in the app font). Use the
  actual character (`“` `”` `—`) inside a JSX attribute, or a `{"…"}` expression. Bug found & fixed in
  the Contractors `HowTo` `sell` on 2026-07-20.
- **Demo data** is defined in `db.js` under `if (DEMO_MODE)` — the `DS` object (units,
  people, applications, motions, contracts, correspondence, …). Add new demo data there so
  the demo mirrors new features.

---

## 10. Keeping this doc current (the contract)

When a change alters architecture — a new module/screen, a data-model change, an access
rule, an env var, a deploy detail, a new edge function — **update the relevant section of
this file in the same commit.** At the start of each work session, read this first so
context carries across sessions instead of being re-derived each time.

---

## 11. Recent history (high level)

- **v0.24.0 (current):** Guides for everyone — 12 new guides (7 resident-facing: report a
  problem, book/apply, find documents, message committee, privacy switches, join in,
  post an event; plus corr-email, maint-history, nalopilot, docs-upload, complaint) and a
  **sectioned library**: `GUIDE_SECTIONS` (Getting started · Everyday living · Building
  manager · Committee engine room), each guide carries `sec`, and both the drawer library
  and Help-hub grid render grouped. `VIEW_GUIDE` values may now be arrays; `GuideBar`
  picks the first guide whose `roles(user)` passes (e.g. documents → docs-upload for
  committee, find-docs for residents). Four new `data-guide` tags (Events Add, Documents
  Upload, Disputes Log a complaint, Correspondence New message); icons `PartyPopper`,
  `History` added to the lucide import. 20 guides total, all printable. `ResidentPortal.jsx`
  only.
- **v0.23.0:** NaloHub Guides — 8 role-aware task walkthroughs from ONE data
  source (`GUIDES` in `ResidentPortal.jsx`): an in-app guide drawer (bottom sheet on
  phones / right panel on desktop; the screen stays usable behind it) with per-step
  tick-off persisted in localStorage (`nalo_guide_<id>_<uid>`), "You'll know it worked"
  checkpoints, and a "Show me" that navigates + pulse-highlights the real button via
  `[data-guide]` / `[data-tour]` selectors — plus a branded printable A4 cheat sheet
  (`printGuide`, print window) rendered from the same data so app and paper can't drift.
  Entry points: Help hub "Guides" grid, a contextual "Step-by-step" pill on task screens
  (`GuideBar` via `VIEW_GUIDE`), all role-filtered. `HeaderAction` now forwards extra
  props (for `data-guide` tags). `ResidentPortal.jsx` only; no schema/db.js changes.
- **v0.22.x:** Minute-ready **Maintenance Report** (Word, date-range, KPI tiles, per-issue
  trail) on Reports; **historical maintenance entry** (backdated Reported on / straight-to-
  Resolved on, BM & committee only) on the Maintenance report form; file uploads capped at
  5MB with automatic image compression.
- **v0.21.0:** Getting Started — committee-gated launch tracker (8 phases / 53 steps,
  owners, N/A + notes, progress timeline, copyable committee summary; state on `building.onboarding`,
  final gate stamps `building.launchedAt`). Be In the Nalo Phase 1 — welcome banner, aboard meter
  with milestone toasts, badges (founding/explorer/settled) hooked into the first-week playbook;
  two-tier controls: committee `building.community` (full|gentle|essentials) × personal Celebrations
  (localStorage), more-restrictive wins. `ResidentPortal.jsx` only; no schema/db.js changes.
- **v0.20.0:** Feedback round — managing-agent add-CTA for leased/tenanted units (Unit
  Search); multi-recipient announcements (new `specific` audience + per-person picker, stored in
  `announcement.recipientIds`, filtered in `activeAnnouncements(store,bid,role,userId)`);
  generic **scheme / plan reference** field (`building.schemeRef`) in Setup + Settings (CTS/SP/OC);
  editable **Dashboard** label (added `dashboard` to `RENAMABLE`) + dashboard section reorder
  (Weather → Do something → Explore → first-week playbook → What's on); **document uploads on New
  Motion** (any file type, stored in `motion.details.attachments` as data-URLs, rendered on the
  motion card so they follow it); **Fire Safety evacuation plan** upload + prominent display
  (`building.evacPlan`); **Maintenance Workflow** progress bar + explicit "next step" guide
  (`MaintProgress` / `mwfStage`); and **header actions moved into the body** globally (the `Head`
  component now renders its `action` as a prominent solid button at the top of the content, and
  `HeaderAction` was restyled accordingly). No schema migrations — all new data rides existing
  JSONB (`buildings.data`, `announcements.data`, `motions.details`) via `persistChange`.
- **v0.19.0:** Correspondence Hub — committee UI (threads/compose/reply/contacts),
  inbound receiver, Unfiled tray, RLS recursion fix. Demo seeded with sample correspondence
  (simulated send/reply + "Demo mode" banner). Correspondence access gated to committee/BM/
  MSC with restricted-thread filtering and a `CORR_ALLOW_BM` toggle.
- Earlier: Unit Search, Applications & Bookings (pets/renovations/parking permits, permit
  PDFs), Voting, Maintenance Workflow, registers (Contracts/Contractors/Walk-Through),
  Word/Excel exports, dispute records, NaloPilot.

---

## Changelog

- **2026-08-08 (v0.25.1 — by-law hanging indent)** — `src/ResidentPortal.jsx` only. v0.25.0 put
  `white-space: pre-wrap` on by-law text, which keeps the leading spaces but lets *wrapped* lines
  fall back to the left margin — so "(a) …" began indented and its second line didn't. Replaced
  with a small `ByLawText` component that splits on newlines and renders each line as its own
  block, padded by `Math.round(leadingSpaces / 4) * 18px` (capped at 3 levels). Continuation lines
  now hang under the clause they belong to, and (i)/(ii) nest under (a)/(b). Used by both the
  By-Laws card and the NaloPilot by-law card. Blank source lines become 7px spacers. Demo + prod
  builds verified green.

- **2026-08-08 (v0.25.0 — by-law display fixes + NaloPilot answers from by-laws)** —
  `src/ResidentPortal.jsx` only; no `db.js`, schema or migration change. Found when Curve's
  38 real by-laws went in and the screen showed them jumbled, unnumbered and with every
  sub-clause run together.
  1) **Numbering.** By-laws now arrive in two shapes: added in-app they carry `num` (a
     number); bulk-loaded from a registered CMS they carry `number` (a string, verbatim as
     printed). `ByLawsView` and the NaloPilot answer card both rendered `b.num` only, so
     loaded by-laws showed a bare "By-law" chip. New module-level `blNum(b)` reads either,
     and `add()`'s `Math.max(...)` uses it so adding a by-law to a loaded set still works
     (it was producing `NaN`).
  2) **Order.** `bylaws` has no `ORDER BY` anywhere in the read path, so the list rendered in
     whatever order Postgres returned. `ByLawsView` now sorts with `blSort` (numeric, ascending).
  3) **Line breaks.** By-law text is stored with real newlines and indented sub-clauses; both
     render sites used a plain `<p>`/`<div>`, which collapses them. Added
     `whiteSpace: "pre-wrap"` to the By-Laws card and the NaloPilot by-law card.
  4) **NaloPilot now sends `buildingId`** to the `nalo-answer` edge function (v2, deployed
     2026-08-08). Previously the client matched by-laws locally and showed them as cards, but
     the *model's answer text* was written from legislation only, because the function never
     saw the by-laws. `NaloPilotView` passes `buildingId` through to `NaloPilotInner` and it
     goes in the invoke body. The function scopes by-laws with the caller's own JWT (see §9),
     so this cannot widen access.
  5) The By-Laws add-form helper line no longer claims bulk CMS upload exists — it points at
     `info@nalohub.com` until that flow ships.
  Demo + production builds both verified green.

- **2026-08-06 (v0.24.0 — Guides for everyone)** — `src/ResidentPortal.jsx` only. Twelve
  new `GUIDES` entries (res-maint · book-apply · find-docs · message · privacy · join-in ·
  events · corr-email · maint-history · nalopilot · docs-upload · complaint), all step
  labels verified against live buttons (incl. real maintenance stages New → Triaged →
  In progress → Resolved, Dispute entry kinds Update / Email or message / Document /
  From in-app messages, Documents visibility options, Events ⟨Post event⟩, Correspondence
  ⟨Unfiled⟩→⟨File⟩). Sectioned library via `GUIDE_SECTIONS` + `sec` per guide, grouped
  rendering in `GuideDrawer` and Help hub. `VIEW_GUIDE` supports arrays with role-based
  resolution in `GuideBar`. Four new `data-guide` tags; `PartyPopper`/`History` imports.
  PLATFORM 0.24.0. Demo + prod builds verified green.

- **2026-08-05 (XSS hardening — Correspondence, shipped with v0.23.0)** — The frontend half
  of the 5 Aug security review, folded into the v0.23.0 deploy so one commit carries both.
  New `htmlToText()` helper above `CorrespondenceView`; both inbound-email sinks now route
  through it: the on-screen thread render (was `dangerouslySetInnerHTML`, now plain text)
  and the print-thread path (HTML bodies converted to text, then escaped — `${esc(isHtml ?
  htmlToText(body) : body)}`). Zero `dangerouslySetInnerHTML` remains in the file. Verified:
  `<img onerror>`, `<svg onload>` and `<script>` payloads neutralised; builds green. The
  three backend fixes from the same review were already live in Supabase. Behaviour change:
  HTML-only inbound emails display as clean plain text.

- **2026-08-05 (v0.23.0 — NaloHub Guides)** — One change, `src/ResidentPortal.jsx` only.
  New Guides module inserted before `DemoOnly`: `GUIDES` (8 guides: get-in/home-screen ·
  maintenance record→vote · maintenance report export · walk-through · committee vote ·
  invite people · compliance calendar · announcements; each `{id, title, who, mins, icon,
  roles(u), steps[{t, check, target?, view?}]}` with on-screen button labels wrapped in
  ⟨…⟩), `GuideDrawer` (library + guide modes, progress, reset, print), `GuideBar`
  (contextual pill, `VIEW_GUIDE` map), `GuideText` (⟨…⟩ → button pills), `printGuide`
  (A4 branded print window: navy/teal, logo from nalohub.com with hide-on-error fallback,
  "Free to copy, print and share… 🌊 Be in the Nalo." footer, "Current at <month year>").
  Small supporting edits: `HeaderAction` spreads `...p`; seven `data-guide` tags on the
  buttons guides point at (Maintenance Report action, Reports Word-report, Walk-Through
  load/start, Directory Add person, Compliance Word agenda, Announcements New); Help hub
  gains the Guides grid (uses `user` from context); `GuideDrawer`/`GuideBar` mounted in
  `BuildingApp`; PLATFORM bumped to 0.23.0. Demo + prod builds verified green.

- **2026-07-22 (v0.21.0 — Getting Started + Be In the Nalo, Phase 1)** — Two features, one change,
  `src/ResidentPortal.jsx` only (no db.js / schema / edge-function changes):
  1) **Getting Started** — committee-gated launch tracker (NAV `onboarding`, home group): 8 phases /
     53 steps with owner pills (Admin/Champion/Committee), Optional + N/A, per-step notes, progress %
     + phase timeline, copy-to-clipboard committee summary. Shared state on `building.onboarding`
     {done,na,notes} via the JSONB store. Ticking the final gate stamps `building.launchedAt`.
  2) **Be In the Nalo (recognition Phase 1)** — WelcomeBanner (first sign-in, per-user localStorage),
     AboardMeter (active ÷ roll incl. new demo-only `status:"invited"`; 50/75/100 milestone toasts,
     flags on `building.recognition.milestones`), BadgeShelf + badges (founding/explorer/settled) on
     `building.recognition.badges[userId]`, awarded via playbook-completion hooks. Two-tier controls:
     committee `building.community` = full|gentle|essentials (Settings card, amber caution on
     essentials) × personal Celebrations (localStorage `nalo_celebrations_<uid>`); app honours the
     more restrictive. Founding era = until launch + 30 days. Demo seeded: SeaHaven mid-tracker
     (~45%, notes), 58 invited users (~70% aboard), Greg holds founding+explorer; Riverbend clean.
     Deployed via GitHub web upload (carried the pending Contractors quote fix with it); local repo
     synced via GitHub Desktop afterwards.

- **2026-07-19 (v0.20.0)** — Acted on Greg's feedback round. All changes are in
  `src/ResidentPortal.jsx` only (111 insertions / 27 deletions); no `db.js`, edge-function or
  schema changes, because new fields persist through the generic JSONB store (`persistChange`) and
  `createMotion`'s `details` column. Demo + production builds both verified green. Items shipped:
  managing-agent CTA (#1), multi-recipient announcements (#2), scheme/plan reference (#3), editable
  Dashboard label + reorder (#4), motion document uploads (#5), Fire Safety evacuation plan (#8),
  maintenance-workflow progress bar/next-step (#7), header actions to body across all screens (#9).
  Proxy form (#6) confirmed already present — auto-generated signable PDF via `openProxyFormPdf`
  in Voting → Proxies; nothing to add.

- **2026-07-19 (v0.20.0, follow-up)** — Outbound announcement email wired: new
  `send-announcement` edge function (deployed to prod, dormant until the frontend ships),
  `db.js` `sendAnnouncementEmail()` + demo no-op, and `Announcements.post()` now emails residents
  (all / owners / specific) at their real addresses in `backend` mode *in addition to* the in-app
  notice — BCC'd for privacy, reply-to the building's committee email. Note: this is separate from
  the **Correspondence Hub**, which already emails external parties (contractors, solicitors,
  strata) via `send-correspondence`. Also: first-week playbook (`CommitteePlaybook`) now truly
  auto-retires once all items are done (was only manual-dismiss) and says so in its subheading;
  and demo seed gained a scheme reference on both buildings, a sample evacuation plan on SeaHaven,
  a targeted ("specific" audience) announcement, and a document attachment on a demo motion.

- **2026-07-19 (inbound email — central building address)** — Groundwork so each building can
  advertise ONE public address (`<slug>@send.nalohub.com`) that lands in Correspondence. New
  `ensure-mailbox` edge function (deployed) provisions a clean name-based slug per building
  (existing mailboxes are never renamed, so live reply-to tokens keep working); `db.js`
  `ensureBuildingMailbox()`; and a **Building email address** card in Settings (committee/manager)
  that shows + copies the address. Inbound already routes end-to-end in `receive-correspondence`
  (catch-all `send.nalohub.com` → webhook → slug lookup → thread or Unfiled tray) — the remaining
  step is operational, not code: enable **Receiving** on the domain in Resend, add ONE MX record
  at Uptime cPanel for `send.nalohub.com`, and set the `RESEND_RECEIVE_KEY` + `RESEND_WEBHOOK_SECRET`
  secrets. Deferred until receiving is verified live: switching `send-announcement`'s reply-to from
  the committee email to the building's app address (so announcement replies also land in-app).

- **2026-07-20 (inbound live · reply routing · quote fix)** — Operational + code follow-ups:
  1) **Inbound receiving went live** — Resend Receiving enabled on `send.nalohub.com`, MX added at
     Uptime cPanel, `RESEND_RECEIVE_KEY` + `RESEND_WEBHOOK_SECRET` set; verified end-to-end (real emails
     threading into Correspondence). Every building can now advertise one public address.
  2) **SeaHaven's prod mailbox slug cleaned** to `seahaven@send.nalohub.com` (safe: threading keys off the
     thread UUID token, not the slug, so existing reply-tos still work).
  3) **`send-announcement` → v2**: `reply_to` now points at the building's app inbox, so replies to a
     notice land in Correspondence instead of a personal inbox (deployed to prod via connector).
  4) **Display fix**: the Contractors `HowTo` `sell` used `\u201C`/`\u201D` escapes that JSX attributes
     render literally — replaced with real quote characters. Frontend one-line push (`main` was `e7d9946`).
  Not app code: produced an editable BCC proposal document ("NaloHub at Curve") from local demo
  screenshots — the demo was rebuilt locally with the building renamed "Curve" purely for the images,
  with a fictional-sample-data disclaimer; prod/demo remain "SeaHaven".

## Curve Birtinya bulk import (30 Aug 2026, data operation)

Loaded the BM's `Residents_08_2026.xlsx` into building `ecd3d712-c949-4dec-b20c-9a5d36df0eb6` via a single
transactional SQL script run through the Supabase connector on Greg's authorisation
(`curve_birtinya_import.sql`, kept with the staging workbook `Curve_Birtinya_Import_Staging.xlsx`).

- Targets: `units` (56, incl. agent_* and `notes`), `unit_people` (125; `is_current=true`; landline /
  committee role / primary-tenant marker in `notes`), `unit_vehicles` (82; Make/Model into `model`, make
  blank), `unit_pets` (11), `unit_access_items` (230; `item_type='key'`, label "Key or fob", no holder),
  `unit_breaches` (4; `occurred_at=current_date`, flagged in description), one `audit_log` row
  (`unit.bulk_imported`).
- Every insert has a duplicate guard (unit_number / name+type / registration / identifier), so the
  script is safe to re-run. Existing unit 105 was preserved; agent/notes only fill blanks.
- Mapping decisions: Mobile over Phone; Car Space / Car Location / Broadcast Custom Group / Requests /
  Lot / Fax skipped; EC Member kept as a note for membership invites; Owner Investor columns not
  needed (every tenanted unit already had owner rows). Non-unit rows (Building Manager, Fire Warden
  Key Set, Emergency Access Lock Box) skipped. "Office" imported as a unit.
- Gap: `units.notes` is not rendered by `UnitSearchView` / `ManagingAgentCard`. Add a "Unit notes"
  card (committee-only) — confirm `unit_health_check` RPC returns the full unit row incl. `notes`.
- Schema facts confirmed live: `buildings.name` lives in `buildings.data->>'name'` (JSONB);
  `unit_people` has `user_id, move_in, move_out, is_current, notes`; `unit_access_items` has
  `status, notes, ack_*`; `audit_log(building_id, actor, action, target, detail jsonb)`.

## v0.29.0 — editable unit registry, versioned conditions, unit-linked disputes (30 Aug 2026)

`src/ResidentPortal.jsx` (`UnitSearchView` rewritten) + `src/db.js` + one migration
(`unit_health_check_app_match_and_past_people`). No table changes: every column used already
existed, and `unit_people` had `move_in` / `move_out` / `is_current` / `notes` unused until now.

- **New db.js functions**, all guarded by the existing committee RLS (`*_committee` policies,
  `is_committee` = roles `bcc` + `admin`): `updateUnit`, `updateUnitPerson`, `moveOutUnitPerson`,
  `restoreUnitPerson`, `moveOutUnitPeopleOfType`, `deleteUnitPerson`, `updateUnitPet`,
  `deleteUnitPet`, `updateUnitVehicle`, `deleteUnitVehicle`, `updateAccessItem`,
  `deleteAccessItem`, `updateUnitBreach`, `deleteUnitBreach`. Each writes an `audit_log` row.
  All 14 are re-bound in the `DEMO_MODE` block against `DS`.
- **Archive, not delete, for occupants.** Owners and tenants get `is_current=false` + `move_out`;
  `unit_health_check` returns them separately as `past_people`. `deleteUnitPerson` is exposed in
  the UI only on already-archived rows and on non-occupant types (property manager, emergency
  contact). `moveOutUnitPeopleOfType` backs the "replacing the current owner/tenant" checkbox on
  the add-person form (default off — co-owners are the norm).
- **`unit_health_check` rewrite.** Each row in `people` now carries `app_match`: a lateral pick of
  the best membership match, `{match:'email'|'name', role, status, full_name, email}`. Email match
  is building-wide (email is the identity); name match is restricted to memberships whose `unit`
  is this unit, and is surfaced as a weaker amber signal the committee confirms, never an
  automatic merge. `residents_directory` entries gain `matched`, so the UI stops double-listing a
  member who is already on the register and instead shows the unmatched ones as
  "App members not on the register". Also adds `past_people`.
- **UI notes:** edit panels render inline under the row being edited (single `edit` state of
  `{kind,id}`, `moveout` is a pseudo-kind). `units.notes` finally has a home: a committee/BM-only
  "Unit notes" card, hidden while the unit edit panel is open so there is only ever one editor.
  Legacy `store.keyfobs` rows merged into the keys section stay read-only (no id in the new table).
- **Known gap:** building managers (`role='manager'`) are not `is_committee`, so they cannot edit
  the register they most often maintain. Deliberate for now; see the Feature Register.

### v0.30.0 — update delivery (31 Aug 2026)

**Confirmed against the live site (demo.nalohub.com, via browser):** no service worker registered,
no Cache Storage, `manifest.webmanifest` linked with `display: standalone` plus
`apple-mobile-web-app-capable`. Netlify served *everything* `public,max-age=0,must-revalidate`,
including the content-hashed assets.

Consequence: a page load always gets the newest build, but nothing triggers a load. Sign-in does
not reload. A standalone iOS install has no address bar and no pull-to-refresh, so the only user
remedy was force-quitting.

- `vite.config.js`: `versionStamp()` plugin emits `dist/version.json`
  (`{version, build, builtAt}`) via `emitFile` in `generateBundle`, and `define` injects
  `__BUILD_ID__` / `__APP_VERSION__`. The version is **read from `PLATFORM.version` in
  `src/ResidentPortal.jsx`** by regex, so that line stays the single source of truth and
  `package.json`'s stale `0.1.0` is deliberately not used.
- `ResidentPortal.jsx`: `UpdateBanner` (rendered inside `AppCtx.Provider`) fetches
  `/version.json?t=…` with `cache:"no-store"` on mount, on `focus`, on `visibilitychange`, and
  every 15 min; shows a dismissible banner when `build !== __BUILD_ID__`. Never auto-reloads.
  Fails silently (offline, 404, dev where `__BUILD_ID__` is undefined → `"dev"`, which skips).
- `netlify.toml`: `no-store` on `/version.json`, `must-revalidate` on `/index.html`,
  `immutable` + 1 year on `/assets/*` (safe — Vite content-hashes those filenames).

If a service worker is ever added, this banner must also hook `registration.updatefound` /
`waiting` and call `skipWaiting`, or the reload will serve the cached old build.

### v0.29.2 — audit pass (31 Aug 2026)

Findings and fixes: `createDispute` called from `UnitSearchView` with no `DEMO_MODE` shim (now
branches on `backend`, demo writes to `store.disputes` with a `unit` field and Unit Search merges
them); a `<Btn>` nested inside a row `<button>` in `Documents` (row converted to
`role="button"` div with `onKeyDown`); three submit handlers with bare `if (!x) return;` and no
feedback (`Messaging.send`, `ApplicationsBookings.book`, `Documents.upload`).

**Three checks worth keeping as a habit, since each caught a real class of fault:**
1. *db functions called from the UI but absent from the `DEMO_MODE` block* — anything unguarded by
   `backend` will fail on demo.
2. *Nested interactive elements* — `<button>`/`<Btn>` inside another `<button>`.
3. *Bare `return` in a handler wired to `onClick`* — the button appears dead to the user.

**Testing note.** Three separate "findings" during the audit were the harness lying, not the app:
an `update()` that mutated without re-rendering made every Settings field look broken (43 false
positives); a fuzzer holding stale DOM references after opening five edit forms at once made the
Key & Fob form look broken; and stubbed `docx`/`URL.createObjectURL` made exports look like they
produced empty files. A harness must mirror the real App shell (store in React state, `update`
clones and re-renders), re-query nodes after every state change, and use the real `docx` library
before any export conclusion is drawn.

### v0.29.1 — Unit Search discovery

`listUnitsOverview(bid)` in `db.js`: units + current `unit_people` + pet/vehicle/key counts in
five queries, returning `{...unit, owners[], tenants[], others[], pets, vehicles, keys}`.
Demo-shimmed from `DS`. `UnitSearchView` renders it as a browsable list, filtered client-side by
unit number or resident name; `run()` resolves a name to a unit when it matches exactly one.

**The bug this fixed is worth remembering.** The unit list was loaded inside
`useEffect(() => { if (backend) listUnits(...) })`. `backend` is not part of the `ctx` object
built in this file — the production shell supplies it — so on the demo build it is falsy and the
effect never ran. Unit Search opened as an empty search box with no indication the building had
any units. Any data loading gated on `backend` should be checked against the demo path: the demo
shims answer nearly every db function, so the guard is usually unnecessary and actively harmful.

### v0.29.0 demo dataset

`db.js` `DEMO_MODE` block: `DEMO_UNITS` / `DEMO_PEOPLE` / `DEMO_PAST` / `DEMO_PETS` /
`DEMO_VEHICLES` / `DEMO_ACCESS` / `DEMO_BREACHES` are compact tuple tables expanded by
`demoResidents()` into `DR`, which is spread into `DS`. Nineteen units, 34 owners and tenants.
To add or change demo residents, edit the tuple tables, not `DS`. Demo `listUnits` now sorts
numerically to match the live query's `order("unit_number")`.

### v0.29.0 additions (merged with the registry work above, which shipped in the same release)

Two streams were built in parallel in separate chats, both stamped v0.28.0, both touching
`ResidentPortal.jsx` and `db.js`. They are merged here and released together as **v0.29.0**;
committing one on top of the other would have silently reverted it.

- **Versioned Conditions of Approval.** Migration `versioned_conditions_of_approval`:
  `motions.version` plus `amend_motion_conditions(uuid, jsonb, text, text)`, SECURITY DEFINER,
  execute granted to `authenticated` only. The RPC re-checks BCC membership server-side,
  requires a reason, snapshots prior conditions and all votes into `motions.details.history`,
  deletes the live votes, bumps `version`, writes an `app_notifications` row (recipient_role
  `bcc`) and an `audit_log` entry, all in one statement. Verified before writing: the
  `trg_tally_motion` trigger fires on INSERT only, so clearing votes cannot mis-decide a
  motion, and `uq_motion_vote_principal` frees each member to vote again.
  `updateMotionConditions` is no longer called from the UI.
- **Disputes carry a unit.** `disputes.unit_id` existed but was never written, so the Unit
  Search Disputes section could not populate for any unit in any building. `createDispute`
  now takes `unitId`; a picker was added to the Disputes form and a "+ Dispute" flow to
  Unit Search.
- **BM registry access, per building.** `can_edit_unit_registry(bid)` = `is_committee(bid)`
  OR (`has_role(bid,'manager')` AND `buildings.data->>'bmRegistryWrite'`). The five registry
  policies now call it; `unit_breaches` deliberately still calls `is_committee`. Note the key
  is **camelCase**: the app writes the whole building object into `buildings.data`, so the
  function reads `bmRegistryWrite` (snake_case kept as a fallback). `UnitSearchView` computes
  the same rule client-side to avoid showing controls the database would refuse.
- **Bug fix: motion card remount.** `MotionCard` and `Tally` were defined inside `VotingLive`
  and rendered as `<MotionCard />`, so each render created a new component type and React
  remounted the whole card — every text box on a motion lost focus after one character. Both
  are now plain function calls (`motionCard(m)`, `tally(m)`) with `key` on the returned Card,
  which keeps their closures and stops the remount.

**Nested-component remount: a recurring trap in this file.** A component declared inside another
component gets a new function identity on every parent render. Rendered as `<Thing />`, React
sees a different component *type* each time and unmounts and remounts the whole subtree, so any
text field inside it loses focus after a single character. Three instances existed; all are fixed
in v0.29.0:

| Where | Symptom | Fix |
|---|---|---|
| `MotionCard` / `Tally` in `VotingLive` | every text box on a motion (comments, questions, amend reason) | rendered as plain calls `motionCard(m)` / `tally(m)`, `key` moved onto the returned Card |
| `Section` in `UnitSearchView` | editing any person, pet, vehicle, key or breach row | hoisted to module level, takes `T` from `useApp()` |
| `Form` in `AssetRegister` | adding or editing an asset | hoisted to module level as `AssetForm` |

Anything left nested (`H`, `P`, `Bar`) is presentational and contains no inputs, so the remount is
harmless. When adding UI here, declare components at module level, or render them as plain
function calls. The regression test for this types character by character and asserts the node is
still connected and holds the full string; asserting only that a panel opens will not catch it.
