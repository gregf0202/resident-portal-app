# NaloHub — App Architecture Baseline

> Living reference for the NaloHub resident-portal app. **Read this at the start of any
> work session; update it in the same commit whenever the architecture changes.**
> Last updated: 2026-09-20 · App version: v0.35.1 (public parking-permit verify page +
> `permit-verify` edge function; v0.35.0 rebuilt the Building Walk Through for Curve Birtinya
> as a 13-section, 176-question checklist bound to the Caretaking and Letting Agreement, with
> a persistent append-only findings register and branded PDF/Word reports). Pending: restyle
> `permit-pdf` to the tent design in `claude/PARKING_PERMIT_TENT_SPEC.md`.
> Note: this file lives in three places (repo `claude/`, the Drive folder, and Claude
> Project knowledge) and all three are synced in the same session as any change, via the
> `nalohub-doc-sync` skill. The repo copy is the working master. Whatever any header says,
> the version line in `src/ResidentPortal.jsx` is the single source of truth for the
> current release.
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
| `src/App.jsx` | **Production shell.** Supabase auth, loads real data via `db.js`, provides context with `backend: true`, renders `<BuildingApp/>`, `<Toast/>`, `<AddToHomeScreen/>` and (since v0.31.2) `<UpdateBanner/>`. |
| `src/ResidentPortal.jsx` | **The whole UI (~700 KB, single file)** + the **demo app** default export. All screens, `NAV`, `ViewRouter`, `AppCtx`/`useApp`, theme live here. Exports `AppCtx, BuildingApp, Toast, UpdateBanner, themeById` for `App.jsx`. |
| `src/db.js` | **Data layer.** Real Supabase functions for prod; a `if (DEMO_MODE)` block rebinds them to an in-memory seeded dataset (`DS`) for the demo. |
| `src/supabaseClient.js` | Creates the Supabase client from env vars (placeholders in demo). |
| `src/billing.js`, `invoicePdf.js`, `csv.js`, `theme.js`, `styles.css` | Billing, PDF/Excel/CSV export, theming. |
| `src/components/` | `SignIn`, `PlatformConsole`, `AddToHomeScreen`, `GuidedTour`, `AnimatedHeader`, `BillingPanel`, `ui.jsx`. **All component files live here, not in `src/`.** |
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

**The reverse trap (v0.31.2):** anything mounted only in the demo root (the default export
`App()` in `ResidentPortal.jsx`) never runs in production. `App.jsx` is a separate shell and
must mount it too. `UpdateBanner` sat in that gap for five days.

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
| Production app | not set (falsey) | real `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | `portal.nalohub.com` |
| Demo | `true` | none needed | `demo.nalohub.com` |

**Env vars** (`.env.example`): `VITE_SUPABASE_URL` = `https://lipwcsihcxndwwgzhiia.supabase.co`,
`VITE_SUPABASE_ANON_KEY` = publishable key. Local `.env` is git-ignored; never commit it.

**Deploy flow — the standard path (incremental, use this):**

```bash
cd "~/Documents/Apps/Resident App/App Code/resident-portal-app 5"
git add <changed files>        # stage only what you changed
git commit -m "clear message"
git push origin main           # Netlify auto-builds prod + demo
```

Netlify then builds both sites (`npm run build` → `dist`) and publishes in ~1–2 min.
In practice Greg does the same three steps through GitHub Desktop after replacing files in
Finder; the paths in this file are what he needs to put each file in the right folder.

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
- **Key register model (0019, 0020, APPLIED to prod 19 Sep 2026).** `access_descriptors`
  (per-building catalogue, RLS `can_edit_unit_registry`), `unit_access_entitlements`,
  `unit_access_items` + `descriptor_id` / `issued_to_role` / `owner_authority` /
  `receipt_path` / `suspended_at`, statuses extended with `on_hand` and `suspended`, and
  `access_audit(uuid)` SECURITY INVOKER.
- **Parking permit unit number (migration 0018, APPLIED to prod 18 Sep 2026).** `issue_parking_permit()` previously derived `unit_number` FROM the
  `units` register via `applications.unit_id`; where that is null the permit issued with
  `unit_number NULL` and `permit-pdf` printed `UNIT#` followed by nothing. Not an edge case:
  only 2 of 12 prod buildings have `units` rows, and **no `unit_people` row carries a
  `user_id`**, so the app cannot resolve a submitter's unit — `details.unit` arrives empty.
  Inverted: the submitted `details.unit` is authoritative for `unit_number`; the register is
  consulted best-effort only, to set `unit_id` on a case-insensitive match (Unit Search
  linkage) and as a fallback when nothing was typed. Deliberately **no** validation against
  the register — it would reject residents in the ten buildings without one, and the
  committee sees the unit on the approval card before approving. Duplicate guard, PP-NNNN
  numbering and the `permit_issued` notification are unchanged. Frontend half: a required
  Unit field on the permit form, without which the DB fix cannot stop a blank arriving.
- **PP-0001/PP-0002 (SeaHaven, expired 20 Jul) remain blank** — no unit was ever captured,
  so there is nothing to backfill from. Left in place deliberately.
- **Verified end-to-end on prod after applying**, in the exact failure case: an application
  carrying `details.unit = '42B'` approved in a building with **zero `units` rows** issued
  `PP-0001` with `unit_number = '42B'` and `unit_id` null — printing correctly without a
  register, and without the missing register blocking issue. Run inside a `DO` block that
  raised at the end to roll the whole thing back; the result was carried out in the error
  message. Confirmed afterwards: 0 test rows, permits still 2, applications still 6.
  Security advisors identical to the pre-change baseline.
- **Correspondence filing + search (migrations 0015, 0016, APPLIED to prod 18 Sep 2026).**
  `corr_file_unfiled_new_thread` (SECURITY DEFINER, committee-guarded, EXECUTE revoked from
  `anon`); `correspondence_messages.search_tsv` generated tsvector + GIN index;
  `corr_search(building, q)` **SECURITY INVOKER** so existing RLS governs visibility. 0016
  switches `ts_headline` to guillemet delimiters so no email HTML reaches the client.
- **`unit_access_items.purpose` (migration 0013, APPLIED to prod 18 Sep 2026).** `text NOT NULL
  DEFAULT 'resident'`, CHECK `resident|master|service|other`, plus `(building_id, purpose)` and
  `(building_id, identifier)` indexes for the building-wide register read. Deliberately a SECOND
  axis rather than more `item_type` values: `item_type` is what the device IS (key / fob / remote /
  swipe_card / digital_card / other), `purpose` is what it is FOR, so a master fob is still a fob
  and can be filtered as one. The 230 Curve rows backfilled to `resident`, which is accurate: they
  are lot-allocated devices. `unit_health_check` returns the field with no change, because its
  `access_items` branch uses `to_jsonb(a)`.
- **`unit_access_items.unit_id` is now NULLABLE (migration 0014, APPLIED to prod 18 Sep 2026).**
  A master key, a service key or a lock box belongs to the building, not a lot. `unit_id NOT NULL`
  is why the Curve import had to skip the Building Manager, Fire Warden Key Set and Emergency
  Access Lock Box rows. Safe for every read path: `unit_health_check` inner-joins `units` on
  `unit_id` so building-level rows never appear under a unit (correct), RLS keys off `building_id`
  and `issued_to_user_id`, and `exportBuildingData` selects by `building_id`. The register renders
  a null `unit_id` as "Common property".
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
  e.g. `seahaven@send.nalohub.com`; committee-only; `verify_jwt=true`), and
  **`permit-verify`** (deployed 20 Sep 2026, `verify_jwt=false`, public by design: a read-only
  check of one parking permit by uuid, `?id=<uuid>&fmt=json`, returning permit number, building,
  validity window and a Brisbane-date status, never unit/vehicle/rego; service role inside,
  CORS open, called by `public/permit.html`). **The Supabase gateway serves function `text/html`
  as `text/plain`** on `*.supabase.co` (verified in `function_edge_logs`), so any HTML a function
  would render must instead be a static page on `portal.nalohub.com` that fetches JSON.
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
  (targeted `Edit`s); it's ~700 KB now.
- **Verifying a build without polluting `node_modules`:** the Mac `node_modules` is macOS-
  native, so a Linux sandbox `npm run build` fails on `@rollup/rollup-linux-x64-gnu`. To
  verify: copy `src/`, `index.html`, `package.json`, `vite.config.js`, `public/` to a temp
  dir, `npm install`, then `VITE_DEMO_MODE=true npm run build`. Or a quick parse check with
  a standalone `esbuild.transformSync(code, { loader: "jsx" })` or `@babel/parser` with the
  `jsx` plugin.
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
- **Phone instructions describe what the person sees, never an OS version.** Safari's Share
  button moved behind a "..." menu in iOS 26's default Compact layout; an instruction that
  said "tap Share" stranded a committee chair (v0.31.3). Write both routes, draw the icons,
  and keep the same rule for any future "open your browser's menu" step.

---

## 10. Keeping this doc current (the contract)

When a change alters architecture — a new module/screen, a data-model change, an access
rule, an env var, a deploy detail, a new edge function — **update the relevant section of
this file in the same commit.** At the start of each work session, read this first so
context carries across sessions instead of being re-derived each time. The version line
(`PLATFORM` in `src/ResidentPortal.jsx`) is the single source of truth for the current
release; if this header disagrees with it, the header is wrong.

### Where these docs live, and the sync rule

`ARCHITECTURE.md` and `FEATURE_REGISTER.md` exist in three places. The repo is the working
master; the other two are mirrors that go stale silently and are read by future sessions as
if they were current.

| Copy | Path | How it updates |
| --- | --- | --- |
| **Working master** | `claude/` in this repo | edited directly, committed with the change |
| Google Drive | folder `1Q3FWFVHznlmXamZBuYRw8dfyYjaZprBq` | the repo `claude/` folder syncs there automatically |
| Claude Project knowledge | `claude/ARCHITECTURE.md`, `claude/FEATURE_REGISTER.md` | **manual — `Projects.project_write` with `local_path`** |

**The rule: any commit that touches either doc must also push it to Project knowledge in the
same session.** Not next time, not when someone notices.

Two things make this non-optional rather than tidy-minded:

- Project knowledge is what a *new* chat reads first. A stale copy there is worse than no
  copy, because it is trusted. On 18 Sep 2026 a session built four code edits against the
  Project copy of `ResidentPortal.jsx` at **v0.27.0** while live was **v0.33.1** — six
  versions and five weeks adrift. The anchors happened to still match; that was luck.
- Project knowledge allows **duplicate docs at the same path**. Three `ARCHITECTURE.md` and
  three `FEATURE_REGISTER.md` had accumulated by 18 Sep. `project_write` replaces only the
  newest, so stale siblings survive underneath and can be served to a future session.
  Collapsed to one of each on 18 Sep 2026.

Mechanics worth knowing, all learned the hard way:

- `project_write` with a **bare filename** lands in the `claude/` namespace, which is why the
  Project paths above match the repo paths. Use that; do not fight it.
- `project_delete` removes **one** doc per call — the newest at that path. To collapse
  duplicates, call it until the path is empty, then write once.
- Use `local_path` rather than inline `content`, so a 77 KB file never enters context.
- **`device_stage_files` can fail with a bogus "file is hardlinked" error for a few seconds
  after `device_bash` writes that file.** It is a propagation lag, not a real hardlink —
  `stat` reports `nlink=1` throughout. Wait and retry the same path rather than making copies;
  copies fail the same way.

`src/ResidentPortal.jsx` and `src/db.js` must **never** be kept in Project knowledge. They are
large, they change most often, and a stale copy is actively dangerous — see above.

---

## 11. Recent history (high level)

- **v0.35.0 (current, 20 Sep 2026):** The Building Walk Through becomes a register rather
  than a checklist. 13 sections and 176 questions seeded from Schedule 1 of Curve's
  Caretaking and Letting Agreement (0022), an append-only `walkthrough_findings` register
  with a six-class finding scheme and committee-verified closure (0021), and three
  historical walks with 90 findings ingested (0023a/0023b). Report exports to branded PDF
  and Word with paired before/after thumbnails. See changelog.
- **v0.34.0 (19 Sep 2026):** Key & Fob Register becomes a register, an entitlement
  record and an audit. Descriptors are per-building data (0019), each unit gets a static
  entitlement per descriptor, devices carry issued / on hand / suspended plus who signed for
  them and the signed receipt, and access_audit (0020) reconciles it. See changelog.
- **v0.33.1 ( 18 Sep 2026):** Back is a button in the body of all 12 screens that have
  a back target, not only a chip on the header image that scrolls away, plus one at the foot of
  a thread. Party list gained Resident tenant and Building manager, Agent became Managing agent
  (migration 0017), and the list is ordered by frequency of dealing. See changelog.
- **v0.33.0 (18 Sep 2026):** Correspondence: an unfiled inbound email can start its
  own thread (migration 0015), search covers subjects, parties and message bodies (0015/0016),
  announcements send from the building's own address rather than no-reply@, and the receiver
  ignores our own domain. See changelog.
- **v0.32.1 (18 Sep 2026):** Key & Fob Register tiles and status chips now describe
  the current search instead of the whole register, which is what made a working search look
  broken. Occupant names de-duplicated. See changelog.
- **v0.32.0 (18 Sep 2026):** Key & Fob Register repointed from the legacy
  `store.keyfobs` JSONB store to `unit_access_items`, the table Unit Search already used. Search by
  unit / resident name / key number, Type + Purpose descriptors (migrations 0013/0014), honest
  "Holder not recorded" rather than an inferred holder. See changelog.
- **v0.31.3 (5 Sep 2026):** Add to Home Screen instructions rewritten to cover iOS 26
  Compact layout (Share icon, or "..." then Share) in `src/components/AddToHomeScreen.jsx` and
  the Getting Started tour step in `ResidentPortal.jsx`. See changelog.
- **v0.31.2:** `UpdateBanner` exported from `ResidentPortal.jsx` and mounted in `App.jsx`;
  it had only ever run on the demo.
- **v0.31.1:** printable guide header no longer draws the wordmark twice; hosted logo
  replaced with a transparent, alpha-trimmed PNG.
- **v0.31.0 (4 Sep):** sign-in code alongside the magic link (`SignIn.jsx`); usage
  analytics Layer 1 app half (`logActivity` in `db.js`, hook in `App.jsx`).
- **v0.30.0 (31 Aug):** version stamping + `UpdateBanner`; Netlify cache headers.
- **v0.29.x (30–31 Aug):** editable unit registry, versioned Conditions of Approval,
  unit-linked disputes, browsable Unit Search, audit pass.
- **v0.24.0:** Guides for everyone — 12 new guides (7 resident-facing: report a
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

### v0.35.1 — a permit can be verified from its QR (20 Sep 2026)

- `public/permit.html` (new, static, no React): `portal.nalohub.com/permit.html?id=<permit uuid>`
  fetches `permit-verify?id=…&fmt=json` and renders the branded verify card (navy header,
  building name, permit number in teal serif, status badge, valid from/to, approval date,
  checked-at). Invalid/unknown ids get a plain refusal. Vite copies `public/` to the site root,
  so it deploys with the app on both portal and demo.
- `permit-verify` edge function (v3, `verify_jwt=false`) — see §8. Exposes nothing that
  identifies the resident; the printed card carries the unit and rego, the scan does not.
- Why not HTML from the function: confirmed the gateway rewrites `text/html` to `text/plain`
  (three deployments, `function_edge_logs` shows `text/plain` on every response). JSON + static
  page is the pattern for any future public HTML.
- Tent permit design agreed with Greg (A4, two A5 cards, top one rotated 180°, fold line):
  navy header with the building name prominent and the NaloHub mark, QR top right, aerial
  photo of the building feathered bottom right. Reference artwork and the `permit-pdf` restyle
  spec are in `claude/PARKING_PERMIT_TENT_SPEC.md`; the existing `permit-pdf` (v8) already
  prints two-up with a fold line in the old black/yellow template, so the restyle is layout only.

### v0.35.0: the Walk Through becomes a register (20 Sep 2026)

`src/ResidentPortal.jsx` (WalkthroughLive rewritten, FindingDrawer, printWalkReport,
exportWalk), `src/db.js` (11 new functions plus demo shims),
`src/components/PlatformConsole.jsx` (version footer), migrations 0021, 0022, 0023a and
0023b. Demo and production builds green.

**Why.** `walkthrough_results` is keyed `(walkthrough_id, item_id)`, so an issue found on
one walk could only ever exist as free text in that walk's `note`. Nothing carried to the
next walk, which is where roughly 90% of the record was being lost. The August and
September Curve walkaround reports showed the same items recurring with no way to prove
recurrence.

- **`walkthrough_findings` (0021)** is the persistent, append-only register. Each finding
  carries a reference (CB-0001), a class, the duty it tests, and a chain of
  `walkthrough_finding_events` recording every observation, photo and closure. Closing a
  finding requires committee verification per building (`walkthrough_closure` setting,
  default `committee`), enforced by a trigger, not by hiding a button.
- **Six finding classes.** S Standard (duty not met at contracted frequency) · R
  Rectification · C Contracted works · H Hazard · L Lot owner/by-law · G Governance. A
  constraint forbids an S-class finding from ever carrying a `maintenance_id`: standard
  shortfalls must not enter the Maintenance Workflow, because they would distort the
  average-days-to-resolve and open-now figures that the maintenance record exists to
  defend.
- **Sections seeded from the agreement (0022).** 176 questions, each citing its Schedule 1
  line and contracted frequency; 24 rest only on cl 3.2/3.4 and say so. The generic 22
  items are retired by `active = false`, never deleted, so historical walks still read.
- **Evidence (0023a/0023b).** Three historical walks (30 Jun, 5 Aug, 2 Sep) and 90
  findings with 140 events. Reports render before/after photo pairs at 240px q0.72
  (12 to 18 KB each) so a report stays emailable, with full-resolution images kept in the
  app.
- **Reports.** `printWalkReport` renders A4 with the NaloHub logo, a running footer on
  every page carrying the building, walk date and generation stamp, and `exportWalk`
  produces a Word file from the same data and the same stamp. Both buttons now read
  "Export PDF" and "Export Word".
- **Findings can be closed between walks.** `actOnFinding` records "still present" or
  "confirmed done and closed" against the register rather than a walk, with copy that
  says which, so the committee is not forced to open a phantom walk to close an item.
- **The Admin account is not an attendee.** Curve carried three membership rows all named
  "Platform Admin", and the attendee list printed each of them as "(BCC)". Neither was a
  duplication bug: `joinAsAdmin` and `createBuilding` hard-coded the name `Platform Admin`
  on every membership they minted, so each platform admin who opened Curve from the
  Platform Console left an identically named row behind, and `roleTag` fell through to
  "BCC" for any role it did not recognise. An attendee list on a body corporate document
  that assigns the wrong office to three people is a defensible-record problem, not a
  cosmetic one. The `admin` role is now excluded from the attendee picker entirely (it is
  how NaloHub reaches a building, not a person who walks it), `roleTag` labels it "Admin"
  wherever it still appears, and both functions now write the name `Admin`. The two
  surplus Curve rows were deleted and the naloit@nalohub.com rows renamed across all
  twelve buildings; `is_platform_admin` lives on `profiles`, so no access changed.
- **The four exploratory walks were cleared.** 4 Sep, 5 Sep and two dated 19 Sep, created
  by committee members and the Admin account while finding their way around the old
  screen. Five bare results between them, no notes and no photos. Deleted with the
  register untouched, because nothing in `walkthrough_findings` referenced them.
- **A platform admin no longer leaves a personal email in a building.** `joinAsAdmin` and
  `createBuilding` wrote `email: authUser.email`, so every admin who opened a building
  from the Console put their own address into that building's member list, visible to its
  committee. Both now write `email: null` with the name `Admin`, because the row exists so
  the app knows who is acting, not so the building can contact them. `UNIQUE (building_id,
  email)` does not constrain NULLs, so the duplicate check in `joinAsAdmin` is now an
  explicit query on `(building_id, user_id)` rather than something left to the database;
  without it every Console visit would add another Admin row. `memberToUser` already
  tolerates a null email (`m.full_name || m.email || "Resident"`).
- **Admin is one account.** `naloit@nalohub.com` holds the `admin` role across all twelve
  buildings and is the only account that should. `gregf0202@gmail.com` held admin at Curve,
  SeaHaven and Regatta; all three were removed, and at Curve it was replaced with an
  `owner` membership for Unit 606, which is what the BM register has always said. Platform
  reach comes from `profiles.is_platform_admin`, not from a membership, so nothing was lost.

### v0.34.0 — the register becomes an auditable record (19 Sep 2026)

`src/ResidentPortal.jsx` (KeyFobRegister rewritten as four tabs), `src/db.js` (14 new
functions plus demo shims), migrations 0019 and 0020. Demo + production builds green;
the four tabs driven in a real headless browser, and the audit arithmetic checked
against live Curve data with a fixture that was reverted.

**Requested by the Curve Birtinya BCC:** thirteen "descriptors", per-unit entitlement
with issued and on hand, issuance to owner / managing agent / tenant with a signed
receipt, lost items suspended and never deleted, and an annual Caretaker audit.

- **Descriptors are per-building DATA, not a fixed list (0019).** Eight of the thirteen
  differed only by fire-stair level, and two ("Building Key - Master", "- Service") were
  the `purpose` axis from 0013 welded back into a string. A fixed list would have undone
  0013, made Level 8 a schema migration, prevented asking "how many fire stairs keys are
  out", and baked ONE building's floor plan into every building's schema, which matters
  commercially. `access_descriptors` is per building; Curve's thirteen are seeded verbatim
  so the committee sees its own words, and each descriptor still carries an item_type and
  purpose so the filters and any cross-building reporting keep working.
- **`unit_access_entitlements`**: the static per unit x descriptor number the whole audit
  reconciles against. Settable one unit at a time or loaded in bulk from the committee's
  own sheet; the bulk path reports what it could not match rather than skipping silently.
- **Two new statuses.** `on_hand` is counted against a unit's entitlement but physically
  held by the BM (the BCC's own example: entitlement 2, one issued, one on hand), or, when
  `unit_id` is null, unallocated building stock. `suspended` replaces deleting: the BCC was
  explicit that lost devices are suspended, never deleted, and stay recorded against the
  unit or against stock. `lost` is kept for existing rows and still renders.
- **Issuance.** `issued_to_role` (owner / managing agent / tenant / building manager /
  contractor / other), `owner_authority` + `owner_authority_by` because a tenant receives
  keys only on the owner's authority, and `receipt_path` for the signed copy in the private
  attachments bucket. The framework the BCC asked to keep is intact: a device is still
  issued TO THE UNIT, and the person is an attribute of the issuance.
- **`access_audit(building)` (0020)** returns three scopes in one call so a single export
  covers the exercise: `unit` (entitlement vs issued vs on hand vs suspended, with
  variance), `stock` (unallocated, for the fob and remote count), and `unclassified`.
  SECURITY INVOKER, so existing RLS decides visibility rather than a second access model.
  The unit scope deliberately lists only pairs with an entitlement or a device; a plain
  cross join would report 56 x 13 = 728 rows of nothing.
- **Unclassified is never hidden.** All 230 Curve rows arrived in Aug 2026 as one
  undifferentiated "Key or fob", so nothing says which is a Level 3 fire stairs key. Until
  they are classified the reconciliation is incomplete, and the report says so on its face
  rather than quietly omitting them. A CSV classify path (template + upload, matched on key
  number) exists for when the BM confirms the mapping. **This is the critical path for the
  BCC's request, and it is data entry, not software.**
- **Tile honesty, again.** The first build counted every row with `variance != 0` as a
  variance, so the demo read "28 variances" over a table showing "—" in all of them, because
  a row with no entitlement has nothing to vary from. Variances now count only rows that
  HAVE an entitlement, with "No entitlement set" as its own tile and its own notice. Same
  rule as v0.32.1: a count beside a table must describe that table.
- **Shadowing caught in review:** the audit rows were first held in a state variable named
  `audit`, which shadows the `audit()` audit-log writer imported from `db.js` at the top of
  the file. Renamed to `auditRows`. Nothing called it inside the component, so this was
  latent rather than broken, but the next edit inside that function would have found it.

### v0.33.2 — Parking permits print their unit number (18 Sep 2026)

`src/ResidentPortal.jsx` only, plus migration 0018. Production build verified green
(1917 modules, vite 5.4.21). Found while tracing the full parking-permit journey end to end
for the Curve BCC demo: demo mode stubs the permit PDF, so the blank unit line had never
been visible — it only shows in production, on the printed permit.

- **Root cause.** `issue_parking_permit()` read the unit from the `units` register, not from
  the application. `resolve_application_unit()` (BEFORE INSERT) only populates `unit_id` when
  `details.unit` is non-empty, and `details.unit = user.unit || ""` always resolved to `""`
  because nothing links an auth user to a `unit_people` row (0 of 125 rows carry `user_id`).
  So `unit_id` stayed null, the register lookup returned null, and the permit printed blank.
- **Decision: resolve, don't validate.** Validating the typed unit against the register was
  considered and rejected — 10 of 12 prod buildings have no register at all, so validation
  would reject legitimate residents outright. The register match is now a bonus that sets
  `unit_id` when it happens to succeed, and never blocks issue.
- **Frontend.** `f.unit` added to both form-state objects, required on submit with its own
  flash message, sent via `details.unit` for `parking_permit` only (every other category
  keeps the existing `user.unit` behaviour), and a full-width Unit field above the vehicle
  grid.
- **Not changed.** The `permit_issued` notification still stores `ref_id` as the permit
  number string rather than the row UUID, so tap-to-open on that one alert cannot resolve;
  and `openPermitPdf` calls `window.open` after an await, which popup blockers (iOS Safari
  especially) can swallow. Both logged, neither fixed here.

### v0.33.1 — Back where you can reach it, and a usable party list (18 Sep 2026)

`src/ResidentPortal.jsx` only, plus migration 0017. Demo + production builds verified green,
and both changes checked in a real rendered page (headless Chromium against the demo build)
rather than assumed.

- **Back.** The control existed: `Head` renders an `ArrowLeft` chip when given `onBack`. But it
  sits inside `AnimatedHeader`, on the image, at the very top, so on any screen taller than the
  viewport it scrolls out of sight. A correspondence thread is the tallest screen in the app, so
  that is where it was noticed: *"there is no obvious Back button here, a problem I thought we
  solved"*. The chip was also easy to miss against the header gradient. New module-level
  `BackLink` renders in the **body** row alongside the primary action, so all 12 screens with a
  back target get one, and the thread view gets a second "Back to Correspondence" at its foot.
  Same reasoning as v0.20.0 moving primary actions out of the header: if it matters, put it where
  the content is. The header chip stays, for consistency with the Dashboard chip beside it.
- **Party list.** `corr_party_type` was missing the two parties a committee deals with most after
  the owner: the **tenant living in the lot** and the **building manager**. Both were being filed
  as "Other", which is exactly where all 8 existing contacts sat. Migration 0017 adds
  `resident_tenant` and `building_manager`.
- **Agent → Managing agent, at the data level.** "Agent" is ambiguous in strata: real-estate
  agent, letting agent, or the strata manager's agent. Renamed the enum VALUE rather than only
  its label, so the stored data matches what is displayed. Free to do: zero contacts used
  `agent` (verified first), and `ALTER TYPE ... RENAME VALUE` relabels in place, so any future
  row follows automatically. Confirmed no code referenced the string `"agent"` as a party type
  first; the one grep hit was `units.agent_business`, unrelated.
- **Order.** `CORR_PARTY`'s key order is what every party dropdown renders, so the list is now
  ordered by how often a committee deals with each party rather than by the enum's historical
  sort order: Owner, Resident tenant, Managing agent, Building manager, Strata manager,
  Contractor, Insurer, Solicitor, Auditor, Council, Other. Verified by reading the rendered
  `<select>` options out of the live DOM, not from the source.
  **Managing agent at position 3 is a judgement call:** the requested order omitted it, and
  owner / tenant / managing agent are the lot-side trio, so it sits with them. Trivial to move.
- **Labels are sentence case** ("Resident tenant", not "Resident Tenant") to match the existing
  set. Also a judgement call, also trivial to change.

### v0.33.0 — Correspondence: filing and search (18 Sep 2026)

`src/ResidentPortal.jsx`, `src/db.js`, migrations 0015 and 0016, plus edge functions
`send-announcement` v6 and `receive-correspondence` v11 (both deployed 18 Sep).
Demo + production builds verified green.

**1. The day-one filing hole.** `corr_file_unfiled(p_raw, p_thread)` requires an EXISTING
thread, and the only way to create a thread was `sendCorrespondence`, which sends a real
email. So the first inbound email for any building could never be filed: you had to email
someone before you could file anything. Curve Birtinya had **0 threads, 0 contacts and 7
unfiled items**, and the File button was permanently disabled because its thread picker
was empty. Reported as "only option is File to Thread, no action taken".

- New `corr_file_unfiled_new_thread(p_raw, p_subject, p_contact_name, p_party_type, p_org)`
  creates the thread from the email itself and **sends nothing**. It matches the sender to
  an existing contact by lowercased email before creating one, so filing two emails from
  the same person does not produce two contacts. Guarded by `corr_is_committee`, EXECUTE
  revoked from `anon`.
- It **refuses a row with `building_id` null** rather than guessing: there is no scheme to
  file into and nothing for the committee check to check against.
- The tray now offers both paths, with "File as a new thread" primary when no threads
  exist yet, plus a filter once there are more than three items.

**2. The silently dead button.** `assignUnfiled` opened with a bare `if (!threadId) return;`
and the button was `disabled` with no explanation. Exactly the class the v0.29.2 audit
called out. It now says what to do instead.

**3. Search.** A generated `search_tsv` on `correspondence_messages` over subject, sender
name, sender email and body, with a GIN index. `corr_search(building, q)` is **SECURITY
INVOKER on purpose**: the RLS on threads and messages already encodes who sees what,
including the restricted-thread rule that keeps the BM and MSC out, and a SECURITY DEFINER
version would be a second copy of the access model free to drift from the first.

- **Highlighting does not use HTML.** `ts_headline` defaults to `<b>`/`</b>`, and rendering
  that would mean reintroducing `dangerouslySetInnerHTML` on inbound email content, which
  is the exact sink the 5 Aug XSS review removed (zero remain). Migration 0016 sets
  `StartSel=«, StopSel=»`; the client splits on the guillemets and emphasises the matched
  run as ordinary JSX. Verified against a real body containing `<quattrors50@gmail.com>`:
  no HTML crosses the boundary, so there is nothing to escape and nothing to trust.

**4. no-reply@ was the root cause of the orphans.** `send-announcement` sent
`from`/`to` = `no-reply@<domain>` with `reply_to` = the building inbox. Resend requires a
`to` even when every recipient is in BCC, and `from`/`to` is what **Reply All** targets. So
a resident's reply-all went to the building inbox AND to no-reply@, and since Receiving is
enabled domain-wide that fired **two** webhooks: one filed, the other resolved the slug
"no-reply", found no mailbox, and became an orphan with `building_id` null, invisible in
every tray. The `to` copy also meant **every announcement was delivered back into our own
inbound webhook**.

- v6 sends from the building's own inbound address in all three slots, so Reply and Reply
  All both land in exactly one place. It also stops the header contradicting the footer: a
  From of no-reply beside a footer inviting a reply teaches residents not to.
- v11 of the receiver resolves the building across **all** recipients preferring one that
  is a real mailbox, prioritises `received_for` (the address Resend actually accepted) over
  `to`/`cc`, and **ignores mail whose sender is our own domain** as `ignored_self` so the
  announcement echo never reaches the tray. Without that second change the sender fix would
  have made things worse: the self-copy would now resolve to the building and appear as a
  tray item on every notice. **The two changes are coupled and must ship together.**
- Auto-responder detection gained header signals (`x-autoreply`, `x-autorespond`,
  `x-auto-response-suppress`). Deliberately NOT loose subject matching: a false positive
  silently hides a real email, which is worse than an extra tray item. The out-of-office
  that slipped through ("We are away from tomorrow morning and back on Monday") came from
  our own domain, so the ignore-self rule catches it anyway.
- A row that still routes nowhere is marked **`unrouted`**, not `unfiled`, so it stops
  masquerading as triageable: `corr_unfiled` only returns `unfiled`.

**5. Orphan cleanup (data, 18 Sep).** Six rows had `building_id` null. Three were reply-all
duplicates of mail that filed correctly, now `ignored_duplicate`; three were our own
announcements, now `ignored_self`. **No resident email was lost** and nothing was deleted:
all 23 inbound rows are intact, status changes only. An earlier note in this session said
nine rows with resident replies at risk; that was wrong on both counts.

**6. Verified.** `corr_file_unfiled_new_thread` tested end to end as a real committee user
via `set_config('request.jwt.claims', …)`: thread created with the subject carried over,
contact created from the sender, inbound message linked back to its raw row, tray 7 → 6,
and the result findable by both message and thread search. The null-building row was
correctly refused and left `unfiled`. **The append-only guard was confirmed by accident**:
the attempt to reverse the test filing was rejected by `corr_messages_guard`
("hard delete is not permitted"), so the test thread remains at Curve as a real filed
email. That guard working is worth more than a tidy tray.

### v0.32.1 — the counters have to follow the search (18 Sep 2026)

`src/ResidentPortal.jsx` (`KeyFobRegister` filtering + header) and `src/db.js` (occupant
de-dup). No schema or migration change. Demo + production builds verified green.

- **Cause.** v0.32.0 computed `shown` (the list) from the search and filters, but computed
  the three tiles and every status chip from `all`. So searching "Ferguson" on Curve
  correctly narrowed 231 devices to the 2 at unit 606, while the tiles still read
  **231 devices / 55 units / 230 no holder** and the chips still read **All 231 · Issued
  231**. The list underneath was right. Reported, reasonably, as "search function not
  working": a list that changes while every number beside it insists nothing happened is
  indistinguishable from a dead search box, and the "Showing 2 of 231" line was below the
  fold on a phone.
- **Fix.** Filtering is split in two. `base` applies the search box and the Type/Purpose
  menus; `shown` applies the status chip on top of `base`. Tiles and chip counts both read
  from `base`, so a chip says how many of *the current search* are issued rather than how
  many of the building. `counts.registerTotal` keeps the building-wide figure for context.
- **Feedback added.** A result line sits directly above the tiles whenever anything is
  filtered: "N of M devices matching X · K units", with a Clear action that resets the
  search, both menus and the chip. The first tile relabels to "Devices found". The empty
  state gains a "Clear the search" button.
- **The whole-register no-holder notice now hides while filtering.** It is a data-quality
  signal about the register as a whole; repeating "2 of 2 devices have no holder recorded"
  over a two-row search result is noise.
- **Occupant de-duplication (`listAccessItems`).** One person can legitimately hold two
  `unit_people` rows for the same lot. Curve unit 606 has Debbie Ferguson as both owner
  and emergency contact, so she was listed twice under every key for that unit. Names are
  now de-duplicated case-insensitively.
- **Standing rule this establishes.** Any count rendered beside a filtered list must be
  computed from the same filtered set, or it actively contradicts the list. Where a
  whole-population figure is genuinely wanted, label it and show it alongside, never in
  place of, the filtered one.
- **Verified** with a 17-assertion logic test over a 231-row fixture shaped like live
  Curve (230 imported rows with no holder, plus the merged legacy row that has one):
  "Ferguson" gives 2 rows / 2 tile devices / 1 unit / 2 issued / 0 returned, key-number and
  unit searches give 1 and 2, a type filter gives 1, and a search combined with a
  non-matching chip gives 0 rows while the tiles stay on the search.

### v0.32.0 — Key & Fob Register reads the real table (18 Sep 2026)

`src/ResidentPortal.jsx` (the whole `KeyFobRegister` block rewritten, one db import, the
version line) + `src/db.js` (one new function, one demo shim, four demo rows) +
migrations 0013 and 0014. Demo + production builds verified green.

- **Cause. There were two key registers and they were never connected.** The screen
  labelled "Key & Fob Register" read `store.keyfobs`, the legacy JSONB content table.
  Every access item added through Unit Search, and every row of the 30 Aug Curve
  Birtinya bulk import, went to `unit_access_items`. So Curve held **230 real keys
  across 54 units, each with a key number, all invisible on the register** while
  `keyfobs` held exactly one row for that building. The data was never lost or
  mis-imported: the screen was reading the wrong table. Reported as "the Key & Fob data
  did not make it to the Register".
- **Fix.** New `listAccessItems(bid)` in `db.js` reads `unit_access_items` building-wide
  (three queries, not an embed, mirroring `listUnitsOverview`) and stitches on
  `unit_number` plus `occupants` (current `unit_people`). `KeyFobRegister` renders that,
  with one search box covering **unit number, resident name and key number**, status
  chips, and Type and Purpose menus. Editing, status changes and deletion reuse the
  existing v0.29.0 `updateAccessItem` / `deleteAccessItem`, so RLS
  (`can_edit_unit_registry`) is unchanged.
- **Type + Purpose, not one longer list.** Keys/Fobs/Cards describe what a device IS;
  Master/Service describe what it is FOR. Folding all six into `item_type` would make
  "master fob" unexpressible and would force every existing row to pick one. `purpose`
  is therefore a second axis (migration 0013). `item_type` already permitted `other` at
  the DB level but the dropdown never offered it; it does now.
- **Holder honesty — the deliberate non-feature.** All 230 Curve rows have no
  `issued_to`: a BM register records a key against a lot, not a person. `occupants` is
  used for SEARCH only. A row with no holder reads **"Holder not recorded"** in amber,
  with the unit's occupants shown beneath as context explicitly labelled *not* a record
  of who holds it. An inferred holder column is worse than an empty one the moment
  anyone relies on it in a dispute. A tile counts how many devices lack a holder, so the
  gap is visible instead of hidden. Verified: every Curve unit holding keys has occupants
  recorded, so name search reaches all 230 rows.
- **Building-level devices (migration 0014).** `unit_id` was NOT NULL, so master/service
  devices and the lock box had nowhere to live. Now nullable; those rows sort FIRST and
  render as "Common property". This closes the gap that made the 30 Aug import skip the
  Building Manager, Fire Warden Key Set and Emergency Access Lock Box rows.
- **Legacy rows are merged, not migrated.** The four remaining `keyfobs` rows appear
  read-only with a "legacy register" badge, the same treatment Unit Search gives them.
  Not migrated because two of the four name SeaHaven unit 828, which has no `units`
  record — inventing lot records to satisfy a foreign key is worse than badging them.
- **CSV.** Template and upload now target the real table (`unit`, `type`, `purpose`,
  `identifier`, `label`, `holder`, `status`, `notes`; blank `unit` means a building
  device), plus a new "Download register" export of the current filtered view. Upload
  inserts row by row and reports how many could not be added.
- **Traps avoided.** `AccessItemForm` is declared at MODULE level and the row renderer is
  a plain `row(r)` call with `key` on the returned Card — the nested-component remount
  trap this file has had three times. The load is NOT gated on `backend`, which is what
  left Unit Search empty in v0.29.1.
- **Deliberately not done.** The NAV entry stays committee-only: `show(role)` receives
  only the role, so it cannot read the per-building `bmRegistryWrite` switch, and showing
  the page to a BM whose switch is off would render an empty list (RLS returns no rows).
  Write controls already honour the switch via `canEdit`. Opening the register to the BM
  needs `navVisibleFor` to pass the building into `show`, which is a wider change.

### v0.31.3 — Add to Home Screen for iOS 26 Compact layout (5 Sep 2026)

Two files: `src/components/AddToHomeScreen.jsx` and `src/ResidentPortal.jsx` (one tour step
plus the version line). No `db.js`, schema or edge-function change.

- **Cause.** iOS 26 Safari ships with a "Compact" tab layout by default on fresh installs: one
  pill at the bottom of the screen holding a back arrow, the URL and a "..." (More) button.
  The Share button is inside "...". The older "Top" and "Bottom" layouts, and every earlier iOS,
  show Share beside the address bar. Both the floating panel and the Getting Started step said
  "tap Share"; Curve's committee chair had no Share button to tap and stopped there.
- **Fix.** The iPhone panel in `AddToHomeScreen.jsx` now shows two step-1 rows, each with its
  icon chip drawn inline (`Share`, and `MoreHorizontal` then `Share` from lucide): "If you see
  the Share icon (a box with an arrow), tap it" / "If you see ... instead, tap it, then tap
  Share." Steps 2 and 3 unchanged. A footnote covers Chrome on iPhone. The tour step at
  `GUIDES` → get-in reads the same way. No iOS version is named anywhere; the rule is to
  describe what the person can see.
- **Deliberately not done.** Detecting the Safari layout from JavaScript is not possible, so no
  attempt to show only the "right" row. Android copy is unchanged (one route, plus Chrome's
  native `beforeinstallprompt` when available). The component already returns `null` when
  running standalone, so installed users never see the button.
- **Follow-up outside the app.** The "Getting into NaloHub on your phone" A4 guide (4 Sep) still
  says "tap Share" on its home-screen step and should be reprinted with the two-route wording.

### v0.31.2 — UpdateBanner reaches production

`UpdateBanner` (v0.30.0) was defined in `ResidentPortal.jsx` but only rendered by the demo
root (the default export `App()`), which is what `demo.nalohub.com` builds. Production runs
`src/App.jsx`, which mounts `BuildingApp`, `Toast` and `AddToHomeScreen` and never mounted the
banner, so the "you are on an old build" prompt existed only on the demo. Caught when an iPhone
home-screen install sat on 0.30.0 with no prompt while a laptop and an Android phone had picked
up 0.31.1. Fix: export `UpdateBanner`, mount it in `App.jsx`. The demo root keeps its own
instance; neither shell renders it twice. See the "reverse trap" note in §4.

### v0.31.1 — printable guide header

`printGuide`'s `.head` was a flex row of the hosted logo (`https://nalohub.com/NaloHub-Logo.png`)
followed by a bold text lockup, but the logo *is* the wordmark, so all twenty cheat sheets printed
the name beside itself. The text div is now hidden by default and revealed only by the `<img>`
`onerror` handler, so a 404 on the hosted file still prints branded. Alt text added. Separately
(no code), the hosted PNG was replaced with a transparent, alpha-trimmed version; the old file had
an opaque light-grey panel that printed as a grey rectangle on white paper.

### v0.31.0 — sign-in code + usage analytics Layer 1 (4 Sep 2026)

Two streams built together, released as one deploy because both are small and both touch the
first minute of a person's day. Four files: `src/db.js`, `src/App.jsx`,
`src/components/SignIn.jsx`, and the version line in `src/ResidentPortal.jsx`.

**(a) Sign-in code.** The Magic Link email template gained `{{ .Token }}` beneath the existing
`{{ .ConfirmationURL }}` link. `SignIn.jsx`'s post-send panel now offers a code field calling
`supabase.auth.verifyOtp({ email, token, type: "email" })`, plus a resend and a line naming the
sender and pointing at Junk / Outlook's Other tab.

- **Code length is NOT hardcoded.** GoTrue's OTP length is a project setting
  (Authentication → Email), 6 on some projects and 8 on others depending on provisioning.
  The first draft of this checked `length !== 6`; the project was emitting 8, so every real
  code would have been rejected by our own screen with a message contradicting the email.
  Caught before deploy. The field accepts `CODE_MIN=6` to `CODE_MAX=10` and lets Supabase judge.
  **Do not "tidy" this back to 6.**
- The `verifyOtp` failure path maps expired/invalid to plain English; the resend path maps
  GoTrue's "For security purposes, you can only request this after N seconds" to a stated pause,
  extracting N when present. Raw auth errors read as faults to someone already locked out.
- Auth settings at time of release: **OTP length 6, OTP expiry 1800s (30 min), resend gap 60s.**
  Expiry governs the link and the code together — they are the same token. Minimum password
  length is 8 and applies only to platform admins (the password path is admin-only).

**(b) Usage analytics Layer 1 — app half.** The database half shipped 3 Sep (below).

- `logActivity(buildingId, role)` in `db.js`, above the DEMO MODE block, modelled on `audit()`:
  fire-and-forget, never blocks a building open. Guarded on both `VITE_SUPABASE_URL` and
  `VITE_DEMO_MODE`. A module-level `Set` de-dupes within a page load; the unique index is the
  real guard. Records a coarse `mobile`/`desktop` hint from the UA into `activity_events.device`.
- **`user_id` must be `auth.uid()`,** read from `getSession()`, not the app store's user id —
  the insert policy is `user_id = auth.uid() AND is_member(building_id)` and the two ids differ.
- The `App.jsx` hook sits **with the other effects, above the early returns**, because `user`
  is derived at render below them and hooks cannot be conditional. It resolves the role from
  `store.users` by `userId` and depends on `[buildingId, userId]` only, so a `store` change
  from an autosave does not re-fire it.
- Verified in production 4 Sep: two rows, correct role, correct Brisbane day, `desktop` and
  `mobile` both recorded.

### Security: `internal_email_token()` exposure closed (4 Sep 2026)

Found by `get_advisors(security)` while checking auth settings, then **confirmed by testing as
the `anon` role rather than assumed**: `public.internal_email_token()` is SECURITY DEFINER, reads
`vault.decrypted_secrets`, has **no guard in its body**, and `anon` held EXECUTE — so it was
callable at `/rest/v1/rpc/internal_email_token` by anyone holding the publishable key, which ships
in the browser bundle. It returned the 64-character secret.

```sql
revoke execute on function public.internal_email_token() from public, anon, authenticated;
revoke execute on function public.report_activity(p_from date, p_to date) from public, anon;
revoke execute on function public.report_actions(p_from date, p_to date) from public, anon;
```

`service_role` retains EXECUTE, so server-side callers are unaffected. Re-tested as `anon`:
permission denied. The two report functions already guarded internally with `is_platform_admin()`
so nothing leaked through them; the revoke is defence in depth, and was intended on 3 Sep but
never landed.

**Standing rule this reinforces:** a `SECURITY DEFINER` function that touches the vault or any
secret must have both an internal guard **and** a revoke. Neither alone. Run `get_advisors` after
any DDL.

### Usage analytics Layer 1 — database half (3 Sep 2026)

Applied to prod 3 Sep; the app half above did not ship until 4 Sep, which is why
`activity_events` sat empty in between.

- `activity_events(id, building_id, user_id, role, kind, device, occurred_at, day)`.
  `day` defaults to `(now() AT TIME ZONE 'Australia/Brisbane')::date`; unique index
  `activity_events_daily_uniq (building_id, user_id, kind, day)` makes active-days the native
  unit and keeps the table tiny.
- RLS: insert `user_id = auth.uid() AND is_member(building_id)`; select `is_platform_admin()`
  only. Committees never see individual login times.
- `report_activity(from, to)` (presence per building per role) and `report_actions(from, to)`
  (audit_log with `building.settings_updated` autosave noise stripped), both SECURITY DEFINER
  with the admin check inside, defaulting to the last 7 Brisbane days.
- Buildings with `data->>'internal' = 'true'` (SeaHaven + the 7 state reference shells, 8 in
  total) are excluded from both reports.

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
  **Until v0.31.2 this was only mounted in the demo root; see that entry.**
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

### v0.29.0 — editable unit registry, versioned conditions, unit-linked disputes (30 Aug 2026)

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
  the register they most often maintain. Addressed in the same release by the per-building
  `bmRegistryWrite` switch below.

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

### Curve Birtinya bulk import (30 Aug 2026, data operation)

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
- `units.notes` is now rendered by the v0.29.0 "Unit notes" card.
- Schema facts confirmed live: `buildings.name` lives in `buildings.data->>'name'` (JSONB);
  `unit_people` has `user_id, move_in, move_out, is_current, notes`; `unit_access_items` has
  `status, notes, ack_*`; `audit_log(building_id, actor, action, target, detail jsonb)`.

### 2026-08-08 (v0.25.1 — by-law hanging indent)

`src/ResidentPortal.jsx` only. v0.25.0 put `white-space: pre-wrap` on by-law text, which keeps
the leading spaces but lets *wrapped* lines fall back to the left margin — so "(a) …" began
indented and its second line didn't. Replaced with a small `ByLawText` component that splits on
newlines and renders each line as its own block, padded by `Math.round(leadingSpaces / 4) * 18px`
(capped at 3 levels). Continuation lines now hang under the clause they belong to, and (i)/(ii)
nest under (a)/(b). Used by both the By-Laws card and the NaloPilot by-law card. Blank source
lines become 7px spacers. Demo + prod builds verified green.

### 2026-08-08 (v0.25.0 — by-law display fixes + NaloPilot answers from by-laws)

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

### 2026-08-06 (v0.24.0 — Guides for everyone)

`src/ResidentPortal.jsx` only. Twelve new `GUIDES` entries (res-maint · book-apply · find-docs ·
message · privacy · join-in · events · corr-email · maint-history · nalopilot · docs-upload ·
complaint), all step labels verified against live buttons (incl. real maintenance stages New →
Triaged → In progress → Resolved, Dispute entry kinds Update / Email or message / Document /
From in-app messages, Documents visibility options, Events ⟨Post event⟩, Correspondence
⟨Unfiled⟩→⟨File⟩). Sectioned library via `GUIDE_SECTIONS` + `sec` per guide, grouped
rendering in `GuideDrawer` and Help hub. `VIEW_GUIDE` supports arrays with role-based
resolution in `GuideBar`. Four new `data-guide` tags; `PartyPopper`/`History` imports.
PLATFORM 0.24.0. Demo + prod builds verified green.

### 2026-08-05 (XSS hardening — Correspondence, shipped with v0.23.0)

The frontend half of the 5 Aug security review, folded into the v0.23.0 deploy so one commit
carries both. New `htmlToText()` helper above `CorrespondenceView`; both inbound-email sinks now
route through it: the on-screen thread render (was `dangerouslySetInnerHTML`, now plain text)
and the print-thread path (HTML bodies converted to text, then escaped — `${esc(isHtml ?
htmlToText(body) : body)}`). Zero `dangerouslySetInnerHTML` remains in the file. Verified:
`<img onerror>`, `<svg onload>` and `<script>` payloads neutralised; builds green. The
three backend fixes from the same review were already live in Supabase. Behaviour change:
HTML-only inbound emails display as clean plain text.

### 2026-08-05 (v0.23.0 — NaloHub Guides)

One change, `src/ResidentPortal.jsx` only. New Guides module inserted before `DemoOnly`:
`GUIDES` (8 guides: get-in/home-screen · maintenance record→vote · maintenance report export ·
walk-through · committee vote · invite people · compliance calendar · announcements; each
`{id, title, who, mins, icon, roles(u), steps[{t, check, target?, view?}]}` with on-screen
button labels wrapped in ⟨…⟩), `GuideDrawer` (library + guide modes, progress, reset, print),
`GuideBar` (contextual pill, `VIEW_GUIDE` map), `GuideText` (⟨…⟩ → button pills), `printGuide`
(A4 branded print window: navy/teal, logo from nalohub.com with hide-on-error fallback,
"Free to copy, print and share… 🌊 Be in the Nalo." footer, "Current at <month year>").
Small supporting edits: `HeaderAction` spreads `...p`; seven `data-guide` tags on the
buttons guides point at (Maintenance Report action, Reports Word-report, Walk-Through
load/start, Directory Add person, Compliance Word agenda, Announcements New); Help hub
gains the Guides grid (uses `user` from context); `GuideDrawer`/`GuideBar` mounted in
`BuildingApp`; PLATFORM bumped to 0.23.0. Demo + prod builds verified green.

### 2026-07-22 (v0.21.0 — Getting Started + Be In the Nalo, Phase 1)

Two features, one change, `src/ResidentPortal.jsx` only (no db.js / schema / edge-function changes):
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

### 2026-07-19 (v0.20.0)

Acted on Greg's feedback round. All changes are in `src/ResidentPortal.jsx` only (111 insertions /
27 deletions); no `db.js`, edge-function or schema changes, because new fields persist through the
generic JSONB store (`persistChange`) and `createMotion`'s `details` column. Demo + production
builds both verified green. Items shipped: managing-agent CTA (#1), multi-recipient announcements
(#2), scheme/plan reference (#3), editable Dashboard label + reorder (#4), motion document uploads
(#5), Fire Safety evacuation plan (#8), maintenance-workflow progress bar/next-step (#7), header
actions to body across all screens (#9). Proxy form (#6) confirmed already present — auto-generated
signable PDF via `openProxyFormPdf` in Voting → Proxies; nothing to add.

### 2026-07-19 (v0.20.0, follow-up)

Outbound announcement email wired: new `send-announcement` edge function (deployed to prod,
dormant until the frontend ships), `db.js` `sendAnnouncementEmail()` + demo no-op, and
`Announcements.post()` now emails residents (all / owners / specific) at their real addresses in
`backend` mode *in addition to* the in-app notice — BCC'd for privacy, reply-to the building's
committee email. Note: this is separate from the **Correspondence Hub**, which already emails
external parties (contractors, solicitors, strata) via `send-correspondence`. Also: first-week
playbook (`CommitteePlaybook`) now truly auto-retires once all items are done (was only
manual-dismiss) and says so in its subheading; and demo seed gained a scheme reference on both
buildings, a sample evacuation plan on SeaHaven, a targeted ("specific" audience) announcement,
and a document attachment on a demo motion.

### 2026-07-19 (inbound email — central building address)

Groundwork so each building can advertise ONE public address (`<slug>@send.nalohub.com`) that
lands in Correspondence. New `ensure-mailbox` edge function (deployed) provisions a clean
name-based slug per building (existing mailboxes are never renamed, so live reply-to tokens keep
working); `db.js` `ensureBuildingMailbox()`; and a **Building email address** card in Settings
(committee/manager) that shows + copies the address. Inbound already routes end-to-end in
`receive-correspondence` (catch-all `send.nalohub.com` → webhook → slug lookup → thread or
Unfiled tray) — the remaining step is operational, not code: enable **Receiving** on the domain
in Resend, add ONE MX record at Uptime cPanel for `send.nalohub.com`, and set the
`RESEND_RECEIVE_KEY` + `RESEND_WEBHOOK_SECRET` secrets. Deferred until receiving is verified
live: switching `send-announcement`'s reply-to from the committee email to the building's app
address (so announcement replies also land in-app).

### 2026-07-20 (inbound live · reply routing · quote fix)

Operational + code follow-ups:
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
