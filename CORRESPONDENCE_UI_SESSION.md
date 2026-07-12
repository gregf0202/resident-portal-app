# Correspondence Hub — UI Session Brief

**Purpose:** hand a fresh session everything it needs to build the App-side UI for the Correspondence Hub, wire the inbound loop, and stand up the backup guardrail. The server-side spine and the send path are already built, deployed, and verified. This session is **interface + receiving + backup**.

Read the companion spec `nalohub-correspondence-hub-spec.md` (design + guardrails) and `nalohub-correspondence-cost-and-risk.md` (risk register) if available. This brief is the actionable summary.

---

## 1. Where things stand (already done, live on prod)

Supabase project **NaloHub** (`lipwcsihcxndwwgzhiia`, region ap-southeast-2). App points here via `.env` `VITE_SUPABASE_URL`.

**Database — applied (`supabase/migrations/0001_correspondence_hub_foundation.sql`):**
- Tables: `building_mailboxes`, `correspondence_contacts`, `correspondence_threads`, `correspondence_thread_members`, `correspondence_inbound_raw`, `correspondence_messages`, `correspondence_attachments`.
- Enums: `corr_party_type` (strata_manager, insurer, solicitor, council, auditor, contractor, agent, owner, other), `corr_context_type` (general, maintenance, contract, compliance, dispute, application), `corr_direction`, `corr_status` (open, awaiting_reply, closed), `corr_visibility` (committee, restricted).
- RLS on all 7 tables. Helper `corr_is_committee(bid)` = active membership with `role in (bcc,admin,manager)` OR `msc = true`.
- **Guardrails enforced in the DB:** `correspondence_messages` is append-only (a trigger blocks hard delete and edits to content; only `delivery_status`, `deleted_at`, `external_message_id`, `in_reply_to`, `raw_id` may change). `content_hash` is auto-set (sha256) on insert. `correspondence_inbound_raw` has RLS enabled with **no policy on purpose** — only the service role (inbound function) touches it.

**Storage — created:** private bucket `correspondence` (attachments + raw inbound). Access via signed URLs only.

**Edge function — deployed, ACTIVE (`supabase/functions/send-correspondence/index.ts`):**
- `verify_jwt = true`. Authenticates caller, runs `corr_is_committee`, then (service role) provisions the building mailbox slug, resolves/creates contact + thread, writes the outbound message, uploads attachments, sends via **Resend**, updates status.
- Reply-To = `<slug>+<threadId>@send.nalohub.com` (plus-addressed, so replies thread deterministically).
- Reuses existing secret `RESEND_API_KEY`; domain via `CORR_MAIL_DOMAIN` (defaults `send.nalohub.com`).

**Client data-layer — written, UNCOMMITTED in `src/db.js`** (see §4). Also present: earlier uncommitted Unit Search agent-note + Directory tower/floor edits — they'll ship on the next app build too; review the diff before pushing.

---

## 2. First action — live smoke test

Before building screens, prove the send path end-to-end.

**Prerequisite:** a building in **production** where the signed-in user is `bcc` / `admin` / `manager` (or `msc = true`). Confirm this exists first (Greg's own building likely qualifies).

1. Sign in to the live app as that user.
2. Trigger a send (temporary button, or the compose screen once built):
   ```js
   await sendCorrespondence({
     buildingId: "<real building id>",
     contact: { name: "Test", email: "<your email>" },
     subject: "NaloHub correspondence test",
     bodyText: "Hello from NaloHub.",
   });
   ```
3. Expect `{ ok: true, deliveryStatus: "sent", threadId, messageId }`; the email arrives; it shows **Delivered** in the Resend dashboard (Emails → Sending); a thread + message row exist.
4. Confirm the guardrail: attempting `update correspondence_messages set body_text=... ` should be **rejected** by the trigger.

Note: Resend Free = **100 emails/day, shared with magic links**. Fine for testing.

---

## 3. What to build this session

### 3a. The Correspondence view (committee-only)
Architecturally this is a **backend (`db.js`) view like `UnitSearchView`**, not a store-based one. It calls the async `db.js` helpers and only functions in `backend` mode (demo returns empty via stubs).

Wire it into the app the same way other views are (in `src/ResidentPortal.jsx`):
- Add a `NAV` entry: `{ key: "correspondence", label: "Correspondence", icon: <lucide icon, e.g. Mail/Inbox>, group: "building", show: (r) => isCommittee(r) || r === "manager" }` — and gate on `msc` too if you want MSC to see it (`show` only gets the role; MSC is `user.msc`, so you may special-case in the nav filter like the maintenance items do).
- Add the component to the `view → component` map (~line where `unitsearch: UnitSearchView` is).
- Build these panels:
  - **Thread list** (`listCorrThreads`) — party name/org, subject, status chip, last-activity, a "restricted" badge, context tag. Filter by status / party type.
  - **Thread view** (`getCorrThread`) — the message trail (outbound/inbound bubbles), delivery status, attachments (via `corrAttachmentUrl`), and a **reply composer** (calls `sendCorrespondence` with the existing `threadId`).
  - **Compose new** — recipient (pick from `listCorrContacts` or new), subject, body, attachments (base64), context link (type + optional id), visibility (committee / restricted + member picker → `setCorrThreadMembers`).
  - **Contacts** — list/add/edit via `listCorrContacts` / `saveCorrContact`.
  - **Unfiled tray** — inbound messages that couldn't be auto-matched (see 3b); one-click assign to a thread/contact.
- Contextual entry points (optional but valuable): an "Email contractor" button on a maintenance job / contractor / contract that opens compose pre-filled with `contextType` + `contextId`.

**UI kit already in the file** (use these, don't reinvent): `Head`, `HeaderAction`, `Wrap`, `Card`, `Field`, `Input`, `Select`, `TextArea`, `Btn`, `Toggle`, `SectionTitle`, `Empty`, `useApp()` (gives `T`, `store`, `user`, `buildingId`, `backend`, `flash`), icons from `lucide-react`, theme `T` (accent, accent2, border, surface, surfaceAlt, textMuted, accentText).

### 3b. Inbound loop (durability-first)
- **Reconcile with the existing `inbound-email` edge function** (already deployed, `verify_jwt = false`) — reuse or add a sibling `receive-correspondence`. Don't duplicate blindly; read it first.
- Flow (guardrail 1 — never lose mail): on webhook, **immediately fetch full body + attachments from Resend's Received-emails/Attachments API, write raw to the `correspondence` bucket + insert a `correspondence_inbound_raw` row, then return 200.** Parse *after* persisting.
- Resolve thread: plus-address token `<slug>+<threadId>@…` first; else sender+subject match to an open thread; else **Unfiled tray** (never discard). Insert inbound `correspondence_messages` row + attachments; bump `last_activity_at`; set `status`.
- Hygiene: require DKIM/SPF pass, dedupe by provider message id, ignore auto-responders. Retries → dead-letter.
- **Config (Free plan):** point MX of `send.nalohub.com` at Resend receiving; register the webhook (Resend → Receiving) to the function URL; verify a shared secret / Resend signature since `verify_jwt` is off.

### 3c. Backup guardrail (guardrail 3)
- Enable Supabase **PITR/backups**.
- Build a scheduled export of correspondence (messages + attachments + raw) to **off-platform** storage in a separate account/region. **Open decision — Greg to pick the destination:** separate Supabase project vs Cloudflare R2 vs AWS S3. Ship with a documented restore runbook and a test restore before real correspondence flows.

---

## 4. Client data-layer API (in `src/db.js`, ready to call)

```
listCorrThreads(buildingId)
  → [{ id, subject, status, visibility, contextType, contextId, lastActivityAt, createdAt,
       contact: { name, email, org, partyType } | null }]

getCorrThread(threadId)
  → { thread: { id, buildingId, subject, status, visibility, contextType, contextId,
                createdBy, createdAt, lastActivityAt, contact },
      messages: [{ id, direction, fromName, fromEmail, toEmail, cc, subject,
                   bodyText, bodyHtml, deliveryStatus, deletedAt, createdAt,
                   attachments: [{ id, fileName, mime, storagePath, size }] }] }

listCorrContacts(buildingId)
  → [{ id, name, org, email, phone, partyType, notes }]

saveCorrContact(buildingId, { id?, name, org, email, phone, partyType, notes }) → id

sendCorrespondence(payload) → { ok, threadId, messageId, deliveryStatus }
  payload = { buildingId, threadId?,                     // omit threadId for a new thread
              contact: { id? | name, email, org, party_type },
              subject, bodyText, bodyHtml?,
              contextType?, contextId?,
              visibility?,                                // "committee" (default) | "restricted"
              restrictedMemberIds?,                       // user ids when restricted
              attachments?: [{ filename, contentBase64, mime }] }

updateCorrThread(threadId, { status?, visibility?, subject? })
setCorrThreadMembers(threadId, userIds[])                 // restricted-thread whitelist
corrAttachmentUrl(storagePath) → signed URL (1h)
```
Demo stubs exist for all of the above so `demo.nalohub.com` won't error.

---

## 5. Guardrails to honor in the UI (non-negotiable)
- **Committee-only.** Correspondence never appears for residents/owners — gate the nav on `isCommittee(r) || r === "manager" || user.msc`; RLS backs this up.
- **Restricted visibility.** Show a restricted badge; use the member picker; RLS already hides restricted threads from non-members, but the UI must not imply they exist.
- **Append-only.** No editing or hard-deleting messages in the UI. "Remove" (if offered) = soft-delete (`deleted_at`) only.
- **Durability-first inbound.** Persist raw before parsing; unmatched mail → Unfiled tray, never dropped.
- **Attachment cap.** Enforce a size limit (~15–25 MB) in compose; large files → link, not attach.

---

## 6. Facts & gotchas the cold session needs
- **Two data paradigms in this app:** store-based/in-memory (Directory, Documents, Meetings) vs backend `db.js` async (Unit Search, Voting, **and this feature**). Model the Correspondence view on `UnitSearchView`.
- **Roles:** `owner, tenant, bcc, admin, manager, strata`; `msc` boolean. `isCommittee(r) = r==='bcc'||r==='admin'`. Correspondence access also includes `manager` and `msc` (matches `corr_is_committee`).
- **Resend:** Free (3,000/mo, 100/day, 1 domain, 30-day retention), domain `send.nalohub.com` verified, Resend region **Tokyo (ap-northeast-1)**; API `api.resend.com` is region-agnostic. Move to Pro at go-live for a dedicated `mail.nalohub.com` receiving domain + longer retention.
- **Existing edge functions** (don't collide): `send-email`, `inbound-email`, `nalo-answer`, `ingest-legislation`, `permit-pdf`, `proxy-form-pdf`, `stripe-billing`, `stripe-webhook`, `billing-cron`, and the new `send-correspondence`.
- **Build note:** `node_modules` is macOS-native; the Linux sandbox can't run `vite build` or `esbuild`. Verify syntax with `@babel/parser` (`node -e "require('@babel/parser').parse(fs.readFileSync('src/db.js','utf8'),{sourceType:'module',plugins:['jsx']})"`). Greg builds on his Mac.
- **Nothing is deployed to the running app** until Greg builds + pushes (Netlify). Server pieces (migration, bucket, function) are already live; client pieces are inert until the app ships.

---

## 7. Session checklist
1. [ ] Confirm a prod building where the user is committee/admin/manager/msc.
2. [ ] Smoke-test `sendCorrespondence` (see §2); verify Delivered + append-only.
3. [ ] Build the Correspondence view (thread list, thread view + reply, compose, contacts, Unfiled tray).
4. [ ] Wire nav entry + view map; contextual "Email" buttons (optional).
5. [ ] Inbound: reconcile/extend `inbound-email`; durability-first persist; thread matching; Unfiled tray; configure Resend Receiving + MX + webhook secret.
6. [ ] Backup: enable PITR; build off-platform export (destination TBD with Greg); test restore.
7. [ ] Verify with `@babel/parser`; hand Greg a clean diff to build + deploy.
