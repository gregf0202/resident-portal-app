# NaloHub — App Architecture Baseline

> Living reference for the NaloHub resident-portal app. **Read this at the start of any
> work session; update it in the same commit whenever the architecture changes.**
> Last updated: 2026-07-22 · App version: v0.21.0 (deployed via GitHub web upload; includes
> the previously pending Contractors quote fix). Nothing pending.
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

- **v0.21.0 (current):** Getting Started — committee-gated launch tracker (8 phases / 53 steps,
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
