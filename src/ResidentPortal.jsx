import React, { useState, useContext, createContext, useMemo, useEffect, useRef } from "react";
import {
  Megaphone, Wrench, CalendarDays, PartyPopper, History, CalendarCheck, Image as ImageIcon, ShoppingBag,
  MessageSquare, FileText, Receipt, Users, ClipboardCheck, Plus, X, Check, ChevronRight, ChevronLeft,
  ArrowLeft, Menu, Building2, Settings, Car, ArrowUpDown, Flame, MapPin, Pin, UserPlus,
  AlertCircle, Clock as ClockIcon, Lock, LayoutDashboard, Mail, Eye, Home, Sparkles, Upload, Paperclip,
  Tag, Calendar, Phone, RefreshCw, Sofa, Dumbbell, FolderOpen, Trash2,
  Sun, Cloud, CloudRain, CloudSun, Gavel, Wind, MessageCircle, Download, Printer, BarChart3,
  Video, ExternalLink, ListChecks, Vote, KeyRound, ShieldAlert, Search, Store, ThumbsUp, HelpCircle, Pencil,
  Boxes, Bell, DollarSign, Smartphone, Inbox, Rocket, Trophy, Copy,
  Scale, BookOpen, ShieldCheck, CalendarClock, AlertTriangle, Send, Info,
  Briefcase, HardHat, ClipboardList,
} from "lucide-react";
import { parseCSV, toCSV, downloadCSV, readFileText } from "./csv.js";
import { Document as DocxDocument, Packer as DocxPacker, Paragraph as DocxP, TextRun as DocxT, HeadingLevel as DocxH, ImageRun as DocxImg, Table as DocxTable, TableRow as DocxTR, TableCell as DocxTC, WidthType as DocxW, ShadingType as DocxSh, BorderStyle as DocxB } from "docx";
import GuidedTour from "./components/GuidedTour.jsx";
import { parseNotice, blocksText, noticeHtml } from "./noticeEmail.js";
import { audit, searchLegislation, loadDisputes, createDispute, appendDisputeEvent, setDisputeStatus, verifyDisputeChain, uploadAttachment, attachmentUrl,
  unitHealthCheck, listUnits, createUnit, addUnitPerson, addUnitPet, addUnitVehicle, addAccessItem, listAccessItems, updateAccessItemStatus, addUnitBreach,
  listAccessDescriptors, saveAccessDescriptor, setAccessDescriptorActive,
  listAccessEntitlements, setAccessEntitlement, bulkSetAccessEntitlements,
  bulkClassifyAccessItems, runAccessAudit, uploadAccessReceipt, accessReceiptUrl, suspendAccessItem,
  listUnitsOverview, updateUnit, updateUnitPerson, moveOutUnitPerson, restoreUnitPerson, moveOutUnitPeopleOfType, deleteUnitPerson,
  updateUnitPet, deleteUnitPet, updateUnitVehicle, deleteUnitVehicle, updateAccessItem, deleteAccessItem, updateUnitBreach, deleteUnitBreach,
  listApplications, createApplication, decideApplication, withdrawApplication, listApplicationAttachments, uploadMedia, mediaUrl, addApplicationAttachment, listPermits, openPermitPdf,
  listMotions, listMotionVotes, createMotion, castVote, withdrawMotion, listProxies, createProxy, revokeProxy, openProxyFormPdf,
  listMaintActivity, addMaintActivity, listMaintQuotes, addMaintQuote, setQuoteStatus,
  listContracts, saveContract, deleteContract, listContractors, saveContractor, deleteContractor,
  listWalkItems, seedWalkDefaults, listWalks, createWalk, listWalkResults, setWalkResult, completeWalk,
  listNotifications, markNotificationRead, markAllNotificationsRead, listMotionComments, addMotionComment,
  addWalkItem, removeWalkItem, setWalkResultPhoto, setWalkResultMaint, mediaBlob, updateUnitAgent, amendMotionConditions, DEMO_UID, exportBuildingData,
  listWalkSections, listFindings, listFindingEvents, raiseFinding, updateFinding, closeFinding, reopenFinding, observeFindingAgain, setWalkMeta, issueWalk, discardWalk, amendFinding, setWalkResultsBulk,
  loadMyBuildingBilling, startPaymentSetup, getDocumentFile, getGalleryImages,
  listCorrThreads, getCorrThread, listCorrContacts, saveCorrContact, sendCorrespondence, sendAnnouncementEmail, previewBroadcast, listCommitteeNotices, createCommitteeNotice, deleteCommitteeNotice, listDistributionLists, saveDistributionList, deleteDistributionList, listAnnouncementSends, ensureBuildingMailbox, updateCorrThread, setCorrThreadMembers, corrAttachmentUrl, listCorrUnfiled, fileCorrUnfiled, fileCorrUnfiledNewThread, searchCorrespondence } from "./db.js";
import { supabase } from "./supabaseClient.js";

/*
  Resident Portal — multi-building prototype (v3)
  Greg provisions buildings; a BCC committee governs access + protected content per building.
  PROTOTYPE: in-session state, simulated auth/email. Supabase swap point = the `seed` object
  + role gates -> tables + RLS scoped by building_id.
*/

const PLATFORM = { name: "Resident Portal", version: "0.40.0" }; // 0.40.0: Unit Search marks owners who live elsewhere with a small purple Investor dot (the committee's word, kept as a display flag, never a category: they remain owners for votes, levies and notices). Same rule as the Lives here pill: lives_here false, or blank on a lot with a current tenant. Dot on the unit record, on every owner in the Browse list, a legend that filters, and typing "investor" in the search finds them. New unit_people.home_address (0037) holds the owner's home or business address when it is not this building, as the QLD roll requires; editable on add and edit, owners only, readable only by those who can edit the register. // 0.39.2: The Home Screen app picks up the sign-in Safari already has. 0.39.1 only helped if the app was added before signing in; the usual order (sign in in Safari, then Add to Home Screen) still opened on the sign-in screen, because Supabase keeps the session in localStorage and iOS copies only cookies into a new Home Screen app (iOS 17.2+). Copying the whole session in a cookie was rejected: both apps would share one refresh token, and with refresh-token reuse detection on, whichever refreshed second would get the session revoked and sign both out. Instead the browser keeps its current access token in a first-party cookie nh_handoff (Secure, SameSite=Lax, expires with the token, never written by the Home Screen app), and a Home Screen app that starts with no session sends it once to the new session-handoff edge function, which checks it with getUser and returns a one-time magic-link hash from auth.admin.generateLink; verifyOtp({ token_hash, type: "email" }) then gives the app a separate session of its own. The cookie is deleted after one attempt; if it has expired or fails, the 0.39.1 code screen takes over. src/handoff.js, App.jsx (Splash while it runs). // 0.39.1: Home Screen sign-in. The Sign in button in the email always opens the phone's browser, never the Home Screen app, and the two keep separate sign-ins, so a resident who tapped the link was signed in in the browser and asked for their email again by the NaloHub icon. SignIn.jsx now detects the Home Screen (display-mode standalone / navigator.standalone) and leads with the code there: "Email me a sign-in code", "Type the code from that email here", a line explaining that the email's button opens the browser, and the cursor placed in the code box. The waiting-for-code state (email + time) is kept in localStorage for 30 minutes, the OTP expiry, because switching to Mail often makes iOS reload a Home Screen app, which used to drop the person back on the empty email screen with the code in hand. Browser sign-in is unchanged. // 0.39.0: Committee-to-committee gets its own home, and the building manager's access becomes the committee's choice. Announcements now means "to residents", full stop. New Committee Notices screen (own table committee_notices, migration 0032, RLS: committee only, plus the building manager on a notice posted with "Share with the building manager"), because hiding a committee note in the UI while it sits in the announcements store is not privacy. Email is a nudge by default: title, one line and an Open in NaloHub button, detail left in the app (send-announcement v10, template v3 linkOnly/openUrl/privateNote/whyLine); tick "Include the detail in the email" for the routine notes. New audiences committee and committee_bm resolve from memberships, never the register, so they follow whoever holds the role after an AGM. Correspondence for the building manager was a source constant, on for every building with no way to switch it off; it is now buildings.data.bmCorrespondence, off by default, enforced by corr_is_committee() (0032) and shown in Settings under "Your building manager". Two findings while building it: a manager carrying the msc flag would have walked straight past that toggle (0033 excludes managers from the msc bypass), and an owner carrying msc IS a committee member, already emailed committee notices, so is_committee_member() (0035) lets them open one. Documents needed no change: the manager already sees only the documents marked for everyone. Also in 0.39.0: Managing agents becomes an audience (the agent on each tenanted or agent-managed lot, from units.agent_email plus Managing agent contacts on the register, one email per agency: 11 at Curve across 12 lots, reachable from nowhere until now), and Send to becomes tick boxes so one notice can carry several groups at once (migration 0036 unions and de-duplicates them; send-announcement v11 takes audiences[]). Announcements stored with audience "multi" carry the chosen tokens in audiences[] and fix their in-app visibility to the app members they reached. // 0.38.0 also: the NaloHub wave runs along the bottom of the email header, the app header's three wave paths painted once onto navy as a 1200x64, 16-colour PNG (about 1 KB) at public/email/nalohub-wave.png, template v2, send-announcement v9. // 0.38.0: Notice emails look like they come from the building. One template, src/noticeEmail.js, byte-identical to supabase/functions/send-announcement/noticeEmail.js, builds both the email that is sent (send-announcement v8) and the "See the email residents will get" preview in the composer (a sandboxed srcDoc iframe). Navy header with the building logo (or its initials) and name as the prominent element; the building address in a slim strip under the header, again in a highlighted box with a Save to contacts prompt, and a Reply to your committee button, because moving residents onto a new address is slow and every notice should help; a signature block with poster name, role, building and date; a dimmed Powered by NaloHub mark in the footer. Images are low-res and hosted, because mail apps block data: URLs: the app shrinks the building logo to a 96px PNG and a notice photo to a 720px JPEG before sending, send-announcement stores them in the new public email-assets bucket (0031: 300 KB cap, PNG/JPEG only, not listable), and the NaloHub mark is a 1.5 KB 107x36 PNG at public/email/nalohub-mark.png. Notice text gains safe formatting: **bold**, dash or numbered lists, [text](https://...) links, bare web and email addresses linked; the parser escapes first and emits only http(s) and mailto links, and the app renders the same parse as JSX (no innerHTML). B, List and Link buttons above Details. Plain-text part rebuilt from the same parse. // 0.37.0: Notices reach the building, not just the app. send-announcement resolved recipients from memberships, so "All residents" meant everyone who had signed in: at Curve 1 person, against 98 distinct email addresses on the unit register. New broadcast_recipients() (migrations 0029, 0030) merges current register owners and tenants with app members, de-duplicated on email, and is called by both the composer preview and send-announcement v7, so what the committee is shown is exactly what is sent. New audiences: Residents (tenants plus owners who live in their unit), Tenants, and Owners who live elsewhere, alongside Everyone and Owners. unit_people.lives_here (null = follow the tenancy) is a tappable Lives here / Lives elsewhere pill on owners in Unit Search. Saved distribution lists (distribution_lists, RLS to admin/bcc/strata/manager): hand-picked, or a rule (audience narrowed by level, derived from unit numbers like 606 or G01, and by pets); saved from the composer or managed under Distribution lists; archived people drop out on their own. Every send writes announcement_sends (who, when, emailed or not), shown to posters on the notice as the send record. Resend caps a message at 50 addresses, so BCC now goes in batches of 45; the old single call would have failed outright past 49. Posting is still the only thing that emails anyone. // 0.36.0: The walk-through register becomes correctable, searchable and complete. (1) A closing photo can be taken outside a walk: the finding panel has its own camera, so a job confirmed done between walks gets its after photo. (2) Closures between walks reach the report: walkClosures() puts a finding closed at a walk in that walk, one closed between walks in the next walk, and on the latest walk lists anything closed since, so a copy pulled for a meeting is current; the tracking table counts them too. Before this they vanished from every report. (3) Findings can be amended by the committee, and only with a reason: migration 0028 makes the database refuse any change to class, place, observation, outcome, owner, due date or risk without one, refuses it on a closed finding, and writes every before and after into the trail as an Amended event; event notes and photos are now immutable once written. Before this, anyone with maintenance rights could change those fields with no record at all. (4) Each duty group on a walk has Nothing to report (answers every unanswered question OK in one tap) and Not walked (recorded on the walk with a reason in sections_not_walked; the report lists it, and a group no longer counts as inspected unless it was walked). (5) Export PDF opens its tab the moment it is pressed, with a working screen and a photo counter, then the report replaces it, so Safari no longer blocks it as a pop-up. (6) The register has a search box across every finding, open or closed, and a Closed tile; a closed finding is a fixed record, Reopen is gone from the screen and refused by the database, and a recurrence is raised as a new finding. Also: the demo personas no longer carry the owner's name or unit. // 0.35.4: Every date a person reads is the local calendar day. 0.35.3 fixed walk dates; the same UTC fault was everywhere a time became a date. Postgres evaluates CURRENT_DATE and timestamptz::date in UTC, and the edge runtime and toISOString() are UTC too, so anything before 10am in Queensland read as yesterday. Migration 0025 adds today_local() and rewrites billing_daily, gen_building_invoice, create_adhoc_invoice, expire_lapsed_proxies and issue_parking_permit onto it (the permit approval date came from decided_at::date, not from the column default, so the default alone would not have fixed it), plus the invoices, parking_permits and proxy_appointments defaults. The billing job runs at 06:00 AEST, which is 20:00 UTC the previous day, so it had been running every day against yesterday: invoice dates, monthly invoice day, trial reminders and late fees were a day behind, and billing-cron charged invoices a day late; both fixed (billing-cron v9, now in the repo). proxy-form-pdf printed its generated date in UTC (v9). In the app, 34 places cut a stored timestamp to 10 characters to get its date, which defeated fmtDate (it already converted full timestamps) because the caller had already thrown the time away: decisions, notifications, disputes, key receipts, applications, correspondence, marketplace expiry, the AGM pack date and file names. They now go through localDay(), which passes a plain date through untouched and converts a timestamp to the local day; addDays() parses locally instead of via UTC; db.js move-out, key returned and export dates use localDate(); BillingPanel formats paid dates locally. // 0.35.3: Walk dates are local, and there is one way to finish a walk. walk_date and walkthrough_findings.first_raised_on defaulted to CURRENT_DATE, which Postgres evaluates in UTC, so anything started before 10am in Queensland was dated the previous day: the walk opened at 09:31 on 20 Sep was stored as 19 Sep. The app now sends the device local date (localDate() in db.js, also replacing the UTC toISOString slice in the demo shims) and migration 0024 makes the fallback default the Brisbane date. Separately, the Complete walk button set status=completed with no issued_at, and only in-progress walks offered Continue, so a walk ended that way could never be issued, never entered the tracking table and printed as Draft forever. The button is now Go to Finish, which scrolls to the Finish card where Issue this walk lives, and Continue is offered on any walk that has not been issued, which also recovers any walk already stranded. The in-app walk-through guide, which still said Complete walk, named a Word button that no longer exists and sent every fault to Maintenance, is rewritten for the register. // 0.35.2: All requests can be filtered and exported. The list of every application and booking a building has ever received was a flat, newest-first list with no way to narrow it, which is fine for a year and then is not. It now has a search box (unit number, resident name, rego, or words in the request), type chips (pet, lot improvement, parking permit, keys, other, bookings), status chips with live counts (awaiting, approved, declined, withdrawn), and for the committee a Decided-by filter (BCC vote vs direct committee approval, read from the decision note the vote engine writes) and a submitted-date range defaulting to the last 12 months. Counts are read from the base filter so the number beside a status chip agrees with the search, the same rule the Key Register learned in v0.32.1. Export for AGM pack writes the filtered list as a branded Word table, one row per request with date, request, unit, decision, status and who decided it, and the conditions of approval beneath the row they bind, so the committee can table a year of decisions without retyping any of them. Each card in the list now names the type, the unit and how it was decided. // 0.35.1: a parking permit can be verified by anyone who scans it. New public/permit.html (served at portal.nalohub.com/permit.html?id=<permit uuid>, copied into dist by Vite like the wordmark) reads the new permit-verify edge function (verify_jwt=false, fmt=json) and shows the permit number, building, validity window and a status computed on Brisbane dates: Current, Not yet started, Expired, Revoked. It never returns unit, vehicle or rego, and it looks up by uuid because permit numbers repeat across buildings (PP-0001 exists at Curve and at SeaHaven). The page lives on our domain rather than on the function because the Supabase gateway on *.supabase.co delivers a text/html response as text/plain (confirmed in function_edge_logs), so the function serves JSON and the page renders it. The QR on the redesigned tent permit (navy header, building name prominent, NaloHub mark, aerial photo of the building) encodes that URL; the permit-pdf restyle to match is still to do and is specified in claude/PARKING_PERMIT_TENT_SPEC.md. // 0.35.0: the Walk-Through becomes a register, and the report becomes its rendering. walkthrough_results answers a question on ONE walk, so a finding lived only as free text in a note and nothing carried forward: measured against Curve's own paper walkarounds, carry-over between June/August and September was running at about one item in ten, and the items lost were disproportionately the ones marked "no visible improvement", including a WHS hazard recorded as unremedied and then absent. walkthrough_findings (0021) is the missing object: a permanent per-building ref (CB-0001), a class (S standard / R rectification / C contracted works / H hazard / L lot owner / G governance), a duty snapshot, an owner, a due date, and an append-only event trail giving walks_open. The rules are in the database, not the UI: a hazard cannot exist without a risk rating, an S-class finding can never be promoted to maintenance (40 recurring cleaning observations would wreck the Maintenance Report KPIs that answer "bare assertions"), findings are superseded never deleted, the trail cannot be rewritten, and CLOSING requires is_committee() because closure is the committee's act, not the caretaker's (per building, so the BM edition can invert it via buildings.data.walkthrough_closure). Curve's generic 22-item checklist is retired in favour of 13 duty groups and 176 standing questions (0022), each citing its Schedule 1 line and contracted frequency, with the 24 that rest only on cl 3.2/3.4 marked as weaker evidence; 90 findings ingested from the two paper walkarounds (0023). printWalkReport() renders the register as a branded A4 report in eight parts, closed-first, with the recurrence schedule (S-class open at 3+ walks) as an appendix produced on request rather than routinely. Photo evidence is the point of the report, so it is carried properly: camera capture on raising a finding, on marking one still present, and on closing it, with the before-and-after pair rendered side by side in Part 2. Thumbnails are downscaled client-side to 240px at q0.72 so a photo-heavy walk still produces a file that will send, and the full image stays in storage one tap away on the finding. The Word export was rebuilt to mirror the report rather than being a flat tick list: same eight parts, same branding, same pairs, so the two formats cannot disagree. Register tiles now drill into the findings behind them and every finding opens a drawer with its whole append-only history and every photograph, which is what a bare count on a tile could never answer. Open hazards get their own card above everything else. The recurrence schedule is no longer an option; every report carries it. A walk-over-walk block reports the closing ratio and whether the building is improving or deteriorating. Resume is now 'Continue this walk', issued walks say so, and the how-it-works copy was rewritten for the register model. Also: the printable wordmark moves into public/ and both printGuide and printWalkReport load it same-origin as /NaloHub-Logo.png. It was fetched from https://nalohub.com/NaloHub-Logo.png, which now returns 403 through both the cloud and desktop proxies, so every printable cheat sheet and every walk report was one outage away from silently falling back to the text wordmark. Vite copies public/ into dist, so Netlify serves it beside the app on both portal and demo. The onerror fallback stays. // 0.34.0: Key & Fob Register becomes a register, an entitlement record and an audit. Descriptors are now per-building DATA (migration 0019) rather than a fixed list: the Curve BCC asked for thirteen, but eight differed only by fire-stair level and two were the Purpose axis welded into a string, so a fixed list would have made a new level a schema change and baked one building floor plan into every building. Each unit gets a static entitlement per descriptor; devices carry issued / on hand / suspended, who signed for them (owner, managing agent or tenant, with the owner authority a tenant issue requires) and the signed receipt file. Lost devices are suspended and never deleted. access_audit (0020) reconciles entitlement against issued and on hand per unit, plus building stock and anything not yet classified, and exports for the Caretaker. Four tabs: Register, Entitlements, Audit, Descriptors. // 0.33.2: parking permits print their unit number. issue_parking_permit derived unit_number FROM the units register via applications.unit_id, so wherever the register has no matching row the permit issued with unit_number NULL and the permit-pdf edge function printed "UNIT#" followed by nothing. That is not an edge case: only 2 of 12 production buildings have any units rows, and no unit_people row carries a user_id, so the app cannot look a submitter unit up at all — details.unit arrived empty and both permits in production (PP-0001, PP-0002) are blank. A dash permit exists to tie a car to a lot, so it was the one field that could not be missing. Inverted in migration 0018: the unit number the submitter types is authoritative and is what prints; the register is consulted only best-effort, to set unit_id when the typed number happens to match (which links the permit into Unit Search) and as a fallback when nothing was typed. Deliberately no validation against the register — that would reject residents in the ten buildings which have none, and the committee already sees the unit on the approval card before approving. The permit form gains a required Unit field, because the database half alone cannot stop a blank arriving. // 0.33.1: Back is now a button in the BODY of every screen that has a back target, not only a chip on the header image that scrolls away, plus a Back to Correspondence at the foot of a thread, which is the longest screen in the app. Party list gained Resident tenant and Building manager (both were being filed as Other, which is why all 8 contacts sat there), Agent became Managing agent at the database level too, and the list is ordered by how often a committee deals with each party rather than by the enum sort order. Migration 0017. // 0.33.0: Correspondence can file and be searched. An inbound email could only be filed onto an EXISTING thread, and the only way to make a thread was to send an email, so the first inbound email for any building was unfilable: Curve had 0 threads and 7 unfiled items with a permanently disabled File button. New corr_file_unfiled_new_thread RPC (migration 0015) starts a thread from the email itself, matching or creating the contact from the sender and sending nothing. One search box now covers thread subject, party name, email and organisation, and the words inside every message body, via a generated tsvector (0015) with guillemet highlighting (0016) so no email HTML ever reaches innerHTML. Unfiled tray gained a filter and the dead File button now explains itself. Announcements send from the building own address instead of no-reply@, and the receiver ignores our own domain and prefers a real mailbox slug, which is what produced 6 unroutable orphan rows. // 0.32.1: Key & Fob Register counters follow the search. The tiles and status chips were computed from the whole register, so searching a name correctly narrowed the list while every number beside it still read the building total, which is indistinguishable from a broken search box. Filtering is now split into base (search + Type + Purpose) and shown (base + status chip), both counts read from base, a result line states "N of M devices matching X" with a Clear action, and the whole-register no-holder notice hides while filtering. Occupant names de-duplicated: one person can hold two unit_people rows for a lot. // 0.32.0: Key & Fob Register reads unit_access_items (the table Unit Search uses) instead of the legacy store.keyfobs, so bulk-imported access data finally appears: Curve Birtinya held 230 imported keys the register could not see. One search box covers unit number, resident name and key number; status chips plus Type and Purpose filters. New Purpose axis (Resident / Master / Service / Other, migration 0013) sits alongside Type rather than replacing it, so a master fob is still a fob. unit_id is now nullable (migration 0014), giving building-level masters, service keys and lock boxes a home instead of being skipped. Devices with no recorded holder say so rather than borrowing an occupant name. CSV download, template and upload; legacy keyfobs rows merged read-only and badged. // 0.31.3: Add to Home Screen instructions describe what the person sees, not an iOS version. iOS 26 Compact layout (the default on a fresh install) hides Safari's Share button behind a "..." menu beside the address bar, so "tap Share" stranded a Curve committee chair. AddToHomeScreen.jsx (src/components) now shows both routes: Share icon, or "..." then Share; the Getting Started tour step says the same. const PLATFORM = { name: "Resident Portal", version: "0.31.2" }; // 0.31.2: the update banner shipped in 0.30.0 has never run in production. UpdateBanner was defined in ResidentPortal.jsx but neither exported nor rendered anywhere except the DEMO root (the default export App(), which the demo build uses). Production runs App.jsx, which renders BuildingApp/Toast/AddToHomeScreen and never mounted it, so the whole point of 0.30.0 (stop people being stranded on old builds) applied only to demo.nalohub.com. Caught when an iPhone home-screen install sat on 0.30.0 with no prompt while laptop and Android had picked up 0.31.1. Fix is two lines: export the component, mount it in App.jsx. The demo root keeps its own instance, so neither app renders it twice. const PLATFORM = { name: "Resident Portal", version: "0.31.1" }; // 0.31.1: the printable guide header drew the wordmark twice. `.head` is a flex row of the hosted logo (https://nalohub.com/NaloHub-Logo.png) followed by a bold text lockup "NalOHub", but the logo IS the wordmark, so all twenty printable cheat sheets carried the name beside itself. The text div is kept purely as a fallback: hidden by default, revealed by the img onerror handler, so a 404 on the hosted file still prints branded rather than blank. Adds alt text too. Separately and with no code involved, the hosted PNG was replaced with a transparent, alpha-trimmed version; the old file had an opaque light-grey panel that printed as a grey rectangle behind the mark on white paper. const PLATFORM = { name: "Resident Portal", version: "0.31.0" }; // 0.31.0: first sign-in is the adoption gate, so it now has two doors. The sign-in email carries a numeric code alongside the link, and the waiting screen accepts it: the code is device-agnostic, so it survives the three things that quietly break a link and look identical to the person (email opened on the laptop while the phone stays locked out; a corporate mail scanner opening the link and burning it before they tap; the link opening inside the mail app's own browser, where Add to Home Screen is not offered). Code length is NOT hardcoded — GoTrue's OTP length is a project setting, so the field accepts 6 to 10 digits and lets Supabase judge. The waiting screen also names the sender and points at Junk and Outlook's Other tab, and the 60-second resend gap is explained as a pause rather than shown as a raw error. Prompted by a Curve committee member who could reach NaloHub on her laptop but not her phone. Also in this build: usage analytics Layer 1 — logActivity() in db.js, fired from a useEffect in App.jsx on building open, writing one row per person, per building, per Brisbane day to activity_events, with a coarse mobile/desktop hint; the DB half shipped 3 September. const PLATFORM = { name: "Resident Portal", version: "0.30.0" }; // 0.30.0: people were being stranded on old builds. There is no service worker, so any page load fetches the newest code — but nothing makes people load the page, and the home-screen app on iOS has no address bar and no pull-to-refresh, so a phone left open can sit on an old build indefinitely. The build now stamps /version.json (vite.config.js reads PLATFORM.version, so this line stays the single source of truth) and the running app compares it on launch, on focus, on resume from background, and every 15 minutes. When they differ a quiet banner offers Refresh. It never reloads on its own — someone may be mid-way through a maintenance report — and it stays silent when offline or when version.json is missing. netlify.toml gains no-store on version.json and immutable caching on the content-hashed /assets/*, which also makes repeat loads cheaper on mobile data. const PLATFORM = { name: "Resident Portal", version: "0.29.2" }; // 0.29.2 (audit pass): Unit Search "+ Dispute" used createDispute, which has no demo shim, so it failed on demo — it now uses the same store path as the Disputes view and demo disputes show against their unit. Documents: the per-row "Release" button was nested inside the whole-row button (invalid HTML, swallowed clicks); the row is now a keyboard-accessible div. Three handlers failed silently: Messaging with no subject, Bookings with no date, Documents with no file/category — all now say what is missing, and Messaging also rejects an empty body instead of sending it. const PLATFORM = { name: "Resident Portal", version: "0.29.1" }; // 0.29.1: Unit Search opens on a browsable list of every unit — owner and tenant names, pet/vehicle/key counts, agent and notes markers — instead of a bare row of numbers, and the search box filters it by unit number OR resident name as you type. Searching a name that lands on one unit opens it. Fixes a real gap: the unit list was behind an `if (backend)` guard, so on the demo (no Supabase) it never loaded at all and the screen was an empty search box with nothing to discover. New listUnitsOverview() in db.js (5 queries, demo-shimmed). // 0.29.0 combines two streams built in parallel. (a) Versioned Conditions of Approval: inline add/remove replaced by Amend (any BCC member, reason required); each amendment snapshots the prior conditions and every vote cast against them into motion.details.history, bumps motions.version, sets live votes aside and re-alerts the BCC; amendment history with strike-through diff; tally labelled with the version it counts. (b) Unit registry: edit + remove on every person, pet, vehicle, key and breach; unit-level edit (lot, spaces, notes); owners/tenants archived via Moved out (is_current + move_out) and restorable under "Previously at this unit"; "replacing the current owner/tenant" archives the incumbent; new Unit notes card; App account badges matched on email (green) or same-unit name (amber); "App members not on the register" with one-tap add; Other contacts section for emergency contacts and property managers. Plus: disputes now link to units in both directions (Log from Unit Search, unit picker in Disputes) — unit_id was never written before, so the Disputes section could never populate; Managing agent card always offered rather than hidden until a tenant exists; per-building "Who maintains the unit register" toggle (Settings, committee-only) letting the BM maintain the register, off by default, enforced by can_edit_unit_registry() in the database. Migrations: unit_health_check rewrite, amend_motion_conditions + motions.version, can_edit_unit_registry + registry policies. // 0.27.0: "Set up by" provenance line on the committee dashboard and in Settings (who established the record, who funds it, committee-only Change with append-only novations; stamped at the final Getting Started gate); "Export everything" beside it, built on the existing building export, with a visible export log (who, when) on building.exports. Export no longer pulls document/gallery file payloads into the workbook (reads the *_meta views). // 0.26.0: Maintenance Report v2 — summary page first (five tiles incl. Approved this period, "waiting on your decision" panel with dates sent, waiting-on breakdown, oldest open item), detail grouped by what each item is waiting on, resolved items as a compact table with a period total; per-item "waiting on" field (Triage card); exactly one ACCEPTED quote per item; duplicate-title nudge on report. // 0.25.1: By-law sub-clauses get a proper hanging indent — wrapped lines align under their clause. // 0.25.0: By-laws sort numerically and keep their line breaks; NaloPilot sends buildingId so nalo-answer answers from the building's own by-laws. // 0.23.0: NaloHub Guides — 8 role-aware task walkthroughs (guide drawer with Show me highlighting + progress) and printable A4 cheat sheets rendered from the same GUIDES data. // 0.22.0: Minute-ready Maintenance Report (Word, date range) on Reports; historical maintenance entry (backdated Reported on / Resolved on, BM & committee only) on the Maintenance report form. // 0.20.0: Managing-agent CTA for leased units, multi-recipient announcements, scheme/plan reference in setup+settings, editable Dashboard label + dashboard reorder, motion document uploads, Fire Safety evacuation plan, maintenance-workflow progress bar + next-step, header actions moved into the body.
// prior: // 0.13.0: Alerts centre, BCC auto-vote for applications, motion Q&A + attachments, trade/category dropdowns, contract upload, walk-through photos + Word export + editable checklist, Unit Search owners/tenant/agent + legacy fob link
// SeaHaven demo building logo (coastal apartment illustration)
const SEAHAVEN_LOGO = "data:image/png;base64,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";
// Personalise the shared demo here — set a prospect's building name to create instant recognition.
// ── PERSONALISE THE DEMO ──────────────────────────────────────────────────
// Edit the defaults below, OR pass them in the share link (no file editing):
//   https://your-site.netlify.app/?building=Sunset%20Towers&suburb=Hamilton&tower=East%20Tower
const DEMO = (() => {
  const d = { buildingName: "SeaHaven", address: "12 Mooloolaba Esplanade, Mooloolaba QLD 4557", tower: "North Tower", theme: "midnight" };
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("building")) d.buildingName = q.get("building");
    if (q.get("address")) d.address = q.get("address");
    if (q.get("suburb")) d.address = q.get("suburb");
    if (q.get("tower")) d.tower = q.get("tower");
    if (q.get("theme")) d.theme = q.get("theme");
  } catch (e) {}
  return d;
})();
const OPTIONAL_MODULES = ["events", "gallery", "marketplace", "messaging", "directory", "business", "documents", "meetings", "keyfobs", "firesafety", "nalopilot", "bylaws", "compliance", "disputes"];
const PREMIUM_MODULES = ["nalopilot", "bylaws", "compliance", "disputes"];
const moduleOn = (building, key) => !OPTIONAL_MODULES.includes(key) || (building && building.modules ? building.modules[key] !== false : true);
const MODULE_LABELS = { events: "Events", gallery: "Gallery", marketplace: "Marketplace", messaging: "Messaging", directory: "Directory", business: "Business Directory", documents: "Documents", meetings: "Meetings", keyfobs: "Key & Fob Register", firesafety: "Fire Safety", whatsapp: "WhatsApp Group", nalopilot: "NaloPilot · ★ Premium", bylaws: "By-Laws · ★ Premium", compliance: "Compliance Calendar · ★ Premium", disputes: "Dispute Records · ★ Premium" };

// ---------- themes ----------------------------------------------------------
const THEMES = [
  { id: "pacific", name: "Pacific Dawn", mode: "light", appBg: "#e8eff5", appBg2: "#f5f9fc", surface: "#ffffff", surfaceAlt: "#eef4f9", text: "#0e1b2b", textMuted: "#56697e", border: "#dde7f0", sidebar: "#0a2030", sidebarText: "#d6e4f0", sidebarMuted: "#7990a4", sidebarActive: "#143247", accent: "#0d7fc6", accent2: "#06b6c7", accent3: "#5b8def", accentText: "#ffffff", glow: "rgba(13,127,198,0.30)", headerFrom: "#145ea6", headerVia: "#0a8fb0", headerTo: "#0bb6c2" },
  { id: "verdant", name: "Verdant Hour", mode: "light", appBg: "#eaf2eb", appBg2: "#f4f9f4", surface: "#ffffff", surfaceAlt: "#eef5ef", text: "#16241a", textMuted: "#54685a", border: "#dde9df", sidebar: "#122c1c", sidebarText: "#dbeae0", sidebarMuted: "#7d958a", sidebarActive: "#1d4530", accent: "#2e9159", accent2: "#5fc06a", accent3: "#2bb39a", accentText: "#ffffff", glow: "rgba(46,145,89,0.30)", headerFrom: "#1d7a4c", headerVia: "#2fa05f", headerTo: "#57c06a" },
  { id: "violet", name: "Violet Mirage", mode: "light", appBg: "#efebf6", appBg2: "#f7f4fb", surface: "#ffffff", surfaceAlt: "#f1edf8", text: "#211a2e", textMuted: "#62596f", border: "#e6e0ef", sidebar: "#241531", sidebarText: "#e3daee", sidebarMuted: "#92829d", sidebarActive: "#38234e", accent: "#7d4cd6", accent2: "#b65bd0", accent3: "#5b6df0", accentText: "#ffffff", glow: "rgba(125,76,214,0.30)", headerFrom: "#6536c2", headerVia: "#8f47cf", headerTo: "#b95cd2" },
  { id: "terracotta", name: "Terracotta Sun", mode: "light", appBg: "#f4efe8", appBg2: "#fbf7f1", surface: "#fffdfa", surfaceAlt: "#f6f1eb", text: "#2a2016", textMuted: "#6c6052", border: "#e8e0d4", sidebar: "#2b2013", sidebarText: "#ece2d4", sidebarMuted: "#9a8b78", sidebarActive: "#45341f", accent: "#c66229", accent2: "#e89a3c", accent3: "#d9536b", accentText: "#ffffff", glow: "rgba(198,98,41,0.30)", headerFrom: "#a8521f", headerVia: "#cf7d2e", headerTo: "#e29a3a" },
  { id: "midnight", name: "Midnight Harbour", mode: "dark", appBg: "#060d16", appBg2: "#0a1422", surface: "#101d2e", surfaceAlt: "#16273b", text: "#e8eff7", textMuted: "#93a6bd", border: "#233346", sidebar: "#04090f", sidebarText: "#cdddec", sidebarMuted: "#6d8298", sidebarActive: "#142a40", accent: "#34a9ec", accent2: "#18cfd6", accent3: "#d9b25e", accentText: "#04121f", glow: "rgba(52,169,236,0.42)", headerFrom: "#0b2f4e", headerVia: "#0e5570", headerTo: "#0b7d86" },
  { id: "forest", name: "Forest Noir", mode: "dark", appBg: "#05100b", appBg2: "#08180f", surface: "#0d1f15", surfaceAlt: "#122a1d", text: "#e4f1e8", textMuted: "#88a596", border: "#1c3528", sidebar: "#030b07", sidebarText: "#cee9d8", sidebarMuted: "#6c8a7a", sidebarActive: "#103024", accent: "#2fc97f", accent2: "#62e08c", accent3: "#d8c98a", accentText: "#04140c", glow: "rgba(47,201,127,0.40)", headerFrom: "#0c3d28", headerVia: "#14633f", headerTo: "#1c8a55" },
  { id: "amethyst", name: "Amethyst Dusk", mode: "dark", appBg: "#0e0816", appBg2: "#150d20", surface: "#1b1228", surfaceAlt: "#241834", text: "#efe6f6", textMuted: "#a596b4", border: "#2f2342", sidebar: "#0a0512", sidebarText: "#ddd0ea", sidebarMuted: "#897a96", sidebarActive: "#2a1a3c", accent: "#b06bf2", accent2: "#e070cf", accent3: "#ff8fb0", accentText: "#150a22", glow: "rgba(176,107,242,0.42)", headerFrom: "#3f2566", headerVia: "#6a3a9e", headerTo: "#9b4fc4" },
  { id: "obsidian", name: "Obsidian Ember", mode: "dark", appBg: "#07070a", appBg2: "#0d0d11", surface: "#141418", surfaceAlt: "#1c1c22", text: "#efeef0", textMuted: "#9b9aa3", border: "#28282f", sidebar: "#050507", sidebarText: "#d8d7db", sidebarMuted: "#7d7c85", sidebarActive: "#20202a", accent: "#e6a23c", accent2: "#f0c45a", accent3: "#c77b4a", accentText: "#1a1206", glow: "rgba(230,162,60,0.40)", headerFrom: "#2a2a30", headerVia: "#3a342c", headerTo: "#1d1a16" },
  { id: "aurora", name: "Aurora Noir", mode: "dark", appBg: "#050f0e", appBg2: "#081a17", surface: "#0d201d", surfaceAlt: "#122a26", text: "#e2f3ee", textMuted: "#84a89f", border: "#1c3631", sidebar: "#040d0c", sidebarText: "#cce8e0", sidebarMuted: "#6c8a82", sidebarActive: "#103029", accent: "#25d6c0", accent2: "#56e08a", accent3: "#8f7df0", accentText: "#04140f", glow: "rgba(37,214,192,0.42)", headerFrom: "#0d3a3a", headerVia: "#135e54", headerTo: "#1f7d8f" },
  { id: "velvet", name: "Velvet Rosé", mode: "dark", appBg: "#100a0d", appBg2: "#170f13", surface: "#1d141a", surfaceAlt: "#271a22", text: "#f4e8ee", textMuted: "#b297a2", border: "#34232e", sidebar: "#0b0609", sidebarText: "#f0dce4", sidebarMuted: "#a3848f", sidebarActive: "#2c1a25", accent: "#e85d7a", accent2: "#f59079", accent3: "#e0b15e", accentText: "#1c0a10", glow: "rgba(232,93,122,0.42)", headerFrom: "#4a1f2e", headerVia: "#7d2f43", headerTo: "#c24a63" },
];
export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

const SEMANTIC = { ok: "#1f9d57", warn: "#cf8a23", bad: "#d6455d" };
// Owners who live somewhere else. They are owners in every respect (votes, levies,
// notices); "Investor" is only the committee's everyday word, so it is a dot, not a
// category. Purple because it is information, not a warning (0.40.0).
const INVESTOR_DOT = "#7c5cd6";
const INVESTOR_TIP = "Owner, lives elsewhere (Investor)";
const InvestorDot = ({ title }) => <span title={title || INVESTOR_TIP} aria-label={title || INVESTOR_TIP} role="img" className="inline-block rounded-full align-middle" style={{ width: 8, height: 8, background: INVESTOR_DOT, marginRight: 6, flexShrink: 0, verticalAlign: "middle" }} />;
const isInvestorQuery = (s) => s.length >= 3 && "investors".startsWith(s);
function hexToRgba(hex, a) { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; }

const HUE = {
  announcements: ["#f59e0b", "#f97316"], maintenance: ["#fb7185", "#f43f5e"], bookings: ["#34d399", "#10b981"],
  events: ["#60a5fa", "#3b82f6"], gallery: ["#e879f9", "#d946ef"], documents: ["#818cf8", "#6366f1"],
  approvals: ["#fbbf24", "#f59e0b"], marketplace: ["#2dd4bf", "#14b8a6"], messaging: ["#a78bfa", "#8b5cf6"],
  directory: ["#38bdf8", "#0ea5e9"], meetings: ["#94a3b8", "#64748b"], reports: ["#f472b6", "#db2777"], settings: ["#cbd5e1", "#94a3b8"],
};

const ROLE_LABEL = { admin: "Platform admin", bcc: "Committee (BCC)", manager: "Building manager", strata: "Strata manager", owner: "Owner", tenant: "Tenant" };
const isApprover = (r) => r === "bcc" || r === "manager" || r === "admin";
const isCommittee = (r) => r === "bcc" || r === "admin";
// Correspondence access — single source of truth, and since 0.39.0 a per-building
// choice rather than a constant: the building manager is out unless the committee
// switches them in (Settings → Your building manager). The same rule is enforced in
// the database by corr_is_committee(), so this only decides what is shown.
// An MSC flag on a MANAGER does not grant it; msc is for owners who sit on the committee.
// An owner flagged msc sits on the strata committee, so they count as committee
// for anything committee-only. A manager carrying the flag does not (0033, 0035).
const isCommitteeMember = (u) => isCommittee(u.role) || (u.msc === true && u.role !== "manager");
const canSeeCorr = (u, building) => isCommittee(u.role)
  || (u.role === "manager" ? !!(building || {}).bmCorrespondence : u.msc === true);
const canMaint = (u) => u.role === "manager" || u.role === "bcc" || u.role === "admin" || u.msc === true;
const isStrata = (r) => r === "strata";

const TRUISMS = [
  "A good neighbour is a found treasure.", "Small kindnesses build great communities.", "The best time to help is now.",
  "Every door you hold open comes back to you.", "Home is a feeling, not just an address.", "Shared spaces shine when shared with care.",
  "Kindness costs nothing and means everything.", "A friendly hello can make someone's whole day.", "Together we tend what none of us could alone.",
  "Good things grow where good people gather.", "The smallest gesture can be the biggest help.", "A tidy hallway is a quiet act of respect.",
  "Community is built one conversation at a time.", "Look out for each other and everyone rises.", "Patience turns neighbours into friends.",
  "Where there is welcome, there is belonging.", "A little gratitude goes a remarkably long way.", "The strongest buildings are held up by their people.",
  "Be the neighbour you'd love to have.", "Every great place was built by people who cared.", "Lend a hand today; you'll need one someday.",
  "Warmth is the best thing to share.", "Good manners never go out of style.", "A shared smile is the shortest distance between people.",
  "Tend your corner and the whole place flourishes.", "The quiet helpers make the biggest difference.", "Respect given freely returns multiplied.",
  "We're all just walking each other home.", "A welcome mat is an open heart.", "Generosity is contagious — start the spread.",
  "Listen first; you'll be heard in return.", "Today is a good day to be a good neighbour.", "Little by little, a little becomes a lot.",
  "Kind words are easy to give and hard to forget.", "A helping hand lifts two people at once.", "Make room at the table and the table grows.",
  "Care is the rent we pay for a happy home.", "Bloom where you're planted, and help others bloom too.", "The best view is people looking out for one another.",
  "Leave things better than you found them.",
];

const MAINT_CATEGORIES = ["Electrical", "Plumbing", "Lifts", "Common area", "Security", "Cleaning", "Grounds & gardens", "Building structure", "Other"];
const DOC_CATEGORIES = ["Governance", "Financials", "Insurance", "Meetings", "Maintenance", "Safety", "Facilities", "Correspondence", "Other"];
const GALLERY_CATEGORIES = ["Events", "Building", "Grounds", "Social", "Works", "Other"];
const MSG_CATEGORIES = ["Application", "Complaint", "Idea", "Query"];
const NOTICE_TYPES = ["Notice of Meeting", "Notice of Special Meeting", "Notice of AGM", "Meeting Minutes"];
const BUSINESS_CATEGORIES = ["Accountant","Air-con / HVAC","Antenna / TV","Appliance repair","Beauty","Builder","Carpenter","Carpet cleaning","Caterer","Childcare","Cleaner","Concreter","Conveyancer / Solicitor","Courier","Dentist","Doctor / GP","Dry cleaning","Electrician","Florist","Gardener / Landscaper","Glazier","Gym / Fitness","Hairdresser","Handyman","Insurance broker","IT support","Locksmith","Mortgage broker","Painter","Pest control","Pharmacy","Photographer","Physio","Plasterer","Plumber","Pool maintenance","Real estate agent","Removalist","Roofer","Security / CCTV","Solar","Storage","Strata lawyer","Tiler","Vet","Window cleaning","Other"];

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const nowISO = () => new Date().toISOString();
// ymd formats a Date as its LOCAL calendar day. localDay turns anything date-like into
// the local YYYY-MM-DD: a plain date string passes through untouched, a stored timestamp
// (always UTC from the server) is converted, so nothing done before 10am in Queensland
// reads as yesterday. Never slice a timestamp to 10 characters to get its date.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localDay = (v) => { if (!v) return ""; const t = String(v); if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; const d = new Date(t.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")); return isNaN(d.getTime()) ? t.substring(0, 10) : ymd(d); };
const addDays = (d, n) => { const [y, m, dd] = localDay(d).split("-").map(Number); const x = new Date(y, m - 1, dd); x.setDate(x.getDate() + n); return ymd(x); };
const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
const openExternal = (url) => { if (url) window.open(url, "_blank", "noopener"); };
const downloadText = (filename, text) => { const blob = new Blob([text], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
const fmtDate = (iso) => {
  if (!iso) return "";
  const s = String(iso);
  // Full ISO timestamps are stored in UTC; render them in the viewer's local
  // date so an AEST morning entry doesn't display as "yesterday".
  if (s.includes("T")) { const dt = new Date(s); if (!isNaN(dt.getTime())) return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`; }
  const p = s.slice(0, 10).split("-");
  return (p.length === 3) ? `${p[2]}/${p[1]}/${p[0]}` : s;
};
// Maintenance timing: reportedAt (ISO datetime) is authoritative; legacy rows fall back to `date`.
const daysOpen = (m) => Math.max(0, Math.floor((Date.now() - new Date(m.reportedAt || m.date)) / 86400000));
const daysToResolve = (m) => (m.resolvedAt ? Math.max(0, Math.round((new Date(m.resolvedAt) - new Date(m.reportedAt || m.date)) / 86400000)) : null);
const agingColor = (d) => (d > 30 ? SEMANTIC.bad : d > 14 ? SEMANTIC.warn : "#8a93a3");
const AU_STATES = ["QLD", "NSW", "VIC", "SA", "WA", "TAS", "NT", "ACT"];
const suburbFromAddress = (addr) => { if (!addr) return "Local"; const last = addr.split(",").pop().trim(); const toks = last.split(/\s+/).filter((t) => !AU_STATES.includes(t.toUpperCase()) && !/^\d{3,4}$/.test(t)); return toks.join(" ") || last; };

// ---------- seed ------------------------------------------------------------
// ---------- demo data generator (full sandbox: 100 units + simulated history) ----------
const FIRST = ["Sarah","David","Priya","Tom","Mia","Jordan","Anika","Beck","Cy","Lena","Raf","Nat","Sol","Indie","Bo","Quinn","Theo","Hana","Liam","Noor","Owen","Faye","Sam","Tara","Vik","Ed","Gita","Cass","Dom","Eli","Mara","Pete","Rosa","Ken","Joy","Hugo","Ivy","Leo","Mae","Otto","Pia","Reed","Sia","Uma","Wes","Cleo","Drew","Esme","Fox","Gwen"];
const LAST = ["McMahon","Nair","Whitfield","Cohen","Iverson","Tanaka","Reilly","Rao","Olsson","Fontaine","Marsh","Delgado","Beaumont","Kepler","Hart","Castellan","Adler","Vance","Pho","Anand","Ng","Brooks","Saito","Mercer","Khan","Doyle","Frost","Lim","Pace","Ruiz","Bauer","Sato","Cole","Ford","Greer","Ives","Jung","Kerr","Lowe","Quill"];
const MAINT_TITLES = { Electrical: ["Foyer light flickering","Carpark light out","Power trip in Lift 1 lobby"], Plumbing: ["Leaking tap in common room","Blocked drain basement","Hot water intermittent L3"], Lifts: ["Lift 2 jerky between L4-L5","Lift door slow to close"], "Common area": ["Torn carpet near mailboxes","Scuffed paint stairwell"], Security: ["Carpark roller door slow","Intercom panel faulty","Gate latch loose"], Cleaning: ["Bins overflowing weekends","Glass doors smudged"], "Grounds & gardens": ["Sprinkler stuck on","Hedge overgrown at entry"], "Building structure": ["Cracked tile poolside","Render flaking north wall"] };
function makeDemo() {
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const ri = (n, m) => n + Math.floor(Math.random() * (m - n + 1));
  const chance = (p) => Math.random() < p;
  const dAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
  const dAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const isoAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
  const nm = () => rnd(FIRST) + " " + rnd(LAST);
  const ph = () => "04" + ri(10, 99) + " " + ri(100, 999) + " " + ri(100, 999);
  const uid = (() => { let i = 100; return () => "u" + (i++); })();
  const units = []; for (let fl = 1; fl <= 10; fl++) for (let n = 1; n <= 10; n++) units.push(fl + String(n).padStart(2, "0"));
  const users = [];
  users.push({ id: "u1", buildingId: "b1", name: "NaloHub Admin", unit: "Admin", tower: "", floor: "", role: "admin", status: "active", email: "admin@seahaven.com.au", phone: ph(), directoryOptIn: true, showPhone: true, showEmail: true, msc: false, lastSeenGallery: isoAgo(20) });
  users.push({ id: "bm", buildingId: "b1", name: "Marcus Hale", unit: "G-Office", role: "manager", status: "active", email: "manager@seahaven.com.au", phone: ph(), directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: isoAgo(20) });
  users.push({ id: "sm", buildingId: "b1", name: "Patricia Hewson", unit: "Strata", role: "strata", status: "active", email: "strata@seahaven.com.au", phone: ph(), directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: isoAgo(20) });
  units.forEach((u) => { const occ = chance(0.35) ? 2 : 1; for (let k = 0; k < occ; k++) { const id = uid(); users.push({ id, buildingId: "b1", name: nm(), unit: u, tower: "", floor: String(ri(1, 10)), role: chance(0.7) ? "owner" : "tenant", status: "active", email: id + "@seahaven.com.au", phone: ph(), directoryOptIn: chance(0.6), showPhone: chance(0.5), showEmail: chance(0.4), msc: false, lastSeenGallery: isoAgo(ri(1, 40)) }); } });
  const owners = users.filter((u) => u.role === "owner");
  for (let i = 0; i < 5 && i < owners.length; i++) owners[i].role = "bcc";
  for (let i = 5; i < 8 && i < owners.length; i++) owners[i].msc = true;
  // Invited-but-not-yet-aboard residents: fuel for the "aboard" meter. The
  // "invited" status is invisible to every other screen (they all key off
  // "active" or "pending"), so these add launch-story life without noise.
  for (let i = 0; i < 58; i++) users.push({ id: "inv" + i, buildingId: "b1", name: nm(), unit: rnd(units), tower: "", floor: String(ri(1, 10)), role: chance(0.7) ? "owner" : "tenant", status: "invited", email: "", phone: "", directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: "" });
  users.push({ id: "pend1", buildingId: "b1", name: nm(), unit: rnd(units), role: "owner", status: "pending", email: "new@seahaven.com.au", phone: "", directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: isoAgo(1) });
  const bccNames = users.filter((u) => u.role === "bcc" || u.role === "admin").map((u) => u.name);
  const mscNames = users.filter((u) => u.msc).map((u) => u.name);
  const active = users.filter((u) => u.status === "active");
  const someName = () => rnd(active).name;
  const chair = bccNames[0] || "Committee";
  const assetSrc = [
    ["Lift 1 — Otis Gen2", "Lifts", "Tower A core", dAgo(2400), 185000, 25, 6, dAgo(70)],
    ["Lift 2 — Otis Gen2", "Lifts", "Tower A core", dAgo(2400), 185000, 25, 6, dAgo(70)],
    ["Fire indicator panel", "Fire & safety", "Ground floor foyer", dAgo(1600), 42000, 15, 6, dAgo(40)],
    ["Booster pump set", "Plumbing", "Basement plant room", dAgo(2000), 28000, 25, 12, dAgo(200)],
    ["Rooftop cooling tower", "HVAC / Air-con", "Rooftop", dAgo(1800), 96000, 15, 6, dAgo(120)],
    ["Pool filtration system", "Pool & spa", "Pool plant room", dAgo(1200), 34000, 12, 3, dAgo(25)],
    ["CCTV & access control", "Security & access", "Whole site", dAgo(900), 61000, 10, 12, dAgo(300)],
    ["Main switchboard", "Electrical", "Basement", dAgo(3200), 120000, 20, 12, dAgo(150)],
    ["Common room furniture", "Common area", "Level 1 common room", dAgo(700), 24000, 12, 0, ""],
    ["Landscaping irrigation", "Grounds & landscaping", "Courtyard", dAgo(1400), 18000, 10, 12, dAgo(210)],
  ];
  const assets = assetSrc.map((a, i) => ({ id: "as" + i, buildingId: "b1", name: a[0], category: a[1], location: a[2], purchaseDate: a[3], purchaseValue: a[4], ageYears: "", usefulLife: a[5], serviceMonths: a[6], lastService: a[7], notes: "" }));
  const announcements = [];
  const annSrc = [["Lift 2 maintenance scheduled","Lift 2 will be offline for its annual service. Please allow extra time and use Lift 1.",true],["Pool reopens after resurfacing","The pool is back open this weekend - updated rules are in Documents.",false],["Quarterly window cleaning","External window cleaning across all floors next Tuesday and Wednesday.",false],["New visitor parking process","Visitor stays over one night now route through the portal for approval.",false],["Garden working bee - volunteers welcome","Join us Saturday morning to tidy the courtyard. Coffee provided!",false],["Fire alarm testing","Routine alarm testing Thursday 10am. A brief siren is expected.",false],["AGM date confirmed","Save the date - the AGM will be held next month. Papers to follow.",true],["Bike rack expansion","Six new bike spaces added in the basement.",false],["Lobby refurbishment complete","Thanks for your patience - the lobby refresh is done.",false],["Balcony plant safety","Please secure balcony pots ahead of the windy season.",false],["Hot water system upgrade","Brief hot water outages possible Monday during the upgrade.",false],["Welcome to the new portal","This portal is now your home for notices, bookings and more.",false]];
  annSrc.forEach((a, i) => announcements.push({ id: "a" + i, buildingId: "b1", title: a[0], body: a[1], postedBy: chair, date: dAgo(i * 4 + 2), expiry: chance(0.5) ? dAhead(ri(5, 40)) : "", pinned: a[2], image: "", doc: chance(0.3) ? a[0].slice(0, 14) + ".pdf" : "", noticeType: "General", audience: "all" }));
  announcements.push({ id: "a-agm", buildingId: "b1", title: "Notice of Annual General Meeting", body: "Notice is given that the Annual General Meeting will be held next month. Agenda papers and proxy forms are attached. All owners are encouraged to attend in person or online.", postedBy: "Definitive Strata Co. (Strata manager)", date: dAgo(6), expiry: dAhead(24), pinned: false, image: "", doc: "AGM notice & agenda.pdf", noticeType: "Notice of AGM", audience: "owners" });
  const b1owners = users.filter((u) => u.buildingId === "b1" && u.role === "owner");
  announcements.push({ id: "a-spec", buildingId: "b1", title: "Balcony waterproofing — affected owners only", body: "This notice goes only to the owners of the units directly affected by next week's balcony waterproofing inspections. Please reply to the committee if the access window doesn't suit — we'll arrange an alternative. Other residents don't need to action anything.", postedBy: chair, date: dAgo(1), expiry: dAhead(20), pinned: false, image: "", doc: "", noticeType: "General", audience: "specific", recipientIds: b1owners.slice(0, 5).map((u) => u.id) });
  const maintenance = []; const cats = Object.keys(MAINT_TITLES); const statuses = ["new", "triaged", "in_progress", "resolved"];
  const usedTitles = new Set(); const uniqueTitle = (cat) => { const pool = MAINT_TITLES[cat]; let t = rnd(pool), tries = 0; while (usedTitles.has(t) && tries++ < 8) t = rnd(pool); if (usedTitles.has(t)) t = t + " — " + rnd(["level 2", "east wing", "north side", "bay 7"]); usedTitles.add(t); return t; };
  for (let i = 0; i < 24; i++) {
    const cat = rnd(cats); const status = rnd(statuses); const assignee = chance(0.6) ? rnd(mscNames.concat(["Marcus Hale"])) : "";
    const reportedDays = ri(1, 60);
    const resolvedDays = status === "resolved" ? ri(0, Math.max(0, reportedDays - 1)) : null;
    const m = { id: "m" + i, buildingId: "b1", title: uniqueTitle(cat), category: cat, location: rnd(["Foyer","Basement","Level 3","Rooftop","Stairwell B","Poolside","Carpark","Common room"]), description: "Reported by a resident; details on file.", raisedBy: someName(), status, triageOwner: status === "new" ? "" : assignee, date: dAgo(reportedDays), reportedAt: isoAgo(reportedDays), resolvedAt: resolvedDays != null ? isoAgo(resolvedDays) : "", reminderDays: (status !== "new" && status !== "resolved" && chance(0.4)) ? rnd([7, 14]) : 0, lastRemindedAt: "", quotes: [], statusHistory: [{ from: "", to: "new", by: someName(), at: isoAgo(reportedDays) }], image: "", resolutions: [], updates: [] };
    // build a plausible status trail up to the current status
    const flow = ["new", "triaged", "in_progress", "resolved"]; const upto = flow.indexOf(status);
    for (let k = 1; k <= upto; k++) m.statusHistory.push({ from: flow[k - 1], to: flow[k], by: assignee || "Marcus Hale", at: isoAgo(Math.max(resolvedDays || 0, Math.round(reportedDays * (1 - k / (upto + 1))))) });
    if (status === "triaged" || status === "in_progress") { m.waitingOn = rnd(["committee", "committee", "quote", "contractor", "access", "ready"]); m.waitingSince = dAgo(ri(2, 20)); }
    if (status !== "new" && chance(0.6)) m.updates.push({ id: "up" + i, text: rnd(["Inspected; parts on order.","Contractor booked for next week.","Temporary fix applied, monitoring.","Awaiting quote approval."]), by: assignee || "Marcus Hale", date: dAgo(ri(1, 10)) });
    if ((status === "in_progress" || status === "resolved") && chance(0.7)) {
      const nq = ri(1, 3);
      for (let k = 0; k < nq; k++) m.quotes.push({ id: "q" + i + "_" + k, supplier: rnd(["DoorTech","BrightSpark Electrical","FlowFix Plumbing","CityLift Services","GreenScape Gardens"]), amount: "$" + (ri(2, 24) * 100).toLocaleString(), doc: chance(0.7) ? "Quote.pdf" : "", note: rnd(["Available next week","Includes parts & labour","Can start Monday",""]), by: rnd(bccNames), date: dAgo(ri(2, 30)), accepted: k === 0 });
      m.resolutions.push({ id: "r" + i, supplier: m.quotes[0].supplier, note: "Scope approved by sub-committee.", cost: m.quotes[0].amount, quoteDoc: "Quote.pdf", sowDoc: chance(0.6) ? "Statement of work.pdf" : "", by: rnd(bccNames), date: dAgo(ri(2, 30)) });
    }
    maintenance.push(m);
  }
  const facs = ["bbq","visitor","lift","common"]; const bookings = [];
  for (let i = 0; i < 28; i++) { const fac = rnd(facs); const future = chance(0.6); const base = future ? dAhead(ri(1, 30)) : dAgo(ri(1, 40)); const st = fac === "visitor" && chance(0.4) ? rnd(["pending","confirmed","declined"]) : "confirmed"; bookings.push({ id: "k" + i, buildingId: "b1", facility: fac, fromDate: base, toDate: fac === "visitor" ? dAhead(ri(1, 33)) : base, timeFrom: fac === "visitor" ? "" : rnd(["09:00","13:00","17:00"]), timeTo: fac === "visitor" ? "" : rnd(["13:00","17:00","21:00"]), bookedBy: someName(), status: st, note: chance(0.4) ? rnd(["Birthday","Moving in","Small gathering","Visitor from interstate"]) : "", decidedBy: (st === "confirmed" || st === "declined") ? chair : "", decidedAt: (st === "confirmed" || st === "declined") ? dAgo(ri(1, 10)) : "", decisionNote: st === "declined" ? "Clashes with another booking." : "" }); }
  const events = []; const evSrc = [["Winter rooftop sundowner","Rooftop terrace, Level 9"],["Residents coffee morning","Common room"],["Kids movie night","Common room"],["Building trivia night","Common room"],["Garden working bee","Courtyard"],["End of year drinks","Rooftop terrace"],["Yoga in the courtyard","Courtyard"],["New residents welcome","Lobby"]];
  evSrc.forEach((e, i) => { const fut = i < 5; events.push({ id: "e" + i, buildingId: "b1", title: e[0], date: fut ? dAhead(ri(2, 28)) : dAgo(ri(5, 40)), timeFrom: rnd(["10:00","17:30","18:00"]), timeTo: rnd(["12:00","20:00","21:00"]), location: e[1], teamsLink: chance(0.3) ? "https://teams.microsoft.com/l/meetup-join/EXAMPLE" : "", organiser: rnd(["Social Committee", chair]), image: "", doc: "", going: active.slice(0, ri(3, 12)).map((u) => u.name), maybe: active.slice(12, 12 + ri(1, 5)).map((u) => u.name), cantGo: [] }); });
  const galColors = ["#1763a8","#2f8f5b","#7c4dd1","#e2556f","#0aa8b0","#c2622e","#8f7df0"]; const gallery = [];
  ["Rooftop at dusk","Garden working bee","Lobby refresh","Trivia night","Pool reopening","Courtyard in bloom","Moving day","Sunset from L9","Festive lights","Coffee morning","New bike racks","Foyer artwork","Stairwell mural","Pool party","BBQ afternoon","Winter markets","Volunteer crew","Building at night"].forEach((c, i) => gallery.push({ id: "g" + i, buildingId: "b1", caption: c, category: rnd(GALLERY_CATEGORIES), color: rnd(galColors), image: "", postedBy: someName(), createdAt: isoAgo(ri(1, 50)) }));
  const marketplace = []; [["Bar stools x2 (oak)","$60"],["IKEA bookshelf","$40"],["Mountain bike","$220"],["Indoor plants bundle","$25"],["Microwave (near new)","$50"],["Sofa - 3 seater","$180"],["Standing desk","$120"],["Kids scooter","$30"],["Dining table","$150"],["Air fryer","$45"]].forEach((m, i) => { const u = rnd(active); marketplace.push({ id: "p" + i, buildingId: "b1", title: m[0], price: m[1], seller: u.name, contact: u.phone, desc: "Good condition. Pick up from Unit " + u.unit + ".", image: "", status: rnd(["active","active","active","pending","sold"]), createdAt: isoAgo(ri(1, 28)) }); });
  const messages = []; const msgSrc = [["Query","Bike storage","Is there room for one more bike in the basement rack?"],["Complaint","Noise after midnight","Ongoing late-night noise from the courtyard on weekends."],["Idea","Community garden","Could we start a herb garden on the rooftop?"],["Application","Renovation request","Requesting approval for bathroom renovation - see attached."],["Query","Parking allocation","Which bay is allocated to Unit 412?"],["Complaint","Lift wait times","Lifts are very slow in the morning peak."],["Idea","EV charging","Any plans for EV chargers in the basement?"],["Query","Pet registration","How do I register my dog on the portal?"]];
  for (let i = 0; i < 18; i++) { const sg = rnd(msgSrc); messages.push({ id: "msg" + i, buildingId: "b1", to: chance(0.7) ? "Committee (BCC)" : "Building manager", category: sg[0], from: someName(), subject: sg[1], body: sg[2], doc: sg[0] === "Application" ? "Application.pdf" : "", date: dAgo(ri(1, 40)) }); }
  const documents = [["By-laws (current)","Governance","all",true,"PDF"],["Emergency & evacuation plan","Safety","all",true,"PDF"],["Pool rules 2026","Facilities","all",true,"PDF"],["AGM 2026 minutes","Meetings","owners",true,"DOCX"],["Committee meeting minutes - May","Meetings","owners",true,"DOCX"],["Annual financial statements","Financials","owners",true,"PDF"],["Building insurance certificate","Insurance","all",true,"PDF"],["Fire safety statement","Safety","all",true,"PDF"],["Window cleaning contract","Correspondence","committee",false,"PDF"],["Draft 10-year capital works plan","Financials","committee",false,"XLSX"],["Lift maintenance agreement","Maintenance","committee",false,"PDF"],["Garden maintenance schedule","Facilities","all",true,"PDF"],["Pet policy","Governance","all",true,"PDF"],["Renovation guidelines","Governance","all",true,"PDF"]].map((d, i) => ({ id: "d" + i, buildingId: "b1", title: d[0], category: d[1], visibility: d[2], released: d[3], uploadedBy: chair, date: dAgo(ri(5, 120)), fileType: d[4], fileData: "" }));
  const meetings = [
    { id: "mt1", buildingId: "b1", title: "Annual General Meeting", date: dAgo(28), timeFrom: "18:00", timeTo: "19:30", location: "Common room, Level 1", teamsLink: "https://teams.microsoft.com/l/meetup-join/EXAMPLE", note: "Annual general meeting - minutes filed.", minutes: "AGM 2026 minutes", agenda: ["Welcome & apologies","Confirm previous minutes","Treasurer's report","Election of committee","Capital works plan","General business"], motions: [{ id: "mo1", ref: "M-AGM-01", title: "Adopt the annual financial statements", mover: bccNames[0] || chair, seconder: bccNames[1] || chair, meetingDate: dAgo(28), status: "decided", forCount: 5, againstCount: 0, abstainCount: 1, outcome: "Carried", decidedDate: dAgo(28), decidedTime: "18:40" }, { id: "mo2", ref: "M-AGM-02", title: "Approve the proposed levy schedule", mover: bccNames[1] || chair, seconder: bccNames[2] || chair, meetingDate: dAgo(28), status: "decided", forCount: 4, againstCount: 2, abstainCount: 0, outcome: "Carried", decidedDate: dAgo(28), decidedTime: "19:05" }], going: active.slice(0, 14).map((u) => u.name), apologies: active.slice(14, 18).map((u) => u.name) },
    { id: "mt2", buildingId: "b1", title: "Committee meeting - May", date: dAgo(50), timeFrom: "18:30", timeTo: "19:30", location: "Common room, Level 1", teamsLink: "", note: "Routine committee meeting.", minutes: "Committee meeting minutes - May", agenda: ["Previous actions","Maintenance update","Budget review","Correspondence"], motions: [{ id: "mo3", ref: "M-2026-018", title: "Engage DoorTech for carpark door repair", mover: bccNames[0] || chair, seconder: bccNames[2] || chair, meetingDate: dAgo(50), status: "decided", forCount: 6, againstCount: 0, abstainCount: 0, outcome: "Carried", decidedDate: dAgo(50), decidedTime: "18:55" }], going: bccNames, apologies: [] },
    { id: "mt3", buildingId: "b1", title: "Committee meeting", date: dAhead(7), timeFrom: "18:30", timeTo: "19:30", location: "Common room, Level 1", teamsLink: "https://teams.microsoft.com/l/meetup-join/EXAMPLE2", note: "Agenda being finalised.", minutes: "", agenda: [], motions: [], going: [], apologies: [] },
  ];
  const actions = [
    { id: "ac1", buildingId: "b1", title: "Obtain second quote for lift servicing", detail: "Compare against CityLift renewal.", assignee: bccNames[0] || chair, due: dAhead(5), status: "open", priority: "high", note: "First quote received; chasing a second for comparison.", docs: ["CityLift quote.pdf"] },
    { id: "ac2", buildingId: "b1", title: "Circulate AGM minutes to owners", detail: "", assignee: chair, due: dAgo(2), status: "open", priority: "high" },
    { id: "ac3", buildingId: "b1", title: "Renew building insurance", detail: "Policy lapses next month.", assignee: bccNames[1] || chair, due: dAhead(20), status: "open", priority: "high", note: "Broker sourcing comparison quotes.", docs: ["Insurance renewal notice.pdf"] },
    { id: "ac4", buildingId: "b1", title: "Review window cleaning contract", detail: "", assignee: bccNames[2] || chair, due: dAhead(12), status: "open", priority: "med" },
    { id: "ac5", buildingId: "b1", title: "Update pool rules signage", detail: "", assignee: "Marcus Hale", due: dAgo(5), status: "done", priority: "low" },
    { id: "ac6", buildingId: "b1", title: "Investigate EV charging feasibility", detail: "Resident request via portal.", assignee: bccNames[0] || chair, due: dAhead(40), status: "open", priority: "low" },
    { id: "ac7", buildingId: "b1", title: "Fire safety statement lodgement", detail: "Annual compliance.", assignee: bccNames[1] || chair, due: dAhead(3), status: "open", priority: "high" },
    { id: "ac8", buildingId: "b1", title: "Approve garden maintenance schedule", detail: "", assignee: chair, due: dAgo(8), status: "done", priority: "med" },
  ];
  const keyfobs = []; const kfHolders = active.filter((u) => u.unit && u.unit.length <= 4);
  for (let i = 0; i < 12; i++) { const u = rnd(kfHolders); const st = rnd(["issued","issued","issued","returned","lost"]); keyfobs.push({ id: "kf" + i, buildingId: "b1", type: rnd(["Fob","Key","Remote","Swipe card"]), label: rnd(["Main entry","Carpark gate","Pool gate","Bin room","Gym","Lift override"]), serial: "SN-" + ri(1000, 9999), unit: u.unit, holder: u.name, issued: dAgo(ri(20, 400)), status: st, notes: st === "lost" ? "Reported lost - deactivate." : "" }); }
  const bizSrc = [["BrightSpark Electrical","Electrician"],["FlowFix Plumbing","Plumber"],["South Bank Locksmiths","Locksmith"],["GreenScape Gardens","Gardener / Landscaper"],["CoolBreeze Air","Air-con / HVAC"],["SparkleClean","Cleaner"],["PestGuard QLD","Pest control"],["River City Removals","Removalist"],["AquaPool Care","Pool maintenance"],["Kingsford Conveyancing","Conveyancer / Solicitor"],["Brisbane Strata Law","Strata lawyer"],["SunPower Solar","Solar"]];
  const businesses = bizSrc.map((b, i) => { const recN = ri(0, 5); const recs = []; for (let k = 0; k < recN; k++) recs.push({ by: someName(), note: chance(0.5) ? rnd(["Prompt and tidy.","Great with strata jobs.","Fair pricing.","Showed up on time.","Highly recommend."]) : "" }); return { id: "biz" + i, buildingId: "b1", name: b[0], category: b[1], phone: ph(), contact: b[0].toLowerCase().replace(/[^a-z]/g, "") + "@seahaven.com.au", desc: rnd(["Used by several residents in the building.","Familiar with our building and access.","Reliable local operator."]), addedBy: someName(), recommendations: recs }; });
  const b2users = [{ id: "b2u1", buildingId: "b2", name: "NaloHub Admin", unit: "Admin", role: "admin", status: "active", email: "admin@seahaven.com.au", phone: ph(), directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: isoAgo(5) }];
  for (let i = 0; i < 6; i++) b2users.push({ id: "b2u" + (i + 2), buildingId: "b2", name: nm(), unit: ri(1, 6) + "0" + ri(1, 9), tower: chance(0.5) ? "A" : "B", floor: String(ri(1, 6)), role: chance(0.7) ? "owner" : "tenant", status: "active", email: "b2r" + i + "@seahaven.com.au", phone: ph(), directoryOptIn: chance(0.5), showPhone: chance(0.5), showEmail: false, msc: false, lastSeenGallery: isoAgo(10) });
  const EVAC_PLAN_DEMO = { name: "SeaHaven-Level6-Evacuation-Plan.svg", type: "image/svg+xml", data: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 380' font-family='system-ui,sans-serif'><rect width='600' height='380' fill='#f8fafc'/><rect x='20' y='20' width='560' height='340' fill='none' stroke='#0f172a' stroke-width='3'/><rect x='120' y='150' width='360' height='70' fill='#e2e8f0'/><rect x='30' y='30' width='180' height='110' fill='#fff' stroke='#94a3b8'/><text x='120' y='90' font-size='16' text-anchor='middle' fill='#334155'>Unit 601</text><rect x='230' y='30' width='160' height='110' fill='#fff' stroke='#94a3b8'/><text x='310' y='90' font-size='16' text-anchor='middle' fill='#334155'>Unit 602</text><rect x='410' y='30' width='160' height='110' fill='#fff' stroke='#94a3b8'/><text x='490' y='90' font-size='16' text-anchor='middle' fill='#334155'>Lift lobby</text><rect x='30' y='230' width='240' height='120' fill='#fff' stroke='#94a3b8'/><text x='150' y='295' font-size='16' text-anchor='middle' fill='#334155'>Common room</text><rect x='300' y='230' width='270' height='120' fill='#fff' stroke='#94a3b8'/><text x='435' y='295' font-size='16' text-anchor='middle' fill='#334155'>Car park ramp</text><defs><marker id='ar' markerWidth='10' markerHeight='10' refX='6' refY='3' orient='auto'><path d='M0,0 L6,3 L0,6 Z' fill='#16a34a'/></marker></defs><g stroke='#16a34a' stroke-width='4' fill='none'><path d='M300 185 H535' marker-end='url(#ar)'/><path d='M300 185 H62' marker-end='url(#ar)'/></g><g fill='#16a34a'><rect x='548' y='170' width='34' height='30'/><text x='565' y='190' font-size='11' fill='#fff' text-anchor='middle'>EXIT</text></g><g fill='#16a34a'><rect x='18' y='170' width='34' height='30'/><text x='35' y='190' font-size='11' fill='#fff' text-anchor='middle'>EXIT</text></g><circle cx='300' cy='185' r='9' fill='#dc2626'/><text x='300' y='140' font-size='13' text-anchor='middle' fill='#dc2626' font-weight='bold'>YOU ARE HERE</text><circle cx='500' cy='320' r='16' fill='#16a34a'/><text x='500' y='325' font-size='14' fill='#fff' text-anchor='middle'>A</text><text x='500' y='355' font-size='12' text-anchor='middle' fill='#334155'>Assembly area</text><text x='300' y='372' font-size='11' text-anchor='middle' fill='#64748b'>SeaHaven — Level 6 evacuation plan (sample)</text></svg>") };
  return {
    buildings: [
      { id: "b1", name: DEMO.buildingName, type: "Residential apartments", address: DEMO.address, schemeRef: "CTS 31245", evacPlan: EVAC_PLAN_DEMO, logoText: "SH", logoImage: SEAHAVEN_LOGO, units: 100, floors: 10, towers: 1, strataManager: "Definitive Strata Co.", buildingManager: "Marcus Hale", towerDesc: DEMO.tower, bccEmail: "committee@seahaven.com.au", strataContactName: "Janine Carter", strataContactPhone: "07 3000 4500", strataContactEmail: "janine@definitivestrata.com.au", facilities: { bbq: true, visitor: true, lift: true, common: true, gym: true }, modules: { events: true, gallery: true, marketplace: true, messaging: true, directory: true, business: true, documents: true, meetings: true, keyfobs: true, firesafety: true, whatsapp: true }, themeId: DEMO.theme, whatsappLink: "https://chat.whatsapp.com/EXAMPLE-GROUP", whatsappName: "WhatsApp Group", emergency: [{ label: "After-hours building emergency line", number: "1300 555 010" }], fireNotes: "", community: "full", launchedAt: "", provenance: { establishedBy: { name: "Marcus Hale", role: "manager" }, establishedAt: "2026-03-14", fundedBy: "committee", fundedByName: "", novations: [{ at: "2026-07-01", from: "bm", to: "committee", byName: "Priya Nair" }] }, exports: [{ at: "2026-08-02T03:10:00Z", byName: "Priya Nair", byRole: "bcc", sheets: 31, files: 12, scope: "full" }], recognition: { badges: { u1: ["founding", "explorer"] }, milestones: {} }, onboarding: { done: { p1s1: true, p1s2: true, p1s3: true, p1s4: true, p1s5: true, p1s6: true, p1s7: true, p2s1: true, p2s2: true, p2s3: true, p2s4: true, p2s5: true, p2s6: true, p2s7: true, p3s1: true, p3s2: true, p3s3: true, p3s5: true, p3s9: true, p4s1: true, p4s2: true }, na: { p3s7: false, p3s4: true }, notes: { p2s5: "Committee agreed: aim for the first weekend next month.", p4s3: "Chasing the May minutes from the secretary.", p5s2: "Strata + insurer notified; solicitor next." } } },
      { id: "b2", name: "Riverbend Apartments", type: "Mixed-use residential", address: "3 Ferry Rd, Bulimba QLD", schemeRef: "CTS 40917", logoText: "RB", logoImage: "", units: 56, floors: 6, towers: 2, strataManager: "Northshore Body Corp", buildingManager: "", towerDesc: "", bccEmail: "", strataContactName: "", strataContactPhone: "", strataContactEmail: "", facilities: { bbq: true, visitor: true, lift: true, common: false, gym: true }, modules: { events: true, gallery: true, marketplace: false, messaging: true, directory: true, business: false, documents: true, meetings: true, keyfobs: true, firesafety: true, whatsapp: false }, themeId: "midnight", whatsappLink: "", whatsappName: "", emergency: [], fireNotes: "" },
    ],
    users: users.concat(b2users),
    announcements, maintenance, assets, bookings, events, gallery, marketplace, messages, documents, meetings, actions, keyfobs, businesses,
    bylaws: seedBylaws(), compliance: seedCompliance(), disputes: seedDisputes(),
  };
}
const seed = makeDemo();

// ---------- context ---------------------------------------------------------
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
// ---------- uploads: compress images, cap everything else -------------------
// Files are stored as base64 data-URLs inside JSONB, which inflates them by
// ~33%, so what goes in here directly determines how much database a building
// consumes. A 20 MB scanned PDF once made Curve Birtinya unopenable — see
// INCIDENT_2026-08-01_CURVE_LOAD.md. Two rules:
//   • Images are RESIZED AND RE-ENCODED, never capped — a 4 MB phone photo
//     becomes ~300 KB, and nothing the app renders is bigger than ~512px.
//   • Anything else (PDFs, Word, etc.) is hard-capped, because the browser
//     can't meaningfully compress it.
const MAX_UPLOAD_MB = 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 40 * 1024 * 1024; // guards browser memory only
const IMG_MAX_DIM = 1600;   // lightbox renders ~512px; 1600 leaves room to zoom
const IMG_QUALITY = 0.82;
const LOGO_MAX_DIM = 512;

const fmtMB = (b) => (b / 1048576).toFixed(1) + " MB";
const oversizeHelp = (file) =>
  `"${file.name}" is ${fmtMB(file.size)} — the limit is ${MAX_UPLOAD_MB} MB. If it's a scan, re-scan at 150 DPI in greyscale (that usually brings a document under 2 MB). Otherwise split it into parts and upload them separately.`;

// Draw through a canvas at a sane size. Falls back to the original data-URL if
// anything goes wrong, so an upload never silently fails.
const compressImage = (file, cb, onError, opts = {}) => {
  const { maxDim = IMG_MAX_DIM, quality = IMG_QUALITY, keepAlpha = false } = opts;
  if (file.size > MAX_SOURCE_IMAGE_BYTES) { if (onError) onError(`"${file.name}" is ${fmtMB(file.size)}, which is too large to process in the browser. Please resize it first.`); return; }
  const r = new FileReader();
  r.onerror = () => { if (onError) onError("Couldn't read that file — please try again."); };
  r.onload = () => {
    const img = new Image();
    img.onerror = () => cb(r.result);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        // JPEG has no alpha channel — flatten onto white so transparent PNGs
        // don't come out with black backgrounds.
        if (!keepAlpha) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL(keepAlpha ? "image/png" : "image/jpeg", quality);
        cb(out && out.length < r.result.length ? out : r.result);
      } catch (e) { cb(r.result); }
    };
    img.src = r.result;
  };
  r.readAsDataURL(file);
};

// Images only (logos, gallery, photo fields).
const readImage = (file, cb, onError, opts) => compressImage(file, cb, onError, opts);

// Any file: images are compressed, everything else must fit the cap.
const readUpload = (file, cb, onError) => {
  if (/^image\//i.test(file.type || "")) { compressImage(file, cb, onError); return; }
  if (file.size > MAX_UPLOAD_BYTES) { if (onError) onError(oversizeHelp(file)); return; }
  const r = new FileReader();
  r.onerror = () => { if (onError) onError("Couldn't read that file — please try again."); };
  r.onload = () => cb(r.result);
  r.readAsDataURL(file);
};

// ---------- UI kit ----------------------------------------------------------
function Card({ children, style, hover, ...p }) {
  const { T } = useApp();
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text, boxShadow: T.mode === "dark" ? `0 16px 40px -22px ${T.glow}, 0 1px 0 rgba(255,255,255,0.05) inset` : "0 12px 28px -18px rgba(16,24,40,0.20), 0 1px 2px rgba(16,24,40,0.05)", ...style }} className={`rounded-2xl ${hover ? "rp-hover" : ""}`} {...p}>{children}</div>;
}
function Btn({ children, kind = "primary", className = "", grad, ...p }) {
  const { T } = useApp();
  const styles = kind === "primary" ? { background: grad ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : T.accent, color: T.accentText, border: "1px solid transparent" }
    : kind === "ghost" ? { background: "transparent", color: T.text, border: `1px solid ${T.border}` }
    : { background: T.surfaceAlt, color: T.text, border: `1px solid ${T.border}` };
  return <button style={styles} className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 ${className}`} {...p}>{children}</button>;
}
function Field({ label, children }) { const { T } = useApp(); return <label className="block"><span style={{ color: T.textMuted }} className="text-xs font-semibold uppercase tracking-wider">{label}</span><div className="mt-1.5">{children}</div></label>; }
function Input(props) { const { T } = useApp(); return <input {...props} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }} className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none" />; }
function TextArea(props) { const { T } = useApp(); return <textarea {...props} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }} className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none resize-none" />; }
function Select({ children, ...props }) { const { T } = useApp(); return <select {...props} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, colorScheme: T.mode || "dark" }} className="w-full rounded-xl px-3.5 py-2.5 text-[15px] outline-none">{children}</select>; }
function Badge({ children, color }) { const { T } = useApp(); const c = color || T.textMuted; return <span style={{ background: hexToRgba(c, T.mode === "dark" ? 0.22 : 0.13), color: c }} className="text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">{children}</span>; }
function SectionTitle({ children, right }) { const { T } = useApp(); return <div className="flex items-center justify-between mb-3"><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-[0.18em] font-bold">{children}</div>{right}</div>; }
function Empty({ icon: Icon, title, hint }) { const { T } = useApp(); return <Card style={{ padding: 40 }}><div className="text-center"><Icon size={26} style={{ color: T.textMuted }} className="mx-auto mb-3" /><div className="font-semibold">{title}</div>{hint && <div style={{ color: T.textMuted }} className="text-sm mt-1">{hint}</div>}</div></Card>; }
function ImagePick({ value, onChange, label = "Add image" }) {
  const { T, flash } = useApp();
  return value ? (<div className="relative rounded-xl overflow-hidden"><img src={value} alt="" className="w-full h-40 object-cover" /><button onClick={() => onChange("")} className="absolute top-2 right-2 bg-black/55 text-white rounded-lg p-1.5"><X size={15} /></button></div>)
    : (<label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-5 text-sm cursor-pointer"><ImageIcon size={17} /> {label}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readImage(f, onChange, flash); }} /></label>);
}
// `docId` lets a chip point at a documents row whose file bytes were not
// loaded with the building — the payload is fetched only when clicked.
function FileChip({ name, data, path, color, docId }) {
  const { T, flash } = useApp();
  const [busy, setBusy] = useState(false);
  const c = color || T.accent;
  const send = (d) => { const a = document.createElement("a"); a.href = d; a.download = name; a.click(); };
  const open = async () => {
    if (busy) return;
    if (path) { attachmentUrl(path).then((url) => window.open(url, "_blank")).catch(() => flash("Couldn't open the file — try again")); return; }
    if (data) { send(data); return; }
    if (docId) {
      setBusy(true);
      try { const d = await getDocumentFile(docId); if (d) { send(d); return; } flash("No file attached to this record"); }
      catch (e) { flash("Couldn't fetch the file — try again"); }
      finally { setBusy(false); }
      return;
    }
    flash(`Opening ${name}`);
  };
  return <button onClick={open} disabled={busy} style={{ background: hexToRgba(c, T.mode === "dark" ? 0.2 : 0.12), color: c, opacity: busy ? 0.6 : 1 }} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5"><Paperclip size={12} /> {name} {busy ? <span className="text-[11px]">fetching…</span> : <Download size={12} />}</button>;
}
export function Toast() { const { toast } = useApp(); if (!toast) return null; return <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4"><div className="bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2"><Mail size={15} /> {toast}</div></div>; }

// ---------- live clock + day/night sky header -------------------------------
function Clock({ className }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const day = now.toLocaleDateString("en-AU", { weekday: "long" });
  const date = now.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  return <span className={className}>{day}, {date} · {time}</span>;
}
const skyPhase = (h) => (h >= 20 || h < 5) ? "night" : (h < 8) ? "dawn" : (h < 17) ? "day" : "dusk";
function AnimatedHeader({ children }) {
  const { T } = useApp();
  const phase = (() => { try { const p = new URLSearchParams(window.location.search).get("phase"); if (["day", "night", "dawn", "dusk"].includes(p)) return p; } catch (e) {} return skyPhase(new Date().getHours()); })();
  const stars = useMemo(() => Array.from({ length: 28 }, () => ({ l: Math.random() * 100, t: Math.random() * 78, d: (Math.random() * 3.5).toFixed(2), s: 1 + Math.random() * 2.6 })), []);
  const isNight = phase === "night";
  const showStars = isNight;
  const showSun = !isNight;
  const sunGlow = phase === "day" ? "rgba(255,241,194,0.6)" : "rgba(255,168,108,0.5)";
  const sunCore = phase === "day" ? "rgba(255,248,224,0.7)" : "rgba(255,190,130,0.6)";
  const showClouds = phase === "day" || phase === "dusk";
  const waves = [
    { h: 86, o: 0.17, dur: 19, dir: "normal", d: "M0,34 C240,104 480,-8 720,44 C960,100 1200,-4 1440,40 L1440,120 L0,120 Z" },
    { h: 104, o: 0.12, dur: 29, dir: "reverse", d: "M0,52 C300,6 600,112 900,48 C1180,4 1320,96 1440,42 L1440,120 L0,120 Z" },
    { h: 78, o: 0.07, dur: 41, dir: "normal", d: "M0,86 C220,66 540,108 760,84 C1020,60 1260,104 1440,82 L1440,120 L0,120 Z" },
  ];
  return (
    <div className="relative overflow-hidden" style={{ background: `linear-gradient(115deg, ${T.headerFrom}, ${T.headerVia}, ${T.headerTo})`, color: "#fff" }}>
      {showSun && <div className="rp-anim" style={{ position: "absolute", top: -130, right: -130, width: 340, height: 340, borderRadius: "50%", background: `radial-gradient(circle, ${sunGlow}, transparent 70%)`, animation: "rpsun 7s ease-in-out infinite" }} />}
      {showSun && <div className="rp-anim" style={{ position: "absolute", top: -70, right: -70, width: 190, height: 190, borderRadius: "50%", background: `radial-gradient(circle, ${sunCore}, transparent 68%)`, animation: "rpsun 7s ease-in-out infinite" }} />}
      {showStars && stars.map((s, i) => (<span key={i} className="rp-twinkle" style={{ position: "absolute", left: `${s.l}%`, top: `${s.t}%`, width: s.s, height: s.s, borderRadius: "50%", background: "#fff", opacity: 0.95, boxShadow: "0 0 7px 1px rgba(255,255,255,0.9)", animationDelay: `${s.d}s` }} />))}
      {showClouds && [{ t: 10, w: 130, o: 0.16, d: "0s", dur: "75s" }, { t: 34, w: 90, o: 0.12, d: "-30s", dur: "100s" }, { t: 20, w: 160, o: 0.09, d: "-55s", dur: "130s" }].map((c, i) => (
        <div key={i} className="rp-anim" style={{ position: "absolute", top: c.t, left: 0, width: c.w, height: c.w * 0.4, borderRadius: 9999, background: "#fff", opacity: c.o, filter: "blur(13px)", animation: `rpcloud ${c.dur} linear infinite`, animationDelay: c.d }} />
      ))}
      <div className="rp-anim" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 130, overflow: "hidden", pointerEvents: "none" }}>
        {waves.map((w, i) => (
          <div key={i} className="rp-anim" style={{ position: "absolute", bottom: 0, left: 0, width: "200%", display: "flex", height: w.h, animation: `rpwave ${w.dur}s linear infinite ${w.dir}` }}>
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: "50%", height: "100%" }}><path d={w.d} fill="#ffffff" fillOpacity={w.o} /></svg>
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: "50%", height: "100%" }}><path d={w.d} fill="#ffffff" fillOpacity={w.o} /></svg>
          </div>
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ---------- new version available -------------------------------------------
// There is no service worker, so a page load always fetches the newest build.
// The problem is that nothing makes people load the page: a tab left open, or the
// home-screen app on iOS where there is no address bar and no pull-to-refresh,
// can sit on an old build indefinitely. So the app asks the server what the
// current build is and offers a refresh. It never reloads on its own — someone
// may be halfway through writing a maintenance report.
const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
export function UpdateBanner() {
  const { T } = useApp();
  const [ready, setReady] = useState(null);   // the newer version's number
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (BUILD_ID === "dev") return;           // nothing to compare against locally
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const v = await r.json();
        if (!stop && v && v.build && v.build !== BUILD_ID) setReady(v.version || "");
      } catch (e) { /* offline or blocked — try again later, never bother the user */ }
    };
    check();
    const id = setInterval(check, 15 * 60 * 1000);
    // Focus means the window is in front, so check unconditionally. On mobile the
    // home-screen app resumes without a focus event, so watch visibility too.
    const onFocus = () => check();
    const onVisible = () => { if (document.visibilityState !== "hidden") check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => { stop = true; clearInterval(id); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  if (!ready || hidden) return null;
  return (
    <div className="fixed inset-x-0 z-[60] px-3 rp-fade" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)" }}>
      <div className="mx-auto max-w-md rounded-2xl shadow-lg p-3 flex items-center gap-3"
        style={{ background: T.surface, border: `1px solid ${T.accent}`, color: T.text }}>
        <div className="h-8 w-8 rounded-xl grid place-items-center shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})` }}><Sparkles size={15} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">A new version is ready{ready ? ` (v${ready})` : ""}</div>
          <div className="text-[11px]" style={{ color: T.textMuted }}>Refresh when you're ready — nothing you're working on is lost.</div>
        </div>
        <Btn grad onClick={() => window.location.reload()} className="!px-3 !py-1.5 !text-xs shrink-0">Refresh</Btn>
        <button onClick={() => setHidden(true)} aria-label="Not now" style={{ color: T.textMuted }} className="shrink-0"><X size={15} /></button>
      </div>
    </div>
  );
}

// ---------- root ------------------------------------------------------------
export default function App() {
  const demoB = seed.buildings[0];
  const demoUser = seed.users.find((u) => u.buildingId === demoB.id && u.role === "bcc" && u.status === "active") || seed.users.find((u) => u.buildingId === demoB.id && u.role === "admin") || seed.users.find((u) => u.buildingId === demoB.id && u.status === "active");
  const [store, setStore] = useState(seed);
  const [buildingId, setBuildingId] = useState(demoB.id);
  const [userId, setUserId] = useState(demoUser ? demoUser.id : null);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const update = (fn) => setStore((s) => { const n = structuredClone(s); fn(n); return n; });
  const flash = (m) => { setToast(m); window.clearTimeout(window.__t); window.__t = window.setTimeout(() => setToast(null), 2600); };
  const building = store.buildings.find((b) => b.id === buildingId) || null;
  const user = store.users.find((u) => u.id === userId) || null;
  const T = themeById(building?.themeId);
  const openBuilding = (bid) => { setBuildingId(bid); const admin = store.users.find((u) => u.buildingId === bid && u.role === "admin" && u.status === "active"); const first = admin || store.users.find((u) => u.buildingId === bid && u.status === "active"); setUserId(first ? first.id : null); setView("dashboard"); setShowGuide(true); };
  const ctx = { store, update, T, building, buildingId, setBuildingId, user, userId, setUserId, view, setView, toast, flash, openBuilding, showGuide, setShowGuide };
  return (
    <AppCtx.Provider value={ctx}>
      <UpdateBanner />
      <style>{`
        @keyframes rpsun { 0%,100% { opacity:.75; transform:scale(1) } 50% { opacity:1; transform:scale(1.06) } }
        @keyframes rpcloud { from { transform:translateX(-15%) } to { transform:translateX(115%) } }
        @keyframes rpwave { from { transform:translateX(0) } to { transform:translateX(-50%) } }
        @keyframes rptwinkle { 0%,100% { opacity:.1; transform:scale(.6) } 50% { opacity:1; transform:scale(1.25) } }
        @keyframes rpfade { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .rp-twinkle { animation: rptwinkle 3s ease-in-out infinite; }
        .rp-fade { animation: rpfade .5s ease both; }
        .rp-hover { transition: transform .15s ease, box-shadow .15s ease; }
        .rp-hover:hover { transform: translateY(-2px); }
        @media (prefers-reduced-motion: reduce) { .rp-anim, .rp-twinkle, .rp-fade { animation: none !important; } }
      `}</style>
      <div style={{ background: building ? `linear-gradient(165deg, ${T.appBg}, ${T.appBg2})` : "linear-gradient(165deg, #0a1019, #0c1320)", color: building ? T.text : "#e6edf5", minHeight: "100vh", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
        {!building ? <PlatformHome /> : <BuildingApp />}
        <Toast />
      </div>
    </AppCtx.Provider>
  );
}

// ---------- footer ----------------------------------------------------------
// ---------- footer + legal --------------------------------------------------
function Footer({ onDark }) {
  const ctx = useApp(); const T = ctx && ctx.T;
  const [show, setShow] = useState(null);
  const muted = onDark ? "rgba(255,255,255,0.45)" : (T ? T.textMuted : "#94a3b8");
  const link = onDark ? "rgba(255,255,255,0.72)" : (T ? T.accent : "#64748b");
  return (<>
    <div className="text-center text-xs py-6 flex items-center justify-center flex-wrap gap-x-3 gap-y-1" style={{ color: muted }}>
      <span>{PLATFORM.name} · v{PLATFORM.version}</span>
      <button onClick={() => setShow("privacy")} style={{ color: link }} className="underline underline-offset-2">Privacy &amp; terms</button>
      <button onClick={() => setShow("about")} style={{ color: link }} className="underline underline-offset-2">About</button>
    </div>
    {show && <LegalModal initial={show} onClose={() => setShow(null)} />}
  </>);
}
function LegalModal({ initial, onClose }) {
  const [t, setT] = useState(initial);
  const H = ({ children }) => <div style={{ color: "#0f172a" }} className="font-bold text-[15px] mt-4 mb-1 first:mt-0">{children}</div>;
  const P = ({ children }) => <p style={{ color: "#475569" }} className="text-sm leading-relaxed mb-2">{children}</p>;
  return (<div className="fixed inset-0 z-[90] grid place-items-center p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/60" />
    <div className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: "#fff", color: "#1e293b", maxHeight: "88dvh" }} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid #e2e8f0" }}>
        <div className="flex gap-1">{[["privacy", "Privacy & terms"], ["about", "About"]].map(([k, l]) => (<button key={k} onClick={() => setT(k)} className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ background: t === k ? "#0f172a" : "transparent", color: t === k ? "#fff" : "#64748b" }}>{l}</button>))}</div>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "#64748b" }}><X size={18} /></button>
      </div>
      <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
        {t === "privacy" ? (<>
          <div className="rounded-lg px-3 py-2 mb-3 text-xs font-semibold" style={{ background: "#ecfeff", color: "#155e75" }}>Effective: 26 June 2026 · Version 1.0</div>
          <P>NaloHub respects your privacy. This statement explains how we handle personal information in line with the Privacy Act 1988 (Cth) and the 13 Australian Privacy Principles (APPs).</P>
          <H>1. Who we are</H><P>NaloHub ("we", "us", "our") provides a private resident portal for apartment and strata buildings. The entity responsible for personal information handled through the platform is Tazanna Trust, ABN 76 424 590 443. Each building's body corporate / owners' committee decides who may access their building's portal.</P>
          <H>2. What personal information we collect</H>
          <ul className="list-disc pl-5 text-sm mb-2" style={{ color: "#475569" }}>
            <li>Account details — your name, email address, the unit/apartment you're associated with, and your role.</li>
            <li>Contact details — a phone number and email address.</li>
            <li>Content you submit — maintenance reports (including photos), bookings, messages, documents and similar entries.</li>
            <li>Building information — details about your building that the committee or manager configures.</li>
            <li>Technical information — basic log and device data (IP address, browser type, timestamps) used for security and reliability.</li>
          </ul>
          <P>We do not seek to collect sensitive information. Please don't post sensitive information into free-text fields unless it's necessary.</P>
          <H>3. How we collect it</H>
          <ul className="list-disc pl-5 text-sm mb-2" style={{ color: "#475569" }}>
            <li>Directly from you, when you sign in or enter information in the portal.</li>
            <li>From your building's committee or manager, who may add your name, email and unit so you can be invited.</li>
            <li>Automatically, through your use of the service (technical/log data above).</li>
          </ul>
          <H>4. Why we use it</H>
          <ul className="list-disc pl-5 text-sm mb-2" style={{ color: "#475569" }}>
            <li>To provide the portal and its features to your building.</li>
            <li>To sign you in securely using an email link, and keep your session safe.</li>
            <li>To deliver notices, bookings, maintenance updates and other building communications.</li>
            <li>To provide support, and to administer billing to the building.</li>
            <li>To maintain security, prevent misuse, and meet our legal obligations.</li>
          </ul>
          <H>5. When we share it</H><P>We do not sell personal information. We disclose it only as needed: within your building (your name, unit and role are visible so the community can function; your phone and email can be hidden); to your committee / manager; to trusted service providers who help us run the platform under confidentiality and security obligations; and where required by law.</P>
          <H>6. Overseas storage and disclosure</H><P>We host the platform's data in Australia where practicable (our primary database region is Sydney). Some service providers may store or process limited data outside Australia; where that happens we take reasonable steps to ensure your information is handled consistently with the APPs (APP 8).</P>
          <H>7. Security and retention</H><P>We take reasonable steps to protect personal information from misuse, loss and unauthorised access — including passwordless sign-in via secure email links, access controls that isolate each building, and encryption in transit. If a data breach likely to cause serious harm occurs, we will respond in line with the Notifiable Data Breaches scheme. We keep personal information only for as long as needed for the purposes above or as required by law.</P>
          <H>8. Accessing and correcting your information</H><P>You can view and update your own details in the portal's settings at any time. Under APPs 12 and 13 you may also ask us for access to the personal information we hold about you, or ask us to correct it. We'll respond within a reasonable time.</P>
          <H>9. Marketing</H><P>NaloHub is a service you use through your building — we don't send unsolicited marketing to residents. Operational emails (such as sign-in links or building notices) are part of providing the service.</P>
          <H>10. Cookies and analytics</H><P>We use only the cookies and local storage needed to keep you signed in and to remember basic preferences. We keep analytics minimal and do not use your portal content for advertising.</P>
          <H>11. Your data, your building</H><P>A building's records belong to that building. The committee can export their building's data and take it with them if they ever leave NaloHub.</P>
          <H>12. Complaints</H><P>If you have a privacy concern, please contact us first and we'll work to resolve it. If you're not satisfied, you can contact the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au or 1300 363 992.</P>
          <H>13. Changes to this statement</H><P>We may update this statement from time to time. We'll change the "Effective" date above and, where changes are significant, let you know within the portal.</P>
          <H>14. Contact us</H><P>Privacy enquiries: email info@nalohub.com · phone +61 420 331 425 · nalohub.com</P>
        </>) : (<>
          <H>{PLATFORM.name}</H><P>Version {PLATFORM.version}</P><P>A simple resident portal that helps your whole building see itself — what's reported, what's moving, what's done. Resident &amp; committee first. 🌊 Be in the Nalo.</P>
        </>)}
      </div>
    </div>
  </div>);
}

// ---------- welcome / guided tour (BCC lens) --------------------------------
function WelcomeGuide({ onStartTour }) {
  const { T, building, setShowGuide, setView } = useApp();
  const close = () => { try { localStorage.setItem("nalo_seen_guide", "1"); } catch (e) {} setShowGuide(false); };
  const steps = [
    { t: "Dashboard", d: "See what a resident lands on — live weather, what's on this month, and one-tap actions." },
    { t: "Announcements", d: "Open a notice. Then switch Viewing as → Strata manager and post a formal AGM notice to owners only." },
    { t: "Maintenance", d: "Open an issue, triage it, post a progress update, and record an approved supplier with quote & statement of work." },
    { t: "Meetings & decisions", d: "Open the AGM: review the agenda, draft one from open actions, and record a motion's vote and decision." },
    { t: "Reports", d: "The committee's snapshot. Export the Decisions register as a baseline for your minutes." },
    { t: "Make it yours", d: "In Settings, edit the building name and details — watch the header update — then toggle features on or off." },
  ];
  return (<div className="fixed inset-0 z-[95] grid place-items-center p-4" onClick={close}>
    <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.62)" }} />
    <div className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, maxHeight: "90dvh" }} onClick={(e) => e.stopPropagation()}>
      <div className="shrink-0"><AnimatedHeader><div className="px-5 py-5"><div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Welcome to the demo</div><h2 className="text-xl font-bold mt-1">Take the Committee's Seat</h2><p className="text-white/85 text-sm mt-1.5">You're exploring {building.name} — a fully working portal filled with realistic data. Nothing you do here affects anyone else; reload any time to reset.</p></div></AnimatedHeader></div>
      <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
        <div className="rounded-xl p-3 mb-4" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><div className="text-sm font-semibold flex items-center gap-2"><Eye size={15} style={{ color: T.accent }} /> The one control to know</div><p style={{ color: T.textMuted }} className="text-sm mt-1">Use <b>Viewing as</b> at the top of the menu to experience the portal through every set of eyes — committee, owner, tenant, building manager or strata manager.</p></div>
        <div className="text-[11px] uppercase tracking-[0.16em] font-bold mb-2" style={{ color: T.textMuted }}>A six-step tour</div>
        <ol className="space-y-3">{steps.map((st, i) => (<li key={i} className="flex gap-3"><span className="h-6 w-6 rounded-full grid place-items-center text-[12px] font-bold shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})` }}>{i + 1}</span><div><div className="text-sm font-semibold">{st.t}</div><div style={{ color: T.textMuted }} className="text-sm">{st.d}</div></div></li>))}</ol>
        <div className="rounded-xl p-3 mt-4 text-xs" style={{ background: hexToRgba(SEMANTIC.warn, T.mode === "dark" ? 0.14 : 0.1), color: T.textMuted, border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.3)}` }}><b style={{ color: T.text }}>This is a live demo to show capability and value.</b> A few things are illustrative — file uploads, document storage, emails and weather are simulated, and everything resets when you reload. The full version stores real files and data securely.</div>
      </div>
      <div className="px-5 py-3 flex gap-2 shrink-0" style={{ borderTop: `1px solid ${T.border}` }}><Btn grad onClick={() => { close(); onStartTour && onStartTour(); }} className="flex-1">Take the guided tour</Btn><Btn kind="ghost" onClick={close}>Explore</Btn><Btn kind="ghost" onClick={() => { setView("settings"); close(); }}>Make it ours</Btn></div>
    </div>
  </div>);
}
function PlatformHome() {
  const { store, openBuilding } = useApp();
  const [wizard, setWizard] = useState(false);
  if (wizard) return <SetupWizard onClose={() => setWizard(false)} />;
  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <div className="flex items-center gap-3 mb-1"><div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center"><Building2 size={22} /></div><div className="text-xs uppercase tracking-[0.2em] text-white/50">{PLATFORM.name} · platform</div></div>
      <h1 className="text-3xl font-bold">Your Buildings</h1>
      <p className="text-white/60 mt-1 text-sm">You provision a building, then hand governance to its committee. Each building's data stays separate.</p>
      <div className="grid sm:grid-cols-2 gap-4 mt-7">
        {store.buildings.map((b) => {
          const t = themeById(b.themeId);
          const count = store.users.filter((u) => u.buildingId === b.id && u.status === "active").length;
          const pending = store.users.filter((u) => u.buildingId === b.id && u.status === "pending").length;
          return (
            <button key={b.id} onClick={() => openBuilding(b.id)} className="text-left rounded-2xl p-5 rp-hover" style={{ background: "#141d2e", border: "1px solid #243049" }}>
              <div className="flex items-center gap-3">{b.logoImage ? <img src={b.logoImage} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="h-12 w-12 rounded-xl grid place-items-center font-black" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, color: t.accentText }}>{b.logoText}</div>}<div className="min-w-0"><div className="font-semibold truncate">{b.name}</div><div className="text-white/50 text-xs truncate">{b.type}</div></div></div>
              <div className="flex items-center gap-4 mt-4 text-xs text-white/55"><span>{b.units} units</span><span>{count} members</span>{pending > 0 && <span style={{ color: SEMANTIC.warn }}>{pending} awaiting access</span>}</div>
              <div className="mt-3 text-sm font-semibold inline-flex items-center gap-1" style={{ color: t.accent }}>Open portal <ChevronRight size={15} /></div>
            </button>
          );
        })}
        <button onClick={() => setWizard(true)} className="rounded-2xl p-5 border-2 border-dashed border-white/20 text-white/70 hover:text-white hover:border-white/40 transition grid place-items-center min-h-[150px]"><div className="text-center"><Plus className="mx-auto mb-1" /><div className="text-sm font-semibold">Add a Building</div></div></button>
      </div>
      <Footer onDark />
    </div>
  );
}

function SetupWizard({ onClose }) {
  const { update, openBuilding, user } = useApp();
  const [f, setF] = useState({ name: "", type: "Residential apartments", address: "", logoText: "", logoImage: "", units: 50, floors: 8, towers: 1, schemeRef: "", strataManager: "", buildingManager: "", towerDesc: "", bccEmail: "", strataContactName: "", strataContactPhone: "", strataContactEmail: "", whatsappName: "", whatsappLink: "", residentsCSV: "", keyfobsCSV: "", facilities: { bbq: true, visitor: true, lift: true, common: true, gym: false }, modules: { events: true, gallery: true, marketplace: true, messaging: true, directory: true, business: true, documents: true, meetings: true, keyfobs: true, firesafety: true, whatsapp: true }, themeId: "pacific" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleFac = (k) => setF((p) => ({ ...p, facilities: { ...p.facilities, [k]: !p.facilities[k] } }));
  const T = themeById(f.themeId);
  const FAC = [["bbq", "BBQ area", Flame], ["visitor", "Visitor parking", Car], ["lift", "Lift booking (moves)", ArrowUpDown], ["common", "Common room", Sofa], ["gym", "Gym", Dumbbell]];
  const create = () => {
    if (!f.name.trim()) return;
    const id = "b" + Math.random().toString(36).slice(2, 6);
    const logo = (f.logoText || f.name).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "BX";
    const { residentsCSV, keyfobsCSV, ...bf } = f;
    const rid = () => Math.random().toString(36).slice(2, 8);
    const newUsers = (residentsCSV || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [name, unit, role, email, phone] = l.split(",").map((x) => (x || "").trim()); const x = (role || "").toLowerCase(); const rl = x.startsWith("t") ? "tenant" : (x.startsWith("b") || x.includes("committee")) ? "bcc" : x.startsWith("m") ? "manager" : x.startsWith("s") ? "strata" : "owner"; return name ? { id: "u" + rid(), buildingId: id, name, unit: unit || "", role: rl, status: "active", email: email || "", phone: phone || "", directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: nowISO() } : null; }).filter(Boolean);
    const newFobs = (keyfobsCSV || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [type, label, serial, unit, holder] = l.split(",").map((x) => (x || "").trim()); return { id: "kf" + rid(), buildingId: id, type: type || "Fob", label: label || "", serial: serial || "", unit: unit || "", holder: holder || "", issued: today(), status: "issued", notes: "" }; });
    update((s) => { const nb = { id, ...bf, logoText: logo, units: Number(f.units) || 0, emergency: [], fireNotes: "" }; stampProvenance(nb, user, today()); s.buildings.push(nb); s.users.push({ id: "u" + rid(), buildingId: id, name: "NaloHub Admin", unit: "Admin", role: "admin", status: "active", email: "admin@seahaven.com.au", phone: "", directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: nowISO() }); newUsers.forEach((u) => s.users.push(u)); newFobs.forEach((k) => s.keyfobs.push(k)); });
    setTimeout(() => openBuilding(id), 0);
  };
  return (
    <div className="min-h-screen" style={{ background: T.appBg, color: T.text }}>
      <AnimatedHeader><div className="max-w-2xl mx-auto px-5 py-8 flex items-center gap-3"><button onClick={onClose} className="p-1.5 rounded-lg bg-white/15"><ArrowLeft size={18} /></button><div><div className="text-[11px] uppercase tracking-[0.2em] text-white/70">New building</div><h1 className="text-2xl font-bold">Set Up a Building</h1></div></div></AnimatedHeader>
      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        <Card style={{ padding: 20 }}><SectionTitle>Identity</SectionTitle><div className="space-y-4">
          <Field label="Building name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. SeaHaven" /></Field>
          <Field label="Logo"><div className="flex items-center gap-3">{f.logoImage ? <img src={f.logoImage} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="h-14 w-14 rounded-xl grid place-items-center font-black" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: T.accentText }}>{(f.logoText || f.name || "B").slice(0, 2).toUpperCase()}</div>}<label style={{ borderColor: T.border, color: T.text }} className="border rounded-xl px-3 py-2 text-sm cursor-pointer inline-flex items-center gap-2"><Upload size={15} /> Upload image<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, (d) => set("logoImage", d), undefined, { maxDim: LOGO_MAX_DIM, keepAlpha: true }); }} /></label>{f.logoImage && <button onClick={() => set("logoImage", "")} style={{ color: T.textMuted }} className="text-xs underline">Use initials</button>}</div></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Type"><Input value={f.type} onChange={(e) => set("type", e.target.value)} /></Field><Field label="Initials (fallback)"><Input value={f.logoText} onChange={(e) => set("logoText", e.target.value.toUpperCase().slice(0, 3))} placeholder="SK" /></Field></div>
          <Field label="Address"><Input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, suburb, state" /></Field>
          <Field label="Scheme / plan reference"><Input value={f.schemeRef} onChange={(e) => set("schemeRef", e.target.value)} placeholder="e.g. CTS 12345 (QLD) · SP 45678 (NSW) · OC/PS (VIC)" /></Field>
          <div className="grid grid-cols-3 gap-3"><Field label="Units"><Input type="number" value={f.units} onChange={(e) => set("units", e.target.value)} /></Field><Field label="Floors"><Input type="number" value={f.floors} onChange={(e) => set("floors", e.target.value)} /></Field><Field label="Towers"><Input type="number" value={f.towers} onChange={(e) => set("towers", e.target.value)} /></Field></div>
        </div></Card>
        <Card style={{ padding: 20 }}><SectionTitle>People &amp; links</SectionTitle><div className="grid sm:grid-cols-2 gap-3"><Field label="Strata manager (optional)"><Input value={f.strataManager} onChange={(e) => set("strataManager", e.target.value)} /></Field><Field label="Building manager (optional)"><Input value={f.buildingManager} onChange={(e) => set("buildingManager", e.target.value)} /></Field></div><div className="mt-3 grid sm:grid-cols-2 gap-3"><Field label="WhatsApp group name (optional)"><Input value={f.whatsappName} onChange={(e) => set("whatsappName", e.target.value)} placeholder="e.g. SeaHaven Residents" /></Field><Field label="WhatsApp group invite link (optional)"><Input value={f.whatsappLink} onChange={(e) => set("whatsappLink", e.target.value)} placeholder="https://chat.whatsapp.com/…" /></Field></div></Card>
        <Card style={{ padding: 20 }}><SectionTitle>Facilities residents can book</SectionTitle><div className="grid sm:grid-cols-2 gap-2.5">{FAC.map(([k, label, Icon]) => (<button key={k} onClick={() => toggleFac(k)} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-left" style={{ border: `1px solid ${f.facilities[k] ? T.accent : T.border}`, background: f.facilities[k] ? hexToRgba(T.accent, T.mode === "dark" ? 0.18 : 0.1) : "transparent" }}><Icon size={18} style={{ color: f.facilities[k] ? T.accent : T.textMuted }} /><span className="text-sm font-medium flex-1">{label}</span>{f.facilities[k] && <Check size={16} style={{ color: T.accent }} />}</button>))}</div></Card>
        <Card style={{ padding: 20 }}><SectionTitle>Features for this building</SectionTitle><p style={{ color: T.textMuted }} className="text-sm mb-3">Turn modules on or off. You can change these later in Settings.</p><div className="grid sm:grid-cols-2 gap-2.5">{OPTIONAL_MODULES.concat("whatsapp").map((k) => { const on = f.modules[k] !== false; return (<button key={k} onClick={() => setF((p) => ({ ...p, modules: { ...p.modules, [k]: !on } }))} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-left" style={{ border: `1px solid ${on ? T.accent : T.border}`, background: on ? hexToRgba(T.accent, T.mode === "dark" ? 0.18 : 0.1) : "transparent" }}><span className="text-sm font-medium flex-1">{MODULE_LABELS[k]}</span>{on && <Check size={16} style={{ color: T.accent }} />}</button>); })}</div></Card>
        <Card style={{ padding: 20 }}><SectionTitle>Bulk import (optional)</SectionTitle><p style={{ color: T.textMuted }} className="text-sm mb-3">Paste one record per line, comma-separated. You can also do this later in Settings.</p>
          <Field label="Owners & tenants — name, unit, role, email, phone"><TextArea rows={4} value={f.residentsCSV} onChange={(e) => set("residentsCSV", e.target.value)} placeholder={"Sandra Pho, 412, owner, sandra@seahaven.com.au, 0400 555 666\nRavi Anand, 118, tenant, ravi@seahaven.com.au, 0400 777 888"} /></Field>
          <div className="mt-3"><Field label="Key/fob register — type, label, serial, unit, holder"><TextArea rows={4} value={f.keyfobsCSV} onChange={(e) => set("keyfobsCSV", e.target.value)} placeholder={"Fob, Main entry, SN-1024, 412, Sandra Pho\nRemote, Carpark gate, SN-2087, 118, Ravi Anand"} /></Field></div>
        </Card>
        <Card style={{ padding: 20 }}><SectionTitle>Appearance</SectionTitle><ThemeGrid value={f.themeId} onChange={(id) => set("themeId", id)} /></Card>
        <div className="flex gap-3 pb-10"><Btn grad onClick={create} className="flex-1"><Plus size={16} /> Create building</Btn><Btn kind="ghost" onClick={onClose}>Cancel</Btn></div>
      </div>
    </div>
  );
}
function ThemeGrid({ value, onChange }) {
  const { T } = useApp();
  return (<div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">{THEMES.map((t) => (<button key={t.id} onClick={() => onChange(t.id)} className="rounded-xl p-2.5 text-left rp-hover" style={{ border: `2px solid ${value === t.id ? t.accent : T.border}`, background: T.surfaceAlt }}><div className="h-9 rounded-lg mb-2" style={{ background: `linear-gradient(110deg, ${t.headerFrom}, ${t.headerVia}, ${t.headerTo})` }} /><div className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})` }} /><div className="text-xs font-semibold flex-1 truncate">{t.name}</div>{value === t.id && <Check size={13} style={{ color: t.accent }} />}</div></button>))}</div>);
}

// ---------- building app shell ----------------------------------------------

// ---------- first-run guide (resident onboarding, production) ---------------
function FirstRunGuide() {
  const { T, setShowGuide } = useApp();
  const GREEN = "#34d399";
  const [i, setI] = useState(0);
  const close = () => { try { localStorage.setItem("nalo_seen_guide", "1"); } catch (e) {} setShowGuide(false); };
  const slides = [
    { safe: true, Icon: Lock, t: "A safe, private place", d: "This portal is just for your building. Only your neighbours and committee are here." },
    { Icon: Wrench, t: "Something broken?", d: "Tap Maintenance, snap a photo, send. You can follow the progress." },
    { Icon: Calendar, t: "Book a space", d: "BBQ, visitor parking, the common room — pick a time and you’re done." },
    { Icon: Megaphone, t: "Stay in the loop", d: "Notices and events come to you. No more missing the lift-wall sign." },
    { Icon: Eye, t: "You’re in control", d: "Choose what to share. Hide your phone and email any time in Settings." },
    { Icon: Sparkles, t: "You’re in the Nalo!", d: "Tap Help whenever you need a hand. Welcome aboard." },
  ];
  const s = slides[i], last = i === slides.length - 1;
  const SafeChip = ({ Icon, b, sub }) => (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-left" style={{ background: hexToRgba(GREEN, 0.12), border: `1px solid ${hexToRgba(GREEN, 0.32)}` }}>
      <Icon size={18} style={{ color: GREEN, flexShrink: 0 }} />
      <div><div className="text-sm font-semibold" style={{ color: T.text }}>{b}</div><div className="text-xs" style={{ color: T.textMuted }}>{sub}</div></div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center p-4" onClick={close}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.62)" }} />
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden flex flex-col" style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, maxHeight: "90dvh" }} onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 relative">
          <AnimatedHeader><div className="px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/75">Welcome 👋</div>
            <h2 className="text-xl font-bold mt-1">Get started in 30 seconds</h2>
            <span className="inline-block mt-2 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.28)", color: "#fff" }}>Your building, just Nalo it.</span>
          </div></AnimatedHeader>
          <button onClick={close} className="absolute top-3 right-3 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>Skip</button>
        </div>
        <div className="px-6 py-6 overflow-y-auto flex-1 min-h-0 text-center flex flex-col items-center gap-3">
          <div className="grid place-items-center rounded-full" style={{ width: s.safe ? 128 : 108, height: s.safe ? 128 : 108, background: s.safe ? hexToRgba(GREEN, 0.14) : hexToRgba(T.accent, 0.16), color: s.safe ? GREEN : T.accent }}><s.Icon size={s.safe ? 58 : 46} /></div>
          <h3 className="text-xl font-bold" style={{ color: T.text }}>{s.t}</h3>
          <p className="text-sm" style={{ color: T.textMuted, maxWidth: 280 }}>{s.d}</p>
          {s.safe && <div className="w-full max-w-xs flex flex-col gap-2 mt-1">
            <SafeChip Icon={Home} b="Private to your building" sub="Outsiders can’t see anything here" />
            <SafeChip Icon={Eye} b="You choose what to share" sub="Your details stay hidden unless you say so" />
            <SafeChip Icon={Lock} b="No password to lose" sub="We email you a secure sign-in link" />
          </div>}
        </div>
        <div className="flex justify-center gap-1.5 py-2">{slides.map((_, k) => <span key={k} className="rounded-full" style={{ width: k === i ? 22 : 8, height: 8, background: k === i ? T.accent : hexToRgba(T.text, 0.18), transition: "all .2s" }} />)}</div>
        <div className="px-5 py-3 flex gap-2 shrink-0" style={{ borderTop: `1px solid ${T.border}` }}>
          {i > 0 && <Btn kind="ghost" onClick={() => setI(i - 1)}>Back</Btn>}
          <Btn grad onClick={() => last ? close() : setI(i + 1)} className="flex-1">{last ? "Finish" : "Next"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ---------- Help hub (everyone) --------------------------------------------
function HelpHub() {
  const { T, setShowGuide, user } = useApp();
  const GREEN = "#34d399";
  const [term, setTerm] = useState(""); const [cat, setCat] = useState("all"); const [open, setOpen] = useState({});
  const cats = [["all", "All"], ["committee", "Committee"], ["safety", "Safe & private"], ["start", "Getting started"], ["report", "Reporting"], ["book", "Bookings"], ["notices", "Notices & docs"], ["account", "Your account"]];
  const faqs = [
    { cat: "safety", safe: 1, Icon: Lock, q: "Is my information safe here?", a: "Yes. This portal is private to your building. Only your neighbours and committee can see it — never the public, and never people from other buildings." },
    { cat: "safety", safe: 1, Icon: Eye, q: "Who can see my phone number?", a: "Nobody, unless you choose to show it. Your phone and email stay hidden by default. You can turn sharing on or off any time in Settings." },
    { cat: "safety", safe: 1, Icon: Lock, q: "Do I need a password?", a: "No password to create or remember. We email you a secure link — tap it and you’re in. That’s safer than a password you might forget." },
    { cat: "start", Icon: Home, q: "Do I need to download an app?", a: "No. It opens in your web browser like a website. You can add it to your home screen if you like, but you don’t have to." },
    { cat: "start", Icon: HelpCircle, q: "I’m not great with technology — is this hard?", a: "Not at all. If you can send a text message, you can use this. Everything is a tap, and Help is always here." },
    { cat: "report", Icon: Wrench, q: "How do I report something broken?", a: "Tap Maintenance, then New. Describe it in a few words, add a photo if you can, and send. Done." },
    { cat: "report", Icon: Wrench, q: "Will I know when it’s fixed?", a: "Yes. Your request shows its progress, so you can see when it’s being looked at and when it’s done." },
    { cat: "book", Icon: Calendar, q: "How do I book the BBQ or common room?", a: "Tap Bookings, choose the space and a time, and confirm. You’ll see your booking in the list." },
    { cat: "committee", Icon: Vote, q: "How does committee voting work?", a: "Open Voting and raise a motion — or let one arrive automatically from an application or maintenance recommendation. Every BCC member is alerted, reviews the attachments and proposed Conditions of Approval, can ask a clarifying question, then votes yes, no or abstain with an optional comment. The motion passes with a majority of ALL committee members (4 of 6, for example) and the decision executes itself — an approved application is approved, an accepted quote is accepted — with every step in the audit trail." },
    { cat: "committee", Icon: Vote, q: "I'll be away — can someone vote for me?", a: "Yes. In Voting, scroll to Proxies and appoint another BCC voting member for your dates. NaloHub enforces the legislative limits (your proxy must be a committee member and can hold only one proxy), generates the signable appointment form, and your proxy's vote is picked up automatically on any motion while you're away." },
    { cat: "committee", Icon: ListChecks, q: "How do I run a repair through to a contractor?", a: "Maintenance Workflow. Pick the issue, tap Triage so everyone knows it's handled, add quotes as they arrive (with the documents attached and linked to your Contractors register), Recommend the best one, then Send to vote. When the motion passes, the winning quote is accepted and you confirm the contractor — the whole story stays on one trail." },
    { cat: "committee", Icon: Search, q: "What does Unit Search show me?", a: "Everything the building knows about a lot in one view: owner and tenant contacts, the managing agent, pets, vehicles and parking, every key and fob on issue (with receipt confirmations), by-law breaches, disputes and applications. Use the + buttons to add records on the spot." },
    { cat: "committee", Icon: KeyRound, q: "How do key and fob receipts work?", a: "When you issue or replace a key, fob or card to an app member, they get an alert asking them to confirm receipt in the app. The confirmation records who, the date and the time — a permanent record that ends every 'I never got it' conversation." },
    { cat: "committee", Icon: Briefcase, q: "What are the registers for?", a: "Contracts holds every agreement the building has — party, purpose, dates, value, the document itself — and warns you 60 days before anything expires. Contractors is your trusted trades list with licences and insurance dates. Walk-Through is the monthly inspection checklist with photos and a one-tap Word report." },
    { cat: "committee", Icon: Bell, q: "How do I know when something needs me?", a: "The Alerts section (with the badge in the menu) collects everything: new applications, votes required, maintenance activity, questions on motions, receipt confirmations. Tap any alert to jump straight to it. If you've added NaloHub to your Home Screen, the app icon can show the count too." },
    { cat: "committee", Icon: ClipboardCheck, q: "What are Conditions of Approval?", a: "When an application goes to a vote, NaloHub attaches standard conditions for that category — pet conditions, renovation conditions, key conditions. Conditions are versioned: any BCC member can amend them while the motion is open, but must give a reason, and every vote already cast is set aside (kept on the record) so members vote again on exactly what they can see. The amendment history stays on the motion for every committee member. If the motion passes, the winning version becomes binding, appears on the applicant's approval, and is captured in the audit trail." },
    { cat: "notices", Icon: Megaphone, q: "Where do I read building notices?", a: "Tap Announcements for the latest, and Events for what’s coming up. The important ones also show on your home screen." },
    { cat: "notices", Icon: FileText, q: "Where are documents like meeting minutes?", a: "Tap Documents. By-laws, minutes and safety info are kept there — tap any one to open it." },
    { cat: "account", Icon: Settings, q: "How do I change or hide my details?", a: "Tap Settings. You can update your details and choose what (if anything) your neighbours can see." },
    { cat: "account", Icon: KeyRound, q: "I’ve been logged out — how do I get back in?", a: "Just enter your email again and we’ll send a fresh sign-in link. Nothing is lost." },
  ];
  const t = term.toLowerCase();
  const list = faqs.filter((f) => (cat === "all" || f.cat === cat) && (f.q.toLowerCase().includes(t) || f.a.toLowerCase().includes(t)));
  const Reassure = ({ Icon, label, green }) => (
    <div className="rounded-xl px-2 py-3 text-center" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div className="flex justify-center" style={{ color: green ? GREEN : T.accent }}><Icon size={18} /></div>
      <div className="text-[11px] font-semibold mt-1" style={{ color: T.text }}>{label}</div>
    </div>
  );
  return (
    <div>
      <Head title="Get the best of NaloHub" sub="Tap a question for a short answer" action={<Btn kind="ghost" onClick={() => setShowGuide(true)}><HelpCircle size={15} /> Take the tour</Btn>} />
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Reassure Icon={Home} label="Private to your building" />
        <Reassure Icon={Eye} label="You control sharing" />
        <Reassure Icon={Lock} label="No password to lose" green />
      </div>
      <SectionTitle>Guides — do it step by step</SectionTitle>
      {GUIDE_SECTIONS.map(([sk, sl]) => { const inSec = guidesFor(user).filter((x) => x.sec === sk); if (!inSec.length) return null; return (
        <div key={sk} className="mb-4">
          <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: T.textMuted }}>{sl}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{inSec.map((g) => (
            <button key={g.id} onClick={() => openGuide(g.id)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <span className="grid place-items-center rounded-lg shrink-0" style={{ width: 34, height: 34, background: hexToRgba(T.accent, 0.14), color: T.accent }}><g.icon size={16} /></span>
              <span className="flex-1 min-w-0"><span className="block text-sm font-semibold leading-snug" style={{ color: T.text }}>{g.title}</span><span className="block text-[11px] mt-0.5" style={{ color: T.textMuted }}>{g.who} · {g.mins} min · printable</span></span>
              <ChevronRight size={15} style={{ color: T.textMuted }} />
            </button>
          ))}</div>
        </div>
      ); })}
      <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        <Search size={16} style={{ color: T.textMuted }} />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search help…" className="flex-1 bg-transparent outline-none text-sm" style={{ color: T.text }} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-1">{cats.map(([k, l]) => (
        <button key={k} onClick={() => setCat(k)} className="whitespace-nowrap text-xs font-semibold rounded-full px-3 py-1.5" style={k === cat ? { background: T.accent, color: T.mode === "dark" ? "#06283a" : "#fff" } : { background: T.surface, color: T.textMuted, border: `1px solid ${T.border}` }}>{l}</button>
      ))}</div>
      {list.length === 0 ? <Card style={{ padding: 16 }}><div style={{ color: T.textMuted }}>No matches — try another word, or tap a category.</div></Card> :
        list.map((f, idx) => { const isOpen = open[f.q]; const green = f.safe;
          return (<div key={idx} className="mb-2">
            <button onClick={() => setOpen((o) => ({ ...o, [f.q]: !o[f.q] }))} className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <span className="grid place-items-center rounded-lg shrink-0" style={{ width: 34, height: 34, background: green ? hexToRgba(GREEN, 0.14) : hexToRgba(T.accent, 0.16), color: green ? GREEN : T.accent }}><f.Icon size={16} /></span>
              <span className="flex-1 text-sm font-semibold" style={{ color: T.text }}>{f.q}</span>
              <ChevronRight size={16} style={{ color: T.textMuted, transform: isOpen ? "rotate(90deg)" : "none", transition: ".2s" }} />
            </button>
            {isOpen && <div className="text-sm px-3 pt-2 pb-1" style={{ color: T.textMuted }}>{f.a}</div>}
          </div>);
        })}
    </div>
  );
}

const NAV = [
  // Home
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "home", show: () => true },
  { key: "onboarding", label: "Getting Started", icon: Rocket, group: "home", show: (r) => isCommittee(r) },
  { key: "alerts", label: "Alerts", icon: Bell, group: "home", show: () => true },
  { key: "announcements", label: "Announcements", icon: Megaphone, group: "home", show: () => true },
  // Requests
  { key: "maintenance", label: "Maintenance", icon: Wrench, group: "requests", show: () => true },
  { key: "bookings", label: "Applications & Bookings", icon: CalendarCheck, group: "requests", show: () => true },
  { key: "approvals", label: "Approvals", icon: ClipboardCheck, group: "requests", show: (r) => isApprover(r) },
  // Decisions
  { key: "voting", label: "Voting", icon: Vote, group: "decisions", show: (r) => isCommittee(r) },
  { key: "meetings", label: "Meetings", icon: Gavel, group: "decisions", show: (r) => r !== "tenant" },
  { key: "actions", label: "Action Register", icon: ListChecks, group: "decisions", show: (r) => isApprover(r) },
  { key: "reports", label: "Reports", icon: BarChart3, group: "decisions", show: (r) => isApprover(r) },
  { key: "disputes", label: "Dispute Records", icon: ShieldCheck, group: "decisions", show: (r) => isCommittee(r), premium: true },
  { key: "committeenotes", label: "Committee Notices", icon: Lock, group: "decisions", show: (r) => isCommittee(r) || r === "manager" || r === "owner" },
  // Registers
  { key: "mworkflow", label: "Maintenance Workflow", icon: ListChecks, group: "registers", show: (r) => isCommittee(r) || r === "manager" },
  { key: "assets", label: "Asset Register", icon: Boxes, group: "registers", show: (r) => isCommittee(r) || r === "manager" },
  { key: "contracts", label: "Contracts", icon: Briefcase, group: "registers", show: (r) => isCommittee(r) },
  { key: "contractors", label: "Contractors", icon: HardHat, group: "registers", show: (r) => isCommittee(r) || r === "manager" },
  { key: "keyfobs", label: "Key & Fob Register", icon: KeyRound, group: "registers", show: (r) => isCommittee(r) },
  { key: "compliance", label: "Compliance Calendar", icon: CalendarClock, group: "registers", show: (r) => isCommittee(r) || r === "manager", premium: true },
  { key: "walkthrough", label: "Walk-Through", icon: ClipboardList, group: "registers", show: (r) => isCommittee(r) || r === "manager" },
  { key: "unitsearch", label: "Unit Search", icon: Search, group: "registers", show: (r) => isCommittee(r) },
  { key: "correspondence", label: "Correspondence", icon: Mail, group: "registers", show: (r) => isCommittee(r) || r === "manager" },
  // Community
  { key: "events", label: "Events", icon: CalendarDays, group: "community", show: () => true },
  { key: "gallery", label: "Gallery", icon: ImageIcon, group: "community", show: () => true },
  { key: "marketplace", label: "Marketplace", icon: ShoppingBag, group: "community", show: () => true },
  { key: "messaging", label: "Messaging", icon: MessageSquare, group: "community", show: () => true },
  { key: "directory", label: "Directory", icon: Users, group: "community", show: () => true },
  { key: "business", label: "Business Directory", icon: Store, group: "community", show: () => true },
  // Knowledge
  { key: "nalopilot", label: "NaloPilot", icon: Scale, group: "knowledge", show: () => true, premium: true },
  { key: "bylaws", label: "By-Laws", icon: BookOpen, group: "knowledge", show: () => true, premium: true },
  { key: "documents", label: "Documents", icon: FileText, group: "knowledge", show: () => true },
  { key: "firesafety", label: "Fire Safety", icon: ShieldAlert, group: "knowledge", show: () => true },
  // Account
  { key: "billing", label: "Billing", icon: Receipt, group: "account", show: (r) => isCommittee(r) },
  { key: "help", label: "Help", icon: HelpCircle, group: "account", show: () => true },
  { key: "settings", label: "Settings", icon: Settings, group: "account", show: () => true },
];

// Editable labels: admin can rename a curated set of nav sections per building.
// Stored in building.labels[key]; falls back to the NAV default.
const RENAMABLE = ["dashboard", "maintenance", "assets", "bookings", "events", "gallery", "marketplace", "messaging", "directory", "business", "documents"];
const navLabel = (building, key, fallback) => (building && building.labels && building.labels[key]) || fallback;

// The nav items a given user may see. Single source of truth, shared by the
// sidebar AND the view router so a role can never land on a screen it can't see
// (e.g. after switching "Viewing as" in the demo).
const navVisibleFor = (user, building, backend) => NAV.filter((n) => (n.show(user.role) || (n.key === "correspondence" && user.msc === true)) && (n.key !== "correspondence" || canSeeCorr(user, building)) && (n.key !== "committeenotes" || isCommitteeMember(user) || user.role === "manager") && moduleOn(building, n.key) && (n.key !== "billing" || backend) && (!n.premium || !backend || building.premiumSuite === true) && (user.role !== "strata" || ["dashboard", "announcements", "help"].includes(n.key)));

// ---------- guided spotlight tour (role & module aware) ----------------------
// Bump TOUR_VERSION when new features join the tour — returning users see it again once.
const TOUR_VERSION = 3;
const tourSeenKey = (userId) => `nalo_tour_${userId || "anon"}`;
function tourChecklist(user) {
  const r = user.role;
  if (isCommittee(r)) return ["Post a welcome announcement", "Check Settings — switch on the features your building needs", "Open Reports for your building's snapshot"];
  if (r === "manager") return ["Review open maintenance issues", "Check today's bookings", "Post a notice for residents"];
  if (isStrata(r)) return ["Post a formal notice to owners", "Scan the dashboard for anything needing attention"];
  return ["Complete your profile in Settings", "See what's on in Events", "Say hello in Messaging"];
}
function buildTourSteps(building, user, backend) {
  const r = user.role;
  const first = (user.name || "").trim().split(/\s+/)[0] || "there";
  const navOk = (k) => { const n = NAV.find((x) => x.key === k); return !!n && n.show(r) && moduleOn(building, k) && (k !== "billing" || backend) && (!n.premium || !backend || building.premiumSuite === true) && (r !== "strata" || ["dashboard", "announcements", "help"].includes(k)); };
  const L = (k) => navLabel(building, k, ((NAV.find((x) => x.key === k) || {}).label) || MODULE_LABELS[k] || k);
  const S = [];
  S.push({ centered: true, icon: Sparkles, chip: "Welcome", title: `Hi ${first} — welcome to ${building.name}`, body: `You're here as ${ROLE_LABEL[r]}. This quick tour shows you around — sit back and watch, or use the arrows to go at your own pace.` });
  if (!backend) S.push({ target: "preview-switcher", icon: Eye, chip: "Demo superpower", title: "See it through anyone's eyes", body: "After the tour, switch Viewing as to committee, owner, tenant or manager — the whole portal (and this tour) adapts to each role." });
  S.push({ target: "nav-dashboard", view: "dashboard", icon: LayoutDashboard, title: L("dashboard"), body: isStrata(r) ? "Your snapshot — announcements and anything needing attention, at a glance." : "Your building at a glance — what's on, what needs attention, and shortcuts to everything." });
  if (!isStrata(r)) S.push({ target: "quick-actions", view: "dashboard", icon: Home, title: "Do something in one tap", body: canMaint(user) ? "Jump straight to the jobs that matter — triage an issue, post a notice, check a booking." : "Report an issue, book a space or browse what's on — right from your dashboard." });
  if (navOk("announcements")) S.push({ target: "nav-announcements", view: "announcements", icon: Megaphone, title: L("announcements"), body: isCommittee(r) || isStrata(r) ? "Post notices to the whole building — or owners only — and pin the important ones." : "Building notices come straight to you. No more missing the sign in the lift." });
  if (navOk("maintenance")) S.push({ target: "nav-maintenance", view: "maintenance", icon: Wrench, title: L("maintenance"), body: canMaint(user) ? "Triage issues, record approved suppliers and post progress updates residents can follow." : "Something broken? Snap a photo, send it, and follow the repair's progress." });
  if (navOk("bookings")) S.push({ target: "nav-bookings", view: "bookings", icon: CalendarCheck, title: L("bookings"), body: "BBQ, visitor parking, the common room — pick a time and you're done." });
  if (navOk("reports")) S.push({ target: "nav-reports", view: "reports", icon: BarChart3, title: "Committee tools", body: "Approvals, Reports and the Action Register — govern with a clear paper trail, ready to export." });
  if (navOk("meetings") && isCommittee(r)) S.push({ target: "nav-meetings", view: "meetings", icon: Gavel, title: L("meetings"), body: "Agendas, motions, votes and recorded decisions — your governance record in one place." });
  if (navOk("nalopilot")) S.push({ target: "nav-nalopilot", view: "nalopilot", icon: Scale, chip: "New", title: "NaloPilot", body: "Ask about your building's by-laws or Queensland body corporate law in plain English — every answer cites the exact by-law or section it came from." });
  if (navOk("compliance")) S.push({ target: "nav-compliance", view: "compliance", icon: CalendarClock, chip: "New", title: "Compliance Calendar", body: "Your statutory deadlines with traffic lights, progress notes and a one-tap export to your meeting agenda — nothing slips past quietly." });
  if (navOk("alerts")) S.push({ target: "nav-alerts", view: "alerts", icon: Bell, chip: "New", title: "Alerts", body: "Applications, votes, issues and decisions come to you the moment they happen — the badge shows what's waiting." });
  if (navOk("voting") && isCommittee(r)) S.push({ target: "nav-voting", view: "voting", icon: Vote, chip: "New", title: "Voting", body: "Committee decisions on your phone: motions, majority rules, comments, proxies — and a permanent audit trail that writes itself." });
  if (navOk("mworkflow") && (isCommittee(r) || r === "manager")) S.push({ target: "nav-mworkflow", view: "mworkflow", icon: ListChecks, chip: "New", title: "Maintenance Workflow", body: "Issue to fixed, one trail: triage, quotes, recommendation, vote, contractor confirmed. Email soup, retired." });
  if (navOk("unitsearch") && isCommittee(r)) S.push({ target: "nav-unitsearch", view: "unitsearch", icon: Search, chip: "New", title: "Unit Search", body: "One unit number returns the lot's whole story — people, pets, vehicles, keys, breaches and applications." });
  if (navOk("contracts") && isCommittee(r)) S.push({ target: "nav-contracts", view: "contracts", icon: Briefcase, chip: "New", title: "Your registers", body: "Contracts, Contractors and the monthly Walk-Through — expiries glow before they bite, and inspection reports export to Word with photo evidence." });
  const comm = ["events", "gallery", "marketplace", "messaging", "directory", "business"].filter(navOk);
  if (comm.length) S.push({ target: "nav-group-community", view: comm[0], icon: Users, title: "Your community", body: `Where ${building.name} comes together: ${comm.map(L).join(" · ")}.` });
  const bld = ["documents"].concat(isCommittee(r) ? [] : ["meetings"], ["keyfobs", "firesafety"]).filter(navOk);
  if (bld.length) S.push({ target: "nav-group-building", view: bld[0], icon: FileText, title: "The building, on record", body: `${bld.map(L).join(" · ")} — one trusted place for your building's information.` });
  if (navOk("settings")) S.push({ target: "nav-settings", view: "settings", icon: Settings, title: L("settings"), body: isCommittee(r) ? "Building details, branding and features — switch modules on or off any time." : "Your profile and privacy — you choose exactly what neighbours can see." });
  if (backend) S.push({ target: "ath-button", view: "dashboard", icon: Smartphone, title: "Put NaloHub on your Home Screen", body: `One tap and ${building.name} opens like an app — look for the NaloHub icon. This button gives you simple step-by-step instructions for iPhone or Android.` });
  S.push({ target: "tour-button", view: "dashboard", icon: HelpCircle, chip: "One last thing", title: "Replay this any time", body: "The tour lives right here in the menu — and when new features arrive, they join it automatically." });
  S.push({ centered: true, icon: Sparkles, chip: "You're in the Nalo!", title: "That's the tour — over to you", body: "A great first five minutes:", list: tourChecklist(user) });
  return S;
}

// Demo arrival nudge: a gently pulsing callout that waves in and points at
// "Take the tour" — the fastest way for a visitor to get what NaloHub is about.
function TourNudge({ onStart }) {
  const { T } = useApp();
  const [pos, setPos] = useState(null);
  const [show, setShow] = useState(false);
  const dismiss = () => { setShow(false); try { sessionStorage.setItem("nalo_nudge_done", "1"); } catch (e) {} };
  useEffect(() => {
    try { if (sessionStorage.getItem("nalo_nudge_done") === "1") return; } catch (e) {}
    const measure = () => {
      const el = document.querySelector('[data-tour="tour-button"]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.left >= 0) setPos({ ring: { top: r.top - 5, left: r.left - 5, width: r.width + 10, height: r.height + 10 }, bubble: { top: r.top - 8, left: r.right + 14 }, side: "right" });
      else setPos({ ring: null, bubble: { top: "calc(64px + var(--sat))", right: 10 }, side: "below" }); // mobile: below the top-bar help button (clears the status bar)
    };
    const t = setTimeout(() => { measure(); setShow(true); }, 1400);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, []);
  if (!show || !pos) return null;
  return (
    <div style={{ zIndex: 60 }}>
      <style>{`
        @keyframes nalo-nudge-in { 0% { opacity: 0; transform: translateX(-16px) scale(.9) } 60% { opacity: 1; transform: translateX(5px) scale(1.03) } 80% { transform: translateX(-2px) scale(.99) } 100% { opacity: 1; transform: translateX(0) scale(1) } }
        @keyframes nalo-nudge-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes nalo-nudge-ring { 0% { box-shadow: 0 0 0 0 ${hexToRgba(T.accent, 0.5)} } 70% { box-shadow: 0 0 0 10px ${hexToRgba(T.accent, 0)} } 100% { box-shadow: 0 0 0 0 ${hexToRgba(T.accent, 0)} } }
        @keyframes nalo-nudge-wave { 0%, 100% { transform: rotate(0deg) } 10% { transform: rotate(14deg) } 20% { transform: rotate(-8deg) } 30% { transform: rotate(14deg) } 40% { transform: rotate(-4deg) } 50% { transform: rotate(10deg) } 60% { transform: rotate(0deg) } }
      `}</style>
      {pos.ring && <div style={{ position: "fixed", ...pos.ring, borderRadius: 14, pointerEvents: "none", zIndex: 60, animation: "nalo-nudge-ring 2s ease-out infinite" }} />}
      <div style={{ position: "fixed", ...pos.bubble, zIndex: 60, width: "min(252px, calc(100vw - 20px - var(--sal) - var(--sar)))", animation: "nalo-nudge-in 700ms cubic-bezier(.34,1.4,.64,1) both, nalo-nudge-float 3.2s ease-in-out 900ms infinite" }}>
        {pos.side === "right" && <div style={{ position: "absolute", left: -6, top: 20, width: 12, height: 12, transform: "rotate(45deg)", background: T.surface, borderLeft: `1px solid ${T.accent}`, borderBottom: `1px solid ${T.accent}` }} />}
        {pos.side === "below" && <div style={{ position: "absolute", right: 18, top: -6, width: 12, height: 12, transform: "rotate(45deg)", background: T.surface, borderLeft: `1px solid ${T.accent}`, borderTop: `1px solid ${T.accent}` }} />}
        <div style={{ background: T.surface, color: T.text, border: `1px solid ${T.accent}`, borderRadius: 16, boxShadow: `0 12px 36px rgba(0,0,0,0.45), 0 0 0 4px ${hexToRgba(T.accent, 0.08)}`, padding: "12px 14px" }}>
          <div className="flex items-start gap-2">
            <span style={{ display: "inline-block", fontSize: 20, animation: "nalo-nudge-wave 2.6s ease-in-out 600ms 2", transformOrigin: "70% 70%" }}>👋</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[14px] leading-snug">New to NaloHub?</div>
              <p className="text-[13px] mt-0.5 leading-relaxed" style={{ color: T.textMuted }}>The 90-second tour is the fastest way to see what your building could do.</p>
            </div>
            <button onClick={dismiss} aria-label="Dismiss" className="p-1 -mt-1 -mr-1 rounded-lg shrink-0" style={{ color: T.textMuted }}><X size={14} /></button>
          </div>
          <button onClick={() => { dismiss(); onStart(); }} className="w-full mt-2.5 px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, boxShadow: `0 6px 16px ${hexToRgba(T.accent2, 0.35)}` }}>Take the tour</button>
        </div>
      </div>
    </div>
  );
}

export function BuildingApp() {
  const { T, building, user, view, setView, showGuide, setShowGuide, backend, signOut, platformAdmin, exitToConsole } = useApp();
  const [tour, setTour] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const startTour = () => { setShowGuide(false); setNavOpen(false); setTour(true); try { sessionStorage.setItem("nalo_nudge_done", "1"); } catch (e) {} };
  const endTour = () => { setTour(false); try { localStorage.setItem(tourSeenKey(user && user.id), String(TOUR_VERSION)); } catch (e) {} };
  // First run: real users go straight into the guided tour (re-shown when TOUR_VERSION bumps);
  // the demo keeps its welcome card, which now leads into the tour.
  React.useEffect(() => { try { if (backend) { if (user && localStorage.getItem(tourSeenKey(user.id)) !== String(TOUR_VERSION)) setTour(true); } else if (!localStorage.getItem("nalo_seen_guide")) setShowGuide(true); } catch (e) {} }, []);
  if (!user) return null;
  if (user.status === "pending") return <PendingScreen />;
  const visible = navVisibleFor(user, building, backend);
  const go = (v) => { setView(v); setNavOpen(false); };
  return (
    <div className="flex">
      {showGuide && !tour && !backend && <WelcomeGuide onStartTour={startTour} />}
      {!backend && !tour && !showGuide && <TourNudge onStart={startTour} />}
      {tour && <GuidedTour steps={buildTourSteps(building, user, backend)} T={T} onNavigate={setView} onClose={endTour} />}
      <GuideDrawer />
      {navOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} />}
      <aside className={`fixed z-40 top-0 left-0 h-full w-64 flex flex-col transition-transform duration-200 ${navOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`} style={{ background: T.sidebar, color: T.sidebarText, paddingTop: "var(--sat)", paddingBottom: "var(--sab)", paddingLeft: "var(--sal)" }}>
        <BuildingBrand go={go} />
        {!backend && <PreviewSwitcher />}
        <button data-tour="tour-button" onClick={startTour} className="mx-3 mt-1 mb-1 rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-2" style={{ color: T.sidebarText, background: hexToRgba(T.accent, 0.16), border: `1px solid ${hexToRgba(T.accent, 0.35)}` }}><HelpCircle size={15} style={{ color: T.accent }} /> Take the tour</button>
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {[["home", ""], ["requests", "Requests"], ["decisions", "Decisions"], ["registers", "Registers"], ["community", "Community"], ["knowledge", "Knowledge"], ["account", "Account"]].map(([grp, hdr]) => { const items = visible.filter((n) => n.group === grp); if (!items.length) return null; return (
            <div key={grp} data-tour={grp === "home" ? undefined : `nav-group-${grp}`}>
              {hdr && <div style={{ color: T.sidebarMuted }} className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-[0.16em]">{hdr}</div>}
              {items.map((n) => { const active = view === n.key; return (
                <button key={n.key} data-tour={`nav-${n.key}`} onClick={() => go(n.key)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px]" style={{ background: active ? T.sidebarActive : "transparent", color: active ? "#fff" : T.sidebarText, fontWeight: active ? 600 : 400 }}><n.icon size={18} className="shrink-0" style={{ color: active ? T.accent : T.sidebarMuted }} /> <span className="flex-1 text-left leading-tight">{navLabel(building, n.key, n.label)}</span>{PREMIUM_MODULES.includes(n.key) && <span title="Premium feature" className="text-[10px] font-bold shrink-0" style={{ color: "#fbbf24" }}>★</span>}{n.key === "approvals" && <NavDot kind="approvals" />}{n.key === "gallery" && <NavDot kind="gallery" />}{n.key === "alerts" && <NavDot kind="alerts" />}</button>
              ); })}
            </div>
          ); })}
        </nav>
        {platformAdmin && <button onClick={exitToConsole} className="mx-3 mt-2 rounded-xl px-3 py-2 text-sm font-medium text-left flex items-center gap-2" style={{ color: T.sidebarText, background: hexToRgba(T.accent, 0.16), border: `1px solid ${hexToRgba(T.accent, 0.35)}` }}><ChevronLeft size={15} style={{ color: T.accent }} /> All buildings</button>}
        {backend && <button onClick={signOut} className="m-3 rounded-xl px-3 py-2 text-sm font-medium text-left" style={{ color: T.sidebarText, border: `1px solid ${hexToRgba("#ffffff", 0.12)}` }}>Sign out</button>}
      </aside>
      <main className="flex-1 min-w-0 md:ml-64 flex flex-col min-h-screen" style={{ paddingBottom: "var(--sab)" }}>
        {/* Mobile top bar. Padded by the iOS safe-area insets: without this the bar
            renders underneath the status bar / Dynamic Island in standalone (Home
            Screen) mode, where iOS swallows the taps and the buttons are dead. */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-1" style={{ background: T.sidebar, color: T.sidebarText, paddingTop: "calc(0.5rem + var(--sat))", paddingBottom: "0.5rem", paddingLeft: "calc(0.75rem + var(--sal))", paddingRight: "calc(0.75rem + var(--sar))" }}><button aria-label="Open menu" onClick={() => setNavOpen(true)} className="shrink-0 grid place-items-center min-w-[44px] min-h-[44px] rounded-lg"><Menu size={22} /></button><button onClick={() => go("dashboard")} className="font-semibold flex-1 min-w-0 text-left truncate min-h-[44px] px-1">{building.name}</button><button aria-label="Take the tour" onClick={startTour} className="shrink-0 grid place-items-center min-w-[44px] min-h-[44px] rounded-lg" style={{ background: T.sidebarActive }}><HelpCircle size={18} /></button>{view !== "dashboard" && <button aria-label="Go to dashboard" onClick={() => go("dashboard")} className="shrink-0 grid place-items-center min-w-[44px] min-h-[44px] rounded-lg" style={{ background: T.sidebarActive }}><Home size={18} /></button>}</div>
        <div className="flex-1" data-tour="main-content"><GuideBar /><ViewRouter /></div>
        <Footer />
      </main>
    </div>
  );
}
function BuildingBrand({ go }) {
  const { T, building, setBuildingId, backend } = useApp();
  return (
    <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${hexToRgba("#ffffff", 0.08)}` }}>
      <button onClick={() => go("dashboard")} className="flex items-center gap-3 min-w-0 flex-1 text-left">{building.logoImage ? <img src={building.logoImage} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" /> : <div className="h-10 w-10 rounded-xl grid place-items-center font-black shrink-0" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: T.accentText }}>{building.logoText}</div>}<div className="min-w-0"><div className="font-semibold truncate">{building.name}</div><div style={{ color: T.sidebarMuted }} className="text-[11px]">Tap for dashboard</div></div></button>
      {!backend && <button onClick={() => setBuildingId(null)} title="Switch building" style={{ color: T.sidebarMuted }} className="p-1.5 rounded-lg hover:bg-white/10"><ChevronLeft size={16} /></button>}
    </div>
  );
}
function NavDot({ kind }) {
  const { store, buildingId, user, backend } = useApp();
  const [alertCount, setAlertCount] = useState(0);
  useEffect(() => {
    if (kind !== "alerts") return;
    let on = true;
    const poll = () => listNotifications(buildingId).then((rs) => {
      if (!on) return;
      const n2 = rs.filter((r) => !r.read_at).length;
      setAlertCount(n2);
      // Home Screen icon badge (installed app; Android/desktop now, iOS where supported)
      try { if (n2 > 0 && navigator.setAppBadge) navigator.setAppBadge(n2); else if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch (e) {}
    }).catch(() => {});
    poll();
    const t = setInterval(poll, 60000);
    return () => { on = false; clearInterval(t); };
  }, [kind, buildingId, backend]);
  let n = 0;
  if (kind === "approvals") n = store.users.filter((u) => u.buildingId === buildingId && u.status === "pending").length + store.bookings.filter((b) => b.buildingId === buildingId && b.status === "pending").length;
  if (kind === "gallery") n = store.gallery.filter((g) => g.buildingId === buildingId && g.createdAt > (user.lastSeenGallery || "")).length;
  if (kind === "alerts") n = alertCount;
  if (!n) return null;
  return <span className="ml-auto text-[10px] font-bold px-1.5 rounded-full" style={{ background: SEMANTIC.warn, color: "#1a1206" }}>{n}</span>;
}
function PreviewSwitcher() {
  const { T, store, buildingId, user, setUserId } = useApp();
  const people = store.users.filter((u) => u.buildingId === buildingId && u.status === "active");
  return (
    <div data-tour="preview-switcher" className="mx-3 mt-3 mb-1 rounded-xl px-3 py-2.5" style={{ background: T.sidebarActive, border: `1px solid ${hexToRgba("#ffffff", 0.1)}` }}>
      <div style={{ color: T.sidebarMuted }} className="text-[10px] uppercase tracking-[0.16em] mb-1.5 flex items-center gap-1"><Eye size={11} /> Viewing as · demo</div>
      <select value={user.id} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-lg px-2.5 py-2 text-sm outline-none" style={{ background: T.sidebar, color: "#fff", border: `1px solid ${hexToRgba("#ffffff", 0.14)}`, colorScheme: "light" }}>{people.map((u) => <option key={u.id} value={u.id} style={{ color: "#000", background: "#fff" }}>{u.name} — {ROLE_LABEL[u.role]}</option>)}</select>
    </div>
  );
}

// ---------- page header -----------------------------------------------------
function Head({ title, sub, action, onBack, backLabel }) {
  const { setView, view, building } = useApp();
  return (
    <>
    <AnimatedHeader>
      <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-5 pb-16">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {view !== "dashboard" && <button onClick={() => setView("dashboard")} className="inline-flex items-center gap-1.5 text-white/85 text-sm font-medium bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5"><Home size={15} /> {navLabel(building, "dashboard", "Dashboard")}</button>}
            {onBack && <button onClick={onBack} className="inline-flex items-center gap-1.5 text-white/85 text-sm font-medium bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5"><ArrowLeft size={15} /> {backLabel || "Back"}</button>}
          </div>
          <Clock className="text-white/70 text-xs hidden sm:block" />
        </div>
        <div className="flex items-end justify-between gap-4"><div><h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>{sub && <p className="text-white/80 text-sm mt-1">{sub}</p>}</div></div>
      </div>
    </AnimatedHeader>
    {/* Primary action and Back both live at the top of the body (not tucked into
        the header) so they're easy to find, and they stay put as the header image
        scrolls away. All 12 screens with a back target get this. */}
    {(action || onBack) && <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-5 -mb-1 flex flex-wrap gap-2 items-center">
      {onBack && <BackLink onClick={onBack} label={backLabel} />}
      {action}
    </div>}
    </>
  );
}
const Wrap = ({ children }) => <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6 space-y-4">{children}</div>;
// Back belongs in the BODY as well as the header. The header copy sits on the
// animated image at the very top, so on any screen taller than the viewport, a
// correspondence thread above all, there was no way back without scrolling all
// the way up. Exactly the reasoning behind v0.20.0 moving primary actions out of
// the header: if it matters, put it where the content is. Reported as "there is
// no obvious Back button here, a problem I thought we solved".
function BackLink({ onClick, label }) {
  const { T } = useApp();
  return <button onClick={onClick} className="text-[15px] font-semibold px-3.5 py-2.5 rounded-xl inline-flex items-center gap-1.5"
    style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}` }}><ArrowLeft size={15} /> {label || "Back"}</button>;
}
function HeaderAction({ children, onClick, ...p }) { const { T } = useApp(); return <button onClick={onClick} {...p} style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: T.accentText, boxShadow: `0 6px 16px ${T.glow || "rgba(0,0,0,0.2)"}` }} className="text-[15px] font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5">{children}</button>; }

// ---------- billing (customer-facing invoices) -----------------------------
function Billing() {
  const { T, billing, buildingId, user, flash } = useApp();
  const [rows, setRows] = useState([]);
  const [bb, setBb] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    (async () => { try { const r = billing ? await billing.list() : []; if (on) setRows(r); } catch (e) { if (on) setRows([]); }
      try { if (isCommittee(user.role)) { const b2 = await loadMyBuildingBilling(buildingId); if (on) setBb(b2); } } catch (e) {}
      if (on) setLoading(false); })();
    return () => { on = false; };
  }, []);
  const fmt = (n, c) => new Intl.NumberFormat("en-AU", { style: "currency", currency: c || "AUD" }).format(n || 0);
  const SC = { draft: T.textMuted, sent: T.accent, paid: "#34d399", overdue: "#f87171", void: "#6b7280" };
  const outstanding = rows.filter((v) => ["draft", "sent", "overdue"].includes(v.status));
  const history = rows.filter((v) => ["paid", "void"].includes(v.status));
  const Row = (v) => (
    <div key={v.id} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px dashed ${T.border}` }}>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{v.number} · {fmt(v.total, v.currency)}{v.kind && v.kind !== "recurring" ? <span className="font-normal text-xs" style={{ color: T.textMuted }}> · {String(v.kind).replace(/_/g, " ")}</span> : null}</div>
        <div className="text-xs" style={{ color: T.textMuted }}>{fmtDate(v.period_start)} → {fmtDate(v.period_end)} · due {fmtDate(v.due_date)}</div>
      </div>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: hexToRgba(SC[v.status] || T.accent, 0.16), color: SC[v.status] || T.accent }}>{v.status}</span>
      <Btn kind="ghost" onClick={() => billing && billing.download(v)}><Download size={15} /> PDF</Btn>
    </div>
  );
  return (
    <div>
      <Head title="Billing" sub="Your building's invoices from NaloHub" />
      {bb && (<div className="max-w-4xl mx-auto px-5 sm:px-8 pt-4">
        <Card style={{ padding: 16, border: bb.payment_method_label ? undefined : `1px solid ${hexToRgba(SEMANTIC.warn, 0.5)}` }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[220px]">
              <div className="font-semibold text-sm">{bb.payment_method_label ? `Payment method: ${bb.payment_method_label}` : "No payment method saved"}</div>
              <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>
                {bb.status === "trial" && bb.trial_end ? `Trial until ${fmtDate(bb.trial_end)} — billing commences from then. ` : ""}
                {bb.payment_method_label ? `Invoices are charged automatically on the due date (preferred payment day: ${bb.preferred_payment_day}${bb.preferred_payment_day === 1 ? "st" : bb.preferred_payment_day === 2 ? "nd" : bb.preferred_payment_day === 3 ? "rd" : "th"} of the month).` : "Save a credit/debit card or a direct debit from the body corporate bank account — payment then happens automatically, and every bill still gets its invoice here."}
              </div>
            </div>
            <Btn grad onClick={() => startPaymentSetup(buildingId).catch((e) => flash(String(e.message || e)))}><DollarSign size={15} /> {bb.payment_method_label ? "Update payment method" : "Set up payment method"}</Btn>
          </div>
        </Card>
      </div>)}
      {loading ? <Card style={{ padding: 16 }}><div style={{ color: T.textMuted }}>Loading…</div></Card> :
        rows.length === 0 ? <Card style={{ padding: 16 }}><div style={{ color: T.textMuted }}>No invoices yet.</div></Card> :
        <>
          {outstanding.length > 0 && <Card style={{ padding: 16, marginBottom: 12 }}><SectionTitle>Outstanding</SectionTitle>{outstanding.map(Row)}</Card>}
          {history.length > 0 && <Card style={{ padding: 16 }}><SectionTitle>History</SectionTitle>{history.map(Row)}</Card>}
        </>}
    </div>
  );
}

// ---------- view router -----------------------------------------------------
function ViewRouter() {
  const { view, setView, user, building, backend } = useApp();
  // Central role guard: if the current screen isn't one this role may see
  // (e.g. after switching "Viewing as" in the demo), fall back to the dashboard.
  // This protects every screen at once, so individual views don't each have to.
  const allowed = !user || navVisibleFor(user, building, backend).some((n) => n.key === view);
  React.useEffect(() => { if (user && !allowed) setView("dashboard"); }, [allowed, user, view]);
  const map = { dashboard: Dashboard, onboarding: OnboardingView, announcements: Announcements, committeenotes: CommitteeNotices, maintenance: Maintenance, assets: AssetRegister, bookings: ApplicationsBookings, unitsearch: UnitSearchView, correspondence: CorrespondenceView, voting: VotingView, mworkflow: MaintWorkflowView, contracts: ContractsView, contractors: ContractorsView, walkthrough: WalkthroughView, alerts: AlertsView, approvals: Approvals, reports: Reports, actions: ActionRegister, events: Events, gallery: Gallery, marketplace: Marketplace, messaging: Messaging, directory: Directory, documents: Documents, meetings: Meetings, keyfobs: KeyFobRegister, firesafety: FireSafety, business: BusinessDirectory, billing: Billing, help: HelpHub, settings: SettingsView, nalopilot: NaloPilotView, bylaws: ByLawsView, compliance: ComplianceView, disputes: DisputeRecordsView };
  const C = map[allowed ? view : "dashboard"] || Dashboard;
  return <C />;
}

// ---------- dashboard -------------------------------------------------------
// Who sees a notice in the app. Posters see everything. "all" and "owners" and
// "tenants" follow the reader's role; "residents", "offsite", saved lists and
// hand-picked people are fixed to the app members they reached when sent.
function activeAnnouncements(store, buildingId, role, userId) {
  const poster = isCommittee(role) || role === "manager" || role === "strata";
  return store.announcements.filter((a) => a.buildingId === buildingId && (isCommittee(role) || !a.expiry || a.expiry >= today())
    && (poster || !a.audience || a.audience === "all"
      || (a.audience === "owners" && role !== "tenant")
      || (a.audience === "tenants" && role === "tenant")
      || (a.recipientIds || []).includes(userId)));
}
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const WX = [{ k: "Sunny", Icon: Sun }, { k: "Partly cloudy", Icon: CloudSun }, { k: "Cloudy", Icon: Cloud }, { k: "Showers", Icon: CloudRain }, { k: "Breezy", Icon: Wind }];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Weather() {
  const { T, building } = useApp();
  const place = useMemo(() => suburbFromAddress(building.address), [building.address]);
  const fc = useMemo(() => { const base = 19 + Math.floor(Math.random() * 5); return Array.from({ length: 5 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); const w = WX[Math.floor(Math.random() * WX.length)]; const hi = base + Math.floor(Math.random() * 4); const lo = hi - (5 + Math.floor(Math.random() * 3)); return { label: i === 0 ? "Today" : DOW[d.getDay()], w, hi, lo }; }); }, []);
  const cur = fc[0];
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div className="flex flex-col sm:flex-row">
        <div className="flex items-center gap-4 p-5 sm:w-[38%]" style={{ background: `linear-gradient(135deg, ${hexToRgba(T.accent, 0.16)}, ${hexToRgba(T.accent2, 0.1)})` }}>
          <cur.w.Icon size={56} strokeWidth={1.4} style={{ color: T.accent }} />
          <div><div className="text-4xl font-bold leading-none">{cur.hi}°</div><div style={{ color: T.text }} className="text-sm mt-1 font-medium">{cur.w.k}</div><div style={{ color: T.textMuted }} className="text-xs">{place} · today</div></div>
        </div>
        <div className="flex-1 grid grid-cols-4">{fc.slice(1).map((d, i) => (<div key={i} className="p-4 text-center" style={{ borderLeft: `1px solid ${T.border}` }}><div style={{ color: T.textMuted }} className="text-xs font-semibold">{d.label}</div><d.w.Icon size={24} strokeWidth={1.6} className="mx-auto my-2" style={{ color: T.accent }} /><div className="text-sm font-bold">{d.hi}°<span style={{ color: T.textMuted }} className="font-normal"> {d.lo}°</span></div></div>))}</div>
      </div>
      <div style={{ color: T.textMuted, borderTop: `1px solid ${T.border}` }} className="text-[10px] px-4 py-1.5">Sample forecast · live weather connects in production</div>
    </Card>
  );
}

function WhatsOn() {
  const { T, store, buildingId, user, setView } = useApp();
  const t0 = today(), t30 = addDays(t0, 31);
  const items = [
    ...store.events.filter((e) => e.buildingId === buildingId).map((e) => ({ id: e.id, type: "Event", date: e.date, title: e.title, sub: [e.timeFrom, e.location].filter(Boolean).join(" · "), hue: HUE.events, go: "events" })),
    ...(user.role !== "tenant" ? store.meetings.filter((m) => m.buildingId === buildingId).map((m) => ({ id: m.id, type: "Meeting", date: m.date, title: m.title, sub: [m.timeFrom, m.location].filter(Boolean).join(" · "), hue: HUE.meetings, go: "meetings" })) : []),
  ].filter((i) => i.date && i.date >= t0 && i.date <= t30).sort((a, b) => (a.date < b.date ? -1 : 1));
  return (
    <Card style={{ padding: 18 }}>
      <SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">next 30 days</span>}>What's on this month</SectionTitle>
      {items.length === 0 && <div style={{ color: T.textMuted }} className="text-sm py-2">Nothing scheduled in the next month — enjoy the quiet.</div>}
      <div className="space-y-2.5">{items.map((i) => { const dt = new Date(i.date + "T00:00:00"); return (
        <button key={i.type + i.id} onClick={() => setView(i.go)} className="w-full flex items-center gap-3.5 text-left rp-hover rounded-xl" style={{ padding: 4 }}>
          <div className="h-12 w-12 rounded-xl grid place-items-center text-white shrink-0 leading-none" style={{ background: `linear-gradient(135deg, ${i.hue[0]}, ${i.hue[1]})` }}><span className="text-base font-bold">{dt.getDate()}</span><span className="text-[9px] uppercase tracking-wide -mt-0.5">{dt.toLocaleString("en", { month: "short" })}</span></div>
          <div className="flex-1 min-w-0"><div className="font-semibold truncate flex items-center gap-2">{i.title}<Badge color={i.hue[1]}>{i.type}</Badge></div>{i.sub && <div style={{ color: T.textMuted }} className="text-xs truncate">{i.sub}</div>}</div>
          <ChevronRight size={16} style={{ color: T.textMuted }} />
        </button>
      ); })}</div>
    </Card>
  );
}

function Dashboard() {
  const { T, store, building, buildingId, user, setView, flash } = useApp();
  const truism = useMemo(() => TRUISMS[Math.floor(Math.random() * TRUISMS.length)], []);
  const pendingAcc = store.users.filter((u) => u.buildingId === buildingId && u.status === "pending").length;
  const pinned = activeAnnouncements(store, buildingId, user.role, user.id).find((a) => a.pinned);
  const annN = activeAnnouncements(store, buildingId, user.role, user.id).length;
  const galN = store.gallery.filter((g) => g.buildingId === buildingId && g.createdAt > (user.lastSeenGallery || "")).length;
  const openA = store.actions.filter((a) => a.buildingId === buildingId && a.status === "open");
  const overdueA = openA.filter((a) => actionFlags(a).overdue).length;
  const soonA = openA.filter((a) => actionFlags(a).soon).length;
  const strata = isStrata(user.role);
  const QA = strata ? [
    { label: "Post a Formal Notice", icon: FileText, go: "announcements", hue: HUE.documents },
  ] : [
    { label: "Report an Issue", icon: Wrench, go: "maintenance", hue: HUE.maintenance },
    { label: "Book a Space or Visitor Car Park", icon: CalendarCheck, go: "bookings", hue: HUE.bookings },
    { label: "Message Committee or Manager", icon: MessageSquare, go: "messaging", hue: HUE.messaging },
  ];
  const EX = strata ? [
    { label: "Announcements", icon: Megaphone, go: "announcements", hue: HUE.announcements, n: annN },
  ] : [
    { label: "Announcements", icon: Megaphone, go: "announcements", hue: HUE.announcements, n: annN },
    { label: "Events", icon: CalendarDays, go: "events", hue: HUE.events },
    { label: "Gallery", icon: ImageIcon, go: "gallery", hue: HUE.gallery, n: galN, nl: "new" },
    { label: "Marketplace", icon: ShoppingBag, go: "marketplace", hue: HUE.marketplace },
    { label: "Directory", icon: Users, go: "directory", hue: HUE.directory },
    { label: "Documents", icon: FileText, go: "documents", hue: HUE.documents },
  ];
  return (
    <div>
      <AnimatedHeader>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-6 pb-16">
          <Clock className="text-[11px] uppercase tracking-[0.18em] text-white/75" />
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/60 mt-1">{ROLE_LABEL[user.role]} · {building.name}</div>
          <h1 className="text-3xl sm:text-4xl font-bold mt-1.5">{greeting()}, {user.name.split(" ")[0]}</h1>
          <p className="text-white/85 text-sm mt-2.5 italic max-w-md flex items-start gap-2"><Sparkles size={15} className="mt-0.5 shrink-0" /> {truism}</p>
        </div>
      </AnimatedHeader>
      <Wrap>
        <ProvenanceLine withExport />
        <WelcomeBanner />
        <Weather />
        {isApprover(user.role) && pendingAcc > 0 && (
          <button onClick={() => setView("approvals")} className="w-full text-left rounded-2xl px-5 py-4 flex items-center gap-3 rp-fade" style={{ background: hexToRgba(SEMANTIC.warn, T.mode === "dark" ? 0.18 : 0.12), border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.4)}` }}><UserPlus style={{ color: SEMANTIC.warn }} /><div className="flex-1"><div className="font-semibold">{pendingAcc} resident{pendingAcc > 1 ? "s" : ""} waiting for access</div><div style={{ color: T.textMuted }} className="text-sm">Review and approve to let them in.</div></div><ChevronRight style={{ color: T.textMuted }} /></button>
        )}
        {isApprover(user.role) && (overdueA + soonA) > 0 && (
          <button onClick={() => setView("actions")} className="w-full text-left rounded-2xl px-5 py-4 flex items-center gap-3 rp-fade" style={{ background: hexToRgba(SEMANTIC.bad, T.mode === "dark" ? 0.16 : 0.1), border: `1px solid ${hexToRgba(SEMANTIC.bad, 0.35)}` }}><ListChecks style={{ color: SEMANTIC.bad }} /><div className="flex-1"><div className="font-semibold">{overdueA > 0 ? `${overdueA} action${overdueA > 1 ? "s" : ""} overdue` : `${soonA} action${soonA > 1 ? "s" : ""} due soon`}</div><div style={{ color: T.textMuted }} className="text-sm">Committee tasks need attention.</div></div><ChevronRight style={{ color: T.textMuted }} /></button>
        )}
        {pinned && (<Card style={{ padding: 18, borderLeft: `4px solid ${T.accent}` }} className="rp-fade"><div className="flex items-center gap-2 mb-1"><Pin size={14} style={{ color: T.accent }} /><span style={{ color: T.accent }} className="text-xs font-bold uppercase tracking-wider">Pinned notice</span></div><div className="font-semibold">{pinned.title}</div><p style={{ color: T.textMuted }} className="text-sm mt-1">{pinned.body}</p></Card>)}
        <div data-tour="quick-actions"><SectionTitle>Do something</SectionTitle><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{QA.filter((q) => moduleOn(building, q.go)).map((q, i) => (<button key={q.label} onClick={() => setView(q.go)} className="text-left rp-fade" style={{ animationDelay: `${i * 60}ms` }}><Card hover style={{ padding: 16, height: "100%" }}><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-2xl grid place-items-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${q.hue[0]}, ${q.hue[1]})`, boxShadow: `0 6px 16px ${hexToRgba(q.hue[1], 0.35)}` }}><q.icon size={20} /></div><div className="font-semibold text-[15px] flex-1 leading-snug">{q.label}</div><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>))}</div></div>
        <div><SectionTitle>Explore</SectionTitle><div className="flex flex-wrap gap-2.5">
          {EX.filter((e) => moduleOn(building, e.go)).map((e) => (<button key={e.label} onClick={() => setView(e.go)} className="flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 rp-hover" style={{ background: T.surface, border: `1px solid ${T.border}` }}><span className="h-7 w-7 rounded-full grid place-items-center text-white" style={{ background: `linear-gradient(135deg, ${e.hue[0]}, ${e.hue[1]})` }}><e.icon size={14} /></span><span className="text-sm font-medium" style={{ color: T.text }}>{e.label}</span>{e.n > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: hexToRgba(e.hue[1], 0.16), color: e.hue[1] }}>{e.n}{e.nl ? ` ${e.nl}` : ""}</span>}</button>))}
          {(building.modules ? building.modules.whatsapp !== false : true) && <button onClick={() => building.whatsappLink ? openExternal(building.whatsappLink) : flash("WhatsApp Group not set up")} className="flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 rp-hover" style={{ background: T.surface, border: `1px solid ${T.border}` }}><span className="h-7 w-7 rounded-full grid place-items-center text-white" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}><MessageCircle size={14} /></span><span className="text-sm font-medium" style={{ color: T.text }}>{building.whatsappName || "WhatsApp Group"}</span><ExternalLink size={12} style={{ color: T.textMuted }} /></button>}
        </div></div>
        {!isStrata(user.role) && <AboardMeter />}
        {!isStrata(user.role) && <CommitteePlaybook />}
        {!isStrata(user.role) && <BadgeShelf />}
        <WhatsOn />
      </Wrap>
    </div>
  );
}

// ---------- announcements ---------------------------------------------------
// Who a notice goes to (0.37.0). Built-in audiences are recalculated from the
// unit register every time a notice is sent, so a new tenant or a sale is picked
// up without anyone maintaining a list. Saved lists are either hand-picked
// people or a rule (an audience narrowed by level or pets). Nothing is emailed
// until someone presses Post: sending is always a deliberate act.
const AUDIENCES = [
  { k: "all", label: "Everyone (owners and tenants)", short: "Everyone", hint: "Every current owner and tenant, including owners who live elsewhere." },
  { k: "residents", label: "Residents (everyone who lives here)", short: "Residents", hint: "Tenants, plus owners who live in their unit. Owners who live elsewhere are left out." },
  { k: "owners", label: "Owners", short: "Owners", hint: "Every owner, whether they live here or not. For AGM notices, levies and motions." },
  { k: "tenants", label: "Tenants", short: "Tenants", hint: "Current tenants only." },
  { k: "offsite", label: "Owners who live elsewhere", short: "Off-site owners", hint: "Owners of tenanted or unoccupied lots." },
  { k: "agents", label: "Managing agents", short: "Managing agents", hint: "The agent on each tenanted or agent-managed lot, taken from the unit record. One email per agency, however many lots it holds." },
];
const audienceShort = (a) => (a.audiences && a.audiences.length > 1) ? `${a.audiences.length} groups`
  : a.audience === "list" ? (a.listName || "Saved list")
  : a.audience === "specific" ? `${a.recipientCount || (a.recipientIds || []).length} recipient${(a.recipientCount || (a.recipientIds || []).length) === 1 ? "" : "s"}`
  : ((AUDIENCES.find((x) => x.k === a.audience) || {}).short || "");
const levelSort = (a, b) => (a === "G" ? -1 : b === "G" ? 1 : (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
// The same audience rules as broadcast_recipients(), used only to preview a rule
// before it is saved. The send itself is always resolved by the database.
const inAudience = (p, aud) => ({ all: true, owners: p.kind === "owner", tenants: p.kind === "tenant", residents: !!p.lives_here, offsite: p.kind === "owner" && !p.lives_here })[aud] || false;
const ruleMatch = (p, rule) => inAudience(p, rule.audience || "all") && (!(rule.levels || []).length || (rule.levels || []).includes(p.level)) && (!rule.pets || p.pet);
const kindLabel = (p) => p.kind === "tenant" ? "Tenant" : p.lives_here ? "Owner, lives here" : "Owner, lives elsewhere";
const ruleText = (r) => { const base = ((AUDIENCES.find((x) => x.k === (r.audience || "all")) || {}).short || "Everyone"); const bits = []; if ((r.levels || []).length) bits.push(`level ${r.levels.slice().sort(levelSort).join(", ")}`); if (r.pets) bits.push("with a pet"); return bits.length ? `${base} on ${bits.join(", ")}`.replace(" on with", " with") : base; };

// Notice text formatting (0.38.0): the same parser the email uses, rendered as
// ordinary JSX so no HTML from a notice ever reaches the page.
function NoticeRuns({ runs }) {
  const { T } = useApp();
  return runs.map((r, i) => r.t === "b" ? <strong key={i}>{r.text}</strong>
    : r.t === "a" ? <a key={i} href={r.href} target="_blank" rel="noopener noreferrer" style={{ color: T.accent, textDecoration: "underline" }}>{r.text}</a>
    : <React.Fragment key={i}>{r.text}</React.Fragment>);
}
function NoticeBody({ text }) {
  const blocks = parseNotice(text);
  return (<div className="text-[15px] mt-3 leading-relaxed space-y-3">{blocks.map((b, i) => b.type === "p"
    ? <p key={i}>{b.lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}<NoticeRuns runs={l} /></React.Fragment>)}</p>
    : React.createElement(b.type, { key: i, className: b.type === "ul" ? "list-disc pl-6 space-y-1" : "list-decimal pl-6 space-y-1" }, b.items.map((it, j) => <li key={j}><NoticeRuns runs={it} /></li>)))}</div>);
}
const noticePlain = (text) => blocksText(parseNotice(text)).replace(/\n+/g, " ");
// Shrink an image for email: cover-crop to a square logo, or fit a photo to a
// width, re-encoded small. Returns a data URL, or null if it can't be read.
function shrinkImage(src, { w, h, type = "image/jpeg", quality = 0.72 }) {
  return new Promise((resolve) => {
    if (!src || !/^data:image\//.test(src)) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas"); const ctx = c.getContext("2d");
        if (h) { c.width = w; c.height = h; const sc = Math.max(w / img.width, h / img.height); const dw = img.width * sc, dh = img.height * sc;
          if (type === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); } ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh); }
        else { const sc = Math.min(1, w / img.width); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); }
        let out = c.toDataURL(type, quality);
        if (out.length > 380000 && type === "image/jpeg") out = c.toDataURL(type, 0.55);
        resolve(out.length > 400000 ? null : out);
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
// Wrap the selected text in the Details box, or prefix each selected line.
function formatSelection(id, kind, setBody) {
  const el = document.getElementById(id); if (!el) return;
  const v = el.value, a = el.selectionStart, b = el.selectionEnd, sel = v.slice(a, b);
  let next, caret;
  if (kind === "bold") { const t = sel || "bold text"; next = v.slice(0, a) + "**" + t + "**" + v.slice(b); caret = a + 2 + t.length + 2; }
  else if (kind === "link") { const t = sel || "link text"; next = v.slice(0, a) + "[" + t + "](https://)" + v.slice(b); caret = a + t.length + 11; }
  else { const start = v.lastIndexOf("\n", a - 1) + 1; const block = v.slice(start, b) || ""; const lines = (block || "").split("\n").map((l) => (l.startsWith("- ") ? l : "- " + l)).join("\n"); next = v.slice(0, start) + lines + v.slice(Math.max(b, start)); caret = start + lines.length; }
  setBody(next);
  setTimeout(() => { try { el.focus(); el.setSelectionRange(caret, caret); } catch (e) {} }, 0);
}

function PeoplePicker({ people, selected, onChange }) {
  const { T } = useApp();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = (people || []).filter((p) => !needle || [p.name, p.unit, p.email].some((v) => String(v || "").toLowerCase().includes(needle)));
  const sel = new Set(selected || []);
  const set = (keys) => onChange(Array.from(new Set(keys)));
  const toggle = (k) => set(sel.has(k) ? (selected || []).filter((x) => x !== k) : [...(selected || []), k]);
  return (<div>
    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, unit or email" />
    <div className="flex flex-wrap gap-3 my-2 text-xs">
      <button type="button" onClick={() => set([...(selected || []), ...shown.map((p) => p.key)])} style={{ color: T.accent }}>{needle ? `Add all ${shown.length} shown` : "Select everyone"}</button>
      <button type="button" onClick={() => set([...(selected || []), ...shown.filter((p) => p.kind === "owner").map((p) => p.key)])} style={{ color: T.accent }}>Add owners</button>
      <button type="button" onClick={() => set([...(selected || []), ...shown.filter((p) => p.kind === "tenant").map((p) => p.key)])} style={{ color: T.accent }}>Add tenants</button>
      <button type="button" onClick={() => onChange([])} style={{ color: T.textMuted }}>Clear</button>
      <span style={{ color: T.textMuted }} className="ml-auto">{sel.size} selected</span>
    </div>
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, maxHeight: 260, overflowY: "auto" }}>
      {people === null && <div className="text-sm p-3" style={{ color: T.textMuted }}>Loading the register…</div>}
      {people && shown.length === 0 && <div className="text-sm p-3" style={{ color: T.textMuted }}>{needle ? "Nobody matches that search." : "Nobody on the register yet. Add owners and tenants in Unit Search."}</div>}
      {shown.map((p) => { const on = sel.has(p.key); return (
        <button key={p.key} type="button" onClick={() => toggle(p.key)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left" style={{ borderBottom: `1px solid ${T.border}`, background: on ? hexToRgba(T.accent, T.mode === "dark" ? 0.16 : 0.09) : "transparent" }}>
          <span className="h-4 w-4 rounded grid place-items-center shrink-0" style={{ border: `1.5px solid ${on ? T.accent : T.border}`, background: on ? T.accent : "transparent" }}>{on && <Check size={11} style={{ color: T.accentText }} />}</span>
          <span className="text-sm flex-1 truncate">{p.name} <span style={{ color: T.textMuted }} className="text-xs">· {p.unit ? `Unit ${p.unit} · ` : ""}{kindLabel(p)}{p.email ? "" : " · no email"}</span></span>
        </button>); })}
    </div>
  </div>);
}

// The recipient line under "Send to": who, how many units, who can't be emailed.
function RecipientSummary({ prev, showWho, setShowWho }) {
  const { T } = useApp();
  if (!prev) return <div className="text-sm" style={{ color: T.textMuted }}>Working out who this goes to…</div>;
  if (prev.error) return <div className="text-sm" style={{ color: SEMANTIC.bad }}>{prev.error}</div>;
  return (<div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
    <div>Goes to <b>{prev.count} {prev.count === 1 ? "person" : "people"}</b>{prev.units ? ` across ${prev.units} unit${prev.units === 1 ? "" : "s"}` : ""}. {prev.emailable} will be emailed.{prev.no_email ? <span style={{ color: SEMANTIC.warn }}> {prev.no_email} {prev.no_email === 1 ? "has" : "have"} no email on file and won't receive it by email.</span> : null}</div>
    {prev.count > 0 && <button type="button" onClick={() => setShowWho(!showWho)} className="text-xs mt-1" style={{ color: T.accent }}>{showWho ? "Hide the list" : "See who"}</button>}
    {showWho && <div className="mt-2 max-h-56 overflow-y-auto text-xs space-y-0.5">{(prev.people || []).map((p) => <div key={p.key} className="flex gap-2"><span className="w-14 shrink-0" style={{ color: T.textMuted }}>{p.unit || "-"}</span><span className="flex-1 truncate">{p.name}</span><span style={{ color: p.email ? T.textMuted : SEMANTIC.warn }}>{p.email ? kindLabel(p) : "no email"}</span></div>)}</div>}
  </div>);
}

// Committee-only record of who a notice actually went to, and when.
function SendRecord({ buildingId, announcementId }) {
  const { T } = useApp();
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { listAnnouncementSends(buildingId, announcementId).then(setRows).catch(() => setRows([])); }, [buildingId, announcementId]);
  if (!rows || !rows.length) return null;
  const r = rows[0];
  return (<div className="mt-4 rounded-xl px-3 py-2.5 text-sm" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
    <div className="flex items-center gap-2"><Mail size={14} style={{ color: T.textMuted }} /><span>Emailed to {r.emailed_count} of {r.people_count} {r.people_count === 1 ? "person" : "people"} on {fmtDate(localDay(r.sent_at))}{r.list_name ? ` (${r.list_name})` : ""}.</span></div>
    <button type="button" onClick={() => setOpen(!open)} className="text-xs mt-1" style={{ color: T.accent }}>{open ? "Hide recipients" : "See recipients"}</button>
    {open && <div className="mt-2 max-h-56 overflow-y-auto text-xs space-y-0.5">{(r.recipients || []).map((p, i) => <div key={i} className="flex gap-2"><span className="w-14 shrink-0" style={{ color: T.textMuted }}>{p.unit || "-"}</span><span className="flex-1 truncate">{p.name}</span><span style={{ color: p.email ? T.textMuted : SEMANTIC.warn }}>{p.email ? (p.kind === "tenant" ? "Tenant" : "Owner") : "not emailed, no email"}</span></div>)}</div>}
    <div className="text-[11px] mt-1.5" style={{ color: T.textMuted }}>Only the committee and managers can see this record.</div>
  </div>);
}

// Create, edit, rename and delete saved lists.
function DistributionListsPanel({ everyone, lists, reload, onClose }) {
  const { T, buildingId, flash } = useApp();
  const [ed, setEd] = useState(null); // { id?, name, kind, members, rule }
  const [confirmDel, setConfirmDel] = useState(null);
  const people = everyone ? everyone.people || [] : null;
  const levels = Array.from(new Set((people || []).map((p) => p.level).filter(Boolean))).sort(levelSort);
  const count = (l) => !people ? "" : l.kind === "rule" ? people.filter((p) => ruleMatch(p, l.rule || {})).length : people.filter((p) => (l.members || []).includes(p.key)).length;
  const save = async () => {
    if (!ed.name.trim()) { flash("Give the list a name"); return; }
    if (ed.kind === "manual" && !(ed.members || []).length) { flash("Pick at least one person"); return; }
    try { await saveDistributionList(buildingId, ed); flash(`Saved "${ed.name.trim()}"`); setEd(null); reload(); } catch (e) { flash(String(e.message || e)); }
  };
  const del = async (l) => { try { await deleteDistributionList(buildingId, l.id, l.name); flash(`Deleted "${l.name}". Notices already sent keep their record.`); setConfirmDel(null); reload(); } catch (e) { flash(String(e.message || e)); } };
  const rule = (ed && ed.rule) || {};
  const setRule = (patch) => setEd({ ...ed, rule: { ...rule, ...patch } });
  return (<Card style={{ padding: 18 }}><div className="space-y-3">
    <div className="flex items-center justify-between"><div className="font-semibold">Saved distribution lists</div><button type="button" onClick={onClose} aria-label="Close" style={{ color: T.textMuted }}><X size={18} /></button></div>
    <p className="text-sm" style={{ color: T.textMuted }}>A saved list appears in "Send to" on every new notice. Hand-picked lists hold named people; a rule list keeps itself current as people move in and out. Anyone who moves out drops off automatically.</p>
    {!ed && (<>
      {lists.length === 0 && <div className="text-sm" style={{ color: T.textMuted }}>No saved lists yet.</div>}
      {lists.map((l) => (<div key={l.id} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
        <ListChecks size={15} style={{ color: T.textMuted }} />
        <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{l.name}</div><div className="text-xs" style={{ color: T.textMuted }}>{l.kind === "rule" ? `Rule: ${ruleText(l.rule || {})}` : "Hand-picked"}{count(l) !== "" ? ` · ${count(l)} ${count(l) === 1 ? "person" : "people"} now` : ""}</div></div>
        {confirmDel === l.id
          ? (<><Btn kind="ghost" onClick={() => setConfirmDel(null)}>Keep</Btn><Btn onClick={() => del(l)} style={{ background: SEMANTIC.bad, color: "#fff", border: "1px solid transparent" }}>Delete</Btn></>)
          : (<><button type="button" title="Edit" onClick={() => setEd({ id: l.id, name: l.name, kind: l.kind, members: l.members || [], rule: l.rule || {} })} className="p-1.5 rounded-lg" style={{ color: T.textMuted, border: `1px solid ${T.border}` }}><Pencil size={13} /></button>
             <button type="button" title="Delete" onClick={() => setConfirmDel(l.id)} className="p-1.5 rounded-lg" style={{ color: SEMANTIC.bad, border: `1px solid ${T.border}` }}><Trash2 size={13} /></button></>)}
      </div>))}
      <div className="flex gap-2 pt-1"><Btn kind="ghost" onClick={() => setEd({ name: "", kind: "manual", members: [], rule: {} })}><Plus size={14} /> Hand-picked list</Btn><Btn kind="ghost" onClick={() => setEd({ name: "", kind: "rule", members: [], rule: { audience: "residents" } })}><Plus size={14} /> Rule list</Btn></div>
    </>)}
    {ed && (<div className="space-y-3">
      <Field label="List name"><Input value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} placeholder={ed.kind === "rule" ? "Level 6 residents" : "Pool working group"} /></Field>
      {ed.kind === "manual" && <Field label="People on this list"><PeoplePicker people={people} selected={ed.members} onChange={(m) => setEd({ ...ed, members: m })} /></Field>}
      {ed.kind === "rule" && (<>
        <Field label="Start from"><Select value={rule.audience || "all"} onChange={(e) => setRule({ audience: e.target.value })}>{AUDIENCES.map((a) => <option key={a.k} value={a.k}>{a.label}</option>)}</Select></Field>
        {levels.length > 0 && <Field label="Only these levels (leave empty for all)"><div className="flex flex-wrap gap-1.5">{levels.map((lv) => { const on = (rule.levels || []).includes(lv); return <button key={lv} type="button" onClick={() => setRule({ levels: on ? (rule.levels || []).filter((x) => x !== lv) : [...(rule.levels || []), lv] })} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${on ? T.accent : T.border}`, background: on ? hexToRgba(T.accent, 0.14) : "transparent", color: on ? T.accent : T.text }}>{lv === "G" ? "Ground" : `Level ${lv}`}</button>; })}</div></Field>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!rule.pets} onChange={(e) => setRule({ pets: e.target.checked })} /> Only units with a pet on the register</label>
        {people && <div className="text-sm" style={{ color: T.textMuted }}>Right now this list is {people.filter((p) => ruleMatch(p, rule)).length} people. It updates itself as the register changes.</div>}
      </>)}
      <div className="flex gap-2"><Btn grad onClick={save}>Save list</Btn><Btn kind="ghost" onClick={() => setEd(null)}>Cancel</Btn></div>
    </div>)}
  </div></Card>);
}

function Announcements() {
  const { T, store, update, buildingId, user, flash, backend } = useApp();
  const [composing, setComposing] = useState(false);
  const [open, setOpen] = useState(null);
  const [manage, setManage] = useState(false);
  const strata = isStrata(user.role);
  // auds is a list: one notice can go to several groups at once, merged and
  // de-duplicated server-side so nobody is emailed twice (migration 0036).
  const blank = () => ({ title: "", body: "", expiry: "", image: "", doc: "", noticeType: strata ? NOTICE_TYPES[0] : "General", auds: [strata ? "owners" : "all"], people: [] });
  const [f, setF] = useState(blank);
  const [lists, setLists] = useState([]);
  const [everyone, setEveryone] = useState(null);
  const [prev, setPrev] = useState(null);
  const [showWho, setShowWho] = useState(false);
  const [saveName, setSaveName] = useState(null);
  const [showEmail, setShowEmail] = useState(false);
  const [inbox, setInbox] = useState("");
  const { building } = useApp();
  const canPost = isCommittee(user.role) || strata;
  useEffect(() => {
    if (!showEmail || inbox) return;
    const demo = (building.name || "building").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) + "@send.nalohub.com";
    if (!backend) { setInbox(demo); return; }
    ensureBuildingMailbox(buildingId).then((r) => setInbox((r && r.address) || (r && r.slug === null ? demo : ""))).catch(() => setInbox(""));
  }, [showEmail, backend, buildingId]);
  const roleLabel = { bcc: "Committee", admin: "Admin", manager: "Building manager", strata: "Strata manager" }[user.role] || "";
  const audLabelFor = (aud) => aud.startsWith("list:") ? `the ${((lists.find((x) => "list:" + x.id === aud) || {}).name || "saved")} list` : ({ all: "owners and tenants", residents: "residents", owners: "owners", tenants: "tenants", offsite: "owners who live elsewhere", specific: "selected people" })[aud] || "residents";
  const emailPreview = () => noticeHtml({ buildingName: building.name, buildingInitials: building.logoText, logoUrl: building.logoImage || "", title: f.title.trim() || "Your title", body: f.body, noticeType: f.noticeType,
    photoUrl: f.image || "", posterName: user.name, posterRole: roleLabel, replyAddress: inbox || "", audienceLabel: (f.auds || []).length > 1 ? (f.auds || []).map(audLabelFor).join(", ") : audLabelFor((f.auds || [])[0] || "all"),
    dateLabel: new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date()), nalohubMarkUrl: "/email/nalohub-mark.png", waveUrl: "/email/nalohub-wave.png" });
  const list = activeAnnouncements(store, buildingId, user.role, user.id).sort((a, b) => (b.pinned - a.pinned) || (b.date < a.date ? -1 : 1));
  const loadLists = () => listDistributionLists(buildingId).then(setLists).catch(() => setLists([]));
  const active = composing || manage;
  useEffect(() => { if (!active) return; loadLists(); previewBroadcast(buildingId, "all").then(setEveryone).catch(() => setEveryone({ people: [] })); }, [active, buildingId]);
  const audArgs = (aud, people) => aud.startsWith("list:") ? ["list", aud.slice(5), []] : aud === "specific" ? ["specific", null, people] : [aud, null, []];
  const peopleSig = (f.people || []).join(",");
  const audSig = (f.auds || []).join(",");
  // Ticking a group adds it; a notice can carry several, merged server-side.
  const toggleAud = (k) => setF((x) => { const on = (x.auds || []).includes(k);
    const next = on ? x.auds.filter((t) => t !== k) : [...(x.auds || []), k];
    return { ...x, auds: next.length ? next : [k] }; });
  useEffect(() => {
    if (!composing) return;
    const toks = f.auds || [];
    if (toks.length === 1 && toks[0] === "specific" && !(f.people || []).length) { setPrev({ people: [], count: 0, emailable: 0, no_email: 0, units: 0 }); return; }
    const [a, l] = audArgs(toks[0] || "all", f.people);
    let live = true; setPrev(null);
    previewBroadcast(buildingId, toks.length > 1 ? null : a, toks.length > 1 ? null : l, f.people, toks)
      .then((r) => { if (live) setPrev(r); }).catch((e) => { if (live) setPrev({ error: String(e.message || e) }); });
    return () => { live = false; };
  }, [composing, audSig, peopleSig, buildingId]);

  const post = async () => {
    if (!f.title.trim()) { flash("Add a title first"); return; }
    const toks = f.auds || [];
    if (!toks.length) { flash("Choose who this goes to"); return; }
    const [a0, l, p] = audArgs(toks[0], f.people);
    const a = toks.length > 1 ? "multi" : a0;
    if (toks.includes("specific") && !(f.people || []).length) { flash("Choose at least one recipient, or untick Pick specific people"); return; }
    if (!prev || prev.error) { flash(prev && prev.error ? prev.error : "Still working out who this goes to. Try again in a moment."); return; }
    const title = f.title.trim(), bodyText = f.body.trim();
    const id = "a" + Math.random().toString(36).slice(2, 8);
    const folks = prev.people || [];
    // In-app visibility: built-in audiences are decided by role when the notice
    // is read; lists and hand-picked people are fixed to who they were at send.
    const recipientIds = ["all", "owners", "tenants"].includes(a) ? [] : Array.from(new Set(folks.map((x) => x.membership_id).filter(Boolean)));
    const listName = a === "list" ? ((lists.find((x) => x.id === l) || {}).name || prev.list_name || "Saved list") : "";
    update((s) => s.announcements.unshift({ id, buildingId, title, body: bodyText, postedBy: user.name + (strata ? " (Strata manager)" : ""), date: today(), expiry: f.expiry, pinned: false, image: f.image, doc: f.doc, noticeType: f.noticeType, audience: a, audiences: toks, listId: l || "", listName, recipientIds, recipientCount: folks.length }));
    const photoSrc = f.image, noticeType = f.noticeType;
    setF(blank()); setComposing(false); setShowWho(false); setSaveName(null); setShowEmail(false);
    flash("Posted. Emailing now…");
    // Low-res copies for the email: logo 96px square PNG, photo 720px JPEG.
    const [logoSmall, photoSmall] = await Promise.all([
      shrinkImage(building.logoImage, { w: 96, h: 96, type: "image/png" }),
      shrinkImage(photoSrc, { w: 720, type: "image/jpeg", quality: 0.72 }),
    ]);
    sendAnnouncementEmail({ buildingId, announcementId: id, subject: title, bodyText, audience: toks.length > 1 ? undefined : a, audiences: toks, listId: l, people: f.people, noticeType, images: { logo: logoSmall, photo: photoSmall } })
      .then((r) => { const n = r && typeof r.sent === "number" ? r.sent : null; const miss = r && r.noEmail ? ` · ${r.noEmail} with no email on file` : ""; const demo = backend ? "" : " (demo: nothing is actually sent)";
        flash(n === 0 ? "Posted in the app · nobody in that group has an email on file" : n ? `Posted and emailed to ${n} ${n === 1 ? "person" : "people"}${miss}${r.partial ? " · some emails failed, check the send record" : ""}${demo}` : "Posted and emailed"); })
      .catch(() => flash("Posted in the app · the email couldn't be sent right now"));
  };
  const saveAsList = async () => {
    const name = (saveName || "").trim(); if (!name) { flash("Give the list a name"); return; }
    try { const nl = await saveDistributionList(buildingId, { name, kind: "manual", members: f.people }); await loadLists(); setF((x) => ({ ...x, aud: "list:" + nl.id })); setSaveName(null); flash(`Saved "${name}". It's in Send to from now on.`); }
    catch (e) { flash(String(e.message || e)); }
  };
  const isFormal = (a) => a.noticeType && a.noticeType !== "General";
  const audBadge = (a) => (a.audience && a.audience !== "all") ? <Badge color={a.audience === "list" || a.audience === "specific" ? T.accent3 : T.textMuted}>{audienceShort(a)}</Badge> : null;
  const poster = canPost || user.role === "manager";
  const hintFor = (t) => t.startsWith("list:") ? (() => { const l = lists.find((x) => "list:" + x.id === t); return l ? (l.kind === "rule" ? `Rule: ${ruleText(l.rule || {})}. Updates itself as people move in and out.` : "Hand-picked list. Anyone who has moved out is left off automatically.") : ""; })()
    : t === "specific" ? "Tick the people this is for. You can save them as a list for next time." : ((AUDIENCES.find((x) => x.k === t) || {}).hint || "");
  const audHint = (f.auds || []).length > 1 ? "Several groups. Anyone in more than one of them is emailed once." : hintFor((f.auds || [])[0] || "all");

  if (open) {
    const a = store.announcements.find((x) => x.id === open); if (!a) { setOpen(null); return null; }
    const expired = a.expiry && a.expiry < today();
    return (<div><Head title={isFormal(a) ? "Formal Notice" : "Announcement"} onBack={() => setOpen(null)} backLabel="All notices" /><Wrap>
      <Card style={{ padding: 0, overflow: "hidden" }}>{a.image && <img src={a.image} alt="" className="w-full h-52 object-cover" />}<div className="p-6">
        <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{a.title}</h2><div className="flex gap-1.5 flex-wrap justify-end">{isFormal(a) && <Badge color={T.accent3}>{a.noticeType}</Badge>}{audBadge(a)}{a.pinned && <Badge color={T.accent}><Pin size={11} /> Pinned</Badge>}{expired && <Badge color={SEMANTIC.bad}>Expired</Badge>}</div></div>
        <NoticeBody text={a.body} />
        {a.doc && <div className="mt-4"><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Attachment</div><FileChip name={a.doc} color={T.accent} /></div>}
        {poster && <SendRecord buildingId={buildingId} announcementId={a.id} />}
        <div style={{ color: T.textMuted, borderTop: `1px solid ${T.border}` }} className="text-xs mt-5 pt-3 flex flex-wrap gap-x-3"><span>Posted {fmtDate(a.date)} by {a.postedBy}</span>{a.expiry && <span>Expires {fmtDate(a.expiry)}</span>}</div>
      </div></Card>
    </Wrap></div>);
  }
  return (
    <div>
      <Head title="Announcements" sub={strata ? "Post formal notices to owners" : canPost ? "Posted by the committee" : "From your committee"} action={canPost && <HeaderAction data-guide="g-ann-new" onClick={() => { setManage(false); setComposing(true); }}><Plus size={16} /> {strata ? "New notice" : "New"}</HeaderAction>} />
      <Wrap>
        {strata && <Card style={{ padding: 14, background: T.surfaceAlt }}><p style={{ color: T.textMuted }} className="text-sm flex items-center gap-2"><FileText size={14} /> As strata manager you can post formal notices (meetings, AGM, minutes). They go to owners unless you choose otherwise.</p></Card>}
        {!canPost && <Card style={{ padding: 14, background: T.surfaceAlt }}><p style={{ color: T.textMuted }} className="text-sm flex items-center gap-2"><Lock size={14} /> Only the committee and strata manager can post here.</p></Card>}
        {canPost && !composing && !manage && <div className="flex justify-end"><button type="button" onClick={() => setManage(true)} className="text-sm inline-flex items-center gap-1.5" style={{ color: T.accent }}><ListChecks size={15} /> Distribution lists</button></div>}
        {manage && !composing && <DistributionListsPanel everyone={everyone} lists={lists} reload={loadLists} onClose={() => setManage(false)} />}
        {composing && (<Card style={{ padding: 18 }}><div className="space-y-3">
          <Field label={strata ? "Notice type" : "Type"}><Select value={f.noticeType} onChange={(e) => setF({ ...f, noticeType: e.target.value })}>{!strata && <option value="General">General announcement</option>}{NOTICE_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Send to"><div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
            {[["Building audiences", AUDIENCES.map((a) => ({ k: a.k, label: a.label }))],
              ...(lists.length ? [["Saved lists", lists.map((l) => ({ k: "list:" + l.id, label: l.name + (l.kind === "rule" ? " (rule)" : "") }))]] : []),
              ["Other", [{ k: "specific", label: "Pick specific people…" }]]].map(([group, items]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold" style={{ background: T.surfaceAlt, color: T.textMuted }}>{group}</div>
                {items.map((it) => { const on = (f.auds || []).includes(it.k); return (
                  <button key={it.k} type="button" onClick={() => { setShowWho(false); setSaveName(null); toggleAud(it.k); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left" style={{ borderTop: `1px solid ${T.border}`, background: on ? hexToRgba(T.accent, T.mode === "dark" ? 0.16 : 0.09) : "transparent" }}>
                    <span className="h-4 w-4 rounded grid place-items-center shrink-0" style={{ border: `1.5px solid ${on ? T.accent : T.border}`, background: on ? T.accent : "transparent" }}>{on && <Check size={11} style={{ color: T.accentText }} />}</span>
                    <span className="text-sm flex-1 truncate">{it.label}</span>
                  </button>); })}
              </div>))}
          </div></Field>
          <div className="flex items-start justify-between gap-3 -mt-1"><div className="text-xs" style={{ color: T.textMuted }}>{audHint}</div><button type="button" onClick={() => { setComposing(false); setManage(true); }} className="text-xs whitespace-nowrap" style={{ color: T.accent }}>Manage lists</button></div>
          {(f.auds || []).includes("specific") && (<Field label="Choose who receives this"><PeoplePicker people={everyone ? everyone.people || [] : null} selected={f.people} onChange={(m) => setF((x) => ({ ...x, people: m }))} />
            {(f.people || []).length > 0 && (saveName === null
              ? <button type="button" onClick={() => setSaveName("")} className="text-xs mt-2 inline-flex items-center gap-1" style={{ color: T.accent }}><Plus size={12} /> Save these {f.people.length} as a list</button>
              : <div className="flex gap-2 mt-2"><Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="List name, e.g. Pool working group" /><Btn onClick={saveAsList}>Save</Btn><Btn kind="ghost" onClick={() => setSaveName(null)}>Cancel</Btn></div>)}
          </Field>)}
          <RecipientSummary prev={prev} showWho={showWho} setShowWho={setShowWho} />
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={strata ? "e.g. Notice of Annual General Meeting" : "What's happening?"} /></Field>
          <Field label="Details"><div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <button type="button" onClick={() => formatSelection("notice-body", "bold", (v) => setF((x) => ({ ...x, body: v })))} className="text-xs px-2.5 py-1 rounded-lg font-bold" style={{ border: `1px solid ${T.border}`, color: T.text }}>B</button>
              <button type="button" onClick={() => formatSelection("notice-body", "bullet", (v) => setF((x) => ({ ...x, body: v })))} className="text-xs px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.text }}>• List</button>
              <button type="button" onClick={() => formatSelection("notice-body", "link", (v) => setF((x) => ({ ...x, body: v })))} className="text-xs px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.text }}>Link</button>
              <span className="text-[11px]" style={{ color: T.textMuted }}>**bold**, a dash for a bullet, web and email addresses become links</span>
            </div>
            <TextArea id="notice-body" rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Add the details residents need." /></Field>
          <Field label="Auto-expire on (optional)"><Input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} /></Field>
          {!strata && <Field label="Image (optional, shown in the app)"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} /></Field>}
          <Field label="Attach document (optional)"><label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-3 px-3 text-sm cursor-pointer"><Paperclip size={15} /> {f.doc || "Attach a file"}<input type="file" className="hidden" onChange={(e) => setF({ ...f, doc: e.target.files?.[0]?.name || "" })} /></label></Field>
          <div><button type="button" onClick={() => setShowEmail(!showEmail)} className="text-sm inline-flex items-center gap-1.5" style={{ color: T.accent }}><Mail size={14} /> {showEmail ? "Hide the email" : "See the email residents will get"}</button>
            {showEmail && <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}><iframe title="Email preview" sandbox="" srcDoc={emailPreview()} style={{ width: "100%", height: 640, border: 0, background: "#F3F4F6" }} /></div>}
            {showEmail && <div className="text-[11px] mt-1" style={{ color: T.textMuted }}>Images are sent small so the email stays light. Some mail apps hide images until the reader allows them, so the words should stand on their own.</div>}
          </div>
          <div className="flex gap-2"><Btn grad onClick={post}>{prev && !prev.error && prev.count ? `Post and email ${prev.emailable} ${prev.emailable === 1 ? "person" : "people"}` : "Post"}</Btn><Btn kind="ghost" onClick={() => { setComposing(false); setF(blank()); setSaveName(null); }}>Cancel</Btn></div>
        </div></Card>)}
        {list.map((a) => (
          <button key={a.id} onClick={() => setOpen(a.id)} className="w-full text-left"><Card hover style={{ padding: 0, overflow: "hidden", borderLeft: isFormal(a) ? `4px solid ${T.accent3}` : a.pinned ? `4px solid ${T.accent}` : undefined }}>
            {a.image && <img src={a.image} alt="" className="w-full h-40 object-cover" />}
            <div className="p-[18px]"><div className="flex items-start justify-between gap-3"><div className="font-semibold text-[17px]">{a.title}</div><div className="flex gap-1.5 items-center">{a.pinned && <Pin size={14} style={{ color: T.accent }} />}{a.doc && <Paperclip size={14} style={{ color: T.textMuted }} />}<ChevronRight size={16} style={{ color: T.textMuted }} /></div></div><div className="flex gap-1.5 mt-1.5 flex-wrap">{isFormal(a) && <Badge color={T.accent3}>{a.noticeType}</Badge>}{audBadge(a)}</div><p style={{ color: T.textMuted }} className="text-sm mt-1.5 line-clamp-2">{noticePlain(a.body)}</p><div style={{ color: T.textMuted }} className="text-xs mt-3">Posted {fmtDate(a.date)} · {a.postedBy}</div></div>
          </Card></button>
        ))}
      </Wrap>
    </div>
  );
}

// ---------- committee notices -----------------------------------------------
// Committee-to-committee. Announcements means "to residents"; this is the
// committee's own board. Residents cannot read these, and the database refuses
// them rather than the screen merely hiding them (migration 0032). The building
// manager sees only a notice posted with "Share with the building manager".
// Email is a nudge by default: title, a line of context and an Open in NaloHub
// button, with the detail left in the app. Tick "Include the detail" for the
// routine notes where that is simply more convenient.
function CommitteeNotices() {
  const { T, user, building, buildingId, flash, backend, store } = useApp();
  const committee = isCommitteeMember(user);
  const [rows, setRows] = useState(null);
  const [composing, setComposing] = useState(false);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const blank = () => ({ title: "", body: "", shareWithBm: false, emailedDetail: false });
  const [f, setF] = useState(blank);
  const [prev, setPrev] = useState(null);
  // The database already refuses a notice this person may not read; filtering
  // here as well keeps the demo (which has no RLS) honest about who sees what.
  const load = () => listCommitteeNotices(buildingId)
    .then((r) => setRows((r || []).filter((x) => committee || x.audience === "committee_bm")))
    .catch((e) => { setRows([]); flash(String(e.message || e)); });
  // user.role matters: the demo switches roles without remounting, and a stale
  // list from a committee session must not linger on the building manager's screen.
  useEffect(() => { setRows(null); load(); }, [buildingId, user.role, user.id]);
  const audience = f.shareWithBm ? "committee_bm" : "committee";
  useEffect(() => {
    if (!composing) return;
    if (!backend) { // demo: memberships live in the store, not the database
      const people = (store.users || []).filter((u) => u.buildingId === buildingId && u.status === "active"
        && ((u.role === "bcc" || (u.msc === true && u.role !== "manager")) || (f.shareWithBm && u.role === "manager")));
      setPrev({ count: people.length, emailable: people.filter((u) => u.email).length });
      return;
    }
    let live = true; setPrev(null);
    previewBroadcast(buildingId, audience).then((r) => { if (live) setPrev(r); }).catch(() => { if (live) setPrev(null); });
    return () => { live = false; };
  }, [composing, audience, buildingId, backend]);

  const post = async () => {
    if (!f.title.trim()) { flash("Add a title first"); return; }
    setBusy(true);
    const payload = { title: f.title.trim(), body: f.body.trim(), shareWithBm: f.shareWithBm, emailedDetail: f.emailedDetail, postedBy: user.name };
    try {
      const row = await createCommitteeNotice(buildingId, payload);
      setF(blank()); setComposing(false); await load();
      flash("Posted to your committee. Emailing now…");
      const logo = await shrinkImage(building.logoImage, { w: 96, h: 96, type: "image/png" });
      sendAnnouncementEmail({ buildingId, announcementId: row.id, subject: payload.title, bodyText: payload.body,
        audience: f.shareWithBm ? "committee_bm" : "committee", noticeType: "Committee note",
        linkOnly: !f.emailedDetail, images: { logo } })
        .then((r) => { const n = r && typeof r.sent === "number" ? r.sent : null;
          flash(n ? `Posted and emailed to ${n} ${n === 1 ? "person" : "people"}${backend ? "" : " (demo: nothing is actually sent)"}` : "Posted. Nobody had an email address on file."); })
        .catch(() => flash("Posted. The email couldn't be sent right now."));
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };
  const del = async (r) => {
    try { await deleteCommitteeNotice(buildingId, r.id, r.title); setConfirmDel(null); setOpen(null); await load(); flash("Notice deleted"); }
    catch (e) { flash(String(e.message || e)); }
  };
  const sharedBadge = (r) => r.audience === "committee_bm"
    ? <Badge color={T.accent3}>Shared with the building manager</Badge>
    : <Badge color={T.textMuted}>Committee only</Badge>;

  if (open) {
    const r = (rows || []).find((x) => x.id === open); if (!r) { setOpen(null); return null; }
    return (<div><Head title="Committee Notice" onBack={() => setOpen(null)} backLabel="All notices" /><Wrap>
      <Card style={{ padding: 24 }}>
        <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{r.title}</h2><div className="flex gap-1.5 flex-wrap justify-end">{sharedBadge(r)}</div></div>
        <NoticeBody text={r.body} />
        <div style={{ color: T.textMuted, borderTop: `1px solid ${T.border}` }} className="text-xs mt-5 pt-3 flex flex-wrap gap-x-3">
          <span>Posted {fmtDate(localDay(r.created_at))}{r.created_by_name ? ` by ${r.created_by_name}` : ""}</span>
          <span>{r.emailed_detail ? "Emailed in full" : "Emailed as a link"}</span>
        </div>
        {committee && (confirmDel === r.id
          ? <div className="flex gap-2 mt-4"><Btn kind="ghost" onClick={() => setConfirmDel(null)}>Keep</Btn><Btn onClick={() => del(r)} style={{ background: SEMANTIC.bad, color: "#fff", border: "1px solid transparent" }}>Delete this notice</Btn></div>
          : <button type="button" onClick={() => setConfirmDel(r.id)} className="text-xs mt-4 inline-flex items-center gap-1" style={{ color: SEMANTIC.bad }}><Trash2 size={12} /> Delete</button>)}
      </Card>
    </Wrap></div>);
  }
  return (
    <div>
      <Head title="Committee Notices" sub={committee ? "Between your committee, not for residents" : "Notices your committee has shared with you"}
        action={committee && <HeaderAction onClick={() => setComposing(true)}><Plus size={16} /> New</HeaderAction>} />
      <Wrap>
        <Card style={{ padding: 14, background: T.surfaceAlt }}>
          <p style={{ color: T.textMuted }} className="text-sm flex items-start gap-2"><Lock size={14} className="mt-0.5 shrink-0" />
            {committee
              ? "Owners and tenants can't see anything on this screen, and neither can your building manager unless you share a notice with them. The email is only a nudge: the detail stays in the app unless you choose otherwise."
              : "Your committee shares notices with you here. Notices they keep to themselves never appear."}</p>
        </Card>
        {composing && (<Card style={{ padding: 18 }}><div className="space-y-3">
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Meeting Tuesday 7pm" /></Field>
          <Field label="Details"><div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <button type="button" onClick={() => formatSelection("cnote-body", "bold", (v) => setF((x) => ({ ...x, body: v })))} className="text-xs px-2.5 py-1 rounded-lg font-bold" style={{ border: `1px solid ${T.border}`, color: T.text }}>B</button>
              <button type="button" onClick={() => formatSelection("cnote-body", "bullet", (v) => setF((x) => ({ ...x, body: v })))} className="text-xs px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.text }}>• List</button>
              <button type="button" onClick={() => formatSelection("cnote-body", "link", (v) => setF((x) => ({ ...x, body: v })))} className="text-xs px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.text }}>Link</button>
            </div>
            <TextArea id="cnote-body" rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="What the committee needs to know." /></Field>
          <label className="flex items-start gap-2.5 cursor-pointer"><input type="checkbox" checked={f.shareWithBm} onChange={(e) => setF({ ...f, shareWithBm: e.target.checked })} className="mt-1" />
            <span className="text-sm">Share with the building manager<span style={{ color: T.textMuted }} className="block text-xs">Off by default. Plenty of committee notes are about the manager's work rather than for them.</span></span></label>
          <label className="flex items-start gap-2.5 cursor-pointer"><input type="checkbox" checked={f.emailedDetail} onChange={(e) => setF({ ...f, emailedDetail: e.target.checked })} className="mt-1" />
            <span className="text-sm">Include the detail in the email<span style={{ color: T.textMuted }} className="block text-xs">Otherwise the email carries the title and a link, and the detail stays in the app. Leave this off for anything naming a resident.</span></span></label>
          <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            {prev ? <>Goes to <b>{prev.count} {prev.count === 1 ? "person" : "people"}</b>{prev.emailable < prev.count ? ` · ${prev.count - prev.emailable} with no email on file` : ""}.</> : "Working out who this goes to…"}
          </div>
          <div className="flex gap-2"><Btn grad onClick={post} disabled={busy}>{busy ? "Posting…" : "Post to the committee"}</Btn><Btn kind="ghost" onClick={() => { setComposing(false); setF(blank()); }}>Cancel</Btn></div>
        </div></Card>)}
        {rows === null && <Card style={{ padding: 18 }}><p style={{ color: T.textMuted }} className="text-sm">Loading…</p></Card>}
        {rows && rows.length === 0 && !composing && (<Card style={{ padding: 18 }}>
          <p style={{ color: T.textMuted }} className="text-sm">{committee ? "No committee notices yet. The first one is usually the next meeting." : "Nothing shared with you yet."}</p></Card>)}
        {(rows || []).map((r) => (
          <button key={r.id} onClick={() => setOpen(r.id)} className="w-full text-left"><Card hover style={{ padding: 18, borderLeft: `4px solid ${T.accent3}` }}>
            <div className="flex items-start justify-between gap-3"><div className="font-semibold text-[17px]">{r.title}</div><ChevronRight size={16} style={{ color: T.textMuted }} /></div>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">{sharedBadge(r)}</div>
            <p style={{ color: T.textMuted }} className="text-sm mt-1.5 line-clamp-2">{noticePlain(r.body)}</p>
            <div style={{ color: T.textMuted }} className="text-xs mt-3">Posted {fmtDate(localDay(r.created_at))}{r.created_by_name ? ` · ${r.created_by_name}` : ""}</div>
          </Card></button>
        ))}
      </Wrap>
    </div>
  );
}

// ---------- maintenance -----------------------------------------------------
const M_STATUS = { new: { label: "New", c: "#8a93a3" }, triaged: { label: "Triaged", c: SEMANTIC.warn }, in_progress: { label: "In progress", c: "#2f86d6" }, resolved: { label: "Resolved", c: SEMANTIC.ok } };
const M_FLOW = ["new", "triaged", "in_progress", "resolved"];
// "Waiting on" — what an open item is blocked by right now. Set on triage,
// changed as the job moves. Rides m.waitingOn in the existing JSONB; when
// unset the report derives it from the workflow trail (mwfWaitingOn).
const M_WAITING = [
  ["committee", "Committee decision", "B45309", "FDF3E7"],
  ["quote", "A quote", "1D6FB8", "E7F1FA"],
  ["contractor", "Contractor booked", "1F7A4C", "E8F5EE"],
  ["access", "Lot owner / access", "6D4DB8", "EFEAF9"],
  ["ready", "Ready to schedule", "B0366B", "FBE9F2"],
  ["", "Not set", "6B7480", "EEF0F3"],
];
const M_WAIT_LABEL = Object.fromEntries(M_WAITING.map((w) => [w[0], w[1]]));
const normTitle = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function Maintenance() {
  const { T, store, update, buildingId, user, flash, backend } = useApp();
  const [raising, setRaising] = useState(false);
  const [open, setOpen] = useState(null);
  const [f, setF] = useState({ title: "", category: MAINT_CATEGORIES[0], location: "", description: "", image: "", reportedOn: "", resolvedOn: "" });
  const [res, setRes] = useState({ supplier: "", note: "", cost: "", quoteDoc: "", sowDoc: "" });
  const [q, setQ] = useState({ supplier: "", amount: "", doc: "", note: "" });
  const [upd, setUpd] = useState("");
  const list = store.maintenance.filter((m) => m.buildingId === buildingId);
  const canTriage = canMaint(user);
  const managers = store.users.filter((u) => u.buildingId === buildingId && (u.role === "manager" || u.role === "bcc" || u.msc));
  const raise = () => {
    if (!f.title.trim()) return;
    // Historical entry (BM/BCC/MSC only): optional backdated "reported on" and
    // straight-to-Resolved "resolved on" — for loading past issues without the
    // workflow. True dates flow into the register, reports and stats.
    const hist = canTriage && !!(f.reportedOn || f.resolvedOn);
    const repOn = hist ? (f.reportedOn || f.resolvedOn) : "";
    const resOn = hist ? (f.resolvedOn || "") : "";
    if (resOn && repOn && resOn < repOn) { flash("Resolved date can't be before the reported date"); return; }
    const repISO = repOn ? new Date(repOn + "T09:00:00").toISOString() : nowISO();
    const resISO = resOn ? new Date(resOn + "T17:00:00").toISOString() : "";
    const { reportedOn: _ro, resolvedOn: _so, ...fields } = f;
    const historyRows = resOn
      ? [{ from: "", to: "new", by: user.name, at: repISO }, { from: "new", to: "resolved", by: user.name, at: resISO }]
      : [{ from: "", to: "new", by: user.name, at: repISO }];
    update((s) => s.maintenance.unshift({ id: "m" + Math.random().toString(36).slice(2, 6), buildingId, ...fields, raisedBy: user.name, status: resOn ? "resolved" : "new", triageOwner: "", date: repOn || today(), reportedAt: repISO, resolvedAt: resISO, ...(hist ? { historical: true } : {}), statusHistory: historyRows, quotes: [], resolutions: [], updates: [] }));
    audit(buildingId, "maintenance.reported", f.title + (hist ? " (historical)" : ""));
    setF({ title: "", category: MAINT_CATEGORIES[0], location: "", description: "", image: "", reportedOn: "", resolvedOn: "" });
    setRaising(false);
    flash(resOn ? "Historical issue recorded as Resolved" : hist ? "Issue logged with its original date · committee notified" : "Issue logged · committee notified");
  };
  const addUpdate = (id) => { if (!upd.trim()) return; update((s) => s.maintenance.find((x) => x.id === id).updates.push({ id: "up" + Math.random().toString(36).slice(2, 6), text: upd.trim(), by: user.name, date: today() })); setUpd(""); flash("Update posted"); };
  const setStatus = (id, status) => { update((s) => { const m = s.maintenance.find((x) => x.id === id); if (!m || m.status === status) return; (m.statusHistory = m.statusHistory || []).push({ from: m.status, to: status, by: user.name, at: nowISO() }); m.status = status; m.resolvedAt = status === "resolved" ? nowISO() : ""; }); audit(buildingId, "maintenance.status_change", status); };
  const setOwner = (id, owner) => update((s) => { const m = s.maintenance.find((x) => x.id === id); m.triageOwner = owner; if (m.status === "new" && owner) { (m.statusHistory = m.statusHistory || []).push({ from: "new", to: "triaged", by: user.name, at: nowISO() }); m.status = "triaged"; } });
  const addRes = (id) => { if (!res.note.trim() && !res.supplier.trim()) return; update((s) => s.maintenance.find((x) => x.id === id).resolutions.push({ id: "r" + Math.random().toString(36).slice(2, 6), supplier: res.supplier.trim(), note: res.note.trim(), cost: res.cost.trim(), quoteDoc: res.quoteDoc, sowDoc: res.sowDoc, by: user.name, date: today() })); audit(buildingId, "maintenance.approved_works", res.supplier); setRes({ supplier: "", note: "", cost: "", quoteDoc: "", sowDoc: "" }); flash("Added to approved works"); };
  const addQuote = (id) => { if (!q.supplier.trim() && !q.amount.trim()) return; update((s) => { const m = s.maintenance.find((x) => x.id === id); m.quotes = m.quotes || []; if (m.quotes.length >= 3) return; m.quotes.push({ id: "q" + Math.random().toString(36).slice(2, 6), supplier: q.supplier.trim(), amount: q.amount.trim(), doc: q.doc, note: q.note.trim(), by: user.name, date: today(), accepted: false }); }); audit(buildingId, "maintenance.quote_added", q.supplier); setQ({ supplier: "", amount: "", doc: "", note: "" }); flash("Quote recorded"); };
  const acceptQuote = (id, qid) => { update((s) => { const m = s.maintenance.find((x) => x.id === id); (m.quotes || []).forEach((x) => { x.accepted = x.id === qid ? !x.accepted : false; }); }); audit(buildingId, "maintenance.quote_accepted", qid); };
  const setWaiting = (id, k) => { update((s) => { const m = s.maintenance.find((x) => x.id === id); m.waitingOn = k || ""; m.waitingSince = k ? today() : ""; }); audit(buildingId, "maintenance.waiting_on", k || "cleared"); };
  const setReminder = (id, days) => update((s) => { const m = s.maintenance.find((x) => x.id === id); m.reminderDays = Number(days) || 0; });
  const remindNow = async (m) => { update((s) => { const x = s.maintenance.find((y) => y.id === m.id); x.lastRemindedAt = nowISO(); }); audit(buildingId, "maintenance.reminder_sent", m.title); flash("Reminder sent to maintenance team & building manager"); if (backend) { try { await supabase.functions.invoke("maintenance-reminders", { body: { issueId: m.id, buildingId } }); } catch (e) { /* email is best-effort */ } } };

  if (open) {
    const m = store.maintenance.find((x) => x.id === open); if (!m) { setOpen(null); return null; }
    const st = M_STATUS[m.status];
    return (<div><Head title="Maintenance" sub="Common-property issue" onBack={() => setOpen(null)} backLabel="All issues" /><Wrap>
      <Card style={{ padding: 0, overflow: "hidden" }}>{m.image && <img src={m.image} alt="" className="w-full h-48 object-cover" />}<div className="p-[18px]">
        <div className="flex items-center justify-between gap-3"><div className="font-semibold text-[17px]">{m.title}</div><Badge color={st.c}>{st.label}</Badge></div>
        <div className="flex flex-wrap gap-2 mt-2"><Badge color={T.accent}><Tag size={11} /> {m.category}</Badge><Badge color={T.textMuted}><MapPin size={11} /> {m.location || "—"}</Badge></div>
        <p className="text-sm mt-3">{m.description}</p>
        <div className="flex items-center gap-2 flex-wrap mt-4"><div style={{ color: T.textMuted }} className="text-xs">Reported by {m.raisedBy} on {fmtDate(m.reportedAt || m.date)}{m.triageOwner && ` · assigned to ${m.triageOwner}`}</div>{m.status === "resolved" ? (daysToResolve(m) != null ? <Badge color={SEMANTIC.ok}>Resolved in {daysToResolve(m)} day{daysToResolve(m) === 1 ? "" : "s"}</Badge> : null) : <Badge color={agingColor(daysOpen(m))}>{daysOpen(m)} day{daysOpen(m) === 1 ? "" : "s"} open</Badge>}</div>
      </div></Card>
      <Card style={{ padding: 18 }}><SectionTitle right={m.status === "resolved" ? <Badge color={SEMANTIC.ok}>Resolved</Badge> : null}>Progress updates</SectionTitle>
        <p style={{ color: T.textMuted }} className="text-xs mb-2">The Maintenance Sub-Committee [MSC] or Building Manager [BM] updates status and assignment.</p>
        {m.updates.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-2">No updates yet.</p>}
        <div className="space-y-2.5">{m.updates.map((u) => (<div key={u.id} className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><p className="text-sm">{u.text}</p><div style={{ color: T.textMuted }} className="text-[11px] mt-1.5">{u.by} · {fmtDate(u.date)}</div></div>))}</div>
        {canTriage && m.status !== "resolved" && (<div className="mt-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}><Field label="Add an update for residents"><TextArea rows={2} value={upd} onChange={(e) => setUpd(e.target.value)} placeholder="e.g. Parts ordered, expected next week." /></Field><div className="mt-2"><Btn grad onClick={() => addUpdate(m.id)}><Plus size={15} /> Post update</Btn></div></div>)}
      </Card>
      {canTriage ? (<>
        <Card style={{ padding: 18 }}><SectionTitle>Triage</SectionTitle>
          <Field label="Assigned to"><Select value={m.triageOwner} onChange={(e) => setOwner(m.id, e.target.value)}><option value="">Unassigned</option>{managers.map((u) => <option key={u.id} value={u.name}>{u.name} — {u.msc ? "Maintenance Sub-Committee" : ROLE_LABEL[u.role]}</option>)}</Select></Field>
          {m.status !== "resolved" && (<div className="mt-4"><SectionTitle>Waiting on</SectionTitle><p style={{ color: T.textMuted }} className="text-xs mb-2">What this item is blocked by right now. The Maintenance Report groups open items by this, so delays land where they belong.</p><div className="flex flex-wrap gap-2">{M_WAITING.map(([k, label, c]) => (<button key={k || "none"} onClick={() => setWaiting(m.id, k)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: (m.waitingOn || "") === k ? "#" + c : "transparent", color: (m.waitingOn || "") === k ? "#fff" : T.text, border: `1px solid ${(m.waitingOn || "") === k ? "#" + c : T.border}` }}>{label}</button>))}</div></div>)}
          <div className="mt-4"><SectionTitle>Status</SectionTitle><div className="flex flex-wrap gap-2">{M_FLOW.map((s) => (<button key={s} onClick={() => setStatus(m.id, s)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: m.status === s ? M_STATUS[s].c : "transparent", color: m.status === s ? "#fff" : T.text, border: `1px solid ${m.status === s ? M_STATUS[s].c : T.border}` }}>{M_STATUS[s].label}</button>))}</div></div>
          {(m.statusHistory || []).length > 0 && (<div className="mt-4"><SectionTitle>History</SectionTitle><div className="space-y-1">{(m.statusHistory || []).map((h, i) => (<div key={i} style={{ color: T.textMuted }} className="text-xs">{h.from ? (M_STATUS[h.from]?.label || h.from) : "Reported"} → <span style={{ color: T.text }} className="font-medium">{M_STATUS[h.to]?.label || h.to}</span> · {h.by} · {fmtDate(h.at)}</div>))}</div></div>)}
          {m.status !== "resolved" && (<div className="mt-4" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}><SectionTitle right={<Bell size={14} style={{ color: T.textMuted }} />}>Follow-up reminders</SectionTitle>
            {(() => { const rd = Number(m.reminderDays) || 0; const last = m.lastRemindedAt || m.reportedAt || m.date; const nextDue = rd > 0 ? addDays(localDay(last), rd) : null; const overdue = nextDue && nextDue <= today(); return (<>
              <div className="grid grid-cols-2 gap-3 items-end"><Field label="Remind every"><Select value={rd} onChange={(e) => setReminder(m.id, e.target.value)}><option value={0}>Off</option><option value={3}>3 days</option><option value={7}>Weekly</option><option value={14}>Fortnightly</option><option value={30}>Monthly</option></Select></Field><div className="text-xs" style={{ color: overdue ? SEMANTIC.warn : T.textMuted }}>{rd > 0 ? (<>Next reminder: {fmtDate(nextDue)}{overdue ? " · due now" : ""}</>) : "No automatic reminders"}</div></div>
              <div className="mt-2"><Btn kind="ghost" onClick={() => remindNow(m)}><Bell size={14} /> Remind team now</Btn></div>
              {m.lastRemindedAt && <div style={{ color: T.textMuted }} className="text-[11px] mt-2">Last reminded {fmtDate(m.lastRemindedAt)}</div>}
            </>); })()}
          </div>)}
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{(m.quotes || []).length}/3 captured</span>}>Quotes</SectionTitle>
          {(m.quotes || []).length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-3">Capture up to three quotes to compare before engaging a supplier, then mark the successful one as accepted.</p>}
          <div className="space-y-2.5 mb-4">{(m.quotes || []).map((r) => (<div key={r.id} className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${r.accepted ? SEMANTIC.ok : T.border}` }}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-sm font-semibold flex items-center gap-2">{r.supplier || "—"}{r.accepted && <Badge color={SEMANTIC.ok}>Accepted</Badge>}</div>{r.note && <p style={{ color: T.textMuted }} className="text-sm">{r.note}</p>}</div>{r.amount && <Badge color={T.accent}>{r.amount}</Badge>}</div><div className="flex flex-wrap items-center gap-3 mt-2">{r.doc && <FileChip name={r.doc} color={T.accent} />}<button onClick={() => acceptQuote(m.id, r.id)} className="text-[11px] font-semibold" style={{ color: r.accepted ? SEMANTIC.bad : SEMANTIC.ok }}>{r.accepted ? "Un-accept" : "Mark accepted"}</button></div><div style={{ color: T.textMuted }} className="text-[11px] mt-2">Added by {r.by} · {fmtDate(r.date)}</div></div>))}</div>
          {(m.quotes || []).length < 3 && (<div className="space-y-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
            <div className="grid grid-cols-2 gap-3"><Field label="Trade / supplier"><Input value={q.supplier} onChange={(e) => setQ({ ...q, supplier: e.target.value })} placeholder="e.g. FlowFix Plumbing" /></Field><Field label="Amount"><Input value={q.amount} onChange={(e) => setQ({ ...q, amount: e.target.value })} placeholder="$" /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="Quote doc"><label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-2.5 px-2 text-xs cursor-pointer"><Paperclip size={13} /> {q.doc || "Attach"}<input type="file" className="hidden" onChange={(e) => setQ({ ...q, doc: e.target.files?.[0]?.name || "" })} /></label></Field><Field label="Note"><Input value={q.note} onChange={(e) => setQ({ ...q, note: e.target.value })} placeholder="e.g. available next week" /></Field></div>
            <Btn grad onClick={() => addQuote(m.id)}><Plus size={15} /> Add quote ({(m.quotes || []).length}/3)</Btn>
          </div>)}
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">supplier · quote · scope</span>}>Approved works &amp; suppliers</SectionTitle>
          {m.resolutions.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-3">No approved works yet. Record the trade/supplier, their quote and the statement of work — these flow into the BCC report.</p>}
          <div className="space-y-2.5 mb-4">{m.resolutions.map((r) => (<div key={r.id} className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><div className="flex items-start justify-between gap-2"><div className="min-w-0">{r.supplier && <div className="text-sm font-semibold">{r.supplier}</div>}{r.note && <p style={{ color: r.supplier ? T.textMuted : T.text }} className="text-sm">{r.note}</p>}</div>{r.cost && <Badge color={SEMANTIC.ok}>{r.cost}</Badge>}</div><div className="flex flex-wrap gap-2 mt-2">{r.quoteDoc && <FileChip name={r.quoteDoc} color={T.accent} />}{r.sowDoc && <FileChip name={r.sowDoc} color={HUE.documents[1]} />}</div><div style={{ color: T.textMuted }} className="text-[11px] mt-2">Approved by {r.by} · {fmtDate(r.date)}</div></div>))}</div>
          <div className="space-y-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
            <Field label="Trade / supplier"><Input value={res.supplier} onChange={(e) => setRes({ ...res, supplier: e.target.value })} placeholder="e.g. DoorTech Pty Ltd" /></Field>
            <Field label="Note / recommendation"><TextArea rows={2} value={res.note} onChange={(e) => setRes({ ...res, note: e.target.value })} placeholder="e.g. Recommend accepting quote; available next week." /></Field>
            <div className="grid grid-cols-3 gap-3"><Field label="Quote / cost"><Input value={res.cost} onChange={(e) => setRes({ ...res, cost: e.target.value })} placeholder="$" /></Field><Field label="Quote doc"><label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-2.5 px-2 text-xs cursor-pointer"><Paperclip size={13} /> {res.quoteDoc || "Attach"}<input type="file" className="hidden" onChange={(e) => setRes({ ...res, quoteDoc: e.target.files?.[0]?.name || "" })} /></label></Field><Field label="Statement of work"><label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-2.5 px-2 text-xs cursor-pointer"><Paperclip size={13} /> {res.sowDoc || "Attach"}<input type="file" className="hidden" onChange={(e) => setRes({ ...res, sowDoc: e.target.files?.[0]?.name || "" })} /></label></Field></div>
            <Btn grad onClick={() => addRes(m.id)}><Plus size={15} /> Record approved works</Btn>
          </div>
        </Card>
      </>) : <Card style={{ padding: 14, background: T.surfaceAlt }}><p style={{ color: T.textMuted }} className="text-sm flex items-center gap-2"><Lock size={14} /> The Maintenance Sub-Committee [MSC] or Building Manager [BM] updates status and assignment.</p></Card>}
    </Wrap></div>);
  }
  const stOrder = { new: 0, triaged: 1, in_progress: 2, resolved: 3 };
  const grouped = MAINT_CATEGORIES.map((c) => ({ c, items: list.filter((m) => m.category === c).sort((a, b) => (stOrder[a.status] - stOrder[b.status]) || (new Date(b.reportedAt || b.date) - new Date(a.reportedAt || a.date))) })).filter((g) => g.items.length > 0);
  return (
    <div>
      <Head title="Maintenance" sub="Report common-property issues" action={<HeaderAction data-guide="g-maint-report" onClick={() => setRaising(true)}><Plus size={16} /> Report</HeaderAction>} />
      <Wrap>
        {raising && (<Card style={{ padding: 18 }}><div className="space-y-3">
          <Field label="What's the issue?"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Foyer light flickering" /></Field>
          {(() => { const nt = normTitle(f.title); if (nt.length < 4) return null; const dup = list.find((m) => normTitle(m.title) === nt); if (!dup) return null; return (<div className="rounded-xl p-3 text-sm flex items-start gap-2" style={{ background: hexToRgba(SEMANTIC.warn, T.mode === "dark" ? 0.16 : 0.1), border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.4)}` }}><AlertCircle size={16} style={{ color: SEMANTIC.warn }} className="mt-0.5 shrink-0" /><div>An issue with this title already exists ({M_STATUS[dup.status].label.toLowerCase()}, reported {fmtDate(dup.reportedAt || dup.date)}). If this is the same problem, add an update to that one instead. If it's a new occurrence, make the title distinct, for example add the location or date.</div></div>); })()}
          <div className="grid sm:grid-cols-2 gap-3"><Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{MAINT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="Where?"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Ground floor foyer" /></Field></div>
          <Field label="Details (optional)"><TextArea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Anything that helps us find it." /></Field>
          <Field label="Photo (a picture beats a paragraph)"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} label="Add a photo" /></Field>
          {canTriage && (<div className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: T.textMuted }}>Historical record (optional) — committee &amp; building manager only</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Reported on (backdate)"><Input type="date" max={today()} value={f.reportedOn} onChange={(e) => setF({ ...f, reportedOn: e.target.value })} /></Field>
              <Field label="Resolved on (records straight to Resolved)"><Input type="date" max={today()} value={f.resolvedOn} onChange={(e) => setF({ ...f, resolvedOn: e.target.value })} /></Field>
            </div>
            <p className="text-[11px] mt-2" style={{ color: T.textMuted }}>For loading past issues into the register. The true dates flow into reports and statistics; no workflow or voting steps are required. Leave blank for a normal report.</p>
          </div>)}
          <div className="flex gap-2"><Btn grad onClick={raise}>Submit report</Btn><Btn kind="ghost" onClick={() => setRaising(false)}>Cancel</Btn></div>
        </div></Card>)}
        {list.length === 0 && <Empty icon={Wrench} title="No issues reported" hint="Spotted something in a shared area? Just Nalo it." />}
        {grouped.map((g) => (<div key={g.c}>
          <div className="flex items-center justify-between mt-2 mb-2"><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold">{g.c}</div><span style={{ color: T.textMuted }} className="text-[11px]">{g.items.filter((m) => m.status !== "resolved").length} open · {g.items.length} total</span></div>
          <div className="space-y-2">{g.items.map((m) => { const st = M_STATUS[m.status]; const d = daysOpen(m); return (
            <button key={m.id} onClick={() => setOpen(m.id)} className="w-full text-left"><Card hover style={{ padding: 14 }}><div className="flex items-center gap-3">{m.image ? <img src={m.image} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" /> : <div className="h-12 w-12 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}><Wrench size={18} /></div>}<div className="flex-1 min-w-0"><div className="font-semibold truncate">{m.title}</div><div style={{ color: T.textMuted }} className="text-xs mt-0.5">Reported {fmtDate(m.reportedAt || m.date)}{(m.quotes || []).length > 0 ? ` · ${m.quotes.length} quote(s)` : ""}{m.resolutions.length > 0 ? ` · ${m.resolutions.length} work(s)` : ""}</div></div>{m.status !== "resolved" && <Badge color={agingColor(d)}>{d}d</Badge>}<Badge color={st.c}>{st.label}</Badge><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>
          ); })}</div>
        </div>))}
      </Wrap>
    </div>
  );
}

// ---------- asset register --------------------------------------------------
const ASSET_CATEGORIES = ["Lifts", "Fire & safety", "HVAC / Air-con", "Pool & spa", "Electrical", "Plumbing", "Security & access", "Grounds & landscaping", "Common area", "Roofing & structure", "Other"];
const DEFAULT_LIFE = { "Lifts": 25, "Fire & safety": 15, "HVAC / Air-con": 15, "Pool & spa": 12, "Electrical": 20, "Plumbing": 25, "Security & access": 10, "Grounds & landscaping": 10, "Common area": 12, "Roofing & structure": 40, "Other": 15 };
const money = (n) => (n || n === 0) ? "$" + Number(n).toLocaleString("en-AU", { maximumFractionDigits: 0 }) : "—";
const assetAge = (a) => { if (a.purchaseDate) return Math.max(0, (Date.now() - new Date(a.purchaseDate)) / (365.25 * 86400000)); return Number(a.ageYears) || 0; };
const assetWDV = (a) => { const val = Number(a.purchaseValue) || 0; const life = Number(a.usefulLife) || DEFAULT_LIFE[a.category] || 15; if (!val || !life) return val; const rem = Math.max(0, 1 - assetAge(a) / life); return Math.round(val * rem); };
const assetNextDue = (a) => { const m = Number(a.serviceMonths) || 0; if (!m) return null; const base = a.lastService || a.purchaseDate; if (!base) return null; return addDays(localDay(base), Math.round(m * 30.44)); };

// Module level: declared inside AssetRegister this was a new component type on every
// render, so each keystroke remounted the form and the field lost focus after one character.
function AssetForm({ vals, setVals, onSave, onCancel, saveLabel }) {
  return (<Card style={{ padding: 18 }}><div className="space-y-3">
    <Field label="Asset name"><Input value={vals.name} onChange={(e) => setVals({ ...vals, name: e.target.value })} placeholder="e.g. Lift 1 — Otis Gen2" /></Field>
    <div className="grid sm:grid-cols-2 gap-3"><Field label="Category"><Select value={vals.category} onChange={(e) => setVals({ ...vals, category: e.target.value })}>{ASSET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="Location"><Input value={vals.location} onChange={(e) => setVals({ ...vals, location: e.target.value })} placeholder="e.g. Tower A, basement" /></Field></div>
    <div className="grid sm:grid-cols-2 gap-3"><Field label="Purchase date"><Input type="date" value={vals.purchaseDate} onChange={(e) => setVals({ ...vals, purchaseDate: e.target.value })} /></Field><Field label="Purchase value ($)"><Input type="number" value={vals.purchaseValue} onChange={(e) => setVals({ ...vals, purchaseValue: e.target.value })} placeholder="0" /></Field></div>
    <div className="grid sm:grid-cols-2 gap-3"><Field label="Approx. age (yrs) — if no purchase date"><Input type="number" value={vals.ageYears} onChange={(e) => setVals({ ...vals, ageYears: e.target.value })} placeholder="e.g. 8" /></Field><Field label="Useful life (yrs)"><Input type="number" value={vals.usefulLife} onChange={(e) => setVals({ ...vals, usefulLife: e.target.value })} placeholder={String(DEFAULT_LIFE[vals.category] || 15)} /></Field></div>
    <div className="grid sm:grid-cols-2 gap-3"><Field label="Service every (months)"><Input type="number" value={vals.serviceMonths} onChange={(e) => setVals({ ...vals, serviceMonths: e.target.value })} placeholder="e.g. 6" /></Field><Field label="Last serviced"><Input type="date" value={vals.lastService} onChange={(e) => setVals({ ...vals, lastService: e.target.value })} /></Field></div>
    <Field label="Notes"><TextArea rows={2} value={vals.notes} onChange={(e) => setVals({ ...vals, notes: e.target.value })} placeholder="Supplier, warranty, serial…" /></Field>
    <div className="flex gap-2"><Btn grad onClick={onSave}>{saveLabel}</Btn><Btn kind="ghost" onClick={onCancel}>Cancel</Btn></div>
  </div></Card>);
}
function AssetRegister() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.assets ? store.assets.filter((a) => a.buildingId === buildingId) : [];
  const canEdit = isCommittee(user.role) || canMaint(user);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const blank = { name: "", category: ASSET_CATEGORIES[0], location: "", purchaseDate: "", purchaseValue: "", ageYears: "", usefulLife: "", serviceMonths: "", lastService: "", notes: "" };
  const [f, setF] = useState(blank);
  const save = () => { if (!f.name.trim()) return; update((s) => { s.assets = s.assets || []; s.assets.unshift({ id: "as" + Math.random().toString(36).slice(2, 6), buildingId, ...f }); }); audit(buildingId, "asset.added", f.name); setF(blank); setAdding(false); flash("Asset added to register"); };
  const patch = (id, k, v) => update((s) => { const a = s.assets.find((x) => x.id === id); a[k] = v; });
  const remove = (id) => { update((s) => { s.assets = s.assets.filter((x) => x.id !== id); }); audit(buildingId, "asset.removed", id); setOpen(null); flash("Asset removed"); };

  const grouped = ASSET_CATEGORIES.map((c) => ({ c, items: list.filter((a) => a.category === c) })).filter((g) => g.items.length);
  const totVal = list.reduce((s, a) => s + (Number(a.purchaseValue) || 0), 0);
  const totWDV = list.reduce((s, a) => s + assetWDV(a), 0);


  if (open) {
    const a = list.find((x) => x.id === open); if (!a) { setOpen(null); return null; }
    const nd = assetNextDue(a); const due = nd && nd <= today();
    return (<div><Head title={navLabel(store.buildings.find((b) => b.id === buildingId), "assets", "Asset Register")} sub="Asset detail" onBack={() => setOpen(null)} backLabel="All assets" /><Wrap>
      <Card style={{ padding: 18 }}>
        <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-[17px]">{a.name}</div><div className="flex flex-wrap gap-2 mt-2"><Badge color={T.accent}><Tag size={11} /> {a.category}</Badge><Badge color={T.textMuted}><MapPin size={11} /> {a.location || "—"}</Badge></div></div></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">{[["Purchase", money(a.purchaseValue)], ["Written-down", money(assetWDV(a))], ["Age", assetAge(a) ? assetAge(a).toFixed(1) + " yrs" : "—"], ["Next service", nd ? fmtDate(nd) : "—"]].map(([l, v], i) => (<div key={l} className="rounded-xl py-3" style={{ background: T.surfaceAlt }}><div className="text-lg font-bold" style={{ color: i === 3 && due ? SEMANTIC.warn : T.text }}>{v}</div><div style={{ color: T.textMuted }} className="text-[11px]">{l}</div></div>))}</div>
        {a.notes && <p className="text-sm mt-3">{a.notes}</p>}
      </Card>
      {canEdit && (<Card style={{ padding: 18 }}><SectionTitle>Update service record</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3"><Field label="Service every (months)"><Input type="number" defaultValue={a.serviceMonths} onBlur={(e) => patch(a.id, "serviceMonths", e.target.value)} /></Field><Field label="Last serviced"><Input type="date" defaultValue={a.lastService} onChange={(e) => patch(a.id, "lastService", e.target.value)} /></Field></div>
        <div className="mt-3"><Btn kind="ghost" onClick={() => remove(a.id)}><Trash2 size={14} /> Remove asset</Btn></div>
      </Card>)}
    </Wrap></div>);
  }

  return (<div>
    <Head title={navLabel(store.buildings.find((b) => b.id === buildingId), "assets", "Asset Register")} sub="Capital assets, values & service schedule" action={canEdit ? <HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> Add asset</HeaderAction> : null} />
    <Wrap>
      {adding && <AssetForm vals={f} setVals={setF} onSave={save} onCancel={() => { setAdding(false); setF(blank); }} saveLabel="Add asset" />}
      {list.length > 0 && (<Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{list.length} assets</span>}>Portfolio value</SectionTitle>
        <div className="grid grid-cols-2 gap-3 text-center mb-4"><div className="rounded-xl py-3" style={{ background: T.surfaceAlt }}><div className="text-2xl font-bold" style={{ color: T.accent }}>{money(totVal)}</div><div style={{ color: T.textMuted }} className="text-xs">Total purchase value</div></div><div className="rounded-xl py-3" style={{ background: T.surfaceAlt }}><div className="text-2xl font-bold" style={{ color: SEMANTIC.ok }}>{money(totWDV)}</div><div style={{ color: T.textMuted }} className="text-xs">Current written-down value</div></div></div>
        <div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">By category</div>
        {grouped.map((g) => { const v = g.items.reduce((s, a) => s + (Number(a.purchaseValue) || 0), 0); const w = g.items.reduce((s, a) => s + assetWDV(a), 0); return (<div key={g.c} className="flex items-center justify-between py-1.5 text-sm" style={{ borderBottom: `1px solid ${T.border}` }}><span>{g.c} <span style={{ color: T.textMuted }}>({g.items.length})</span></span><span style={{ color: T.textMuted }} className="text-xs">{money(v)} → {money(w)}</span></div>); })}
        <div className="mt-3"><Btn kind="ghost" onClick={() => { const lines = ["ASSET REGISTER", "", ...ASSET_CATEGORIES.flatMap((c) => { const its = list.filter((a) => a.category === c); if (!its.length) return []; return ["== " + c, ...its.map((a) => `  ${a.name} | ${a.location || "-"} | purchase ${money(a.purchaseValue)} | WDV ${money(assetWDV(a))} | next service ${assetNextDue(a) ? fmtDate(assetNextDue(a)) : "-"}`), ""]; }), `TOTAL purchase ${money(totVal)} -> WDV ${money(totWDV)}`]; downloadText("asset-register.txt", lines.join("\n")); }}><Download size={14} /> Export register</Btn></div>
      </Card>)}
      {list.length === 0 && <Empty icon={Boxes} title="No assets yet" hint={canEdit ? "Add lifts, pumps, fire systems and other capital assets to track value and servicing." : "The committee hasn't added assets yet."} />}
      {grouped.map((g) => (<div key={g.c}>
        <div className="flex items-center justify-between mt-2 mb-2"><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold">{g.c}</div><span style={{ color: T.textMuted }} className="text-[11px]">{money(g.items.reduce((s, a) => s + assetWDV(a), 0))} WDV</span></div>
        <div className="space-y-2">{g.items.map((a) => { const nd = assetNextDue(a); const due = nd && nd <= today(); return (
          <button key={a.id} onClick={() => setOpen(a.id)} className="w-full text-left"><Card hover style={{ padding: 14 }}><div className="flex items-center gap-3"><div className="h-12 w-12 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}><Boxes size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold truncate">{a.name}</div><div style={{ color: T.textMuted }} className="text-xs mt-0.5">{a.location || "—"} · WDV {money(assetWDV(a))}{nd ? ` · service ${fmtDate(nd)}` : ""}</div></div>{due && <Badge color={SEMANTIC.warn}>Service due</Badge>}<ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>
        ); })}</div>
      </div>))}
    </Wrap>
  </div>);
}

// ---------- bookings --------------------------------------------------------
const FAC_META = { bbq: { label: "BBQ area", icon: Flame, timed: true }, visitor: { label: "Visitor parking", icon: Car, timed: false }, lift: { label: "Lift (move)", icon: ArrowUpDown, timed: true }, common: { label: "Common room", icon: Sofa, timed: true }, gym: { label: "Gym session", icon: Dumbbell, timed: true } };
function Bookings() {
  const { T, store, update, building, buildingId, user, flash } = useApp();
  const facs = Object.keys(building.facilities).filter((k) => building.facilities[k]);
  const [fac, setFac] = useState(facs[0] || "bbq");
  const [f, setF] = useState({ fromDate: "", toDate: "", timeFrom: "", timeTo: "", note: "" });
  const meta = FAC_META[fac];
  const mine = store.bookings.filter((b) => b.buildingId === buildingId && (isApprover(user.role) || b.bookedBy === user.name));
  const book = () => { if (!f.fromDate) { flash("Pick a date first"); return; } const nights = fac === "visitor" ? daysBetween(f.fromDate, f.toDate || f.fromDate) : 0; const needsApproval = fac === "visitor" && nights > 1; update((s) => s.bookings.unshift({ id: "k" + Math.random().toString(36).slice(2, 6), buildingId, facility: fac, fromDate: f.fromDate, toDate: f.toDate || f.fromDate, timeFrom: f.timeFrom, timeTo: f.timeTo, bookedBy: user.name, status: needsApproval ? "pending" : "confirmed", note: f.note.trim(), decidedBy: "", decidedAt: "", decisionNote: "" })); setF({ fromDate: "", toDate: "", timeFrom: "", timeTo: "", note: "" }); flash(needsApproval ? "Request sent to the committee for approval" : "Booking confirmed · email sent"); };
  const nights = fac === "visitor" && f.fromDate ? daysBetween(f.fromDate, f.toDate || f.fromDate) : 0;
  return (
    <div>
      <Head title="Bookings" sub="Reserve shared spaces & visitor parking" />
      <Wrap>
        <div className="flex gap-2 flex-wrap">{facs.map((k) => { const M = FAC_META[k]; const on = fac === k; return (<button key={k} onClick={() => { setFac(k); setF({ fromDate: "", toDate: "", timeFrom: "", timeTo: "", note: "" }); }} className="px-3.5 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2" style={{ background: on ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : T.surface, color: on ? T.accentText : T.text, border: `1px solid ${on ? "transparent" : T.border}` }}><M.icon size={16} /> {M.label}</button>); })}</div>
        <Card style={{ padding: 18 }}><SectionTitle>New booking · {meta.label}</SectionTitle><div className="space-y-3">
          {meta.timed ? (<><Field label="Date"><Input type="date" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value, toDate: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="From"><Input type="time" value={f.timeFrom} onChange={(e) => setF({ ...f, timeFrom: e.target.value })} /></Field><Field label="To"><Input type="time" value={f.timeTo} onChange={(e) => setF({ ...f, timeTo: e.target.value })} /></Field></div></>)
            : (<><div className="grid grid-cols-2 gap-3"><Field label="From date"><Input type="date" value={f.fromDate} onChange={(e) => setF({ ...f, fromDate: e.target.value })} /></Field><Field label="To date"><Input type="date" value={f.toDate} onChange={(e) => setF({ ...f, toDate: e.target.value })} /></Field></div>{nights > 0 && <p style={{ color: nights > 1 ? SEMANTIC.warn : T.textMuted }} className="text-xs flex items-center gap-1.5">{nights > 1 && <AlertCircle size={13} />}{nights} night{nights > 1 ? "s" : ""}{nights > 1 ? " · needs committee approval" : ""}</p>}</>)}
          <Field label="Note (optional)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. moving furniture in" /></Field>
          <Btn grad onClick={book}>{fac === "visitor" && nights > 1 ? "Request booking" : "Confirm booking"}</Btn>
        </div></Card>
        <SectionTitle>{isApprover(user.role) ? "All bookings" : "Your bookings"}</SectionTitle>
        {mine.length === 0 && <Empty icon={CalendarCheck} title="Nothing booked yet" hint="Pick a space and Nalo it when you’re ready." />}
        {mine.map((b) => { const M = FAC_META[b.facility]; const stc = b.status === "pending" ? SEMANTIC.warn : b.status === "declined" ? SEMANTIC.bad : SEMANTIC.ok; return (
          <Card key={b.id} style={{ padding: 16 }}><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${HUE.bookings[0]}, ${HUE.bookings[1]})` }}><M.icon size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold">{M.label}</div><div style={{ color: T.textMuted }} className="text-xs">{b.facility === "visitor" ? `${fmtDate(b.fromDate)} → ${fmtDate(b.toDate)}` : `${fmtDate(b.fromDate)}${b.timeFrom ? ` · ${b.timeFrom}–${b.timeTo}` : ""}`} · {b.bookedBy}</div></div><Badge color={stc}>{b.status === "pending" ? "Pending" : b.status === "declined" ? "Declined" : "Confirmed"}</Badge></div>{b.decidedBy && <div style={{ color: T.textMuted, borderTop: `1px solid ${T.border}` }} className="text-xs mt-3 pt-2.5">{b.status === "confirmed" ? "Approved" : "Declined"} by {b.decidedBy} · {fmtDate(b.decidedAt)}{b.decisionNote && ` — “${b.decisionNote}”`}</div>}</Card>
        ); })}
      </Wrap>
    </div>
  );
}

// ---------- applications & bookings (live backend) --------------------------
// Kind first (Application or Booking), then category. Applications support
// document/image/video uploads; parking permits capture vehicle + dates and
// auto-issue a fold-for-dash permit PDF on approval. Committee gets a queue.
const APP_CATS = {
  application: [["pet", "Pet approval", Tag], ["lot_improvement", "Lot improvement", Wrench], ["parking_permit", "Parking permit", Car], ["keys_access", "Keys & access", KeyRound], ["other", "Other request", FileText]],
  booking: [["common_area_booking", "BBQ / common area", Flame], ["other", "Other booking", CalendarCheck]],
};
const APP_STATUS_COLOR = (s) => s === "approved" ? SEMANTIC.ok : s === "declined" || s === "withdrawn" ? SEMANTIC.bad : SEMANTIC.warn;
function ApplicationsBookings() { return <ApplicationsBookingsLive />; }
function ApplicationsBookingsLive() {
  const { T, user, buildingId, building, flash, setView } = useApp();
  const committee = isCommittee(user.role);
  const [rows, setRows] = useState([]); const [atts, setAtts] = useState([]); const [permits, setPermits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState("application");
  const [cat, setCat] = useState("pet");
  const [f, setF] = useState({ title: "", detail: "", unit: "", make: "", model: "", colour: "", rego: "", from: "", to: "", petType: "", petName: "", petBreed: "" });
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    try {
      const r = await listApplications(buildingId);
      setRows(r);
      setAtts(await listApplicationAttachments(r.map((x) => x.id)));
      if (committee || r.some((x) => x.category === "parking_permit")) setPermits(await listPermits(buildingId));
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [buildingId]);
  const submit = async () => {
    try {
      setBusy(true);
      let title = f.title.trim(); const details = {};
      if (cat === "parking_permit") {
        if (!f.unit.trim() || !f.make || !f.model || !f.colour || !f.rego || !f.from || !f.to) { flash("Parking permits need the unit number, vehicle make, model, colour, rego and dates"); setBusy(false); return; }
        Object.assign(details, { vehicle_make: f.make, vehicle_model: f.model, vehicle_colour: f.colour, vehicle_rego: f.rego, date_from: f.from, date_to: f.to });
        title = title || `Parking permit — ${f.make} ${f.model} (${f.rego.toUpperCase()})`;
      }
      if (cat === "pet") { Object.assign(details, { pet_type: f.petType, name: f.petName, breed: f.petBreed }); title = title || `Pet approval — ${f.petName || f.petType || "pet"}`; }
      if (f.detail.trim()) details.description = f.detail.trim();
      if (kind === "booking" && f.from) { details.date_from = f.from; details.date_to = f.to || f.from; }
      if (!title) title = (APP_CATS[kind].find((c) => c[0] === cat) || ["", "Request"])[1];
      const myUnit = null; // unit link resolved server-side reporting later; details carry unit text
      details.unit = (cat === "parking_permit" ? f.unit.trim() : "") || user.unit || "";
      const { data: s } = await supabase.auth.getSession();
      const uid = s && s.session ? s.session.user.id : null;
      const id = await createApplication(buildingId, uid, myUnit, kind, cat, title, details);
      for (const file of files) {
        const up = await uploadMedia(buildingId, "applications", file);
        await addApplicationAttachment(id, up);
      }
      setF({ title: "", detail: "", unit: "", make: "", model: "", colour: "", rego: "", from: "", to: "", petType: "", petName: "", petBreed: "" });
      setFiles([]);
      flash(kind === "booking" ? "Booking request sent to the committee" : "Application submitted — the committee has been alerted");
      reload();
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };
  const decide = async (id, ok) => {
    try {
      const { data: s } = await supabase.auth.getSession();
      await decideApplication(buildingId, id, ok, notes[id] || "", s && s.session ? s.session.user.id : null);
      flash(ok ? "Approved — the applicant has been notified" : "Declined — the applicant has been notified");
      reload();
    } catch (e) { flash(String(e.message || e)); }
  };
  const attsFor = (id) => atts.filter((a) => a.application_id === id);
  const permitFor = (id) => permits.find((p) => p.application_id === id);
  const openAtt = async (a) => { try { const u = await mediaUrl(a.storage_path); window.open(u, "_blank"); } catch (e) { flash("Couldn't open the file"); } };
  const queue = rows.filter((r) => ["submitted", "under_review"].includes(r.status));
  const cats = APP_CATS[kind];
  // ---- All requests: filters (v0.35.2). Base = search + type + decided-by + date; shown = base + status chip.
  // Counts read from base so the numbers beside a status chip agree with the search, as the Key Register does.
  const [fq, setFq] = useState(""); const [fType, setFType] = useState("all"); const [fStatus, setFStatus] = useState("all");
  const [fDecided, setFDecided] = useState("all"); const [fRange, setFRange] = useState("12m");
  const decidedBy = (r) => r.status === "approved" || r.status === "declined" ? (/^Decided by BCC vote/i.test(r.decision_note || "") ? "vote" : "direct") : "";
  const rangeFrom = (() => { if (fRange === "all") return null; const d = new Date(); d.setMonth(d.getMonth() - (fRange === "3m" ? 3 : fRange === "12m" ? 12 : 36)); return ymd(d); })();
  const norm = (v) => String(v || "").toLowerCase();
  const base = rows.filter((r) => {
    if (fType !== "all" && !(fType === "booking" ? r.kind === "booking" : r.kind === "application" && r.category === fType)) return false;
    if (fDecided !== "all" && decidedBy(r) !== fDecided) return false;
    if (rangeFrom && localDay(r.submitted_at) < rangeFrom) return false;
    if (fq.trim()) { const q = norm(fq); const unit = norm(r.details && r.details.unit); const hay = [r.title, r.category, r.decision_note, r.details && r.details.description, r.details && r.details.vehicle_rego, r.details && r.details.name].map(norm).join(" ");
      if (!(unit === q || unit === q.replace(/^unit\s*/, "") || hay.includes(q))) return false; }
    return true;
  });
  const statusCount = (st) => base.filter((r) => st === "awaiting" ? ["submitted", "under_review"].includes(r.status) : r.status === st).length;
  const shown = base.filter((r) => fStatus === "all" ? true : fStatus === "awaiting" ? ["submitted", "under_review"].includes(r.status) : r.status === fStatus);
  const filtering = fq.trim() || fType !== "all" || fStatus !== "all" || fDecided !== "all" || fRange !== "12m";
  const clearFilters = () => { setFq(""); setFType("all"); setFStatus("all"); setFDecided("all"); setFRange("12m"); };
  const typeLabel = (r) => r.kind === "booking" ? "Booking" : ((APP_CATS.application.find((c) => c[0] === r.category) || ["", r.category])[1]);
  const statusLabel = (st) => ({ submitted: "Awaiting", under_review: "Awaiting", approved: "Approved", declined: "Declined", withdrawn: "Withdrawn" }[st] || st);
  // AGM pack: the filtered list as a Word table, one row per request, conditions of approval beneath the row that carries them.
  const exportRequests = async () => {
    try {
      const K = [];
      const bname = (building && building.name) || "Building";
      const fromLbl = fRange === "all" ? "all time" : fRange === "3m" ? "last 3 months" : fRange === "12m" ? "last 12 months" : "last 3 years";
      K.push(rptP([{ text: "Applications & Bookings", bold: true, size: 32, color: RPT.navy }], { after: 20 }));
      K.push(rptP([{ text: `${bname} · ${shown.length} request${shown.length === 1 ? "" : "s"} · ${fromLbl}${fType !== "all" ? " · " + (fType === "booking" ? "Bookings" : (APP_CATS.application.find((c) => c[0] === fType) || ["", fType])[1]) : ""}${fStatus !== "all" ? " · " + (fStatus === "awaiting" ? "Awaiting" : statusLabel(fStatus)) : ""}${fDecided !== "all" ? (fDecided === "vote" ? " · decided by BCC vote" : " · approved directly") : ""}${fq.trim() ? " · matching “" + fq.trim() + "”" : ""}`, size: 18, color: RPT.muted }], { after: 160 }));
      const W = [1300, 1900, 900, 2300, 1000, 1600]; const TW = W.reduce((a, b) => a + b, 0);
      const hdr = ["Date", "Request", "Unit", "Decision", "Status", "Decided by"];
      const trs = [new DocxTR({ tableHeader: true, children: hdr.map((h, i) => rptCell([rptP([{ text: h, bold: true, size: 16, color: "FFFFFF" }])], { w: W[i], fill: RPT.navy, borders: { top: rptNoB(), bottom: rptNoB(), left: rptNoB(), right: rptNoB() } })) })];
      shown.forEach((r, i) => {
        const fill = i % 2 ? RPT.light : undefined; const db = decidedBy(r);
        const cells = [
          fmtDate(localDay(r.submitted_at)),
          `${r.title || r.category}${r.category === "parking_permit" && r.details ? ` — ${(r.details.vehicle_rego || "").toUpperCase()}` : ""}`,
          r.details && r.details.unit ? String(r.details.unit) : "—",
          r.decision_note || (r.decided_at ? fmtDate(localDay(r.decided_at)) : "—"),
          statusLabel(r.status),
          db === "vote" ? "BCC vote" : db === "direct" ? "Committee (direct)" : "—",
        ];
        trs.push(new DocxTR({ cantSplit: true, children: cells.map((c, j) => rptCell([rptP([{ text: c, size: 17, bold: j === 1 }])], { w: W[j], fill, borders: { top: rptNoB(), bottom: rptB(), left: rptNoB(), right: rptNoB() } })) }));
        const conds = r.status === "approved" && r.details && Array.isArray(r.details.conditions) ? r.details.conditions : [];
        if (conds.length) trs.push(new DocxTR({ cantSplit: true, children: [rptCell(conds.map((c, k) => rptP([{ text: `${k + 1}. ${c}`, size: 15, color: RPT.muted }], { after: 10 })), { w: TW, span: 6, fill, borders: { top: rptNoB(), bottom: rptB(), left: rptNoB(), right: rptNoB() } })] }));
      });
      K.push(new DocxTable({ width: { size: TW, type: DocxW.DXA }, columnWidths: W, rows: trs }));
      K.push(rptP([{ text: `Prepared from NaloHub on ${fmtDate(today())}. Every entry is backed by the in-app record: who applied, who decided, and when. Conditions of approval are shown beneath the request they bind.`, size: 13, color: RPT.muted }], { before: 200 }));
      const doc = new DocxDocument({ styles: { default: { document: { run: { font: "Calibri", size: 20, color: RPT.ink } } } }, sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children: K }] });
      const blob = await DocxPacker.toBlob(doc);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `Applications-${bname.replace(/[^\w]+/g, "-")}-${today()}.docx`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      flash("Word export downloaded");
    } catch (e) { flash(String(e.message || e)); }
  };
  return (
    <div>
      <Head title="Applications & Bookings" sub="Pets, lot improvements, parking permits and shared-space bookings" />
      <Wrap>
        {committee && <HowTo id="applications" steps={["Residents apply here — pets, lot improvements, parking permits, keys — with documents, quotes and photos attached.", "Pet, improvement and key applications open a BCC vote automatically, with standard Conditions of Approval the committee can amend on the record; parking permits you approve directly.", "Approvals notify the applicant instantly — and an approved parking permit generates its printable dash permit on the spot."]} sell="Applications stop being email attachments nobody can find — they arrive structured, route themselves to a vote, and close with conditions attached and a paper trail." />}
        <Card style={{ padding: 18 }}>
          <SectionTitle>New request</SectionTitle>
          <div className="flex gap-2 mb-3">{[["application", "Application"], ["booking", "Booking"]].map(([k, l]) => (
            <button key={k} onClick={() => { setKind(k); setCat(APP_CATS[k][0][0]); }} className="px-3.5 py-2 rounded-xl text-sm font-medium" style={{ background: kind === k ? `linear-gradient(90deg, ${T.accent}, ${T.accent2})` : T.surface, color: kind === k ? T.accentText : T.text, border: `1px solid ${kind === k ? "transparent" : T.border}` }}>{l}</button>))}
          </div>
          <div className="flex gap-2 flex-wrap mb-3">{cats.map(([k, l, Ic]) => (
            <button key={k} onClick={() => setCat(k)} className="px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5" style={{ background: cat === k ? hexToRgba(T.accent, 0.18) : T.surfaceAlt, color: cat === k ? T.accent : T.textMuted, border: `1px solid ${cat === k ? T.accent : T.border}` }}><Ic size={13} /> {l}</button>))}
          </div>
          <div className="space-y-3">
            {cat === "parking_permit" && (<>
              <Field label="Unit"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="e.g. 105" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vehicle make"><Input value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} placeholder="Toyota" /></Field>
                <Field label="Model"><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="RAV4" /></Field>
                <Field label="Colour"><Input value={f.colour} onChange={(e) => setF({ ...f, colour: e.target.value })} placeholder="White" /></Field>
                <Field label="Rego"><Input value={f.rego} onChange={(e) => setF({ ...f, rego: e.target.value })} placeholder="123ABC" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Permit from"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
                <Field label="Permit to"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
              </div>
            </>)}
            {cat === "pet" && (<div className="grid grid-cols-3 gap-3">
              <Field label="Pet type"><Input value={f.petType} onChange={(e) => setF({ ...f, petType: e.target.value })} placeholder="Dog" /></Field>
              <Field label="Name"><Input value={f.petName} onChange={(e) => setF({ ...f, petName: e.target.value })} placeholder="Rex" /></Field>
              <Field label="Breed"><Input value={f.petBreed} onChange={(e) => setF({ ...f, petBreed: e.target.value })} placeholder="Cavoodle" /></Field>
            </div>)}
            {kind === "booking" && (<div className="grid grid-cols-2 gap-3">
              <Field label="Date"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
              <Field label="To (optional)"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
            </div>)}
            <Field label="Title (optional)"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Short summary" /></Field>
            <Field label="Details"><Input value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} placeholder={cat === "lot_improvement" ? "Describe the works — attach quotes below" : "Anything the committee should know"} /></Field>
            <Field label="Attachments — documents, quotes, photos, video">
              <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))}
                style={{ color: T.textMuted }} className="text-sm" />
              {files.length > 0 && <div className="text-xs mt-1" style={{ color: T.textMuted }}><Paperclip size={12} className="inline" /> {files.map((x) => x.name).join(", ")}</div>}
            </Field>
            <Btn grad disabled={busy} onClick={submit}>{busy ? "Sending…" : kind === "booking" ? "Request booking" : "Submit application"}</Btn>
          </div>
        </Card>
        {committee && queue.length > 0 && (<>
          <SectionTitle>Awaiting decision ({queue.length})</SectionTitle>
          {queue.map((r) => (
            <Card key={r.id} style={{ padding: 16 }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.title || r.category}</div>
                  <div style={{ color: T.textMuted }} className="text-xs">{r.kind} · {r.category.replace(/_/g, " ")}{r.details && r.details.unit ? ` · Unit ${r.details.unit}` : ""} · {fmtDate(localDay(r.submitted_at))}</div>
                  {r.category === "parking_permit" && r.details && <div style={{ color: T.textMuted }} className="text-xs mt-1">{r.details.vehicle_make} {r.details.vehicle_model} · {r.details.vehicle_colour} · {(r.details.vehicle_rego || "").toUpperCase()} · {fmtDate(r.details.date_from)} → {fmtDate(r.details.date_to)}</div>}
                  {r.details && r.details.description && <div style={{ color: T.textMuted }} className="text-xs mt-1">{r.details.description}</div>}
                </div>
                <Badge color={APP_STATUS_COLOR(r.status)}>{r.status.replace(/_/g, " ")}</Badge>
              </div>
              {attsFor(r.id).length > 0 && <div className="flex gap-2 flex-wrap mt-2">{attsFor(r.id).map((a) => (<button key={a.id} onClick={() => openAtt(a)} className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1" style={{ background: T.surfaceAlt, color: T.accent, border: `1px solid ${T.border}` }}><Paperclip size={11} /> {a.file_name}</button>))}</div>}
              {r.kind === "application" && ["pet", "lot_improvement", "keys_access", "other"].includes(r.category)
                ? <div className="mt-3 text-sm flex items-center gap-2" style={{ color: T.textMuted }}><Vote size={15} style={{ color: T.accent }} /> This goes to a full BCC vote — cast yours in <b style={{ color: T.accent, cursor: "pointer" }} onClick={() => setView("voting")}>Voting</b>. The result decides it automatically.</div>
                : (<><div className="mt-3"><Input placeholder="Decision note (optional)" value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} /></div>
              <div className="flex gap-2 mt-2.5"><Btn grad onClick={() => decide(r.id, true)}><Check size={15} /> Approve</Btn><Btn kind="ghost" onClick={() => decide(r.id, false)}><X size={15} /> Decline</Btn></div></>)}
            </Card>))}
        </>)}
        <SectionTitle>{committee ? "All requests" : "Your requests"}</SectionTitle>
        {!loading && rows.length > 0 && (() => {
          const chip = (on, label, onClick, count) => (<button key={label} onClick={onClick} className="px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5" style={{ background: on ? T.accent : T.surfaceAlt, color: on ? T.accentText : T.text, border: `1px solid ${on ? T.accent : T.border}` }}>{label}{count != null && <span className="rounded-full px-1.5" style={{ background: on ? hexToRgba("#FFFFFF", 0.25) : T.surface, fontSize: 10 }}>{count}</span>}</button>);
          return (<Card style={{ padding: 14 }}>
            <div className="flex gap-2 items-center">
              <Input placeholder="Search unit, name, rego or words in the request" value={fq} onChange={(e) => setFq(e.target.value)} />
              {filtering && <Btn kind="ghost" onClick={clearFilters}><X size={14} /> Clear</Btn>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {chip(fType === "all", "All types", () => setFType("all"))}
              {APP_CATS.application.map(([k, l]) => chip(fType === k, l, () => setFType(fType === k ? "all" : k)))}
              {chip(fType === "booking", "Bookings", () => setFType(fType === "booking" ? "all" : "booking"))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[["all", "Any status"], ["awaiting", "Awaiting"], ["approved", "Approved"], ["declined", "Declined"], ["withdrawn", "Withdrawn"]].map(([k, l]) => chip(fStatus === k, l, () => setFStatus(fStatus === k ? "all" : k), k === "all" ? base.length : statusCount(k)))}
            </div>
            {committee && <div className="flex flex-wrap gap-1.5 mt-2 items-center">
              <span className="text-[11px] mr-1" style={{ color: T.textMuted }}>Decided by</span>
              {[["all", "Any"], ["vote", "BCC vote"], ["direct", "Committee direct"]].map(([k, l]) => chip(fDecided === k, l, () => setFDecided(k)))}
              <span className="text-[11px] ml-2 mr-1" style={{ color: T.textMuted }}>Submitted</span>
              {[["3m", "3 months"], ["12m", "12 months"], ["36m", "3 years"], ["all", "All time"]].map(([k, l]) => chip(fRange === k, l, () => setFRange(k)))}
            </div>}
            <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: `1px solid ${T.border}` }}>
              <div className="text-xs" style={{ color: T.textMuted }}>{shown.length} of {rows.length} request{rows.length === 1 ? "" : "s"}{filtering ? " matching" : ""}{fq.trim() ? ` “${fq.trim()}”` : ""}</div>
              {committee && shown.length > 0 && <Btn onClick={exportRequests}><Download size={14} /> Export for AGM pack</Btn>}
            </div>
          </Card>); })()}
        {loading && <Card style={{ padding: 16 }}><div style={{ color: T.textMuted }}>Loading…</div></Card>}
        {!loading && rows.length === 0 && <Empty icon={CalendarCheck} title="Nothing here yet" hint="Submit an application or booking above — the committee is alerted the moment it lands." />}
        {!loading && rows.length > 0 && shown.length === 0 && <Empty icon={CalendarCheck} title="No requests match" hint="Try another type or status, widen the date range, or clear the filters." />}
        {shown.map((r) => { const p = r.category === "parking_permit" && r.status === "approved" ? permitFor(r.id) : null; return (
          <Card key={r.id} style={{ padding: 16 }}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{r.title || r.category}</div>
                <div style={{ color: T.textMuted }} className="text-xs">{typeLabel(r)}{r.details && r.details.unit ? ` · Unit ${r.details.unit}` : ""} · {fmtDate(localDay(r.submitted_at))}{decidedBy(r) ? ` · ${decidedBy(r) === "vote" ? "BCC vote" : "committee"}` : ""}{r.decision_note ? ` — “${r.decision_note}”` : ""}</div>
              </div>
              <Badge color={APP_STATUS_COLOR(r.status)}>{r.status.replace(/_/g, " ")}</Badge>
            </div>
            {attsFor(r.id).length > 0 && <div className="flex gap-2 flex-wrap mt-2">{attsFor(r.id).map((a) => (<button key={a.id} onClick={() => openAtt(a)} className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1" style={{ background: T.surfaceAlt, color: T.accent, border: `1px solid ${T.border}` }}><Paperclip size={11} /> {a.file_name}</button>))}</div>}
            {r.status === "approved" && r.details && r.details.conditions && r.details.conditions.length > 0 && (<div className="mt-2 rounded-xl p-2.5" style={{ background: T.surfaceAlt, border: `1px solid ${hexToRgba(SEMANTIC.ok, 0.35)}` }}>
              <div className="text-[11px] font-bold mb-1" style={{ color: SEMANTIC.ok }}>CONDITIONS OF APPROVAL</div>
              {r.details.conditions.map((c, i) => (<div key={i} className="text-xs py-0.5" style={{ color: T.textMuted }}>{i + 1}. {c}</div>))}
            </div>)}
            {p && <div className="mt-3"><Btn onClick={() => openPermitPdf(p.id).catch(() => flash("Couldn't generate the permit PDF"))}><Download size={15} /> Permit {p.permit_no} — download PDF</Btn></div>}
          </Card>); })}
      </Wrap>
    </div>
  );
}

// ---------- unit search (committee) ------------------------------------------
const btrimU = (s) => String(s || "").trim().toLowerCase();
// Managing agent for a tenanted unit — editable in place
function ManagingAgentCard({ hc, onSaved }) {
  const { T, buildingId, flash } = useApp();
  const hasTenant = (hc.people || []).some((p) => p.person_type === "tenant") || (hc.residents_directory || []).some((m) => m.role === "tenant");
  const [edit, setEdit] = useState(false);
  const [a, setA] = useState({ business: hc.unit.agent_business || "", contact: hc.unit.agent_contact || "", phone: hc.unit.agent_phone || "", email: hc.unit.agent_email || "", note: hc.unit.agent_note || "" });
  useEffect(() => { setA({ business: hc.unit.agent_business || "", contact: hc.unit.agent_contact || "", phone: hc.unit.agent_phone || "", email: hc.unit.agent_email || "", note: hc.unit.agent_note || "" }); setEdit(false); }, [hc.unit.id]);
  // Previously hidden unless a tenant existed, which left nowhere to record an
  // agent you already knew about. Now always offered; the prompt just adapts.
  const empty = !hc.unit.agent_business && !hc.unit.agent_contact && !hc.unit.agent_email;
  const save = async () => {
    try { await updateUnitAgent(buildingId, hc.unit.id, a); setEdit(false); flash("Managing agent saved"); onSaved && onSaved(); }
    catch (e) { flash(String(e.message || e)); }
  };
  return (
    <Card style={{ padding: 16 }}>
      <div className="flex items-center"><SectionTitle>Managing agent</SectionTitle><button onClick={() => setEdit(!edit)} className="ml-auto text-xs" style={{ color: T.accent }}><Pencil size={13} className="inline" /> {edit ? "Cancel" : "Edit"}</button></div>
      {!edit && empty && (<div className="text-sm" style={{ color: T.textMuted }}>{hasTenant ? "This unit is tenanted but no managing agent is recorded. Tap Edit to add one." : "No managing agent recorded. Tap Edit to add one, even before a tenant is on the register."}</div>)}
      {!edit && !empty && (hc.unit.agent_business
        ? <div className="text-sm"><div className="font-medium">{hc.unit.agent_business}</div><div className="text-xs" style={{ color: T.textMuted }}>{[hc.unit.agent_contact, hc.unit.agent_phone, hc.unit.agent_email].filter(Boolean).join(" · ")}</div>{hc.unit.agent_note && <div className="text-xs mt-1 italic" style={{ color: T.textMuted }}>{hc.unit.agent_note}</div>}</div>
        : <div className="text-sm" style={{ color: T.textMuted }}>This unit is leased/tenanted, so it usually has a managing agent (the real-estate property manager). <button onClick={() => setEdit(true)} className="font-semibold inline-flex items-center gap-1" style={{ color: T.accent }}><Plus size={13} /> Add managing agent</button></div>)}
      {edit && (<div className="space-y-2.5">
        <Field label="Real estate agent"><Input value={a.business} onChange={(e) => setA({ ...a, business: e.target.value })} placeholder="Coastal Property Management" /></Field>
        <Field label="Contact person"><Input value={a.contact} onChange={(e) => setA({ ...a, contact: e.target.value })} placeholder="e.g. Mia Chen" /></Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Mobile"><Input value={a.phone} onChange={(e) => setA({ ...a, phone: e.target.value })} placeholder="04xx xxx xxx" /></Field>
          <Field label="Email"><Input value={a.email} onChange={(e) => setA({ ...a, email: e.target.value })} placeholder="agent@example.com" /></Field>
        </div>
        <Field label="Note"><TextArea rows={2} value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })} placeholder="e.g. Lease ends March; contact agent for entry or access." /></Field>
        <Btn grad onClick={save}>Save agent</Btn>
      </div>)}
    </Card>
  );
}
// Type a unit number, get the lot's complete story: people, pets, vehicles,
// keys & fobs, by-law breaches, disputes and applications, in one view.
// ---------- Correspondence Hub (committee / MSC / manager only) --------------
// Two-way email record with external parties (strata manager, insurer, solicitor,
// council, contractor…). Reads come from the RLS-protected correspondence tables;
// sending routes through the `send-correspondence` edge function. Messages are
// APPEND-ONLY — the UI never edits or hard-deletes them. Backend-only, modelled on
// UnitSearchView; in demo mode the db stubs return empty and nothing is called.
// Ordered by how often a committee actually deals with each party, not
// alphabetically and not by the enum's historical sort order: this object's key
// order is what every party dropdown renders. "Resident tenant" and "Building
// manager" were missing entirely, so both were being filed as Other, which is
// how all 8 existing contacts ended up there. "Agent" was ambiguous in strata
// (real-estate agent? letting agent? the strata manager's agent?) and is now
// "Managing agent", renamed at the database level too (migration 0017).
const CORR_PARTY = {
  owner: "Owner", resident_tenant: "Resident tenant", managing_agent: "Managing agent",
  building_manager: "Building manager", strata_manager: "Strata manager",
  contractor: "Contractor", insurer: "Insurer", solicitor: "Solicitor",
  auditor: "Auditor", council: "Council", other: "Other",
};
const CORR_CONTEXT = { general: "General", maintenance: "Maintenance", contract: "Contract", compliance: "Compliance", dispute: "Dispute", application: "Application" };
const CORR_STATUS = { open: { label: "Open", c: "#3b82f6" }, awaiting_reply: { label: "Awaiting reply", c: SEMANTIC.warn }, closed: { label: "Closed", c: SEMANTIC.ok } };
const CORR_MAX_ATTACH = 20 * 1024 * 1024; // 20 MB per file — larger files should be linked, not attached
const corrDelivery = (s) => s === "sent" || s === "delivered" ? SEMANTIC.ok : s === "failed" ? SEMANTIC.bad : SEMANTIC.warn;
const corrMB = (n) => `${(n / 1048576).toFixed(n > 1048576 ? 1 : 2)} MB`;
// corr_search marks matched runs with guillemets, never HTML (migration 0016).
// Splitting and rendering as JSX keeps inbound email bodies out of innerHTML —
// the 5 Aug XSS review left zero raw-HTML sinks in this file, and this
// feature does not get to be the exception. Real bodies contain angle brackets.
const corrSnippet = (str) => String(str || "").split(/[\u00ab\u00bb]/)
  .map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>));

const corrWhen = (iso) => { if (!iso) return ""; const d = new Date(String(iso).replace(" ", "T")); const day = fmtDate(localDay(iso)); return isNaN(d.getTime()) ? day : `${day} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`; };
const fileToCorrAttachment = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => { const s = String(r.result || ""); resolve({ filename: file.name, mime: file.type || "application/octet-stream", contentBase64: s.includes(",") ? s.slice(s.indexOf(",") + 1) : s, size: file.size }); };
  r.onerror = () => reject(new Error("Could not read " + file.name));
  r.readAsDataURL(file);
});

// Render inbound HTML email as safe plain text. Never inject third-party HTML
// into the DOM — an HTML-only email to a building's public address would
// otherwise run scripts in a committee member's session (stored XSS).
const htmlToText = (html) => {
  let s = String(html || "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#0?39;/g, "'");
  return s.replace(/\n{3,}/g, "\n\n").trim();
};
function CorrespondenceView() {
  const { T, user, building, buildingId, backend, flash, store } = useApp();
  const [mode, setMode] = useState("list");          // list | thread | compose | contacts | unfiled
  const [threads, setThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [open, setOpen] = useState(null);            // { thread, messages }
  const [busy, setBusy] = useState(false);
  const [fStatus, setFStatus] = useState("");        // status filter
  const [fParty, setFParty] = useState("");          // party-type filter
  const [reply, setReply] = useState("");
  const [rFiles, setRFiles] = useState([]);
  const [cf, setCf] = useState({ contactId: "", name: "", email: "", org: "", partyType: "other", subject: "", body: "", contextType: "general", contextId: "", visibility: "committee", memberIds: [] });
  const [cFiles, setCFiles] = useState([]);
  const [ct, setCt] = useState({ id: "", name: "", org: "", email: "", phone: "", partyType: "other", notes: "" });
  const [unfiled, setUnfiled] = useState([]);
  const [assignTo, setAssignTo] = useState({});
  const [cq, setCq] = useState("");                  // correspondence search box
  const [cres, setCres] = useState(null);            // null = not searching
  const [csearching, setCsearching] = useState(false);
  const [uq, setUq] = useState("");                  // unfiled tray filter
  const [newFor, setNewFor] = useState(null);        // raw id being filed as a new thread
  const [nf, setNf] = useState({ contactName: "", partyType: "other", org: "", subject: "" });

  const members = (store.users || []).filter((m) => m.buildingId === buildingId && m.authId);

  // The building's sending identity, shown so the sender always knows who this goes out as.
  const senderIdentity = building && building.name ? `${building.name} via NaloHub` : "your building via NaloHub";
  // Auto-signature appended to the body — editable, so a sender can drop their phone if they prefer.
  const signature = () => {
    const l = [user && user.name, user && user.phone, user && user.email].filter(Boolean);
    if (building && building.name) l.push(`${building.name} @ NaloHub`);
    return l.length ? "\n\n" + l.join("\n") : "";
  };
  const blankCompose = () => ({ contactId: "", name: "", email: "", org: "", partyType: "other", subject: "", body: signature(), contextType: "general", contextId: "", visibility: "committee", memberIds: [] });
  const openCompose = () => { setCf(blankCompose()); setCFiles([]); setMode("compose"); };

  // Load in both backend and demo — but only for roles allowed to see correspondence
  // (committee, building manager, MSC). This mirrors the app's RLS in the demo too.
  const canView = canSeeCorr(user, building);
  const loadUnfiled = () => { if (!canView) return; listCorrUnfiled(buildingId).then(setUnfiled).catch(() => {}); };
  const refresh = () => { if (!canView) return; listCorrThreads(buildingId).then(setThreads).catch((e) => flash(String(e.message || e))); listCorrContacts(buildingId).then(setContacts).catch(() => {}); loadUnfiled(); };
  useEffect(() => { setMode("list"); setOpen(null); refresh(); }, [buildingId, backend]);

  const runSearch = async (term) => {
    const t = String(term === undefined ? cq : term).trim();
    if (!t) { setCres(null); return; }
    setCsearching(true);
    try { setCres(await searchCorrespondence(buildingId, t)); }
    catch (e) { flash(String(e.message || e)); setCres([]); }
    setCsearching(false);
  };
  const clearSearch = () => { setCq(""); setCres(null); };

  const startNewThread = (u) => {
    setNewFor(u.id);
    setNf({ contactName: u.fromName || u.fromEmail || "", partyType: "other", org: "", subject: u.subject || "" });
  };
  const fileAsNewThread = async (u) => {
    setBusy(true);
    try {
      const tid = await fileCorrUnfiledNewThread(u.id, nf);
      flash("Filed as a new thread");
      setNewFor(null);
      loadUnfiled();
      listCorrThreads(buildingId).then(setThreads).catch(() => {});
      listCorrContacts(buildingId).then(setContacts).catch(() => {});
      if (tid) openThread(tid);
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };

  const assignUnfiled = async (rawId, threadId) => {
    // Was a bare `return`, so the button looked dead when no thread was picked —
    // and with no threads yet the picker was empty, which is every building's
    // first inbound email. See the v0.29.2 audit note on bare returns.
    if (!threadId) { flash("Pick a thread first, or use 'File as a new thread'."); return; }
    setBusy(true);
    try { await fileCorrUnfiled(rawId, threadId); flash("Filed to thread"); loadUnfiled(); refresh(); }
    catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };

  const openThread = async (id) => { setBusy(true); try { const d = await getCorrThread(id); setOpen(d); setReply(signature()); setRFiles([]); setMode("thread"); } catch (e) { flash(String(e.message || e)); } setBusy(false); };

  const addFiles = async (fileList, setter, current) => {
    const out = [];
    for (const f of Array.from(fileList || [])) {
      if (f.size > CORR_MAX_ATTACH) { flash(`${f.name} is over 20 MB — share it as a link instead`); continue; }
      try { out.push(await fileToCorrAttachment(f)); } catch (e) { flash(String(e.message || e)); }
    }
    if (out.length) setter([...current, ...out]);
  };
  const attachPayload = (files) => files.length ? files.map(({ filename, mime, contentBase64 }) => ({ filename, mime, contentBase64 })) : undefined;

  const sendNew = async () => {
    if (!cf.subject.trim()) return flash("Add a subject");
    if (!cf.contactId && !cf.email.trim()) return flash("Pick a contact or enter a recipient email");
    if (cf.visibility === "restricted" && cf.memberIds.length === 0) return flash("Choose who can see this restricted thread");
    setBusy(true);
    try {
      const contact = cf.contactId ? { id: cf.contactId } : { name: cf.name.trim() || cf.email.trim(), email: cf.email.trim(), org: cf.org.trim() || undefined, party_type: cf.partyType };
      const payload = { buildingId, contact, subject: cf.subject.trim(), bodyText: cf.body, contextType: cf.contextType, contextId: cf.contextId.trim() || undefined, visibility: cf.visibility, attachments: attachPayload(cFiles) };
      if (cf.visibility === "restricted") payload.restrictedMemberIds = cf.memberIds;
      const res = await sendCorrespondence(payload);
      flash(res && res.deliveryStatus === "failed" ? "Logged, but delivery failed — check Resend" : "Sent");
      setCf(blankCompose());
      setCFiles([]); refresh();
      if (res && res.threadId) await openThread(res.threadId);
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };

  const sendReply = async () => {
    if (!reply.trim() && rFiles.length === 0) return;
    setBusy(true);
    try {
      const t = open.thread;
      const res = await sendCorrespondence({ buildingId, threadId: t.id, subject: t.subject, bodyText: reply, attachments: attachPayload(rFiles) });
      flash(res && res.deliveryStatus === "failed" ? "Logged, but delivery failed — check Resend" : "Reply sent");
      await openThread(t.id); refresh();
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };

  const changeStatus = async (s) => { try { await updateCorrThread(open.thread.id, { status: s }); await openThread(open.thread.id); refresh(); } catch (e) { flash(String(e.message || e)); } };
  const openAttachment = async (path) => { try { const url = await corrAttachmentUrl(path); if (url) window.open(url, "_blank"); } catch (e) { flash("Couldn't open the attachment — try again"); } };

  // Print a clean, paper-friendly copy of the whole thread.
  const printThread = () => {
    if (!open) return;
    const t = open.thread;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const fromAddr = (open.messages.find((m) => m.direction === "outbound") || {}).fromEmail || "";
    const rows = open.messages.map((m) => {
      const who = m.direction === "outbound" ? senderIdentity : (m.fromName || m.fromEmail || "Received");
      const isHtml = !m.bodyText && !!m.bodyHtml;
      const body = m.deletedAt ? "[Message removed]" : (m.bodyText || m.bodyHtml || "(no body)");
      const atts = (m.attachments || []).map((a) => `<div class="att">📎 ${esc(a.fileName)}</div>`).join("");
      return `<div class="msg ${m.direction}"><div class="meta"><strong>${esc(who)}</strong> · ${esc(m.direction)} · ${esc(corrWhen(m.createdAt))}${m.deliveryStatus ? " · " + esc(m.deliveryStatus) : ""}</div><div class="body">${esc(isHtml ? htmlToText(body) : body)}</div>${atts}</div>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.subject || "Correspondence")}</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px;}
      h1{font-size:18px;margin:0 0 6px;} .hdr{font-size:13px;color:#333;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px;}
      .hdr div{margin:2px 0;} .msg{border:1px solid #ddd;border-radius:8px;padding:10px 12px;margin:10px 0;page-break-inside:avoid;}
      .msg.outbound{background:#f4f8ff;} .meta{font-size:11px;color:#555;margin-bottom:6px;} .body{font-size:13px;white-space:pre-wrap;word-wrap:break-word;}
      .att{font-size:11px;color:#555;margin-top:6px;} .foot{margin-top:18px;font-size:11px;color:#777;border-top:1px solid #ccc;padding-top:8px;}</style></head>
      <body><h1>${esc(t.subject || "(no subject)")}</h1>
      <div class="hdr"><div><strong>From:</strong> ${esc(senderIdentity)}${fromAddr ? ` &lt;${esc(fromAddr)}&gt;` : ""}</div>
      <div><strong>To:</strong> ${esc(t.contact ? t.contact.name : "")}${t.contact && t.contact.email ? ` &lt;${esc(t.contact.email)}&gt;` : ""}</div>
      <div><strong>Status:</strong> ${esc(CORR_STATUS[t.status]?.label || t.status)}${t.visibility === "restricted" ? " · Restricted" : ""}</div></div>
      ${rows}
      <div class="foot">${esc(building && building.name ? building.name : "")} · Correspondence record via NaloHub · printed ${esc(new Date().toLocaleString())}</div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { flash("Allow pop-ups to print this thread"); return; }
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch (_e) {} }, 350);
  };

  const saveContact = async () => {
    if (!ct.name.trim()) return flash("Add a name");
    try { await saveCorrContact(buildingId, { id: ct.id || undefined, name: ct.name.trim(), org: ct.org.trim(), email: ct.email.trim(), phone: ct.phone.trim(), partyType: ct.partyType, notes: ct.notes.trim() }); flash(ct.id ? "Contact updated" : "Contact added"); setCt({ id: "", name: "", org: "", email: "", phone: "", partyType: "other", notes: "" }); refresh(); }
    catch (e) { flash(String(e.message || e)); }
  };

  const AttachChips = ({ items, onRemove }) => items.length ? (
    <div className="flex flex-wrap gap-1.5 mt-2">{items.map((a, i) => (
      <span key={i} className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1.5" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.textMuted }}>
        <Paperclip size={11} /> {a.filename} · {corrMB(a.size)}
        {onRemove && <button onClick={() => onRemove(i)} style={{ color: T.textMuted }}><X size={12} /></button>}
      </span>))}</div>) : null;

  // Restricted threads are visible only to the committee proper (BCC/admin), mirroring RLS —
  // the building manager and MSC see committee threads but not restricted ones.
  const roleThreads = threads.filter((t) => t.visibility !== "restricted" || isCommittee(user.role));
  const shownUnfiled = unfiled.filter((u) => {
    const needle = uq.trim().toLowerCase();
    return !needle || [u.fromName, u.fromEmail, u.subject].filter(Boolean).join(" ").toLowerCase().includes(needle);
  });
  const shown = roleThreads.filter((t) => (!fStatus || t.status === fStatus) && (!fParty || (t.contact && t.contact.partyType === fParty)));
  if (!canView) return null;

  // ---- list ----------------------------------------------------------------
  if (mode === "list") return (
    <div>
      <Head title="Correspondence" sub="The building's paper trail with strata, insurers, solicitors & trades" action={<HeaderAction onClick={openCompose}><Plus size={15} /> New</HeaderAction>} />
      <Wrap>
        <HowTo id="correspondence" steps={["Compose a message to any external party — strata manager, insurer, solicitor, council, contractor. It sends by email from your building's address and every word is logged here.", "Replies thread back automatically: when they reply, it lands on the same conversation, so the whole exchange lives in one place.", "Mark threads restricted when only some committee members should see them, and close them when they're done. Nothing here can be edited or deleted — it's a permanent, tamper-evident record."]} sell="The correspondence that used to scatter across personal inboxes — now one shared, permanent record the whole committee can stand behind." />
        {!backend && <div className="rounded-xl px-3.5 py-2.5 mb-3 text-xs" style={{ background: hexToRgba(SEMANTIC.warn, T.mode === "dark" ? 0.14 : 0.1), color: T.textMuted, border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.3)}` }}><b style={{ color: T.text }}>Demo mode — simulated.</b> These are sample threads. Sending and replies here are simulated — no real email goes out — and everything resets when you reload.</div>}
        <div className="flex flex-wrap gap-2 items-center">
          <Btn grad data-guide="g-corr-new" onClick={openCompose}><Plus size={15} /> New message</Btn>
          <Btn kind="ghost" onClick={() => setMode("contacts")}><Users size={15} /> Contacts</Btn>
          <Btn kind="ghost" onClick={() => { loadUnfiled(); setMode("unfiled"); }}><Inbox size={15} /> Unfiled{unfiled.length ? ` (${unfiled.length})` : ""}</Btn>
          <div className="flex-1" />
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All statuses</option>{Object.keys(CORR_STATUS).map((k) => <option key={k} value={k}>{CORR_STATUS[k].label}</option>)}</Select>
          <Select value={fParty} onChange={(e) => setFParty(e.target.value)}><option value="">All parties</option>{Object.keys(CORR_PARTY).map((k) => <option key={k} value={k}>{CORR_PARTY[k]}</option>)}</Select>
        </div>
        <Card style={{ padding: 14 }}>
          <div className="flex items-center gap-2">
            <Search size={15} style={{ color: T.textMuted, flexShrink: 0 }} />
            <Input placeholder="Search a sender, a subject, or anything said in an email…" value={cq}
              onChange={(e) => { setCq(e.target.value); if (!e.target.value.trim()) setCres(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} />
            {cq ? <Btn kind="ghost" onClick={clearSearch}><X size={14} /></Btn> : null}
            <Btn grad disabled={!cq.trim() || csearching} onClick={() => runSearch()}>{csearching ? "Searching…" : "Search"}</Btn>
          </div>
        </Card>

        {cres !== null ? (<div className="space-y-3">
          <div className="text-sm flex items-center gap-2 flex-wrap" style={{ color: T.textMuted }}>
            <span>{cres.length === 0 ? "Nothing matches" : `${cres.length} result${cres.length === 1 ? "" : "s"} for`}</span>
            <span className="font-semibold" style={{ color: T.text }}>{cq.trim()}</span>
            <button onClick={clearSearch} className="text-xs font-semibold underline" style={{ color: T.accent }}>Clear</button>
          </div>
          {cres.length === 0
            ? <Empty icon={Search} title="No match" hint="Search looks at the subject, the party's name, email and organisation, and the words inside every email on record." />
            : <Card style={{ padding: 8 }}>{cres.map((r, i) => (
              <button key={(r.messageId || r.threadId) + "-" + i} onClick={() => openThread(r.threadId)} className="w-full text-left px-3 py-3 rounded-xl" style={{ borderBottom: `1px dashed ${T.border}` }}>
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-[15px] flex-1 leading-tight">{r.contactName || "Unknown party"}</div>
                  <Badge color={r.matchedIn === "message" ? T.accent : SEMANTIC.warn}>{r.matchedIn === "message" ? "in the email" : "subject or party"}</Badge>
                </div>
                <div className="text-sm mt-0.5">{r.threadSubject || "(no subject)"}</div>
                {r.snippet ? <div className="text-xs mt-1 leading-relaxed" style={{ color: T.textMuted }}>{corrSnippet(r.snippet)}</div> : null}
                <div className="text-xs mt-1" style={{ color: T.textMuted }}>
                  {r.direction === "inbound" ? "Received" : r.direction === "outbound" ? "Sent" : "Thread"} · {corrWhen(r.occurredAt)}
                </div>
              </button>))}</Card>}
        </div>) : shown.length === 0 ? (<div className="space-y-3"><Empty icon={Mail} title="No correspondence yet" hint="Send your first tracked email to an external party, or file something from the Unfiled tray — both are logged here." /><div className="text-center"><Btn grad onClick={openCompose}><Plus size={15} /> New correspondence</Btn></div></div>)
          : <Card style={{ padding: 8 }}>{shown.map((t) => (
            <button key={t.id} onClick={() => openThread(t.id)} className="w-full text-left px-3 py-3 rounded-xl" style={{ borderBottom: `1px dashed ${T.border}` }}>
              <div className="flex items-center gap-2">
                <div className="font-semibold text-[15px] flex-1 leading-tight">{t.contact ? t.contact.name : "Unknown party"}{t.contact && t.contact.org ? <span style={{ color: T.textMuted }} className="font-normal"> · {t.contact.org}</span> : null}</div>
                <Badge color={CORR_STATUS[t.status]?.c}>{CORR_STATUS[t.status]?.label || t.status}</Badge>
                {t.visibility === "restricted" && <Badge color={SEMANTIC.warn}><Lock size={10} /> Restricted</Badge>}
              </div>
              <div className="text-sm mt-0.5">{t.subject || "(no subject)"}</div>
              <div className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: T.textMuted }}>
                {t.contact && t.contact.partyType && <span>{CORR_PARTY[t.contact.partyType] || t.contact.partyType}</span>}
                {t.contextType && t.contextType !== "general" && <span className="inline-flex items-center gap-1"><Tag size={11} /> {CORR_CONTEXT[t.contextType] || t.contextType}</span>}
                <span>· {fmtDate(localDay(t.lastActivityAt || t.createdAt))}</span>
              </div>
            </button>))}</Card>}
      </Wrap>
    </div>
  );

  // ---- thread --------------------------------------------------------------
  if (mode === "thread" && open) {
    const t = open.thread;
    const fromAddr = (open.messages.find((m) => m.direction === "outbound") || {}).fromEmail || "";
    return (
      <div>
        <Head title={t.contact ? t.contact.name : "Conversation"} sub={t.contact ? ([t.contact.org, CORR_PARTY[t.contact.partyType]].filter(Boolean).join(" · ") || "Correspondence") : "Correspondence"} onBack={() => { setMode("list"); refresh(); }} backLabel="Correspondence" />
        <Wrap>
          <Card style={{ padding: 16 }}>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.textMuted }}>From</span><span className="font-medium">{senderIdentity}</span>{fromAddr && <span style={{ color: T.textMuted }}>&lt;{fromAddr}&gt;</span>}</div>
              <div className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.textMuted }}>To</span><span className="font-medium">{t.contact ? t.contact.name : "—"}</span>{t.contact && t.contact.email && <span style={{ color: T.textMuted }}>&lt;{t.contact.email}&gt;</span>}</div>
              <div className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.textMuted }}>Subject</span><span className="font-medium">{t.subject || "(no subject)"}</span></div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: `1px solid ${T.border}` }}>
              {t.visibility === "restricted" && <Badge color={SEMANTIC.warn}><Lock size={10} /> Restricted</Badge>}
              <Btn kind="ghost" onClick={printThread}><Printer size={14} /> Print</Btn>
              <div className="flex-1" />
              <span className="text-xs" style={{ color: T.textMuted }}>Status</span>
              <div style={{ width: 170 }}><Select value={t.status} onChange={(e) => changeStatus(e.target.value)}>{Object.keys(CORR_STATUS).map((k) => <option key={k} value={k}>{CORR_STATUS[k].label}</option>)}</Select></div>
            </div>
          </Card>
          <div className="space-y-3">
            {open.messages.map((m) => {
              const out = m.direction === "outbound";
              return (
                <div key={m.id} className="flex" style={{ justifyContent: out ? "flex-end" : "flex-start" }}>
                  <div className="max-w-[85%] rounded-2xl px-4 py-3" style={{ background: out ? hexToRgba(T.accent, T.mode === "dark" ? 0.16 : 0.10) : T.surfaceAlt, border: `1px solid ${out ? hexToRgba(T.accent, 0.35) : T.border}` }}>
                    <div className="text-xs mb-1 flex items-center gap-2 flex-wrap" style={{ color: T.textMuted }}>
                      <span className="font-semibold" style={{ color: T.text }}>{out ? "Sent" : (m.fromName || m.fromEmail || "Received")}</span>
                      <span>· {corrWhen(m.createdAt)}</span>
                      {out && <Badge color={corrDelivery(m.deliveryStatus)}>{m.deliveryStatus}</Badge>}
                    </div>
                    {m.deletedAt ? <div className="text-sm italic" style={{ color: T.textMuted }}>Message removed</div>
                      : <div className="text-sm whitespace-pre-wrap">{m.bodyText || (m.bodyHtml ? htmlToText(m.bodyHtml) : <span style={{ color: T.textMuted }}>(no body)</span>)}</div>}
                    {(m.attachments || []).map((a) => (
                      <button key={a.id} onClick={() => openAttachment(a.storagePath)} className="text-xs mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.accent }}>
                        <Paperclip size={11} /> {a.fileName}{a.size ? ` · ${corrMB(a.size)}` : ""}
                      </button>))}
                  </div>
                </div>);
            })}
          </div>
          {t.status !== "closed" && (
            <Card style={{ padding: 16 }}>
              <SectionTitle>Reply to {t.contact ? t.contact.name : "this thread"}</SectionTitle>
              <div className="text-xs mb-2" style={{ color: T.textMuted }}>Goes to {t.contact && t.contact.email ? t.contact.email : "the recipient"} · subject stays “{t.subject || "(no subject)"}” · sends as {senderIdentity}</div>
              <TextArea rows={6} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${t.contact ? t.contact.name : "this thread"}…`} />
              <AttachChips items={rFiles} onRemove={(i) => setRFiles(rFiles.filter((_, x) => x !== i))} />
              <div className="flex items-center gap-2 mt-3">
                <label className="text-sm cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ border: `1px solid ${T.border}`, color: T.textMuted }}><Paperclip size={14} /> Attach<input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files, setRFiles, rFiles)} /></label>
                <div className="flex-1" />
                <Btn grad disabled={busy} onClick={sendReply}><Send size={15} /> {busy ? "Sending…" : "Send reply"}</Btn>
              </div>
            </Card>)}
          <div className="pt-1"><BackLink onClick={() => { setMode("list"); refresh(); }} label="Back to Correspondence" /></div>
        </Wrap>
      </div>
    );
  }

  // ---- compose -------------------------------------------------------------
  if (mode === "compose") return (
    <div>
      <Head title="New correspondence" sub="Send a tracked email to an external party" onBack={() => setMode("list")} backLabel="Correspondence" />
      <Wrap>
        <Card style={{ padding: 18 }} >
          <div className="space-y-3">
            <div className="rounded-xl px-3.5 py-3 text-sm flex items-start gap-2.5" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.12 : 0.07), border: `1px solid ${hexToRgba(T.accent, 0.3)}` }}>
              <Send size={16} style={{ color: T.accent, marginTop: 1 }} className="shrink-0" />
              <div>Sends as <span className="font-semibold">{senderIdentity}</span>. Replies come straight back into this thread — recorded here for the whole committee, never lost in a personal inbox.</div>
            </div>
            <Field label="To — recipient"><Select value={cf.contactId} onChange={(e) => setCf({ ...cf, contactId: e.target.value })}><option value="">— New recipient —</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.org ? ` · ${c.org}` : ""}{c.email ? ` · ${c.email}` : ""}</option>)}</Select></Field>
            {!cf.contactId && (<div className="grid sm:grid-cols-2 gap-3">
              <Field label="Name"><Input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} placeholder="e.g. Definitive Strata" /></Field>
              <Field label="Email"><Input type="email" value={cf.email} onChange={(e) => setCf({ ...cf, email: e.target.value })} placeholder="name@example.com" /></Field>
              <Field label="Organisation (optional)"><Input value={cf.org} onChange={(e) => setCf({ ...cf, org: e.target.value })} /></Field>
              <Field label="Party type"><Select value={cf.partyType} onChange={(e) => setCf({ ...cf, partyType: e.target.value })}>{Object.keys(CORR_PARTY).map((k) => <option key={k} value={k}>{CORR_PARTY[k]}</option>)}</Select></Field>
            </div>)}
            <Field label="Subject"><Input value={cf.subject} onChange={(e) => setCf({ ...cf, subject: e.target.value })} placeholder="e.g. Insurance renewal — certificate of currency" /></Field>
            <Field label="Message"><TextArea rows={7} value={cf.body} onChange={(e) => setCf({ ...cf, body: e.target.value })} placeholder="Write your message…" /></Field>
            <AttachChips items={cFiles} onRemove={(i) => setCFiles(cFiles.filter((_, x) => x !== i))} />
            <label className="text-sm cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ border: `1px solid ${T.border}`, color: T.textMuted }}><Paperclip size={14} /> Attach files<input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files, setCFiles, cFiles)} /></label>
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <Field label="Context"><Select value={cf.contextType} onChange={(e) => setCf({ ...cf, contextType: e.target.value })}>{Object.keys(CORR_CONTEXT).map((k) => <option key={k} value={k}>{CORR_CONTEXT[k]}</option>)}</Select></Field>
              <Field label="Linked reference (optional)"><Input value={cf.contextId} onChange={(e) => setCf({ ...cf, contextId: e.target.value })} placeholder="e.g. maintenance job id" /></Field>
            </div>
            <Field label="Visibility"><Select value={cf.visibility} onChange={(e) => setCf({ ...cf, visibility: e.target.value })}><option value="committee">Whole committee</option><option value="restricted">Restricted — selected members only</option></Select></Field>
            {cf.visibility === "restricted" && (
              <Card style={{ padding: 12 }}>
                <div className="text-xs mb-2" style={{ color: T.textMuted }}>Only these members (and you) will see this thread.</div>
                <div className="flex flex-wrap gap-1.5">{members.map((m) => { const on = cf.memberIds.includes(m.authId); return (
                  <button key={m.id} onClick={() => setCf({ ...cf, memberIds: on ? cf.memberIds.filter((x) => x !== m.authId) : [...cf.memberIds, m.authId] })} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: on ? hexToRgba(T.accent, 0.18) : T.surfaceAlt, color: on ? T.accent : T.textMuted, border: `1px solid ${on ? T.accent : T.border}` }}>{on && <Check size={11} className="inline mr-1" />}{m.name}</button>); })}
                  {members.length === 0 && <span className="text-xs" style={{ color: T.textMuted }}>No app members found for this building.</span>}</div>
              </Card>)}
            <div className="flex gap-2 pt-1"><Btn grad disabled={busy} onClick={sendNew}><Send size={15} /> {busy ? "Sending…" : "Send"}</Btn><Btn kind="ghost" onClick={() => setMode("list")}>Cancel</Btn></div>
          </div>
        </Card>
      </Wrap>
    </div>
  );

  // ---- contacts ------------------------------------------------------------
  if (mode === "contacts") return (
    <div>
      <Head title="Correspondence contacts" sub="External parties for this building" onBack={() => setMode("list")} backLabel="Correspondence" />
      <Wrap>
        <Card style={{ padding: 18 }}>
          <SectionTitle>{ct.id ? "Edit contact" : "Add contact"}</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Name"><Input value={ct.name} onChange={(e) => setCt({ ...ct, name: e.target.value })} /></Field>
            <Field label="Organisation"><Input value={ct.org} onChange={(e) => setCt({ ...ct, org: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={ct.email} onChange={(e) => setCt({ ...ct, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={ct.phone} onChange={(e) => setCt({ ...ct, phone: e.target.value })} /></Field>
            <Field label="Party type"><Select value={ct.partyType} onChange={(e) => setCt({ ...ct, partyType: e.target.value })}>{Object.keys(CORR_PARTY).map((k) => <option key={k} value={k}>{CORR_PARTY[k]}</option>)}</Select></Field>
          </div>
          <div className="mt-3"><Field label="Notes"><TextArea rows={2} value={ct.notes} onChange={(e) => setCt({ ...ct, notes: e.target.value })} /></Field></div>
          <div className="flex gap-2 mt-3"><Btn grad onClick={saveContact}><Plus size={15} /> {ct.id ? "Save" : "Add contact"}</Btn>{ct.id && <Btn kind="ghost" onClick={() => setCt({ id: "", name: "", org: "", email: "", phone: "", partyType: "other", notes: "" })}>Cancel edit</Btn>}</div>
        </Card>
        {contacts.length === 0 ? <Empty icon={Users} title="No contacts yet" hint="Add the parties you correspond with, or they're captured automatically when you send." />
          : <Card style={{ padding: 8 }}>{contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: `1px dashed ${T.border}` }}>
              <div className="flex-1"><div className="text-sm font-medium">{c.name}{c.org ? <span style={{ color: T.textMuted }} className="font-normal"> · {c.org}</span> : null}</div><div className="text-xs" style={{ color: T.textMuted }}>{[CORR_PARTY[c.partyType] || c.partyType, c.email, c.phone].filter(Boolean).join(" · ")}</div></div>
              <button onClick={() => setCt({ id: c.id, name: c.name || "", org: c.org || "", email: c.email || "", phone: c.phone || "", partyType: c.partyType || "other", notes: c.notes || "" })} className="text-xs" style={{ color: T.accent }}><Pencil size={13} className="inline" /> Edit</button>
            </div>))}</Card>}
      </Wrap>
    </div>
  );

  // ---- unfiled tray --------------------------------------------------------
  if (mode === "unfiled") return (
    <div>
      <Head title="Unfiled" sub="Inbound email we couldn't match — start a thread from it, or add it to one" onBack={() => { setMode("list"); refresh(); }} backLabel="Correspondence" />
      <Wrap>
        {unfiled.length > 3 && (<Card style={{ padding: 14 }}>
          <div className="flex items-center gap-2">
            <Search size={15} style={{ color: T.textMuted, flexShrink: 0 }} />
            <Input placeholder="Filter by sender or subject…" value={uq} onChange={(e) => setUq(e.target.value)} />
            {uq ? <Btn kind="ghost" onClick={() => setUq("")}><X size={14} /></Btn> : null}
          </div>
        </Card>)}
        {unfiled.length === 0 ? <Empty icon={Inbox} title="Nothing unfiled" hint="Any reply we can't match automatically lands here so it's never lost. You're all clear." />
          : shownUnfiled.length === 0 ? <Empty icon={Search} title="Nothing matches that filter" hint="Try a sender's address or a word from the subject." />
          : <Card style={{ padding: 8 }}>{shownUnfiled.map((u) => (
            <div key={u.id} className="px-3 py-3" style={{ borderBottom: `1px dashed ${T.border}` }}>
              <div className="text-sm font-medium">{u.fromName || u.fromEmail || "Unknown sender"}{u.fromName && u.fromEmail ? <span style={{ color: T.textMuted }} className="font-normal"> · {u.fromEmail}</span> : null}</div>
              <div className="text-sm">{u.subject || "(no subject)"}</div>
              <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>{corrWhen(u.receivedAt)}</div>
              {newFor === u.id ? (
                <div className="mt-3 pt-3 space-y-3" style={{ borderTop: `1px solid ${T.border}` }}>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Who is this?"><Input value={nf.contactName} onChange={(e) => setNf({ ...nf, contactName: e.target.value })} placeholder={u.fromEmail || "Name"} /></Field>
                    <Field label="They are our"><Select value={nf.partyType} onChange={(e) => setNf({ ...nf, partyType: e.target.value })}>{Object.keys(CORR_PARTY).map((k) => <option key={k} value={k}>{CORR_PARTY[k]}</option>)}</Select></Field>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Organisation (optional)"><Input value={nf.org} onChange={(e) => setNf({ ...nf, org: e.target.value })} /></Field>
                    <Field label="Thread subject"><Input value={nf.subject} onChange={(e) => setNf({ ...nf, subject: e.target.value })} /></Field>
                  </div>
                  <div className="text-xs" style={{ color: T.textMuted }}>This files the email and opens the thread. No email is sent, and nobody is contacted.</div>
                  <div className="flex gap-2"><Btn grad disabled={busy} onClick={() => fileAsNewThread(u)}><Check size={15} /> File as a new thread</Btn><Btn kind="ghost" onClick={() => setNewFor(null)}>Cancel</Btn></div>
                </div>
              ) : (
                <div className="flex gap-2 mt-2 items-center flex-wrap">
                  {roleThreads.length > 0 && (<>
                    <Select value={assignTo[u.id] || ""} onChange={(e) => setAssignTo({ ...assignTo, [u.id]: e.target.value })}>
                      <option value="">Add to an existing thread…</option>
                      {roleThreads.map((t) => <option key={t.id} value={t.id}>{(t.contact ? t.contact.name : "Unknown")}{t.subject ? ` — ${t.subject}` : ""}</option>)}
                    </Select>
                    <Btn kind="ghost" disabled={busy} onClick={() => assignUnfiled(u.id, assignTo[u.id])}><Check size={15} /> Add</Btn>
                  </>)}
                  <Btn grad disabled={busy} onClick={() => startNewThread(u)}><Plus size={15} /> File as a new thread</Btn>
                </div>
              )}
            </div>))}</Card>}
      </Wrap>
    </div>
  );

  return null;
}

// Module level on purpose. Declared inside UnitSearchView it would be a new
// component type on every render, so React remounted each section and any open
// edit field lost focus after a single character.
function Section({ title, rows, render, empty, right }) {
  const { T } = useApp();
  return (
    <Card style={{ padding: 16 }}>
      <div className="flex items-center"><SectionTitle>{title}</SectionTitle>{right && <div className="ml-auto">{right}</div>}</div>
      {(!rows || rows.length === 0) ? <div className="text-sm" style={{ color: T.textMuted }}>{empty || "Nothing recorded."}</div> : rows.map(render)}
    </Card>
  );
}
function UnitSearchView() {
  const { T, user, buildingId, backend, flash, store, update } = useApp();
  // Committee always; the building manager only where the committee has switched
  // it on for this building. Mirrors can_edit_unit_registry() in the database, so
  // nobody is shown a control that would be refused.
  const bldg = (store.buildings || []).find((b) => b.id === buildingId) || {};
  const canEdit = isCommittee(user.role) || (user.role === "manager" && !!bldg.bmRegistryWrite);
  const [q, setQ] = useState("");
  const [units, setUnits] = useState([]);
  const [browse, setBrowse] = useState(true);
  const [hc, setHc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addType, setAddType] = useState("");
  const [af, setAf] = useState({});
  const [edit, setEdit] = useState(null);   // { kind, id }
  const [ef, setEf] = useState({});         // edit-form fields
  const [showPast, setShowPast] = useState(false);
  // No backend guard: the demo dataset answers this too, and without it the demo
  // opened on an empty search box with nothing to tell anyone the building existed.
  useEffect(() => { listUnitsOverview(buildingId).then(setUnits).catch(() => {}); }, [buildingId]);
  const run = async (unitNo) => {
    let target = (unitNo || q).trim();
    if (!target) return;
    // Typing a resident's name should find their unit. Only when the name lands on
    // exactly one unit — otherwise leave it alone and let the list do the narrowing.
    if (isInvestorQuery(target.toLowerCase())) {
      const n = units.filter((u) => (u.ownerAway || []).some(Boolean)).length;
      setBrowse(true); setHc(null); flash(`${n} unit${n === 1 ? "" : "s"} with an owner who lives elsewhere (Investor)`); return;
    }
    if (!units.some((u) => String(u.unit_number).toLowerCase() === target.toLowerCase())) {
      const needle = target.toLowerCase();
      const named = units.filter((u) => [...u.owners, ...u.tenants, ...u.others].join(" ").toLowerCase().includes(needle));
      if (named.length === 1) target = named[0].unit_number;
      else if (named.length > 1) { setBrowse(true); flash(`${named.length} units match “${target}” — pick one from the list`); return; }
    }
    setBusy(true); setAddType(""); setEdit(null); setBrowse(false);
    try { const d = await unitHealthCheck(buildingId, target); setHc({ q: target, ...d }); } catch (e) { flash(String(e.message || e)); }
    setBusy(false);
  };
  const uid = hc && hc.unit ? hc.unit.id : null;
  const people = hc && hc.people ? hc.people : [];
  const currentOfType = (t) => people.filter((p) => p.person_type === t).length;

  const addRecord = async () => {
    try {
      if (!uid && addType !== "unit") { flash("Create the unit first"); return; }
      if (addType === "unit") { await createUnit(buildingId, hc ? hc.q : q, af.lot, af.spaces); flash("Unit created"); listUnits(buildingId).then(setUnits).catch(() => {}); }
      if (addType === "person") {
        const ptype = af.ptype || "owner";
        // Replacing rather than joining: archive whoever currently holds the role.
        if (af.replace && (ptype === "owner" || ptype === "tenant")) {
          const n = await moveOutUnitPeopleOfType(buildingId, uid, ptype, af.movedate || today());
          if (n) flash(`${n} previous ${ptype}${n === 1 ? "" : "s"} moved out and archived`);
        }
        await addUnitPerson(buildingId, uid, { person_type: ptype, full_name: af.name || "", email: af.email || null, phone: af.phone || null, move_in: af.movein || null, is_current: true, notes: af.notes || null, ...(ptype === "owner" && (af.addr || "").trim() ? { home_address: af.addr.trim() } : {}) });
      }
      if (addType === "pet") await addUnitPet(buildingId, uid, { pet_type: af.ptype || "", name: af.name || "", breed: af.breed || "", approval_status: "approved" });
      if (addType === "vehicle") await addUnitVehicle(buildingId, uid, { make: af.make || "", model: af.model || "", colour: af.colour || "", registration: af.rego || "", parking_bay: af.bay || null });
      if (addType === "key") {
        const member = (store.users || []).find((m) => m.id === af.member);
        await addAccessItem(buildingId, uid, { item_type: af.ptype || "key", identifier: af.ident || null, label: af.label || null, issued_to: member ? member.name : (af.name || null), issued_to_user_id: member ? member.authId : null, issued_at: today() });
        if (member && member.authId) flash("Issued — the recipient has been asked to confirm receipt in-app");
      }
      if (addType === "breach") await addUnitBreach(buildingId, uid, { bylaw_ref: af.ref || "", description: af.desc || "", occurred_at: af.date || today() });
      if (addType === "dispute") {
        if (!(af.title || "").trim()) { flash("Give the complaint a title"); return; }
        const byLabel = `${user.name} (${ROLE_LABEL[user.role]})`;
        if (backend) await createDispute(buildingId, af.title.trim(), byLabel, af.cat || DP_CATS[0], uid);
        else update((s) => { s.disputes = s.disputes || []; const ref = "DISP-" + String(s.disputes.length + 1).padStart(4, "0"); s.disputes.push({ id: "dp" + Math.random().toString(36).slice(2, 6), buildingId, ref, unit: hc.unit.unit_number, title: af.title.trim(), category: af.cat || DP_CATS[0], status: "complaint", openedAt: today(), events: [{ seq: 1, at: today(), type: "stage", by: byLabel, text: "Complaint received and logged." }] }); });
        flash("Dispute record started and linked to this unit");
      }
      setAddType(""); setAf({});
      run(hc.q);
    } catch (e) { flash(String(e.message || e)); }
  };

  // ---- editing -------------------------------------------------------------
  const openEdit = (kind, row) => {
    setAddType("");
    setEdit({ kind, id: row.id });
    if (kind === "person") setEf({ ptype: row.person_type, name: row.full_name || "", email: row.email || "", phone: row.phone || "", movein: localDay(row.move_in), notes: row.notes || "", addr: row.home_address || "" });
    if (kind === "pet") setEf({ ptype: row.pet_type || "", name: row.name || "", breed: row.breed || "", status: row.approval_status || "approved" });
    if (kind === "vehicle") setEf({ make: row.make || "", model: row.model || "", colour: row.colour || "", rego: row.registration || "", bay: row.parking_bay || "" });
    if (kind === "key") setEf({ ptype: row.item_type || "key", ident: row.identifier || "", label: row.label || "", holder: row.issued_to || "", status: row.status || "issued" });
    if (kind === "breach") setEf({ ref: row.bylaw_ref || "", desc: row.description || "", date: localDay(row.occurred_at), status: row.status || "open" });
    if (kind === "unit") setEf({ lot: row.lot_number || "", spaces: String(row.parking_spaces == null ? "" : row.parking_spaces), notes: row.notes || "" });
  };
  const saveEdit = async () => {
    if (!edit) return;
    try {
      const id = edit.id;
      if (edit.kind === "unit") await updateUnit(buildingId, id, { lot_number: ef.lot || null, parking_spaces: Number(ef.spaces) || 0, notes: ef.notes || null });
      if (edit.kind === "person") await updateUnitPerson(buildingId, id, { person_type: ef.ptype, full_name: ef.name || "", email: ef.email || null, phone: ef.phone || null, move_in: ef.movein || null, notes: ef.notes || null, home_address: (ef.addr || "").trim() || null });
      if (edit.kind === "pet") await updateUnitPet(buildingId, id, { pet_type: ef.ptype || "", name: ef.name || "", breed: ef.breed || "", approval_status: ef.status || "approved" });
      if (edit.kind === "vehicle") await updateUnitVehicle(buildingId, id, { make: ef.make || "", model: ef.model || "", colour: ef.colour || "", registration: ef.rego || "", parking_bay: ef.bay || null });
      if (edit.kind === "key") await updateAccessItem(buildingId, id, { item_type: ef.ptype || "key", identifier: ef.ident || null, label: ef.label || null, issued_to: ef.holder || null, status: ef.status || "issued", returned_at: ef.status === "returned" ? today() : null });
      if (edit.kind === "breach") await updateUnitBreach(buildingId, id, { bylaw_ref: ef.ref || "", description: ef.desc || "", occurred_at: ef.date || null, status: ef.status || "open" });
      setEdit(null); setEf({}); flash("Saved");
      run(hc.q);
    } catch (e) { flash(String(e.message || e)); }
  };
  const setLivesHere = async (p, v) => {
    try { await updateUnitPerson(buildingId, p.id, { lives_here: v }); flash(`${p.full_name}: ${v ? "lives here" : "lives elsewhere"}`); run(hc.q); }
    catch (e) { flash(String(e.message || e)); }
  };
  const doMoveOut = async (p) => {
    try { await moveOutUnitPerson(buildingId, p.id, ef.moveout || today()); flash(`${p.full_name} archived as a past ${p.person_type}`); setEdit(null); setEf({}); run(hc.q); }
    catch (e) { flash(String(e.message || e)); }
  };
  const doRestore = async (p) => {
    try { await restoreUnitPerson(buildingId, p.id); flash(`${p.full_name} is current again`); run(hc.q); }
    catch (e) { flash(String(e.message || e)); }
  };
  const doRemove = async (kind, row, label) => {
    if (!confirm(`Remove ${label} from the unit register? This cannot be undone.`)) return;
    try {
      if (kind === "person") await deleteUnitPerson(buildingId, row.id);
      if (kind === "pet") await deleteUnitPet(buildingId, row.id);
      if (kind === "vehicle") await deleteUnitVehicle(buildingId, row.id);
      if (kind === "key") await deleteAccessItem(buildingId, row.id);
      if (kind === "breach") await deleteUnitBreach(buildingId, row.id);
      flash("Removed"); run(hc.q);
    } catch (e) { flash(String(e.message || e)); }
  };

  // ---- small presentational helpers ---------------------------------------
  const IconBtn = ({ onClick, title, children, danger }) => (
    <button onClick={onClick} title={title} aria-label={title} className="text-xs px-1.5 py-1 rounded-lg shrink-0"
      style={{ color: danger ? SEMANTIC.bad : T.textMuted, background: "transparent", border: `1px solid ${T.border}` }}>{children}</button>
  );
  const Pill = ({ tone, children, title }) => (
    <span title={title} className="text-[10px] px-1.5 py-0.5 rounded-md ml-1.5 align-middle whitespace-nowrap"
      style={{ background: hexToRgba(tone, 0.16), color: tone, border: `1px solid ${hexToRgba(tone, 0.4)}` }}>{children}</span>
  );
  // one register row: title line, detail line, and the actions that belong to it
  const row = (main, sub, k, actions, faded) => (
    <div key={k} className="py-1.5 flex items-start gap-2" style={{ borderBottom: `1px dashed ${T.border}`, opacity: faded ? 0.6 : 1 }}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{main}</div>
        {sub && <div className="text-xs" style={{ color: T.textMuted }}>{sub}</div>}
      </div>
      {actions && canEdit && <div className="flex gap-1 pt-0.5">{actions}</div>}
    </div>
  );
  const AF = (label, key, ph, type) => (<Field label={label}><Input type={type || "text"} value={af[key] || ""} onChange={(e) => setAf({ ...af, [key]: e.target.value })} placeholder={ph || ""} /></Field>);
  const EF = (label, key, ph, type) => (<Field label={label}><Input type={type || "text"} value={ef[key] || ""} onChange={(e) => setEf({ ...ef, [key]: e.target.value })} placeholder={ph || ""} /></Field>);

  // The edit drawer, rendered inline under whichever row is being edited.
  const editPanel = (kind) => (edit && edit.kind === kind) ? (
    <div className="mt-2 mb-1 p-3 rounded-xl space-y-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
      {kind === "person" && (<><Field label="Type"><Select value={ef.ptype || "owner"} onChange={(e) => setEf({ ...ef, ptype: e.target.value })}><option value="owner">Owner</option><option value="tenant">Tenant</option><option value="property_manager">Property manager</option><option value="emergency_contact">Emergency contact</option></Select></Field>{EF("Full name", "name")}{EF("Email", "email")}{EF("Phone", "phone")}{(ef.ptype || "owner") === "owner" && EF("Home or business address, if not this building", "addr", "Where the body corporate can reach an owner who lives elsewhere")}{EF("Moved in", "movein", "", "date")}{EF("Note", "notes", "Anything the committee should know")}</>)}
      {kind === "pet" && (<>{EF("Pet type", "ptype", "Dog")}{EF("Name", "name", "Rex")}{EF("Breed", "breed", "Cavoodle")}<Field label="Approval"><Select value={ef.status || "approved"} onChange={(e) => setEf({ ...ef, status: e.target.value })}><option value="approved">Approved</option><option value="pending">Pending</option><option value="refused">Refused</option></Select></Field></>)}
      {kind === "vehicle" && (<div className="grid grid-cols-2 gap-3">{EF("Make", "make", "Toyota")}{EF("Model", "model", "RAV4")}{EF("Colour", "colour", "White")}{EF("Rego", "rego", "123ABC")}{EF("Parking bay", "bay", "B2-14")}</div>)}
      {kind === "key" && (<><Field label="Type"><Select value={ef.ptype || "key"} onChange={(e) => setEf({ ...ef, ptype: e.target.value })}><option value="key">Key</option><option value="fob">Fob</option><option value="remote">Remote</option><option value="swipe_card">Swipe card</option><option value="digital_card">Digital card</option></Select></Field>{EF("Identifier / serial", "ident")}{EF("Label", "label", "Lobby / garage")}{EF("Held by", "holder", "Name")}<Field label="Status"><Select value={ef.status || "issued"} onChange={(e) => setEf({ ...ef, status: e.target.value })}><option value="issued">Issued</option><option value="returned">Returned</option><option value="lost">Lost</option></Select></Field></>)}
      {kind === "breach" && (<>{EF("By-law reference", "ref", "By-law 12 (Noise)")}{EF("Description", "desc")}{EF("Date", "date", "", "date")}<Field label="Status"><Select value={ef.status || "open"} onChange={(e) => setEf({ ...ef, status: e.target.value })}><option value="open">Open</option><option value="resolved">Resolved</option><option value="withdrawn">Withdrawn</option></Select></Field></>)}
      {kind === "unit" && (<><div className="grid grid-cols-2 gap-3">{EF("Lot number", "lot", "Lot 12")}{EF("Parking spaces", "spaces", "1", "number")}</div><Field label="Unit notes (committee and building manager only)"><textarea value={ef.notes || ""} onChange={(e) => setEf({ ...ef, notes: e.target.value })} rows={5} className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}` }} placeholder="History, agreements, anything the next committee will need." /></Field></>)}
      <div className="flex gap-2"><Btn grad onClick={saveEdit}>Save</Btn><Btn kind="ghost" onClick={() => { setEdit(null); setEf({}); }}>Cancel</Btn></div>
    </div>) : null;

  // owner/tenant rows carry an app-account badge when the person also holds a
  // membership: email is a real match, a same-unit name match is only a hint.
  const personRow = (p) => {
    const m = p.app_match;
    const badge = !m ? null
      : m.match === "email" ? <Pill tone={SEMANTIC.ok} title={`App member — ${m.role}${m.email ? ` · ${m.email}` : ""}`}>App account</Pill>
      : <Pill tone={SEMANTIC.warn} title={`A member at this unit has the same name but a different email (${m.email || "no email"}). Confirm before treating as the same person.`}>Possible app account</Pill>;
    const isOccupant = p.person_type === "owner" || p.person_type === "tenant";
    // Owners: do they live here? Blank means "follow the tenancy" (untenanted =
    // lives here). It decides who a Residents notice reaches (0.37.0).
    const tenantedNow = ((hc && hc.people) || []).some((x) => x.person_type === "tenant" && x.is_current !== false);
    const lh = p.person_type === "owner" ? (p.lives_here ?? !tenantedNow) : null;
    const lhTip = `${lh ? "Counts as a resident" : "Not a resident"} for Residents notices${p.lives_here == null ? `, assumed because the unit ${tenantedNow ? "has" : "has no"} current tenant` : ""}.${canEdit ? " Tap to change." : ""}`;
    const lhPill = lh === null ? null : canEdit
      ? <button type="button" onClick={() => setLivesHere(p, !lh)} className="align-middle"><Pill tone={lh ? SEMANTIC.ok : T.textMuted} title={lhTip}>{lh ? "Lives here" : "Lives elsewhere"}{p.lives_here == null ? " (assumed)" : ""}</Pill></button>
      : <Pill tone={lh ? SEMANTIC.ok : T.textMuted} title={lhTip}>{lh ? "Lives here" : "Lives elsewhere"}{p.lives_here == null ? " (assumed)" : ""}</Pill>;
    return (
      <div key={p.id}>
        {row(<span>{lh === false && <InvestorDot title={`${INVESTOR_TIP}${p.lives_here == null ? ", assumed because the unit has a current tenant" : ""}`} />}{p.full_name}{badge}{lhPill}</span>,
          [(p.person_type || "").replace(/_/g, " "), p.email, p.phone, p.home_address ? `Address: ${p.home_address}` : "", p.move_in ? `in ${fmtDate(localDay(p.move_in))}` : "", p.notes].filter(Boolean).join(" · "),
          p.id,
          <>
            <IconBtn title="Edit" onClick={() => openEdit("person", p)}><Pencil size={13} /></IconBtn>
            {isOccupant
              ? <IconBtn title="Mark as moved out" onClick={() => { setAddType(""); setEdit({ kind: "moveout", id: p.id }); setEf({ moveout: today() }); }}><ArrowLeft size={13} /></IconBtn>
              : <IconBtn danger title="Remove" onClick={() => doRemove("person", p, p.full_name)}><Trash2 size={13} /></IconBtn>}
          </>)}
        {edit && edit.kind === "person" && edit.id === p.id && editPanel("person")}
        {edit && edit.kind === "moveout" && edit.id === p.id && (
          <div className="mt-2 mb-1 p-3 rounded-xl space-y-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <div className="text-sm">Mark <b>{p.full_name}</b> as a past {p.person_type}. Nothing is deleted: they move to “Previously at this unit” and can be restored.</div>
            <Field label="Move-out date"><Input type="date" value={ef.moveout || ""} onChange={(e) => setEf({ ...ef, moveout: e.target.value })} /></Field>
            <div className="flex gap-2"><Btn grad onClick={() => doMoveOut(p)}>Moved out</Btn><Btn kind="ghost" onClick={() => { setEdit(null); setEf({}); }}>Cancel</Btn></div>
          </div>)}
      </div>);
  };
  // members whose account names this unit but who aren't on the register
  const orphanRow = (m, i) => row(
    <span>{m.full_name}<Pill tone={SEMANTIC.warn} title="Has an app account for this unit but no entry on the unit register">Not on the register</Pill></span>,
    [`${m.role} (app member)`, m.email, m.phone].filter(Boolean).join(" · "), "dir" + i,
    <IconBtn title="Add to the register" onClick={() => { setEdit(null); setAddType("person"); setAf({ ptype: m.role === "tenant" ? "tenant" : "owner", name: m.full_name || "", email: m.email || "", phone: m.phone || "" }); }}><Plus size={13} /></IconBtn>);

  const orphans = (hc && hc.residents_directory ? hc.residents_directory : []).filter((m) => !m.matched);
  const past = hc && hc.past_people ? hc.past_people : [];

  return (
    <div>
      <Head title="Unit Search" sub="One unit number — the whole story" />
      <Wrap>
        <HowTo id="unitsearch" steps={["Browse every unit in the building, or type a unit number or a resident's name to narrow the list. Tap any row to open it.", "Everything appears in one view: owners, tenant, other contacts, managing agent, unit notes, pets, vehicles, keys & fobs, breaches, disputes and applications.", "Use the + buttons to add, the pencil to correct anything, and the arrow to mark an owner or tenant moved out — they stay on the unit's history rather than disappearing.", "A small purple dot beside an owner means they own the unit but live elsewhere: an Investor. They are still an owner for votes, levies and notices. The dot is assumed whenever the unit has a tenant; tap Lives here or Lives elsewhere to correct it, and use the pencil to record their home or business address. Type “investor” to list them.", "An “App account” badge means that person also signs in to NaloHub. “Possible app account” means the name matches but the email doesn't — worth a check.", "Log a dispute straight from the unit and it appears in that unit's history from the first entry. Editing is committee-only unless the committee has switched on building-manager access in Settings."]} sell="The complete unit health check — what used to mean digging through years of emails and a filing cabinet now takes less time than reading this sentence." />
        <Card style={{ padding: 18 }}>
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Unit number or resident name" />
            <Btn grad disabled={busy} onClick={() => run()}><Search size={15} /> {busy ? "Searching…" : "Search"}</Btn>
          </div>
          {units.length > 0 && <div className="flex gap-1.5 flex-wrap mt-3">{units.map((u) => (<button key={u.id} onClick={() => { setQ(u.unit_number); run(u.unit_number); }} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: T.surfaceAlt, color: T.textMuted, border: `1px solid ${T.border}` }}>{u.unit_number}</button>))}</div>}
          {units.length > 0 && (<button onClick={() => setBrowse(!browse)} className="text-xs mt-3" style={{ color: T.accent }}>{browse ? "Hide the full list" : `Browse all ${units.length} units`}</button>)}
        </Card>
        {browse && units.length > 0 && (() => {
          const needle = q.trim().toLowerCase();
          const inv = isInvestorQuery(needle);
          const hits = !needle ? units : units.filter((u) => {
            const names = [...u.owners, ...u.tenants, ...u.others].join(" ").toLowerCase();
            return String(u.unit_number).toLowerCase().includes(needle) || names.includes(needle) || (inv && (u.ownerAway || []).some(Boolean));
          });
          const nInv = units.filter((u) => (u.ownerAway || []).some(Boolean)).length;
          return (<Card style={{ padding: 16 }}>
            <SectionTitle right={<span className="text-[11px]" style={{ color: T.textMuted }}>{hits.length} of {units.length}</span>}>Every unit in the building</SectionTitle>
            {nInv > 0 && <button type="button" onClick={() => setQ(inv ? "" : "investor")} className="text-xs mb-2 flex items-center" style={{ color: T.textMuted }} title="Tap to show only these units, tap again to show all"><InvestorDot />Owner, lives elsewhere (Investor): {nInv} unit{nInv === 1 ? "" : "s"}{inv ? " · show all" : ""}</button>}
            {hits.length === 0 && <div className="text-sm" style={{ color: T.textMuted }}>Nothing matches “{q}”. Search by unit number or by a resident's name.</div>}
            {hits.map((u) => {
              const chips = [u.pets ? `${u.pets} pet${u.pets === 1 ? "" : "s"}` : "", u.vehicles ? `${u.vehicles} vehicle${u.vehicles === 1 ? "" : "s"}` : "", u.keys ? `${u.keys} key${u.keys === 1 ? "" : "s"}` : "", u.agent_business ? "agent" : "", u.notes ? "notes" : ""].filter(Boolean);
              return (<button key={u.id} onClick={() => { setQ(u.unit_number); run(u.unit_number); }} className="w-full text-left py-2 flex items-start gap-3" style={{ borderBottom: `1px dashed ${T.border}` }}>
                <div className="h-8 w-11 rounded-lg grid place-items-center text-xs font-bold shrink-0" style={{ background: T.surfaceAlt, color: T.accent, border: `1px solid ${T.border}` }}>{u.unit_number}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.owners.length ? u.owners.map((n, i) => <span key={i}>{i ? ", " : ""}{(u.ownerAway || [])[i] && <InvestorDot />}{n}</span>) : <span style={{ color: T.textMuted }}>No owner recorded</span>}{u.tenants.length ? <span style={{ color: T.textMuted }}> · tenanted</span> : ""}</div>
                  <div className="text-xs truncate" style={{ color: T.textMuted }}>{u.tenants.length ? `Tenant: ${u.tenants.join(", ")}` : "Owner-occupied or vacant"}{chips.length ? ` · ${chips.join(" · ")}` : ""}</div>
                </div>
                <ChevronRight size={15} style={{ color: T.textMuted, marginTop: 6 }} />
              </button>);
            })}
          </Card>);
        })()}
        {hc && !hc.unit && (
          <Card style={{ padding: 16 }}>
            <div className="font-semibold mb-1">Unit “{hc.q}” isn't in the register yet</div>
            <div className="text-sm mb-3" style={{ color: T.textMuted }}>Residents matching this unit number{(hc.residents_directory || []).length ? "" : " — none found"}: {(hc.residents_directory || []).map((m) => m.full_name).join(", ")}</div>
            {addType !== "unit" ? <Btn grad onClick={() => setAddType("unit")}><Plus size={15} /> Create unit {hc.q}</Btn> :
              (<div className="space-y-3">{AF("Lot number (optional)", "lot", "Lot 12")}{AF("Parking spaces", "spaces", "1")}<div className="flex gap-2"><Btn grad onClick={addRecord}>Create</Btn><Btn kind="ghost" onClick={() => setAddType("")}>Cancel</Btn></div></div>)}
          </Card>)}
        {hc && hc.unit && (<>
          <Card style={{ padding: 16 }}>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl grid place-items-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})` }}><Home size={20} /></div>
              <div className="flex-1"><div className="font-bold text-lg">Unit {hc.unit.unit_number}</div><div className="text-xs" style={{ color: T.textMuted }}>{hc.unit.lot_number || "No lot number"} · {hc.unit.parking_spaces} parking space{hc.unit.parking_spaces === 1 ? "" : "s"}</div></div>
              {canEdit && <div className="flex gap-1.5 flex-wrap justify-end">
                <button onClick={() => (edit && edit.kind === "unit") ? setEdit(null) : openEdit("unit", hc.unit)} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: (edit && edit.kind === "unit") ? hexToRgba(T.accent, 0.18) : T.surfaceAlt, color: (edit && edit.kind === "unit") ? T.accent : T.textMuted, border: `1px solid ${(edit && edit.kind === "unit") ? T.accent : T.border}` }}><Pencil size={12} className="inline" /> Unit</button>
                {[["person", "Person"], ["pet", "Pet"], ["vehicle", "Vehicle"], ["key", "Key/Fob"], ["breach", "Breach"], ["dispute", "Dispute"]].map(([k, l]) => (<button key={k} onClick={() => { setEdit(null); setAddType(addType === k ? "" : k); setAf({}); }} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: addType === k ? hexToRgba(T.accent, 0.18) : T.surfaceAlt, color: addType === k ? T.accent : T.textMuted, border: `1px solid ${addType === k ? T.accent : T.border}` }}>+ {l}</button>))}
              </div>}
            </div>
            {editPanel("unit")}
            {addType && addType !== "unit" && (<div className="mt-4 pt-3 space-y-3" style={{ borderTop: `1px solid ${T.border}` }}>
              {addType === "person" && (<><Field label="Type"><Select value={af.ptype || "owner"} onChange={(e) => setAf({ ...af, ptype: e.target.value })}><option value="owner">Owner</option><option value="tenant">Tenant</option><option value="property_manager">Property manager</option><option value="emergency_contact">Emergency contact</option></Select></Field>{AF("Full name", "name")}{AF("Email", "email")}{AF("Phone", "phone")}{(af.ptype || "owner") === "owner" && AF("Home or business address, if not this building", "addr", "Where the body corporate can reach an owner who lives elsewhere")}{AF("Moved in", "movein", "", "date")}
                {(af.ptype || "owner") !== "property_manager" && (af.ptype || "owner") !== "emergency_contact" && currentOfType(af.ptype || "owner") > 0 && (
                  <div className="p-3 rounded-xl" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={!!af.replace} onChange={(e) => setAf({ ...af, replace: e.target.checked })} className="mt-0.5" />
                      <span>Replacing the current {af.ptype || "owner"}{currentOfType(af.ptype || "owner") === 1 ? "" : "s"} ({people.filter((p) => p.person_type === (af.ptype || "owner")).map((p) => p.full_name).join(", ")}) — mark them moved out and keep them on the unit's history.
                        <span className="block text-xs mt-0.5" style={{ color: T.textMuted }}>Leave unticked if this person is joining them, such as a second owner or a co-tenant.</span></span>
                    </label>
                    {af.replace && <div className="mt-2">{AF("Move-out date for the current " + (af.ptype || "owner"), "movedate", "", "date")}</div>}
                  </div>)}
              </>)}
              {addType === "pet" && (<>{AF("Pet type", "ptype", "Dog")}{AF("Name", "name", "Rex")}{AF("Breed", "breed", "Cavoodle")}</>)}
              {addType === "vehicle" && (<div className="grid grid-cols-2 gap-3">{AF("Make", "make", "Toyota")}{AF("Model", "model", "RAV4")}{AF("Colour", "colour", "White")}{AF("Rego", "rego", "123ABC")}{AF("Parking bay", "bay", "B2-14")}</div>)}
              {addType === "key" && (<><Field label="Type"><Select value={af.ptype || "key"} onChange={(e) => setAf({ ...af, ptype: e.target.value })}><option value="key">Key</option><option value="fob">Fob</option><option value="remote">Remote</option><option value="swipe_card">Swipe card</option><option value="digital_card">Digital card</option></Select></Field>{AF("Identifier / serial", "ident", "F-9981")}{AF("Label", "label", "Lobby / garage")}<Field label="Issued to (app member — they'll confirm receipt in-app)"><Select value={af.member || ""} onChange={(e) => setAf({ ...af, member: e.target.value })}><option value="">— not an app member —</option>{(store.users || []).filter((m) => m.buildingId === buildingId).map((m) => (<option key={m.id} value={m.id}>{m.name}{m.unit ? ` · Unit ${m.unit}` : ""}</option>))}</Select></Field>{!af.member && AF("Issued to (name)", "name")}</>)}
              {addType === "breach" && (<>{AF("By-law reference", "ref", "By-law 12 (Noise)")}{AF("Description", "desc")}{AF("Date", "date", "", "date")}</>)}
              {addType === "dispute" && (<><div className="text-xs" style={{ color: T.textMuted }}>Starts a tamper-evident Dispute Record linked to this unit. It appears in Disputes with its full history from the first entry.</div>{AF("What happened", "title", "Noise complaint — weekend parties")}<Field label="Category"><Select value={af.cat || DP_CATS[0]} onChange={(e) => setAf({ ...af, cat: e.target.value })}>{DP_CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field></>)}
              <div className="flex gap-2"><Btn grad onClick={addRecord}>Add</Btn><Btn kind="ghost" onClick={() => { setAddType(""); setAf({}); }}>Cancel</Btn></div>
            </div>)}
          </Card>

          {hc.unit.notes && !(edit && edit.kind === "unit") && (
            <Card style={{ padding: 16 }}>
              <div className="flex items-center"><SectionTitle>Unit notes</SectionTitle>
                {canEdit && <button onClick={() => openEdit("unit", hc.unit)} className="ml-auto text-xs" style={{ color: T.accent }}><Pencil size={13} className="inline" /> Edit</button>}</div>
              <div className="text-sm whitespace-pre-wrap" style={{ color: T.text }}>{hc.unit.notes}</div>
              <div className="text-[11px] mt-2" style={{ color: T.textMuted }}>Committee and building manager only. Residents never see this.</div>
            </Card>)}

          <div className="grid sm:grid-cols-2 gap-4">
            <Section title="Owners" rows={people.filter((p) => p.person_type === "owner")} empty="No owner recorded against this unit." render={personRow} />
            <Section title="Tenant" rows={people.filter((p) => p.person_type === "tenant")} empty="No tenant — owner-occupied or vacant." render={personRow} />
            {people.some((p) => p.person_type === "property_manager" || p.person_type === "emergency_contact") && (
              <Section title="Other contacts" rows={people.filter((p) => p.person_type === "property_manager" || p.person_type === "emergency_contact")} render={personRow} />)}
            {orphans.length > 0 && (
              <Section title="App members not on the register" rows={orphans} render={orphanRow} />)}
            <ManagingAgentCard hc={hc} onSaved={() => run(hc.q)} />
            <Section title="Pets" rows={hc.pets} render={(p) => (<div key={p.id}>{row(`${p.name || p.pet_type}${p.breed ? ` · ${p.breed}` : ""}`, `${p.pet_type || ""} · ${p.approval_status}`, p.id, <><IconBtn title="Edit" onClick={() => openEdit("pet", p)}><Pencil size={13} /></IconBtn><IconBtn danger title="Remove" onClick={() => doRemove("pet", p, p.name || p.pet_type)}><Trash2 size={13} /></IconBtn></>)}{edit && edit.kind === "pet" && edit.id === p.id && editPanel("pet")}</div>)} />
            <Section title="Vehicles & parking" rows={hc.vehicles} render={(v) => (<div key={v.id}>{row(`${[v.make, v.model].filter(Boolean).join(" ") || "Vehicle"} · ${(v.registration || "").toUpperCase()}`, `${v.colour || ""}${v.parking_bay ? ` · Bay ${v.parking_bay}` : ""}`, v.id, <><IconBtn title="Edit" onClick={() => openEdit("vehicle", v)}><Pencil size={13} /></IconBtn><IconBtn danger title="Remove" onClick={() => doRemove("vehicle", v, v.registration || "this vehicle")}><Trash2 size={13} /></IconBtn></>)}{edit && edit.kind === "vehicle" && edit.id === v.id && editPanel("vehicle")}</div>)} />
            <Section title="Keys, fobs & cards" rows={(hc.access_items || []).concat((store.keyfobs || []).filter((k) => k.buildingId === buildingId && btrimU(k.unit) === btrimU(hc.unit.unit_number)).map((k) => ({ id: k.id, legacy: true, item_type: (k.type || "key").toLowerCase(), identifier: k.serial, label: (k.label || "") + " (legacy register)", status: k.status || "issued", issued_to: k.holder })))}
              render={(a) => (<div key={a.id}>{row(`${(a.item_type || "key").replace(/_/g, " ")}${a.identifier ? ` · ${a.identifier}` : ""}${a.label ? ` — ${a.label}` : ""}`, `${a.status}${a.issued_to ? ` · ${a.issued_to}` : ""}${a.ack_at ? ` · receipt confirmed ${fmtDate(localDay(a.ack_at))}` : a.issued_to_user_id ? " · awaiting receipt confirmation" : ""}`, a.id,
                a.legacy ? null : <><IconBtn title="Edit" onClick={() => openEdit("key", a)}><Pencil size={13} /></IconBtn><IconBtn danger title="Remove" onClick={() => doRemove("key", a, `${a.item_type} ${a.identifier || ""}`.trim())}><Trash2 size={13} /></IconBtn></>)}
                {edit && edit.kind === "key" && edit.id === a.id && editPanel("key")}</div>)} />
            <Section title="By-law breaches" rows={hc.breaches} empty="No breaches on record." render={(b) => (<div key={b.id}>{row(`${b.bylaw_ref || "Breach"} · ${(b.status || "open").replace(/_/g, " ")}`, `${b.description || ""}${b.occurred_at ? ` · ${fmtDate(b.occurred_at)}` : ""}`, b.id, <><IconBtn title="Edit" onClick={() => openEdit("breach", b)}><Pencil size={13} /></IconBtn><IconBtn danger title="Remove" onClick={() => doRemove("breach", b, b.bylaw_ref || "this breach")}><Trash2 size={13} /></IconBtn></>)}{edit && edit.kind === "breach" && edit.id === b.id && editPanel("breach")}</div>)} />
            <Section title="Disputes" rows={(hc.disputes || []).concat((store.disputes || []).filter((d) => (!d.buildingId || d.buildingId === buildingId) && d.unit && btrimU(d.unit) === btrimU(hc.unit.unit_number)).map((d) => ({ id: d.id, ref: d.ref, data: { title: d.title, status: d.status } })))} empty="No disputes involve this unit."
              right={canEdit ? <button onClick={() => { setEdit(null); setAddType(addType === "dispute" ? "" : "dispute"); setAf({}); }} className="text-xs" style={{ color: T.accent }}><Plus size={12} className="inline" /> Log</button> : null}
              render={(d) => row(d.ref || d.id, [(d.data && d.data.title) || "", (d.data && d.data.status) || ""].filter(Boolean).join(" · "), d.id)} />
            <Section title="Applications & bookings" rows={hc.applications} render={(a) => row(`${a.title || a.category}`, `${(a.status || "").replace(/_/g, " ")} · ${fmtDate(localDay(a.submitted_at))}`, a.id)} />
            {past.length > 0 && (
              <Section title="Previously at this unit" rows={showPast ? past : []} empty={`${past.length} past occupant${past.length === 1 ? "" : "s"} on the record.`}
                right={<button onClick={() => setShowPast(!showPast)} className="text-xs" style={{ color: T.accent }}>{showPast ? "Hide" : `Show ${past.length}`}</button>}
                render={(p) => row(p.full_name, [(p.person_type || "").replace(/_/g, " "), p.move_out ? `moved out ${fmtDate(localDay(p.move_out))}` : "date not recorded", p.email].filter(Boolean).join(" · "), p.id,
                  <><IconBtn title="Still lives here — restore" onClick={() => doRestore(p)}><RefreshCw size={13} /></IconBtn><IconBtn danger title="Delete permanently" onClick={() => doRemove("person", p, p.full_name)}><Trash2 size={13} /></IconBtn></>, true)} />)}
          </div>
        </>)}
      </Wrap>
    </div>
  );
}

// ---------- committee suite: shared bits -------------------------------------
// ---------- committee onboarding: playbook + in-context guides ----------------
// Three-layer onboarding: the guided tour (first 90 seconds), this playbook
// (first week — real wins with progress), and HowTo strips inside each view
// (help at the moment of need). Progress lives in localStorage per user.
const PLAYBOOKS = {
  owner: [
    { key: "alerts", view: "alerts", icon: Bell, title: "Never miss a thing", win: "Notices, decisions on your applications and building news land in Alerts the moment they happen — no more missing the sign in the lift." },
    { key: "report", view: "maintenance", icon: Wrench, title: "Snap it, send it, sorted", win: "Something broken? Photo, two taps, done — then watch the repair's progress instead of wondering who to chase." },
    { key: "apply", view: "bookings", icon: CalendarCheck, title: "Apply for anything in minutes", win: "Pet approval, renovation, parking permit, the BBQ — structured forms with your documents attached, decisions back with alerts." },
    { key: "community", view: "messaging", icon: MessageSquare, title: "Say g'day", win: "Messaging, events and the marketplace — the neighbourly stuff that makes a building a community." },
    { key: "documents", view: "documents", icon: FileText, title: "The building's paperwork, findable", win: "By-laws, minutes, insurance certificates — the answers you used to email the committee for, self-served in seconds." },
    { key: "privacy", view: "settings", icon: Lock, title: "You control what neighbours see", win: "Your profile, your privacy switches — share your phone number with the directory, or don't. Entirely up to you." },
  ],
  tenant: [
    { key: "alerts", view: "alerts", icon: Bell, title: "Never miss a thing", win: "Building notices and updates on your requests come straight to you — no relying on second-hand news." },
    { key: "report", view: "maintenance", icon: Wrench, title: "Snap it, send it, sorted", win: "Something broken? Photo, two taps, done — no hunting for the right email address, and you can watch the repair's progress." },
    { key: "book", view: "bookings", icon: CalendarCheck, title: "Book the good stuff", win: "BBQ, visitor parking, shared spaces — pick a time and you're done." },
    { key: "community", view: "messaging", icon: MessageSquare, title: "Say g'day", win: "Messaging, events and the marketplace — feel at home faster." },
    { key: "documents", view: "documents", icon: FileText, title: "Know the house rules", win: "By-laws and building documents at your fingertips — handy before the housewarming." },
    { key: "privacy", view: "settings", icon: Lock, title: "You control what neighbours see", win: "Your profile, your privacy switches — entirely up to you." },
  ],
};
const PLAYBOOK = [
  { key: "alerts", view: "alerts", icon: Bell, title: "Let the building come to you", win: "Open Alerts — every application, vote and issue lands here the moment it happens. No more inbox archaeology." },
  { key: "unitsearch", view: "unitsearch", icon: Search, title: "The 30-second unit health check", win: "Type any unit number and see owners, tenants, pets, vehicles, keys and history — what used to be a night in the filing cabinet." },
  { key: "voting", view: "voting", icon: Vote, title: "Decide without a meeting", win: "Open a motion, everyone votes on their phone with comments, majority is automatic and the audit trail writes itself." },
  { key: "mworkflow", view: "mworkflow", icon: ListChecks, title: "Run a repair end-to-end", win: "Triage → quotes → recommendation → vote → contractor confirmed. One trail replaces thirty emails." },
  { key: "registers", view: "contracts", icon: Briefcase, title: "Load your registers", win: "Add your lift and cleaning contracts and trusted trades — expiry warnings mean nothing renews unnoticed again." },
  { key: "walkthrough", view: "walkthrough", icon: ClipboardList, title: "Walk the building, once a month", win: "Tick the checklist together, snap photos, export a Word report with evidence — your inspection record, done before coffee cools." },
];
const pbKey = (uid) => `nalo_playbook_${uid || "anon"}`;
const PB_HEADINGS = {
  committee: ["Your first week on the committee", "Six small wins that turn committee work from email soup into two taps.", "Engine room: mastered 🎉", "You've seen every efficiency NaloHub gives your committee. This card retires itself — replay the tour from the menu any time."],
  owner: ["Welcome home — six things worth a tap", "The building now works around you. Here's the proof, one tap at a time.", "You're in the Nalo 🎉", "That's the whole toolkit. This card retires itself — the tour is in the menu whenever you want a refresher."],
  tenant: ["Make this place yours — six quick wins", "Everything you need as a resident, one tap at a time.", "You're in the Nalo 🎉", "That's the whole toolkit. This card retires itself — the tour is in the menu whenever you want a refresher."],
};
function CommitteePlaybook() {
  const { T, user, setView, building, update, flash } = useApp();
  const flavour = isCommittee(user.role) || user.role === "manager" ? "committee" : user.role === "tenant" ? "tenant" : "owner";
  const ITEMS = flavour === "committee" ? PLAYBOOK : PLAYBOOKS[flavour];
  const [h1, h2, c1, c2] = PB_HEADINGS[flavour];
  const [done, setDone] = useState(() => { try { return JSON.parse(localStorage.getItem(pbKey(user.id)) || "{}"); } catch (e) { return {}; } });
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(pbKey(user.id) + "_hide") === "1"; } catch (e) { return false; } });
  const n = ITEMS.filter((i) => done[i.key]).length;
  const complete = n === ITEMS.length;
  // Auto-retire: once all items are done, the guide shows its celebration for the
  // rest of this visit, then never appears again (it's gone on the next load).
  const wasCompleteAtMount = useRef(complete);
  if (hidden || wasCompleteAtMount.current) return null;
  const go = (item) => {
    const next = { ...done, [item.key]: true };
    setDone(next);
    try { localStorage.setItem(pbKey(user.id), JSON.stringify(next)); } catch (e) {}
    // Be In the Nalo: quiet thank-yous as the first week comes together.
    const nn = ITEMS.filter((i) => next[i.key]).length;
    if (nn >= 3) grantBadge(update, { building, user, flash }, "explorer");
    if (nn === ITEMS.length) { grantBadge(update, { building, user, flash }, "settled"); if (celebOn(building, user)) flash("\u{1F389} First week \u2014 done. You're in the Nalo."); }
    setView(item.view);
  };
  const hide = () => { setHidden(true); try { localStorage.setItem(pbKey(user.id) + "_hide", "1"); } catch (e) {} };
  return (
    <Card style={{ padding: 0, overflow: "hidden", border: `1px solid ${hexToRgba(T.accent, 0.35)}` }}>
      <div className="px-5 pt-4 pb-3" style={{ background: `linear-gradient(135deg, ${hexToRgba(T.accent, 0.14)}, ${hexToRgba(T.accent2, 0.08)})` }}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="font-bold">{complete ? c1 : h1}</div>
            <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>{complete ? c2 : `${h2} ${n} of ${ITEMS.length} done — this guide disappears once you've reviewed all ${ITEMS.length}.`}</div>
          </div>
          <button onClick={hide} title="Dismiss" style={{ color: T.textMuted }}><X size={16} /></button>
        </div>
        <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: hexToRgba(T.accent, 0.15) }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(n / ITEMS.length) * 100}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})` }} />
        </div>
      </div>
      <div className="p-3 grid sm:grid-cols-2 gap-2">
        {ITEMS.map((item) => (
          <button key={item.key} onClick={() => go(item)} className="flex items-start gap-2.5 rounded-xl p-2.5 text-left rp-hover" style={{ background: done[item.key] ? T.surfaceAlt : T.surface, border: `1px solid ${T.border}`, opacity: done[item.key] ? 0.7 : 1 }}>
            <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0" style={{ background: done[item.key] ? hexToRgba(SEMANTIC.ok, 0.15) : hexToRgba(T.accent, 0.14), color: done[item.key] ? SEMANTIC.ok : T.accent }}>{done[item.key] ? <Check size={15} /> : <item.icon size={15} />}</div>
            <div className="min-w-0"><div className="text-sm font-semibold leading-tight">{item.title}</div><div className="text-[11px] mt-0.5 leading-snug" style={{ color: T.textMuted }}>{item.win}</div></div>
          </button>))}
      </div>
    </Card>
  );
}

// ---------- Be In the Nalo — welcome & recognition (Phase 1) ----------------
// The committee sets the building's Community layer (building.community):
//   "full" (default)  welcome, badges, aboard meter, celebration toasts
//   "gentle"          the layer stays, celebrations go quiet
//   "essentials"      the whole layer is off
// Each resident can dial their own Celebrations (localStorage, like the
// playbook); the app honours the MORE restrictive of the two. Durable awards
// live on the building record (building.recognition) so they persist through
// the existing JSONB store with no schema change.
const COMMUNITY_LEVEL = { full: 3, gentle: 2, essentials: 1, on: 3, off: 1 };
const communityMode = (b) => (b && b.community) || "full";
const celebKey = (uid) => `nalo_celebrations_${uid || "anon"}`;
const celebPref = (uid) => { try { return localStorage.getItem(celebKey(uid)) || "on"; } catch (e) { return "on"; } };
const recogLevel = (b, uid) => Math.min(COMMUNITY_LEVEL[communityMode(b)] || 3, COMMUNITY_LEVEL[celebPref(uid)] || 3);
const recogOn = (b, u) => !!u && !isStrata(u.role) && recogLevel(b, u.id) >= 2;
const celebOn = (b, u) => !!u && !isStrata(u.role) && recogLevel(b, u.id) >= 3;
const foundingEra = (b) => { const L = b && b.launchedAt; if (!L) return true; return (new Date(today()) - new Date(L)) / 86400000 <= 30; };
const BADGE_DEFS = [
  { id: "founding", icon: "\u{1F331}", name: "Founding Resident", hint: "Aboard from the building's first days" },
  { id: "explorer", icon: "\u{1F9ED}", name: "Explorer", hint: "Three first-week wins down" },
  { id: "settled", icon: "\u{1F6DF}", name: "Settled In", hint: "Finished the first-week guide" },
];
const userBadges = (b, uid) => (((b || {}).recognition || {}).badges || {})[uid] || [];
function grantBadge(update, ctx, id) {
  const { building, user, flash } = ctx;
  if (!recogOn(building, user) || userBadges(building, user.id).includes(id)) return;
  update((s) => { const bb = s.buildings.find((x) => x.id === building.id); if (!bb) return; bb.recognition = bb.recognition || {}; bb.recognition.badges = bb.recognition.badges || {}; const cur = bb.recognition.badges[user.id] || []; if (!cur.includes(id)) bb.recognition.badges[user.id] = cur.concat(id); });
  if (celebOn(building, user)) { const d = BADGE_DEFS.find((x) => x.id === id); flash(`${d ? d.icon : "\u{1F3C5}"} Badge earned \u2014 ${d ? d.name : id}`); }
}

function WelcomeBanner() {
  const { T, building, user, update, flash } = useApp();
  const k = `nalo_welcome_${user.id}`;
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(k) === "1"; } catch (e) { return false; } });
  useEffect(() => { if (!seen && recogOn(building, user) && foundingEra(building)) grantBadge(update, { building, user, flash }, "founding"); }, []); // eslint-disable-line
  if (seen || !recogOn(building, user)) return null;
  const dismiss = () => { setSeen(true); try { localStorage.setItem(k, "1"); } catch (e) {} };
  return (
    <Card style={{ padding: 18, border: `1px solid ${hexToRgba(T.accent, 0.35)}`, background: `linear-gradient(120deg, ${hexToRgba(T.accent, 0.14)}, ${hexToRgba(T.accent2, 0.08)})` }} className="rp-fade">
      <div className="flex items-start gap-3">
        <div className="flex-1"><div className="font-bold">Welcome to {building.name}, {user.name.split(" ")[0]}.</div>
          <div style={{ color: T.textMuted }} className="text-sm mt-0.5">Great to have you in the Nalo {"\u{1F30A}"} This is your building's home for notices, repairs and the good stuff.</div></div>
        <button onClick={dismiss} title="Dismiss" style={{ color: T.textMuted }}><X size={16} /></button>
      </div>
    </Card>
  );
}

function AboardMeter() {
  const { T, store, building, buildingId, user, update, flash } = useApp();
  const roll = store.users.filter((u) => u.buildingId === buildingId && !isStrata(u.role) && u.role !== "manager" && (u.status === "active" || u.status === "invited" || u.status === "pending"));
  const aboard = roll.filter((u) => u.status === "active").length;
  const pct = roll.length ? Math.round((aboard / roll.length) * 100) : 0;
  const ms = ((building.recognition || {}).milestones) || {};
  useEffect(() => {
    if (!recogOn(building, user)) return;
    const hit = [50, 75, 100].filter((m) => pct >= m && !ms[m]);
    if (!hit.length) return;
    update((s) => { const bb = s.buildings.find((x) => x.id === building.id); if (!bb) return; bb.recognition = bb.recognition || {}; bb.recognition.milestones = { ...(bb.recognition.milestones || {}) }; hit.forEach((m) => { bb.recognition.milestones[m] = true; }); });
    if (celebOn(building, user)) { const top = hit[hit.length - 1]; flash(top === 100 ? `\u{1F389} All of ${building.name} is aboard. Thank you, everyone.` : `\u{1F30A} ${building.name} just passed ${top}% aboard!`); }
  }, [pct]); // eslint-disable-line
  if (!recogOn(building, user) || roll.length < 5) return null;
  return (
    <Card style={{ padding: 18 }} className="rp-fade">
      <div className="flex items-baseline justify-between"><div className="font-bold text-xl">{pct}%</div><div style={{ color: T.textMuted }} className="text-xs">of {building.name} is aboard</div></div>
      <div className="h-2.5 rounded-full mt-2.5 overflow-hidden" style={{ background: hexToRgba(T.accent, 0.13) }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})` }} />
      </div>
      <div style={{ color: T.textMuted }} className="text-[11px] mt-1.5">Every neighbour who joins fills it a little more.</div>
    </Card>
  );
}

function BadgeShelf() {
  const { T, building, user } = useApp();
  if (!recogOn(building, user)) return null;
  const earned = userBadges(building, user.id);
  if (!earned.length) return null;
  return (
    <Card style={{ padding: 18 }} className="rp-fade">
      <SectionTitle>Your badges</SectionTitle>
      <div className="flex flex-wrap gap-2.5">
        {BADGE_DEFS.filter((b) => earned.includes(b.id)).map((b) => (
          <div key={b.id} title={b.hint} className="flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <span className="h-7 w-7 rounded-full grid place-items-center" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})` }}>{b.icon}</span>
            <span className="text-sm font-medium">{b.name}</span>
          </div>
        ))}
      </div>
      <div style={{ color: T.textMuted }} className="text-[11px] mt-2">Little thank-yous — never a scoreboard.</div>
    </Card>
  );
}

// ---------- Getting Started — the committee's shared launch tracker ---------
// The living record of a building's road to resident launch. Committee-only;
// progress lives on the building record (building.onboarding = {done, na,
// notes}) so every committee member sees the same state, and it persists via
// the existing JSONB store. Ticking the final gate stamps building.launchedAt,
// which also closes the Founding Resident window 30 days later.
const OB_OWNERS = { A: "Admin", C: "Champion", B: "Committee", AC: "Admin + Champion" };
const ONBOARD = [
  { n: 1, name: "Pre-Flight", sub: "set the building up", steps: [
    { id: "p1s1", t: "Create the building in NaloHub (production)", o: "A" },
    { id: "p1s2", t: "Set the Admin, and add the Champion as committee", o: "A" },
    { id: "p1s3", t: "Confirm the building's public inbox address", o: "A" },
    { id: "p1s4", t: "Choose the plan tier for this building's size", o: "A" },
    { id: "p1s5", t: "Set up the building's billing (per the chosen plan)", o: "A" },
    { id: "p1s6", t: "Check magic-link sign-in works with a test email", o: "A" },
    { id: "p1s7", t: "Have the demo link ready to show the committee", o: "A", opt: true },
  ] },
  { n: 2, name: "Crew Briefing", sub: "the committee decides & aligns", steps: [
    { id: "p2s1", t: "Show the committee a 15-min demo", o: "C" },
    { id: "p2s2", t: "Committee agrees in principle to trial NaloHub", o: "B", note: "Record the decision in the minutes.", gate: true },
    { id: "p2s3", t: "Committee approves the NaloHub subscription", o: "B" },
    { id: "p2s4", t: "Confirm the Transition Champion", o: "B" },
    { id: "p2s5", t: "Agree a target readiness date", o: "B", note: "Resident-launch timing stays the committee's call." },
    { id: "p2s6", t: "Agree the starter modules for v1 (keep it lean)", o: "AC" },
    { id: "p2s7", t: "Every committee member signs in once", o: "B" },
  ] },
  { n: 3, name: "Systems Check", sub: "configure the building", steps: [
    { id: "p3s1", t: "Enter building name, address & scheme reference", o: "A" },
    { id: "p3s2", t: "Enter units / floors / towers", o: "A" },
    { id: "p3s3", t: "Enter strata manager & building manager details", o: "A", note: "Needs info from the committee." },
    { id: "p3s4", t: "Set up the building & strata managers as users", o: "A", opt: true },
    { id: "p3s5", t: "Enter emergency & after-hours contacts", o: "A", note: "Needs info from the committee." },
    { id: "p3s6", t: "Enter facilities (BBQ, visitor parking, lift\u2026)", o: "A", opt: true },
    { id: "p3s7", t: "Add the WhatsApp group link", o: "A", opt: true },
    { id: "p3s8", t: "Upload fire-safety notes & evacuation plan", o: "A", opt: true, note: "Needs file from the committee." },
    { id: "p3s9", t: "Switch on the agreed v1 modules", o: "A" },
  ] },
  { n: 4, name: "Fuelling", sub: "load the key records", steps: [
    { id: "p4s1", t: "Upload the by-laws", o: "A", note: "Needs file from the committee." },
    { id: "p4s2", t: "Upload the insurance certificate of currency", o: "A", note: "Needs file from the committee." },
    { id: "p4s3", t: "Upload the latest AGM / committee minutes", o: "A", note: "Needs file from the committee." },
    { id: "p4s4", t: "Upload the current budget", o: "A", opt: true },
    { id: "p4s5", t: "Add the contracts register", o: "A", opt: true },
    { id: "p4s6", t: "Add the contractors register", o: "A", opt: true },
    { id: "p4s7", t: "Add any live maintenance items", o: "A", note: "So the loop is visible from day one." },
    { id: "p4s8", t: "Draft the welcome announcement, ready to publish", o: "C", opt: true },
  ] },
  { n: 5, name: "Comms Channel", sub: "turn on correspondence", steps: [
    { id: "p5s1", t: "Confirm & copy the building's public address", o: "A" },
    { id: "p5s2", t: "Tell key external parties the new address", o: "C", note: "Strata, insurer, solicitor, council, contractors." },
    { id: "p5s3", t: "Test inbound: one real email files into Correspondence", o: "AC" },
    { id: "p5s4", t: "Test outbound: a notice's reply lands in Correspondence", o: "AC" },
    { id: "p5s5", t: "Decide if / when to retire the old email relay", o: "B", opt: true, note: "No rush \u2014 keep it until confident." },
  ] },
  { n: 6, name: "Crew Ready", sub: "the committee learns & tests", steps: [
    { id: "p6s1", t: "Run a 30-min committee walkthrough (or the Help hub)", o: "C" },
    { id: "p6s2", t: "Each committee member does one real action", o: "B", gate: true, note: "Post, comment or log something." },
    { id: "p6s3", t: "Soft-launch to a few friendly residents for a week", o: "C" },
    { id: "p6s4", t: "Collect 3\u20135 pieces of feedback", o: "C" },
    { id: "p6s5", t: "Fix the rough edges from feedback", o: "A" },
  ] },
  { n: 7, name: "Manifest", sub: "get residents ready to load", steps: [
    { id: "p7s1", t: "Confirm authority to load the resident roll, and that residents will be told their details are held in NaloHub", o: "B", note: "Privacy Act / Australian Privacy Principles." },
    { id: "p7s2", t: "Prepare the resident list (name \u00b7 email \u00b7 unit \u00b7 role)", o: "C" },
    { id: "p7s3", t: "Load residents into NaloHub", o: "A" },
    { id: "p7s4", t: "Test an owner and a tenant sign-in", o: "A" },
    { id: "p7s5", t: "Line up 2\u20133 resident helpers for launch", o: "C" },
    { id: "p7s6", t: "Draft the resident invite & welcome message", o: "AC" },
  ] },
  { n: 8, name: "Cleared for Launch", sub: "the readiness gate", steps: [
    { id: "p8s1", t: "Committee checks the loaded info is current & correct", o: "B", note: "By-laws, insurance, contacts." },
    { id: "p8s2", t: "Review readiness against this tracker", o: "C" },
    { id: "p8s3", t: "Committee confirms: cleared to launch to all residents", o: "B", gate: true, note: "The timing is the committee's call." },
    { id: "p8s4", t: "Hand over to the Resident Launch plan", o: "C" },
  ] },
];
function OnboardingView() {
  const { T, building, user, update, flash } = useApp();
  const [noteOpen, setNoteOpen] = useState({});
  if (!isCommittee(user.role)) return <div><Head title="Getting Started" /><Wrap><Card style={{ padding: 18 }}><p style={{ color: T.textMuted }} className="text-sm">This screen is for the committee.</p></Card></Wrap></div>;
  const ob = building.onboarding || { done: {}, na: {}, notes: {} };
  const setOb = (fn) => update((s) => { const bb = s.buildings.find((x) => x.id === building.id); if (!bb) return; bb.onboarding = bb.onboarding || { done: {}, na: {}, notes: {} }; bb.onboarding.done = bb.onboarding.done || {}; bb.onboarding.na = bb.onboarding.na || {}; bb.onboarding.notes = bb.onboarding.notes || {}; fn(bb.onboarding, bb); });
  const all = ONBOARD.flatMap((p) => p.steps);
  const counted = all.filter((st) => !(ob.na || {})[st.id]);
  const done = counted.filter((st) => (ob.done || {})[st.id]).length;
  const pct = counted.length ? Math.round((done / counted.length) * 100) : 0;
  const cleared = !!(ob.done || {})["p8s3"];
  const toggle = (st) => { if ((ob.na || {})[st.id]) return; const to = !(ob.done || {})[st.id]; setOb((o, bb) => { o.done[st.id] = to; if (st.id === "p8s3") { bb.launchedAt = to ? today() : ""; if (to) stampProvenance(bb, user, today()); } }); if (st.id === "p8s3" && to) flash("\u{1F680} Cleared for launch \u2014 over to the Resident Launch plan."); };
  const toggleNa = (st) => setOb((o) => { o.na[st.id] = !(o.na || {})[st.id]; if (o.na[st.id]) o.done[st.id] = false; });
  const copySummary = () => {
    let out = `NaloHub \u2014 Getting Started\nBuilding: ${building.name}\nAs at: ${today()}\nOverall: ${pct}% ready (${done}/${counted.length} steps)` + (cleared ? " \u2014 CLEARED FOR LAUNCH" : "") + "\n\n";
    ONBOARD.forEach((p) => { const cs = p.steps.filter((st) => !(ob.na || {})[st.id]); const ds = cs.filter((st) => (ob.done || {})[st.id]).length; out += `Phase ${p.n} \u00b7 ${p.name}: ${ds}/${cs.length}\n`; });
    const open = all.filter((st) => !(ob.na || {})[st.id] && !(ob.done || {})[st.id]).slice(0, 6);
    if (open.length) { out += "\nNext up:\n"; open.forEach((st) => { out += `\u2022 ${st.t} (${OB_OWNERS[st.o]})\n`; }); }
    const noted = all.filter((st) => (ob.notes || {})[st.id]);
    if (noted.length) { out += "\nNotes:\n"; noted.forEach((st) => { out += `\u2022 ${st.t}: ${ob.notes[st.id]}\n`; }); }
    try { navigator.clipboard.writeText(out); flash("Progress copied \u2014 paste it to the committee"); } catch (e) { flash("Copy not available here"); }
  };
  return (
    <div>
      <Head title="Getting Started" sub={`${building.name}'s shared road to launch \u2014 launch timing is always the committee's call`} action={<HeaderAction onClick={copySummary}><Copy size={15} /> Copy progress</HeaderAction>} />
      <Wrap>
        <Card style={{ padding: 18, border: cleared ? `1px solid ${hexToRgba(SEMANTIC.ok, 0.5)}` : undefined }}>
          <div className="flex items-baseline justify-between"><div className="font-bold text-2xl">{pct}%<span style={{ color: T.textMuted }} className="text-sm font-medium"> ready</span></div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: cleared ? SEMANTIC.ok : T.textMuted }}>{cleared ? "\u2713 Cleared for launch" : pct === 100 ? "Ready \u2014 awaiting sign-off" : "In progress"}</div></div>
          <div className="h-2.5 rounded-full mt-3 overflow-hidden" style={{ background: hexToRgba(T.accent, 0.13) }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})` }} />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mt-3.5">
            {ONBOARD.map((p) => { const cs = p.steps.filter((st) => !(ob.na || {})[st.id]); const ds = cs.filter((st) => (ob.done || {})[st.id]).length; const full = cs.length > 0 && ds === cs.length; return (
              <div key={p.n} className="text-center"><div className="h-1.5 rounded-full" style={{ background: full ? SEMANTIC.ok : ds > 0 ? `linear-gradient(90deg, ${SEMANTIC.ok} 50%, ${hexToRgba(T.accent, 0.13)} 50%)` : hexToRgba(T.accent, 0.13) }} /><div className="text-[9px] mt-1 font-semibold truncate" style={{ color: full ? SEMANTIC.ok : T.textMuted }}>{p.name}</div></div>); })}
          </div>
          <p style={{ color: T.textMuted }} className="text-xs mt-3">Tick items as they're done — every committee member sees the same live record. Steps that don't apply here can be marked N/A.</p>
        </Card>
        {ONBOARD.map((p) => { const cs = p.steps.filter((st) => !(ob.na || {})[st.id]); const ds = cs.filter((st) => (ob.done || {})[st.id]).length; return (
          <Card key={p.n} style={{ padding: 18 }}>
            <SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{ds}/{cs.length} done</span>}>{p.n}. {p.name} · {p.sub}</SectionTitle>
            <div className="space-y-2">
              {p.steps.map((st) => { const isDone = !!(ob.done || {})[st.id]; const isNa = !!(ob.na || {})[st.id]; const note = (ob.notes || {})[st.id] || ""; const showNote = !!note || noteOpen[st.id]; return (
                <div key={st.id} className="rounded-xl px-3 py-2.5" style={{ background: isDone && !isNa ? hexToRgba(SEMANTIC.ok, 0.08) : T.surfaceAlt, border: `1px solid ${isDone && !isNa ? hexToRgba(SEMANTIC.ok, 0.35) : T.border}`, opacity: isNa ? 0.55 : 1 }}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggle(st)} aria-label="Mark done" className="h-6 w-6 rounded-md grid place-items-center shrink-0 mt-0.5" style={{ background: isDone && !isNa ? SEMANTIC.ok : "transparent", border: `2px solid ${isDone && !isNa ? SEMANTIC.ok : T.border}`, cursor: isNa ? "not-allowed" : "pointer" }}>{isDone && !isNa && <Check size={14} color="#fff" />}</button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm" style={{ textDecoration: isNa ? "line-through" : "none" }}>{st.t}{st.gate && <span style={{ color: T.accent }} className="font-bold"> ★</span>}</div>
                      {st.note && <div style={{ color: T.textMuted }} className="text-[11px] mt-0.5">{st.note}</div>}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: hexToRgba(T.accent, 0.14), color: T.accent }}>{OB_OWNERS[st.o]}</span>
                        {st.opt && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: hexToRgba(SEMANTIC.warn, 0.15), color: SEMANTIC.warn }}>Optional</span>}
                        <button onClick={() => toggleNa(st)} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ border: `1px dashed ${isNa ? SEMANTIC.warn : T.border}`, color: isNa ? SEMANTIC.warn : T.textMuted }}>{isNa ? "N/A \u2713" : "Mark N/A"}</button>
                        {!showNote && !isNa && <button onClick={() => setNoteOpen({ ...noteOpen, [st.id]: true })} className="text-[10px] font-semibold" style={{ color: T.textMuted, borderBottom: `1px dashed ${T.border}` }}>+ note</button>}
                      </div>
                      {showNote && !isNa && <div className="mt-2"><Input value={note} placeholder="Add a note — who's chasing it, a date, a blocker…" onChange={(e) => { const v = e.target.value; setOb((o) => { if (v.trim()) o.notes[st.id] = v; else delete o.notes[st.id]; }); }} /></div>}
                    </div>
                  </div>
                </div>); })}
            </div>
          </Card>); })}
      </Wrap>
    </div>
  );
}

// ---------- Set up by: who established the record, who funds it --------------
// building.provenance = { establishedBy: {name, role}, establishedAt, fundedBy,
//   fundedByName, novations: [{at, from, to, byName}] } on the existing JSONB.
// Written once at the final Getting Started gate (or on building creation);
// the funding party is committee-editable only, append-only. The line is the
// visible proof behind "Your Building, Your Records".
const FUNDED_LABEL = { committee: "the Committee", bm: "Building Manager", other: "" };
function provenanceLine(b) {
  const p = b && b.provenance; if (!p || !p.establishedAt) return null;
  const eb = p.establishedBy || {};
  const who = eb.role === "manager" ? eb.name || "the Building Manager" : eb.role === "bcc" || eb.role === "admin" ? (eb.name ? eb.name : "the Committee") : eb.name || "the Committee";
  const role = eb.role === "manager" ? ", Building Manager" : eb.role === "bcc" ? ", Committee" : "";
  let line = `Set up by ${who}${role}, ${fmtDateLong(p.establishedAt)}. This is the building's record.`;
  if (p.fundedBy !== "committee") line += " The owners corporation can export it in full at any time.";
  const nov = (p.novations || []).slice(-1)[0];
  if (nov) line += ` Handed to ${nov.to === "committee" ? "the Committee" : nov.to === "bm" ? "the Building Manager" : nov.toName || "a new funding party"} on ${fmtDateLong(nov.at)}.`;
  return line;
}
// "Wednesday 2nd September 2026". A walk is an event on a named day, and the
// committee talks about it that way, so the record should too.
const fmtWalkDate = (d) => {
  try {
    const x = new Date(localDay(d) + "T12:00:00");
    const n = x.getDate();
    const ord = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
    const wd = x.toLocaleDateString("en-AU", { weekday: "long" });
    const mo = x.toLocaleDateString("en-AU", { month: "long" });
    return `${wd} ${n}${ord} ${mo} ${x.getFullYear()}`;
  } catch (e) { return fmtDate(d); }
};

const fmtDateLong = (d) => { try { const x = new Date(localDay(d) + "T12:00:00"); return x.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return fmtDate(d); } };
function stampProvenance(bb, user, when) {
  if (!bb || (bb.provenance && bb.provenance.establishedAt)) return;
  const fundedBy = user && user.role === "manager" ? "bm" : "committee";
  bb.provenance = { establishedBy: { name: (user && user.name) || "the Committee", role: (user && user.role) || "bcc", userId: user && user.id }, establishedAt: when || today(), fundedBy, fundedByName: "", novations: [] };
}
function ProvenanceLine({ withExport }) {
  const { T, building, user, setView } = useApp();
  const line = provenanceLine(building);
  if (!line || !(isCommittee(user.role) || user.role === "manager")) return null;
  return (
    <div className="text-[12px] leading-relaxed px-1" style={{ color: T.textMuted }}>
      {line}{withExport && isCommittee(user.role) && (<> <button onClick={() => setView("settings")} className="font-semibold" style={{ color: T.accent }}>Export everything</button></>)}
    </div>
  );
}
// Whether the building manager may maintain the unit register. Off by default and
// decided per building: some committees want the BM keeping tenants and keys current,
// others keep the register firmly in committee hands. Enforced in the database, not
// just here — the same flag drives can_edit_unit_registry() in Supabase.
function BMRegistryCard() {
  const { T, user, store, buildingId, update, flash } = useApp();
  const building = (store.buildings || []).find((b) => b.id === buildingId) || {};
  const on = !!building.bmRegistryWrite;
  if (!isCommittee(user.role)) return null;
  const bmCount = (store.users || []).filter((m) => m.buildingId === buildingId && m.role === "manager").length;
  const setCorr = (val) => {
    update((s) => { const bb = s.buildings.find((x) => x.id === buildingId); if (bb) bb.bmCorrespondence = val; });
    audit(buildingId, val ? "building.bm_correspondence_enabled" : "building.bm_correspondence_disabled", building.name || buildingId);
    flash(val ? "Your building manager can now see Correspondence" : "Correspondence is committee-only again");
  };
  const setOn = (val) => {
    update((s) => { const bb = s.buildings.find((x) => x.id === buildingId); if (bb) bb.bmRegistryWrite = val; });
    audit(buildingId, val ? "building.bm_registry_write_enabled" : "building.bm_registry_write_disabled", building.name || buildingId);
    flash(val ? "Your building manager can now maintain the unit register" : "Unit register is committee-only again");
  };
  return (
    <Card style={{ padding: 18 }}>
      <SectionTitle>Your building manager</SectionTitle>
      <p className="text-sm mb-3" style={{ color: T.textMuted }}>What your building manager can reach, beyond their own work: maintenance, walk-throughs, the compliance calendar and contractors, which are always theirs. Each switch is enforced by the database, not just hidden on screen.</p>
      <div className="rounded-xl p-3 mb-3" style={{ border: `1px solid ${T.border}` }}>
        <label className="flex items-start gap-2.5 cursor-pointer"><input type="checkbox" checked={!!building.bmCorrespondence} onChange={(e) => setCorr(e.target.checked)} className="mt-1" />
          <span className="text-sm">Let the building manager see Correspondence<span style={{ color: T.textMuted }} className="block text-xs">The building's email record: letters to the strata manager, insurers, solicitors and contractors. Off unless you switch it on. Buildings run by their manager, with no committee on NaloHub, start with it on.</span></span></label>
      </div>
      <SectionTitle>Who maintains the unit register</SectionTitle>
      <p className="text-sm" style={{ color: T.textMuted }}>Owners, tenants, pets, vehicles and keys. The committee can always edit these. Your building manager is usually the first to know when a tenant moves or a key changes hands, so you can let them keep the register current.</p>
      <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1" />
        <span className="text-sm">Let the building manager update the unit register
          <span className="block text-xs mt-0.5" style={{ color: T.textMuted }}>{bmCount === 0 ? "No building manager on this building yet — the setting will apply when one is added." : on ? "On. Every change is recorded with their name against it." : "Off. Only committee members can change the register."}</span></span>
      </label>
      <div className="text-[11px] mt-2" style={{ color: T.textMuted }}>By-law breaches stay committee-only either way: recording an allegation against a resident is a committee act, not register upkeep.</div>
    </Card>
  );
}
function ProvenanceCard() {
  const { T, building, update, user, flash } = useApp();
  const [editing, setEditing] = useState(false);
  const [fb, setFb] = useState("committee"); const [fbName, setFbName] = useState("");
  const p = building.provenance;
  const canChange = isCommittee(user.role);
  const stampNow = () => { update((s) => { const bb = s.buildings.find((x) => x.id === building.id); stampProvenance(bb, user, building.launchedAt || today()); }); flash("Provenance recorded"); };
  const save = () => {
    update((s) => { const bb = s.buildings.find((x) => x.id === building.id); if (!bb.provenance) stampProvenance(bb, user, today()); const pv = bb.provenance; (pv.novations = pv.novations || []).push({ at: today(), from: pv.fundedBy, to: fb, toName: fb === "other" ? fbName.trim() : "", byName: user.name, byUserId: user.id }); pv.fundedBy = fb; pv.fundedByName = fb === "other" ? fbName.trim() : ""; });
    audit(building.id, "building.provenance_changed", fb); setEditing(false); flash("Provenance updated");
  };
  const exportsLog = (building.exports || []).slice(-5).reverse();
  return (
    <Card style={{ padding: 18 }}>
      <SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">Your Building, Your Records</span>}>Set up by</SectionTitle>
      {p && p.establishedAt ? (<p className="text-sm">{provenanceLine(building)}</p>) : (<p style={{ color: T.textMuted }} className="text-sm">Not recorded yet. It is stamped automatically when the final Getting Started gate is ticked{canChange ? ", or you can record it now" : ""}.</p>)}
      {canChange && !(p && p.establishedAt) && <div className="mt-3"><Btn kind="ghost" onClick={stampNow}>Record it now</Btn></div>}
      {canChange && p && p.establishedAt && !editing && <div className="mt-3"><Btn kind="ghost" onClick={() => { setFb(p.fundedBy || "committee"); setFbName(p.fundedByName || ""); setEditing(true); }}>Change who funds NaloHub</Btn></div>}
      {editing && (<div className="mt-3 rounded-xl p-3 space-y-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
        <div className="text-sm font-semibold">Who funds NaloHub for this building from now?</div>
        <div className="flex flex-wrap gap-2">{[["committee", "Committee"], ["bm", "Building manager"], ["other", "Other"]].map(([v, l]) => (<button key={v} onClick={() => setFb(v)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: fb === v ? T.accent : "transparent", color: fb === v ? T.accentText : T.text, border: `1px solid ${fb === v ? T.accent : T.border}` }}>{l}</button>))}</div>
        {fb === "other" && <Input value={fbName} onChange={(e) => setFbName(e.target.value)} placeholder="Name of the funding party" />}
        <p style={{ color: T.textMuted }} className="text-xs">This records who pays. It does not change who owns the record. The record belongs to the building either way.</p>
        <div className="flex gap-2"><Btn grad onClick={save}>Save</Btn><Btn kind="ghost" onClick={() => setEditing(false)}>Cancel</Btn></div>
      </div>)}
      {exportsLog.length > 0 && (<div className="mt-4" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Export log</div>
        {exportsLog.map((x, i) => (<div key={i} className="text-xs py-1" style={{ color: T.textMuted }}>Exported in full by <span style={{ color: T.text }} className="font-medium">{x.byName}</span> ({ROLE_LABEL[x.byRole] || x.byRole}) on {fmtDateLong(x.at)}{x.sheets ? ` · ${x.sheets} sheets` : ""}{x.files ? `, ${x.files} files listed` : ""}</div>))}
        {(building.exports || []).length > 5 && <div className="text-[11px] mt-1" style={{ color: T.textMuted }}>{(building.exports || []).length} exports in total.</div>}
      </div>)}
    </Card>
  );
}

// One-tap export of everything the building owns (Services Agreement cl.4).
function DataExportCard() {
  const { T, building, buildingId, user, flash, update } = useApp();
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState("");
  if (!isCommittee(user.role)) return null;
  const run = async () => {
    setBusy(true);
    try {
      const res = await exportBuildingData(buildingId, building.name, setProg);
      update((s) => { const bb = s.buildings.find((x) => x.id === buildingId); if (!bb) return; bb.exports = (bb.exports || []).slice(-99); bb.exports.push({ at: nowISO(), byUserId: user.id, byName: user.name, byRole: user.role, sheets: res.sheets, files: res.files, scope: "full" }); });
      flash(`Export complete — ${res.sheets} sheets${res.files ? `, ${res.files} files listed` : ""}. Check your downloads.`);
    } catch (e) { flash(String(e.message || e)); }
    setBusy(false); setProg("");
  };
  return (
    <Card style={{ padding: 18 }}>
      <SectionTitle>Export everything</SectionTitle>
      <p style={{ color: T.textMuted }} className="text-sm mb-3">Everything this building owns — every register, application, vote, contract, walk-through and audit entry, plus a manifest of every stored file with 7-day download links — exported to a single Excel workbook. Your data belongs to your body corporate; taking it with you is one tap, and always will be.</p>
      <Btn grad disabled={busy} onClick={run}><Download size={15} /> {busy ? (prog || "Exporting…") : "Export everything"}</Btn>
    </Card>
  );
}

// Collapsible "how this works" strip shown at the top of committee views.
function HowTo({ id, steps, sell }) {
  const { T, user } = useApp();
  const k = `nalo_howto_${id}_${user.id || "anon"}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(k) !== "0"; } catch (e) { return true; } });
  const toggle = () => { setOpen(!open); try { localStorage.setItem(k, open ? "0" : "1"); } catch (e) {} };
  return (
    <Card style={{ padding: 0, overflow: "hidden", border: `1px dashed ${hexToRgba(T.accent, 0.4)}` }}>
      <button onClick={toggle} className="w-full flex items-center gap-2 px-4 py-2.5 text-left">
        <HelpCircle size={15} style={{ color: T.accent }} />
        <span className="text-sm font-semibold flex-1">How this works</span>
        <ChevronRight size={15} style={{ color: T.textMuted, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (<div className="px-4 pb-3.5">
        <ol className="space-y-1">{steps.map((st, i) => (<li key={i} className="text-xs flex gap-2" style={{ color: T.textMuted }}><b style={{ color: T.accent }}>{i + 1}.</b><span>{st}</span></li>))}</ol>
        <div className="text-xs mt-2.5 pt-2 flex items-start gap-1.5" style={{ borderTop: `1px dashed ${T.border}`, color: T.text }}><Sparkles size={13} className="shrink-0 mt-0.5" style={{ color: T.accent2 }} /><i>{sell}</i></div>
      </div>)}
    </Card>
  );
}

// ---------- NaloHub Guides — task walkthroughs + printable cheat sheets ------
// One source of truth: each guide below renders BOTH the in-app guide drawer
// (do-it-with-the-screen-open checklist with "Show me" highlighting) AND the
// printable A4 cheat sheet — so the two can never drift apart.
// Step text: wrap exact on-screen button labels in ⟨angle quotes⟩ — they render
// as button pills in the drawer and bold chips on the printed sheet.
// `target` = a [data-guide]/[data-tour] selector for Show me; `view` = the
// screen Show me navigates to first. Progress persists per user per guide in
// localStorage (nalo_guide_<id>_<uid>).
// Library sections — role filtering trims what each person sees; sections make
// the rest scannable. Order here is display order.
const GUIDE_SECTIONS = [["start", "Getting started"], ["living", "Everyday living"], ["bm", "Building manager"], ["committee", "Committee engine room"]];
const GUIDES = [
  {
    id: "get-in", sec: "start", icon: Smartphone, mins: 3, who: "Everyone",
    title: "Get in — and keep NaloHub on your phone",
    intro: "No password, no app store. Your email is your key.",
    roles: () => true,
    steps: [
      { t: "Open your building's NaloHub address in your phone's browser — it's in your invite email, or ask your committee.", check: "You can see the NaloHub sign-in screen." },
      { t: "Type your email — the one the committee has on file — and tap ⟨Email me a sign-in link⟩.", check: "The screen confirms a sign-in link is on its way." },
      { t: "Open that email on the same phone and tap the link. That's it — no password, ever. The link proves you own the email address, so there's nothing to remember and nothing for anyone to steal.", check: "Your building's dashboard appears." },
      { t: "Tap the floating ⟨Add to Home Screen⟩ button and follow the steps for your phone. iPhone: tap the Share icon next to the address bar (if you only see \"...\", tap that, then Share), then Add to Home Screen. Android: the ⋮ menu, then Add to Home screen (or Install app).", check: "The NaloHub icon sits on your home screen like any other app." },
      { t: "From now on, just tap the icon — you'll usually still be signed in. If it ever asks again, it's only your email and a fresh link.", check: "One tap from home screen to your building." },
    ],
  },
  {
    id: "maint-vote", sec: "bm", icon: Wrench, mins: 6, who: "Building manager & committee",
    title: "Record a maintenance issue & send it to vote",
    intro: "One trail from first report to committee decision — nothing lives in an inbox.",
    roles: (u) => canMaint(u),
    steps: [
      { t: "Open ⟨Maintenance⟩ and tap ⟨Report⟩.", check: "The new-issue form is open.", target: '[data-guide="g-maint-report"]', view: "maintenance" },
      { t: "Give it a clear title, pick the category and location, add a few words and a photo if you have one, then save. (Loading past jobs? Use the historical dates so the record stays honest.)", check: "\u201CIssue logged \u00B7 committee notified\u201D flashes and the issue is in the list.", view: "maintenance" },
      { t: "Open ⟨Maintenance Workflow⟩, pick the issue and tap ⟨Triage⟩ — the building can now see it's being handled.", check: "The stage bar moves to Triaged.", target: '[data-tour="nav-mworkflow"]', view: "mworkflow" },
      { t: "Tap ⟨Add quote⟩ as each quote arrives — supplier, amount, and attach the document. Aim for two or three.", check: "Each quote appears on the issue's trail.", view: "mworkflow" },
      { t: "Tap ⟨Recommend⟩ on the best quote and add your one-line reason. That sentence is the most valuable thing on the whole trail.", check: "The stage bar moves to Recommended.", view: "mworkflow" },
      { t: "Tap ⟨Send to vote⟩. The motion carries the entire trail with it, and every committee member is alerted at once.", check: "The stage bar moves to At vote.", view: "mworkflow" },
      { t: "When the motion passes, the winning quote is accepted automatically. Book the works, then tap ⟨Contractor confirmed⟩.", check: "The stage bar completes — the decision and the job stay on one trail, forever.", view: "mworkflow" },
    ],
  },
  {
    id: "maint-report", sec: "bm", icon: BarChart3, mins: 2, who: "Building manager & committee",
    title: "Export the Maintenance Report for a meeting",
    intro: "Pick a period, tap once, table the Word document — minute-ready.",
    roles: (u) => canMaint(u),
    steps: [
      { t: "Open ⟨Reports⟩ and find the Maintenance Report card. The report opens with a one-page summary: five tiles, the items waiting on a committee decision (with the date each was sent), and what every open item is waiting on. Detail follows, grouped the same way.", check: "You can see the period picker.", target: '[data-tour="nav-reports"]', view: "reports" },
      { t: "Pick the From and To dates — usually the day after your last meeting, up to today.", check: "The period covers everything since the committee last met.", view: "reports" },
      { t: "Tap ⟨Word report⟩.", check: "A .docx file downloads to your phone or computer.", target: '[data-guide="g-report-word"]', view: "reports" },
      { t: "Open it and skim \u201COpen issues — for the committee's attention\u201D. That section is the meeting's discussion list, written for you.", check: "Every line is backed by the in-app trail — who, what, when." },
      { t: "Attach it to the agenda email. It's ready to table in the minutes as-is.", check: "Forty minutes of \u201Cwhat happened with…\u201D becomes a document everyone read beforehand." },
    ],
  },
  {
    id: "walkthrough", sec: "bm", icon: ClipboardList, mins: 10, who: "Building manager & committee",
    title: "Run a building walk-through & share it",
    intro: "Walk it, photograph it, issue it. The report builds itself from the register.",
    roles: (u) => canMaint(u) && u.role !== "tenant",
    steps: [
      { t: "Open ⟨Walk-Through⟩. First time only: tap ⟨Load standard checklist⟩ for a 22-question starting point covering fire safety, access, lifts, common areas, amenities, building fabric, services and grounds.", check: "The checklist appears.", target: '[data-guide="g-walk-load"]', view: "walkthrough" },
      { t: "Tap ⟨Edit checklist⟩ to add or retire questions. Do it before the walk starts. Retired questions stay in the record of every past walk that used them.", check: "The checklist fits your building.", view: "walkthrough" },
      { t: "Tick the people who are actually there, then tap ⟨Start walk-through⟩. If a walk is already open, NaloHub offers to take you back into it: press OK.", check: "The walk is open, dated today, with its attendees listed.", target: '[data-guide="g-walk-start"]', view: "walkthrough" },
      { t: "Start with ⟨Carried from earlier walks⟩. For each one take a ⟨Photo⟩, then tap ⟨Still present⟩, or ⟨Close⟩ if you can see it is done.", check: "Every carried finding has been seen again or closed.", view: "walkthrough" },
      { t: "Walk each group: ⟨OK⟩, ⟨Issue⟩ or ⟨N/A⟩ on every question. Where something needs doing, tap ⟨Raise a finding here⟩, pick its class, say what done looks like, and take the before photo.", check: "Each problem has its own reference, owner and date.", view: "walkthrough" },
      { t: "Tap ⟨Go to Finish⟩, note any areas not walked, then tap ⟨Issue this walk⟩.", check: "The walk carries a green issued badge under Past walks.", view: "walkthrough" },
      { t: "Tap ⟨Export PDF⟩ and save it as the record of the walk, or ⟨Export Word⟩ for a working copy. Email it to the committee and the building manager.", check: "Every page is stamped with the time the copy was made.", view: "walkthrough" },
    ],
  },
  {
    id: "vote", sec: "committee", icon: Vote, mins: 2, who: "Committee members",
    title: "Check an alert, review a motion & cast your vote",
    intro: "Twenty seconds on your phone — and the decision executes itself.",
    roles: (u) => isCommittee(u.role),
    steps: [
      { t: "Tap ⟨Alerts⟩ — the badge on the menu shows how many things need your eyes.", check: "You can see what's waiting, newest first.", target: '[data-tour="nav-alerts"]', view: "alerts" },
      { t: "Tap the \u201Cvote required\u201D alert. It takes you straight to the motion in ⟨Voting⟩.", check: "The motion is open in front of you.", view: "alerts" },
      { t: "Review it: the description, any attached documents, the quotes and recommendation trail, and the proposed Conditions of Approval. Unsure about something? Post a question — it's answered on the record, for everyone.", check: "You know what you're deciding and why.", view: "voting" },
      { t: "Add a comment or a condition if you want (\u201Capproved subject to…\u201D), then tap ⟨Yes⟩, ⟨No⟩ or ⟨Abstain⟩.", check: "\u201CVote recorded\u201D flashes and the tally updates.", view: "voting" },
      { t: "You're done. The motion passes with a majority of ALL committee members, executes itself the moment it's reached, and the decision stays attached to what it was about — findable at an AGM three years from now.", check: "No chasing, no email thread, one permanent trail." },
    ],
  },
  {
    id: "invite", sec: "start", icon: Users, mins: 3, who: "Committee members",
    title: "Bring your neighbours aboard",
    intro: "Nothing in NaloHub works better than a building that's actually in it.",
    roles: (u) => isCommittee(u.role),
    steps: [
      { t: "Open ⟨Directory⟩ and tap ⟨Add person⟩.", check: "The add-person form is open.", target: '[data-guide="g-add-person"]', view: "directory" },
      { t: "Enter their name, role (Owner / Tenant / Committee / Building manager), unit — and most importantly, the email address they'll sign in with.", check: "The email is the one they actually read.", view: "directory" },
      { t: "Tap ⟨Add person⟩. They're on the roll — no invitation email to compose, nothing for them to install.", check: "They appear in the Directory.", view: "directory" },
      { t: "Tell them (or show them) the one-liner: open the building's NaloHub address, type that email, tap ⟨Email me a sign-in link⟩. Point them at the \u201CGet in\u201D guide — it's printable.", check: "They sign in first go, no password created.", },
      { t: "Watch the aboard meter climb. Every sign-in is one more neighbour in the Nalo.", check: "The building starts talking to itself in one place." },
    ],
  },
  {
    id: "compliance", sec: "committee", icon: CalendarClock, mins: 4, who: "Building manager & committee",
    title: "Work the Compliance Calendar",
    intro: "Your scheme's statutory deadlines with traffic lights — nothing slips past quietly.",
    roles: (u) => isCommittee(u.role) || u.role === "manager",
    steps: [
      { t: "Open ⟨Compliance Calendar⟩. First time only: load the standard deadlines for your scheme, then adjust the dates to your building's actual ones.", check: "Your obligations are listed with due dates.", target: '[data-tour="nav-compliance"]', view: "compliance" },
      { t: "Read the traffic lights. Red needs action now, amber is approaching, green is done or on track.", check: "You can answer \u201Care we compliant?\u201D in one glance.", view: "compliance" },
      { t: "On any item: update its status, add a progress note, and attach the evidence — the certificate, the invoice, the report.", check: "The proof lives with the deadline, not in someone's inbox.", view: "compliance" },
      { t: "Missing an obligation specific to your building? Tap ⟨Add obligation⟩ and it joins the calendar with the rest.", check: "The calendar reflects your building, not a template.", view: "compliance" },
      { t: "Before each meeting, tap ⟨Word agenda⟩ — the calendar becomes a ready-made agenda item. ⟨Excel (CSV)⟩ if you'd rather a spreadsheet.", check: "Compliance is a standing agenda item that writes itself.", target: '[data-guide="g-cp-agenda"]', view: "compliance" },
    ],
  },
  {
    id: "announce", sec: "committee", icon: Megaphone, mins: 2, who: "Committee members",
    title: "Post an announcement",
    intro: "Tell the whole building something in 90 seconds — no more sign in the lift.",
    roles: (u) => isCommittee(u.role),
    steps: [
      { t: "Open ⟨Announcements⟩ and tap ⟨New⟩.", check: "The compose form is open.", target: '[data-guide="g-ann-new"]', view: "announcements" },
      { t: "Write a clear title and your message. Choose who it goes to in Send to: Everyone, Residents (people who live here), Owners, Tenants, Owners who live elsewhere, a saved list, or specific people. The line underneath shows exactly how many people it reaches before you post.", check: "The right people — and only the right people — will see it.", view: "announcements" },
      { t: "Attach a document if there is one, and pin it if it's important.", check: "Pinned notices stay at the top.", view: "announcements" },
      { t: "Tap ⟨Post & email residents⟩ (or ⟨Post & email owners⟩). It appears in-app for everyone instantly — and in production it's emailed to their real addresses too, BCC'd for privacy.", check: "Posted at the top of Announcements; residents are alerted.", view: "announcements" },
    ],
  },
  {
    id: "res-maint", sec: "living", icon: Wrench, mins: 2, who: "Everyone",
    title: "Report a problem & watch it get fixed",
    intro: "Snap it, send it — then watch it move. No chasing, no wondering.",
    roles: () => true,
    steps: [
      { t: "Open ⟨Maintenance⟩ and tap ⟨Report⟩.", check: "The report form is open.", target: '[data-guide="g-maint-report"]', view: "maintenance" },
      { t: "Give it a clear title, pick the category and where it is, add a photo if you can, and save.", check: "\u201CIssue logged \u00B7 committee notified\u201D flashes — the right people already know.", view: "maintenance" },
      { t: "Watch the status chip on your issue: New → Triaged → In progress → Resolved. The days-open badge keeps everyone honest.", check: "You can see, at any moment, exactly where your repair is up to.", view: "maintenance" },
      { t: "That's it. When anything changes, an alert comes to you — you never have to ask \u201Cwhat happened with…?\u201D again.", check: "Reported once, visible always." },
    ],
  },
  {
    id: "book-apply", sec: "living", icon: CalendarCheck, mins: 3, who: "Everyone",
    title: "Book the BBQ — or apply for a pet, reno or permit",
    intro: "Structured forms, decisions back in Alerts, printable permits.",
    roles: () => true,
    steps: [
      { t: "Open ⟨Applications & Bookings⟩.", check: "You can see the spaces you can book and the things you can apply for.", target: '[data-tour="nav-bookings"]', view: "bookings" },
      { t: "Pick what you're after — a shared space or visitor parking to book, or a pet, renovation or parking-permit application.", check: "The short form for it is open.", view: "bookings" },
      { t: "Fill it in and attach any documents it asks for (plans, vet papers), then tap ⟨Request booking⟩ or ⟨Submit application⟩.", check: "It's with the committee — no printed forms, no chasing.", view: "bookings" },
      { t: "The decision lands in ⟨Alerts⟩. Approved applications come with a printable permit.", check: "Everything about your request stays in one place, decision included." },
    ],
  },
  {
    id: "find-docs", sec: "living", icon: FolderOpen, mins: 2, who: "Everyone",
    title: "Find any building document in seconds",
    intro: "By-laws, insurance, minutes — no emailing the secretary and waiting.",
    roles: () => true,
    steps: [
      { t: "Open ⟨Documents⟩.", check: "Documents are grouped by category — Governance, Insurance, Meetings, Financials and more.", target: '[data-tour="nav-documents"]', view: "documents" },
      { t: "Tap the document you're after — the by-laws, the insurance certificate, AGM minutes. It shows \u201Cfetching…\u201D briefly, then opens or downloads.", check: "You have the actual current document, not someone's forwarded copy.", view: "documents" },
      { t: "Can't see something you expected? Some documents are owners-only, and committee working files aren't released yet. Ask via ⟨Messaging⟩ — it's a ten-second question.", check: "You know what exists and how to reach the rest." },
    ],
  },
  {
    id: "message", sec: "living", icon: MessageSquare, mins: 2, who: "Everyone",
    title: "Message your committee or manager",
    intro: "No hunting for an email address — and your message can't get lost.",
    roles: () => true,
    steps: [
      { t: "Open ⟨Messaging⟩.", check: "The message form is right there.", target: '[data-tour="nav-messaging"]', view: "messaging" },
      { t: "Choose who it's for — Committee (BCC) or Building manager — and what it is: an Application, Complaint, Idea or Query.", check: "It goes to the right people, filed the right way.", view: "messaging" },
      { t: "Write your message and tap ⟨Send message⟩.", check: "Sent — and on the record, so it can't fall through the cracks.", view: "messaging" },
      { t: "Replies come back here, with an alert so you don't miss them.", check: "One thread, start to finish." },
    ],
  },
  {
    id: "privacy", sec: "living", icon: Lock, mins: 2, who: "Everyone",
    title: "Choose what your neighbours can see",
    intro: "Your profile, your switches. Nothing is shared unless you say so.",
    roles: () => true,
    steps: [
      { t: "Open ⟨Settings⟩ and find your profile.", check: "You can see your details and the privacy switches.", target: '[data-tour="nav-settings"]', view: "settings" },
      { t: "Set the three toggles the way you want them: ⟨Listed in directory⟩, ⟨Show phone⟩, ⟨Show email⟩ — any mix, changeable any time.", check: "Off means off: that detail simply doesn't appear.", view: "settings" },
      { t: "Check your work: open ⟨Directory⟩ and find yourself — or notice you're not there. That's the point.", check: "The Directory shows exactly what you chose, nothing more." },
    ],
  },
  {
    id: "join-in", sec: "living", icon: PartyPopper, mins: 3, who: "Everyone",
    title: "Join in — events, marketplace, gallery",
    intro: "NaloHub isn't just admin. This is the community half.",
    roles: () => true,
    steps: [
      { t: "Open ⟨Events⟩ and RSVP to something — ⟨Going⟩, ⟨Maybe⟩ or ⟨Can't go⟩. Organisers see numbers instantly.", check: "Your name's on the list; no group-chat archaeology.", target: '[data-tour="nav-events"]', view: "events" },
      { t: "Selling something? ⟨Marketplace⟩ → ⟨List item⟩ — buy and sell within the building, no strangers at the door.", check: "Your listing is up, for neighbours only.", view: "marketplace" },
      { t: "Got a good photo of the building or a community day? ⟨Gallery⟩ → ⟨Add photo⟩.", check: "The building's shared album grows — and it's lovely at AGM time.", view: "gallery" },
      { t: "And if you know a great local tradie, add them to the ⟨Business Directory⟩ so your neighbours benefit too.", check: "Small contributions, real community." },
    ],
  },
  {
    id: "events", sec: "living", icon: CalendarDays, mins: 3, who: "Everyone",
    title: "Post an event & manage RSVPs",
    intro: "From idea to headcount without a single reply-all.",
    roles: () => true,
    steps: [
      { t: "Open ⟨Events⟩ and tap ⟨Add⟩.", check: "The event form is open.", target: '[data-guide="g-event-add"]', view: "events" },
      { t: "Title, date, time, location — and a Teams link if it's online or hybrid. Add an image if you have one, then tap ⟨Post event⟩.", check: "\u201CEvent posted\u201D — the whole building can see it.", view: "events" },
      { t: "RSVPs count themselves: Going / Maybe / Can't go tallies update live, with names listed under the event.", check: "You know your numbers for catering without asking anyone.", view: "events" },
      { t: "Need to change details? Open the event and edit — everyone sees the current version, not a superseded flyer in the lift.", check: "One source of truth for the event." },
    ],
  },
  {
    id: "corr-email", sec: "committee", icon: Mail, mins: 5, who: "Committee & building manager",
    title: "Set up the building's email address & file every reply",
    intro: "One address the whole committee can see — a permanent, tamper-evident record.",
    roles: (u) => isCommittee(u.role) || u.role === "manager" || u.msc === true,
    steps: [
      { t: "Open ⟨Settings⟩ and find the ⟨Building email address⟩ card. Copy the address — it looks like yourbuilding@send.nalohub.com.", check: "You have the building's one public address.", target: '[data-tour="nav-settings"]', view: "settings" },
      { t: "Share it with your strata manager, insurer, council and trades: \u201Cplease use this address for building matters\u201D. Mail sent there lands in NaloHub, visible to the committee — not in someone's personal inbox.", check: "The building owns its correspondence, whoever is on the committee next year." },
      { t: "To send: open ⟨Correspondence⟩, tap ⟨New message⟩ — choose or add the contact, write it, attach documents, tap ⟨Send⟩.", check: "It emails from the building's address and every word is logged.", target: '[data-guide="g-corr-new"]', view: "correspondence" },
      { t: "Replies thread back to the right conversation automatically.", check: "The whole exchange lives in one place, in order.", view: "correspondence" },
      { t: "If a reply can't be matched, it waits in ⟨Unfiled⟩ — never lost. Open it and tap ⟨File as a new thread⟩, or add it to a thread you already have.", check: "The email opens as a thread — the record is complete again.", view: "correspondence" },
    ],
  },
  {
    id: "maint-history", sec: "bm", icon: History, mins: 5, who: "Building manager & committee",
    title: "Load your maintenance history",
    intro: "Backdate past jobs so the register is honest from day one.",
    roles: (u) => canMaint(u),
    steps: [
      { t: "Open ⟨Maintenance⟩ and tap ⟨Report⟩ — the same form, with two extra date fields you'll see as manager or committee.", check: "You can see \u201CReported on (backdate)\u201D and \u201CResolved on\u201D.", target: '[data-guide="g-maint-report"]', view: "maintenance" },
      { t: "Enter a past job as usual — title, category, location — then set ⟨Reported on (backdate)⟩ to the date it was actually raised.", check: "The record carries its true date, not today's.", view: "maintenance" },
      { t: "If the job is finished, set ⟨Resolved on⟩ too — it files straight to Resolved with the right dates at both ends.", check: "Closed jobs don't clutter the open list.", view: "maintenance" },
      { t: "Work back through the last 6–12 months of jobs from your notes or emails. Fifteen minutes, once.", check: "The register and its aging figures are honest from day one — and your first Maintenance Report already means something." },
    ],
  },
  {
    id: "nalopilot", sec: "living", icon: Scale, mins: 3, who: "Everyone",
    title: "Ask Nalo — plain-English answers on strata law",
    intro: "Your by-laws and your state's body corporate law, minus the legalese.",
    roles: () => true,
    steps: [
      { t: "Open ⟨NaloPilot⟩.", check: "You can see the question box.", target: '[data-tour="nav-nalopilot"]', view: "nalopilot" },
      { t: "Type a question the way you'd ask a person — like the example shown: \u201CCan we keep a pet in our lot?\u201D — and tap ⟨Ask⟩.", check: "The answer cites the exact by-law or section it came from, so you can check it yourself.", view: "nalopilot" },
      { t: "Good things to ask: notice periods for meetings \u00B7 who pays — my lot or common property? \u00B7 pet, parking and noise rules \u00B7 what the committee can spend without a vote \u00B7 what a motion needs to pass.", check: "Ten seconds to an answer that used to mean an email to the strata manager.", view: "nalopilot" },
      { t: "One honest note: it explains the law and your by-laws — it isn't legal advice. For a live dispute, it tells you where the question actually lands.", check: "Informed first, professional help when it matters." },
    ],
  },
  {
    id: "docs-upload", sec: "committee", icon: Upload, mins: 3, who: "Committee members",
    title: "Upload & file documents — and control who sees them",
    intro: "The visibility choice is the whole game: right document, right audience.",
    roles: (u) => isCommittee(u.role),
    steps: [
      { t: "Open ⟨Documents⟩ and tap ⟨Upload⟩.", check: "The upload form is open.", target: '[data-guide="g-doc-upload"]', view: "documents" },
      { t: "Choose the file — up to 5MB; if a scan is bigger, re-scan at 150 DPI greyscale and it'll fit comfortably.", check: "The file is attached.", view: "documents" },
      { t: "Pick the category, then the choice that matters most — ⟨Who can see it⟩: All residents \u00B7 Owners only \u00B7 Committee only (working file). Insurance certificate: all residents. AGM minutes: owners. A draft contract: committee only.", check: "The right people can find it; the wrong people can't.", view: "documents" },
      { t: "Working files show \u201Cnot yet released\u201D — when a draft is ready for owners, tap ⟨Release⟩ next to it.", check: "Drafts stay drafts until the committee says otherwise.", view: "documents" },
    ],
  },
  {
    id: "complaint", sec: "committee", icon: ShieldCheck, mins: 4, who: "Committee members",
    title: "Log a complaint & keep a defensible record",
    intro: "Facts, dates, and what was done — the record a tribunal respects.",
    roles: (u) => isCommittee(u.role),
    steps: [
      { t: "Open ⟨Dispute Records⟩ and tap ⟨Log a complaint⟩ — whether a resident raised it or the committee is recording it for audit purposes, the record starts the same way.", check: "You can see the new-complaint form.", target: '[data-guide="g-dp-log"]', view: "disputes" },
      { t: "Give it a factual title and a category, then tap ⟨Start record⟩.", check: "\u201CComplaint logged — the record starts now\u201D, with its own reference number.", view: "disputes" },
      { t: "Add entries as things actually happen: an ⟨Update⟩ (a call, a decision), an ⟨Email or message⟩, a ⟨Document⟩ — or pull a resident's complaint straight in with ⟨From in-app messages⟩. Then ⟨Add to record⟩.", check: "Every entry is dated, attributed, and can never be edited or deleted.", view: "disputes" },
      { t: "Keep it neutral and procedural — record what happened and what was done, not opinions about people. That discipline is exactly what makes the record defensible.", check: "Reads like a log book, not a grievance." },
      { t: "If it grows: tap ⟨Escalate to formal⟩ — the entire history travels with it — and export the full Word record any time for the tribunal.", check: "If it ever gets serious, you're already prepared." },
    ],
  },
];

// Which guide a screen suggests (the "Step-by-step" pill above each screen).
const VIEW_GUIDE = { maintenance: ["maint-vote", "res-maint"], mworkflow: "maint-vote", reports: "maint-report", walkthrough: "walkthrough", voting: "vote", alerts: "vote", directory: "invite", compliance: "compliance", announcements: "announce", correspondence: "corr-email", bookings: "book-apply", documents: ["docs-upload", "find-docs"], messaging: "message", events: "events", gallery: "join-in", marketplace: "join-in", nalopilot: "nalopilot", disputes: "complaint" };

const guideBus = { open: null };
const openGuide = (id) => { if (guideBus.open) guideBus.open(id || "library"); };
const guideKey = (gid, uid) => `nalo_guide_${gid}_${uid || "anon"}`;
const guidesFor = (user) => GUIDES.filter((g) => { try { return g.roles(user); } catch (e) { return false; } });

// Render "…⟨Button label⟩…" step text with the labels as button-style pills.
function GuideText({ text, T }) {
  const parts = String(text).split(/⟨|⟩/);
  return (<span>{parts.map((p, i) => i % 2 === 1
    ? <b key={i} className="inline-block align-baseline rounded-md px-1.5 py-px mx-px text-[12px] font-semibold whitespace-nowrap" style={{ background: hexToRgba(T.accent, 0.14), color: T.accent, border: `1px solid ${hexToRgba(T.accent, 0.35)}` }}>{p}</b>
    : <span key={i}>{p}</span>)}</span>);
}

// Printable A4 cheat sheet — same GUIDES data, branded, one page.
// The Walk Through report. A rendering of the register at a point in time, not a
// document anyone types into: everything below is a filter over walkthrough_findings.
// Branded A4, opens in a print window, save as PDF. Eight parts plus the two
// appendices, in the order the committee reads them: what got closed comes first.
const WT_CLASS = {
  S: ["Standard", "A Schedule 1 duty not met at its contracted frequency"],
  R: ["Rectification", "One-off repair or remediation"],
  C: ["Contracted works", "Needs quote, scope or Body Corporate resolution"],
  H: ["Hazard", "Workplace health and safety"],
  L: ["Lot owner", "Outside caretaker scope"],
  G: ["Governance", "Contract deliverable"],
};

// Evidence thumbnails. The report carries small JPEGs so it stays emailable; the
// full image stays in storage against the finding. 240px at q0.72 lands each one
// around 12-18KB, so even a photo-heavy walk produces a file that will send.
const THUMB_W = 240;
async function thumbDataUri(path) {
  const blob = await mediaBlob(path);
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, THUMB_W / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c.toDataURL("image/jpeg", 0.72);
}

// Walks the event trail and turns every photo into a thumbnail, keyed by finding.
// A missing or unreadable image is skipped rather than failing the whole report.
async function collectEvidence(findings, events, onProgress) {
  const byF = {};
  (events || []).forEach((e) => { if (e.photo_path) (byF[e.finding_id] = byF[e.finding_id] || []).push(e); });
  const total = Object.values(byF).reduce((a, x) => a + x.length, 0);
  let done = 0;
  const out = {};
  for (const f of findings || []) {
    const evs = byF[f.id];
    if (!evs || !evs.length) continue;
    const entry = { observed: [] };
    for (const ev of evs.sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1))) {
      try {
        const uri = await thumbDataUri(ev.photo_path);
        if (ev.event === "raised") entry.raised = uri;
        else if (ev.event === "closed") entry.closed = uri;
        else entry.observed.push({ uri, on: ev.occurred_at });
      } catch (err) { /* image gone from storage; the row still reports */ }
      done += 1;
      if (onProgress) onProgress(done, total);
    }
    out[f.id] = entry;
  }
  return out;
}

// Same downscale, but Word needs raw bytes and explicit dimensions rather than a
// data URI, so the two collectors share the canvas step and differ only at the end.
async function thumbBuffer(path) {
  const blob = await mediaBlob(path);
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, THUMB_W / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  const out = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.72));
  return { data: await out.arrayBuffer(), w: Math.round(c.width * 0.55), h: Math.round(c.height * 0.55) };
}

async function collectEvidenceBuffers(findings, events) {
  const byF = {};
  (events || []).forEach((e) => { if (e.photo_path) (byF[e.finding_id] = byF[e.finding_id] || []).push(e); });
  const out = {};
  for (const f of findings || []) {
    const evs = byF[f.id];
    if (!evs || !evs.length) continue;
    const entry = { observed: [] };
    for (const ev of evs.sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1))) {
      try {
        const buf = await thumbBuffer(ev.photo_path);
        if (ev.event === "raised") entry.raised = buf;
        else if (ev.event === "closed") entry.closed = buf;
        else entry.observed.push(Object.assign(buf, { on: ev.occurred_at }));
      } catch (err) { /* image gone from storage; the row still reports */ }
    }
    out[f.id] = entry;
  }
  return out;
}

// Which closures belong to a walk's report. A finding closed AT a walk belongs to that
// walk. One confirmed done BETWEEN walks belongs to the next walk: after the previous
// walk's date, up to and including this one's. On the most recent walk, anything closed
// since it is listed too, so a copy pulled for a meeting is current. Used by PDF and Word
// alike so the two can never disagree.
function walkClosures(walk, walks, findings) {
  const wid = walk && walk.id;
  const sorted = (walks || []).slice().sort((a, b) => (a.walk_date < b.walk_date ? -1 : a.walk_date > b.walk_date ? 1 : 0));
  const i = sorted.findIndex((x) => x.id === wid);
  const prev = i > 0 ? sorted[i - 1] : null;
  const isLatest = i === sorted.length - 1;
  const day = (f) => localDay(f.closed_at);
  const closed = (findings || []).filter((f) => f.status === "closed");
  const atWalk = closed.filter((f) => f.closed_walk_id === wid);
  const between = closed.filter((f) => !f.closed_walk_id && walk && (!prev || day(f) > prev.walk_date) && day(f) <= walk.walk_date);
  const since = isLatest && walk ? closed.filter((f) => !f.closed_walk_id && day(f) > walk.walk_date) : [];
  return { closedHere: atWalk.concat(between), since };
}
const notWalkedList = (walk) => (walk && Array.isArray(walk.sections_not_walked) ? walk.sections_not_walked : []);
const notWalkedText = (walk) => [notWalkedList(walk).map((x) => x.name + (x.reason ? ` (${x.reason})` : "")).join("; "), (walk && walk.areas_not_walked) || ""].filter(Boolean).join(". ");

// The report tab is opened the moment the button is pressed, while the tap still counts as
// the person's own action. A tab opened after seconds of photo work looks like a pop-up to
// the browser, and Safari in particular blocks it. The tab shows a working screen until the
// report is ready, then the report replaces it and the print screen opens.
function openReportWindow() {
  const w = window.open("", "_blank");
  if (!w) return null;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Building your report</title><style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B1F3A;color:#fff;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
    .c{text-align:center;padding:24px;max-width:440px}
    .w{display:flex;gap:9px;justify-content:center;margin-bottom:26px}
    .w span{width:12px;height:12px;border-radius:50%;background:#1FA6A6;animation:b 1.2s ease-in-out infinite}
    .w span:nth-child(2){animation-delay:.15s}.w span:nth-child(3){animation-delay:.3s}.w span:nth-child(4){animation-delay:.45s}
    @keyframes b{0%,80%,100%{transform:translateY(0);opacity:.45}40%{transform:translateY(-14px);opacity:1}}
    @media (prefers-reduced-motion:reduce){.w span{animation:none;opacity:1}}
    h1{font-size:21px;line-height:1.3;margin:0 0 10px}p{margin:0 0 8px;color:#C9D8E6;font-size:14px;line-height:1.5}
    #n{font-variant-numeric:tabular-nums;color:#7FD6D3;font-weight:600}
  </style></head><body><div class="c"><div class="w"><span></span><span></span><span></span><span></span></div>
  <h1>You've captured a lot. We're working on it.</h1>
  <p id="n">Gathering the photo evidence...</p>
  <p>The print screen opens by itself when the report is ready. Choose Save as PDF.</p></div></body></html>`);
  w.document.close();
  return w;
}
const reportProgress = (win, done, total) => {
  try { const el = win && win.document.getElementById("n"); if (el) el.textContent = `Preparing photo ${done} of ${total}`; } catch (e) { /* tab closed */ }
};

function printWalkReport({ walk, building, sections, findings, events, prevWalk, walks, photos, win }) {
  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const dmy = (d) => (d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "");
  const now = new Date();
  // One generation stamp, shown in the header and repeated on every page, so a
  // printed copy can always be matched against another printed copy.
  const stamp = now.toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const wid = walk && walk.id;
  const F = findings || [];
  const P = photos || {};
  const evByF = {};
  (events || []).forEach((e) => { (evByF[e.finding_id] = evByF[e.finding_id] || []).push(e); });

  const { closedHere, since } = walkClosures(walk, walks, F);
  const nwl = notWalkedList(walk);
  const notWalkedOf = (sec) => nwl.find((x) => (x.section_id && x.section_id === sec.id) || x.name === sec.name) || null;
  const closedWhen = (f) => dmy(f.closed_at) + (f.closed_walk_id ? "" : " (between walks)");
  const newHere = F.filter((f) => f.status === "open" && wid && f.first_raised_walk_id === wid);
  const carried = F.filter((f) => f.status === "open" && (!wid || f.first_raised_walk_id !== wid));
  const byClass = (c) => F.filter((f) => f.status === "open" && f.class === c);
  const hazards = byClass("H"), decisions = byClass("C"), lot = byClass("L"), gov = byClass("G");
  const inWalkParts = (arr) => arr.filter((f) => ["S", "R"].includes(f.class));
  const recurrence = F.filter((f) => f.class === "S" && f.status === "open" && (f.walks_open || 0) >= 3)
    .sort((a, b) => (b.walks_open || 0) - (a.walks_open || 0));
  const overdue = F.filter((f) => f.overdue);

  // --- evidence -------------------------------------------------------------
  // Thumbnails only. The full image stays in the app, one tap from the finding.
  const img = (uri, cap) => (uri
    ? `<figure><img src="${uri}"/><figcaption>${esc(cap || "")}</figcaption></figure>`
    : "");
  const pair = (f) => {
    const p = P[f.id] || {};
    if (!p.raised && !p.closed) return "";
    return `<div class="pair">${img(p.raised, "Raised " + dmy(f.first_raised_on))}${img(p.closed, "Closed " + closedWhen(f))}</div>`;
  };
  const shots = (f) => {
    const p = P[f.id] || {};
    const all = [p.raised ? [p.raised, "Raised " + dmy(f.first_raised_on)] : null]
      .concat((p.observed || []).map((o) => [o.uri, "Seen " + dmy(o.on)]))
      .filter(Boolean);
    return all.length ? `<div class="pair">${all.map(([u, c]) => img(u, c)).join("")}</div>` : "";
  };

  const cell = (v) => `<td>${esc(v) || "<span class='q'>-</span>"}</td>`;
  const rowsFor = (arr, cols, ev) => arr.map((f) => {
    const cells = cols.map((c) => cell(typeof c === "function" ? c(f) : f[c])).join("");
    const e2 = ev ? ev(f) : "";
    return `<tr>${cells}${ev ? `<td class="ev">${e2}</td>` : ""}</tr>`;
  }).join("");
  const table = (heads, arr, cols, ev) => arr.length
    ? `<table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}${ev ? "<th>Evidence</th>" : ""}</tr></thead><tbody>${rowsFor(arr, cols, ev)}</tbody></table>`
    : `<p class="none">Nothing in this section.</p>`;

  const due = (f) => (f.due_date ? dmy(f.due_date) + (f.overdue ? "  OVERDUE" : "") : "");
  const ownerDue = (f) => [f.owner, due(f)].filter(Boolean).join("  ·  ");
  const age = (f) => `${f.walks_open || 1} walk${(f.walks_open || 1) === 1 ? "" : "s"} · since ${dmy(f.first_raised_on)}`;

  // --- how the building is tracking, walk over walk -------------------------
  const issued = (walks || []).filter((w) => w.issued_at).sort((a, b) => (a.walk_date < b.walk_date ? -1 : 1));
  let running = 0;
  let prevIssued = null;
  const trend = issued.map((w) => {
    const raised = F.filter((f) => f.first_raised_walk_id === w.id).length;
    // Closed at this walk, or confirmed done between the previous issued walk and this one.
    const shut = F.filter((f) => f.status === "closed" && (f.closed_walk_id === w.id
      || (!f.closed_walk_id && (!prevIssued || localDay(f.closed_at) > prevIssued.walk_date) && localDay(f.closed_at) <= w.walk_date))).length;
    prevIssued = w;
    running += raised - shut;
    return { date: w.walk_date, raised, shut, open: running, id: w.id };
  });
  const last = trend[trend.length - 1], before = trend[trend.length - 2];
  const dir = !before ? null : last.open < before.open ? "improving" : last.open > before.open ? "deteriorating" : "steady";
  const totalRaised = trend.reduce((a, t) => a + t.raised, 0);
  const totalShut = trend.reduce((a, t) => a + t.shut, 0);
  const closeRate = totalRaised ? Math.round((totalShut / totalRaised) * 100) : 0;
  const trendBlock = trend.length < 2 ? "" : `
    <h2>How the building is tracking</h2>
    <p class="lead">Closing ratio is everything closed against everything raised, across every walk on the register. Direction compares open items at this walk against the one before.</p>
    <div class="stats">
      ${stat(closeRate + "%", "closing ratio, all walks", closeRate >= 50 ? "good" : "warn")}
      ${stat(totalRaised, "raised, all walks")}
      ${stat(totalShut, "closed, all walks", "good")}
      ${stat(dir ? dir[0].toUpperCase() + dir.slice(1) : "-", "direction", dir === "improving" ? "good" : dir === "deteriorating" ? "bad" : "")}
    </div>
    <table><thead><tr><th>Walk</th><th>Raised</th><th>Closed</th><th>Open after this walk</th></tr></thead><tbody>
    ${trend.map((t) => `<tr><td>${esc(dmy(t.date))}</td><td>${t.raised}</td><td>${t.shut}</td><td><b>${t.open}</b></td></tr>`).join("")}
    </tbody></table>`;

  function stat(n, l, tone) { return `<div class="stat ${tone || ""}"><b>${n}</b><span>${esc(l)}</span></div>`; }

  const groups = (sections || []).map((sec) => ({ sec, mine: inWalkParts(newHere).filter((f) => f.section_id === sec.id), nw: notWalkedOf(sec) }));
  const groupBlocks = groups.map(({ sec, mine, nw }) => `
    <div class="grp">
      <h3>${esc(sec.name)}</h3>
      <div class="duty">${esc(sec.duty_reference || "")}</div>
      ${mine.length
        ? table(["Ref", "Cls", "Location", "Observation", "Required outcome", "Owner / due"], mine,
            ["ref", "class", "location", "observation", "required_outcome", ownerDue], shots)
        : nw ? `<p class="nw">Not walked on this walk${nw.reason ? ": " + esc(nw.reason) : ""}.</p>`
        : `<p class="nil">Inspected, nothing raised.</p>`}
    </div>`).join("");
  // A group only counts as a nil return if it was actually walked.
  const nilCount = groups.filter((g) => !g.mine.length && !g.nw).length;
  const walkedCount = groups.filter((g) => !g.nw).length;
  const nwCount = groups.length - walkedCount;
  const unsectioned = inWalkParts(newHere).filter((f) => !f.section_id);

  const html = `<!doctype html><html><head><meta charset="utf-8">
  <title>Walk Through report - ${esc(building.name)} - ${esc(dmy(walk && walk.walk_date))}</title>
  <style>
    @page { size: A4; margin: 13mm 13mm 18mm 13mm; }
    * { box-sizing: border-box; }
    body { font-family: "Sora", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #25425E; margin: 0; font-size: 10px; line-height: 1.4; }
    .head { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #60A0B4; padding-bottom: 9px; }
    .logo { height: 38px; } .word { font-weight: 800; font-size: 20px; } .word i { color: #60A0B4; font-style: normal; }
    .meta { margin-left: auto; text-align: right; font-size: 9px; color: #5b7186; }
    h1 { font-size: 20px; margin: 13px 0 1px; }
    .sub { color: #5b7186; font-size: 11px; margin-bottom: 10px; }
    h2 { font-size: 13px; margin: 16px 0 5px; padding-bottom: 3px; border-bottom: 2px solid #60A0B4; page-break-after: avoid; }
    h3 { font-size: 11px; margin: 9px 0 1px; page-break-after: avoid; }
    .duty { font-size: 8.5px; color: #60A0B4; font-style: italic; margin-bottom: 3px; }
    .lead { color: #5b7186; font-size: 9.5px; margin: 0 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 7px; }
    th { background: #25425E; color: #fff; font-size: 8px; text-align: left; padding: 4px 5px; font-weight: 700; }
    td { vertical-align: top; padding: 4px 5px; border-bottom: 1px solid #dbe6ee; font-size: 8.8px; }
    tr { page-break-inside: avoid; }
    td:first-child { font-weight: 700; white-space: nowrap; }
    td.ev { width: 200px; }
    .pair { display: flex; gap: 4px; }
    .pair figure { margin: 0; }
    .pair img { width: 92px; height: auto; border: 1px solid #dbe6ee; border-radius: 3px; display: block; }
    .pair figcaption { font-size: 7px; color: #5b7186; margin-top: 1px; }
    .q { color: #b3c2ce; }
    .none, .nil, .nw { font-size: 9px; color: #5b7186; margin: 2px 0 7px; } .nil { color: #2f7d5d; } .nw { color: #9a6408; font-style: italic; }
    .grp { page-break-inside: avoid; margin-bottom: 4px; }
    .stats { display: flex; gap: 7px; margin: 9px 0 11px; }
    .stat { flex: 1; border: 1px solid #dbe6ee; border-radius: 7px; padding: 7px 9px; }
    .stat b { display: block; font-size: 18px; line-height: 1.05; }
    .stat span { font-size: 8px; color: #5b7186; }
    .stat.bad { border-color: #d98282; background: #fdf3f3; } .stat.bad b { color: #a33; }
    .stat.good { border-color: #8fc3a8; background: #f2f9f5; } .stat.good b { color: #2f7d5d; }
    .stat.warn { border-color: #e0b783; background: #fdf7ef; } .stat.warn b { color: #8a5a17; }
    .banner { border-left: 4px solid #a33; background: #fdf3f3; padding: 7px 10px; margin: 7px 0; font-size: 9.5px; }
    .keytab td { font-size: 8.5px; } .keytab td:first-child { width: 22px; }
    .foot { margin-top: 13px; border-top: 1px solid #dbe6ee; padding-top: 7px; font-size: 8px; color: #5b7186; display: flex; justify-content: space-between; gap: 10px; }
    /* position:fixed repeats on every printed page, which is the only reliable
       way to get a running footer out of a browser. Two people in a meeting can
       then check they are holding the same generation. */
    .pagefoot { position: fixed; left: 0; right: 0; bottom: 0; background: #fff;
                border-top: 1px solid #dbe6ee; padding-top: 4px; font-size: 7.5px;
                color: #5b7186; display: flex; justify-content: space-between; gap: 10px; }
    body { padding-bottom: 8mm; }
  </style></head><body>
  <div class="head">
    <img class="logo" alt="NaloHub" src="/NaloHub-Logo.png" onerror="this.style.display='none';var w=document.getElementById('wm');if(w)w.style.display='block'"/>
    <div class="word" id="wm" style="display:none">Nal<i>o</i>Hub</div>
    <div class="meta">Generated from the NaloHub register<br/>${esc(stamp)}</div>
  </div>

  <h1>Building Walk Through</h1>
  <div class="sub">${esc(building.name)}${building.address ? " · " + esc(building.address) : ""} · Walk of ${esc(dmy(walk && walk.walk_date))}</div>

  <div class="stats">
    ${stat(closedHere.length, "closed since last walk", "good")}
    ${stat(inWalkParts(newHere).length, "raised at this walk")}
    ${stat(carried.length, "carried from earlier walks", carried.length ? "warn" : "")}
    ${stat(overdue.length, "overdue", overdue.length ? "bad" : "")}
    ${stat(hazards.length, "open hazards", hazards.length ? "bad" : "")}
  </div>

  ${hazards.length ? `<div class="banner"><b>${hazards.length} workplace health and safety hazard${hazards.length === 1 ? "" : "s"} open.</b> See Part 5. Schedule 1 requires hazards to be reported to the Body Corporate for instructions, with remedial action taken where necessary.</div>` : ""}

  <h2>Part 1 · Walk record</h2>
  <table><tbody>
    <tr><td style="width:120px">Date of walk</td><td>${esc(dmy(walk && walk.walk_date))}</td></tr>
    <tr><td>In attendance</td><td>${esc((walk && walk.attendees) || "")}</td></tr>
    ${walk && walk.weather ? `<tr><td>Weather</td><td>${esc(walk.weather)}</td></tr>` : ""}
    <tr><td>Areas not walked</td><td>${esc(notWalkedText(walk) || "None. All groups were inspected.")}</td></tr>
    <tr><td>Compared against</td><td>${prevWalk ? esc(dmy(prevWalk.walk_date)) : "First walk on the register"}</td></tr>
    <tr><td>Status</td><td>${walk && walk.issued_at ? "Issued " + esc(new Date(walk.issued_at).toLocaleString("en-AU")) : "Draft, not yet issued"}</td></tr>
  </tbody></table>
  <p class="lead">Recorded against the Caretaking and Letting Agreement. Every standing question cites the Schedule 1 duty it tests and that duty's contracted frequency. Findings carry a permanent reference and stay on the register until closed and verified. Photographs are thumbnails; the full image sits against the finding in the app.</p>

  ${trendBlock}

  <h2>Part 2 · Closed since last walk</h2>
  <p class="lead">Before and after, side by side. This is the proof the work was done.</p>
  ${table(["Ref", "Cls", "Location", "What it was", "Outcome", "Closed"], closedHere,
      ["ref", "class", "location", "observation", "required_outcome", closedWhen], pair)}
  ${since.length ? `<h3>Closed since this walk</h3><p class="lead">Confirmed done after this walk, up to the moment this copy was made.</p>
  ${table(["Ref", "Cls", "Location", "What it was", "Outcome", "Closed"], since,
      ["ref", "class", "location", "observation", "required_outcome", closedWhen], pair)}` : ""}

  <h2>Part 3 · The walk, by duty group</h2>
  <p class="lead">${nilCount} of ${walkedCount} groups walked with nothing raised${nwCount ? `, and ${nwCount} not walked` : ""}. A nil return is a dated record that the area was walked, not an absence.</p>
  ${groupBlocks}
  ${unsectioned.length ? `<h3>Other observations</h3>${table(["Ref", "Cls", "Location", "Observation", "Required outcome", "Owner / due"], unsectioned, ["ref", "class", "location", "observation", "required_outcome", ownerDue], shots)}` : ""}

  <h2>Part 4 · Carried and overdue</h2>
  <p class="lead">Open from a previous walk. Nothing leaves the register except by being closed in Part 2.</p>
  ${table(["Ref", "Cls", "Location", "Observation", "Required outcome", "Open for", "Owner / due"],
      inWalkParts(carried).sort((a, b) => (b.walks_open || 0) - (a.walks_open || 0)),
      ["ref", "class", "location", "observation", "required_outcome", age, ownerDue])}

  <h2>Part 5 · Workplace health and safety</h2>
  ${table(["Ref", "Risk", "Location", "Hazard", "Control", "Open for"], hazards,
      ["ref", (f) => String(f.risk_rating || "").toUpperCase(), "location", "observation", "required_outcome", age], shots)}

  <h2>Part 6 · For Body Corporate decision</h2>
  <p class="lead">The Building Manager has done their part; these are waiting on the committee.</p>
  ${table(["Ref", "Matter", "What is needed to decide", "Owner", "Due"], decisions,
      ["ref", "location", "observation", "owner", due])}

  <h2>Part 7 · Lot owner and by-law matters</h2>
  <p class="lead">Outside caretaker scope. A notice-and-date trail under clause 3.10.</p>
  ${table(["Ref", "Lot", "Matter", "Action", "Owner", "Due"], lot,
      ["ref", "location", "observation", "required_outcome", "owner", due])}

  <h2>Part 8 · Contract and governance</h2>
  ${table(["Ref", "Deliverable", "Detail", "Owner", "Due"], gov,
      ["ref", "location", "observation", "owner", due])}

  <h2>Appendix A · Recurrence schedule</h2>
  <p class="lead">Standard-class findings open at three or more walks, with every date observed. Produced from the register, not written. One precise dated finding carries more than many loose ones.</p>
  ${recurrence.length ? `<table><thead><tr><th>Ref</th><th>Duty group</th><th>Location</th><th>Observation</th><th>First raised</th><th>Observed</th><th>Evidence</th></tr></thead><tbody>
  ${recurrence.map((f) => `<tr><td>${esc(f.ref)}</td><td>${esc(f.section_name || "")}</td><td>${esc(f.location)}</td><td>${esc(f.observation)}</td><td>${esc(dmy(f.first_raised_on))}</td><td>${esc((evByF[f.id] || []).filter((e) => ["raised", "observed_again"].includes(e.event)).map((e) => dmy(e.occurred_at)).join(", "))}</td><td class="ev">${shots(f)}</td></tr>`).join("")}
  </tbody></table>` : `<p class="none">No standard-class finding has reached three walks.</p>`}

  <h2>Appendix B · Finding classes</h2>
  <table class="keytab"><tbody>
  ${Object.entries(WT_CLASS).map(([k, v]) => `<tr><td>${k}</td><td><b>${esc(v[0])}</b> &nbsp; ${esc(v[1])}</td></tr>`).join("")}
  </tbody></table>
  <p class="lead">Standard-class findings are observations against a cited duty, not breach allegations, and are never promoted into the maintenance register. They escalate by recurrence.</p>

  <div class="foot">
    <div>Prepared from the NaloHub Walk Through register. Every entry is backed by the in-app trail: who, what, when. Suitable for tabling in committee meeting minutes.</div>
    <div>Be in the Nalo.</div>
  </div>

  <div class="pagefoot">
    <div>${esc(building.name)} · Walk Through · Walk of ${esc(dmy(walk && walk.walk_date))}</div>
    <div>Generated ${esc(stamp)} · NaloHub</div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
  </body></html>`;

  const w = win || window.open("", "_blank");
  if (!w) return alert("Please allow pop-ups to open the report, then use your browser's Save as PDF.");
  w.document.open(); w.document.write(html); w.document.close();
}

function printGuide(g, building) {
  const month = new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  const pill = (s) => s.replace(/⟨/g, '<b class="pill">').replace(/⟩/g, "</b>");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = g.steps.map((st, i) => `
    <tr><td class="n"><span>${i + 1}</span></td><td class="do">${pill(esc(st.t))}${st.check ? `<div class="chk">✓ You'll know it worked: ${esc(st.check)}</div>` : ""}</td><td class="tick">☐</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>NaloHub guide — ${esc(g.title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; } body { font-family: "Sora", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #25425E; margin: 0; font-size: 11.5px; line-height: 1.45; }
    .head { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #60A0B4; padding-bottom: 10px; }
    .logo { height: 42px; } .word { font-weight: 800; font-size: 22px; letter-spacing: -0.02em; } .word i { color: #60A0B4; font-style: normal; }
    .meta { margin-left: auto; text-align: right; font-size: 10px; color: #5b7186; }
    h1 { font-size: 19px; margin: 14px 0 2px; letter-spacing: -0.01em; }
    .intro { color: #5b7186; margin: 0 0 12px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 7px 8px; border-bottom: 1px solid #dbe6ee; }
    .n span { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 999px; background: #25425E; color: #fff; font-weight: 700; font-size: 11px; }
    .pill { display: inline-block; background: #eaf4f7; color: #25425E; border: 1px solid #60A0B4; border-radius: 6px; padding: 0 5px; font-size: 10.5px; white-space: nowrap; }
    .chk { color: #2f7d5d; font-size: 10px; margin-top: 3px; }
    .tick { font-size: 15px; color: #9db2c2; width: 24px; text-align: center; }
    .foot { margin-top: 14px; border-top: 1px solid #dbe6ee; padding-top: 8px; font-size: 9.5px; color: #5b7186; display: flex; justify-content: space-between; gap: 10px; }
  </style></head><body>
  <div class="head">
    <img class="logo" alt="NaloHub" src="/NaloHub-Logo.png" onerror="this.style.display='none';var w=document.getElementById('wm');if(w)w.style.display='block'"/>
    <div class="word" id="wm" style="display:none">Nal<i>o</i>Hub</div>
    <div class="meta">${esc(g.who)} · about ${g.mins} minute${g.mins === 1 ? "" : "s"}<br/>Current at ${esc(month)}${building && building.name ? ` · ${esc(building.name)}` : ""}</div>
  </div>
  <h1>${esc(g.title)}</h1>
  <p class="intro">${esc(g.intro)} Tick each step as you go — the same guide lives in the app under Help → Guides.</p>
  <table>${rows}</table>
  <div class="foot"><div>Free to copy, print and share. Made for Australian apartment buildings by NaloHub — <b>nalohub.com</b></div><div>🌊 Be in the Nalo.</div></div>
  <script>window.onload = () => setTimeout(() => window.print(), 250);<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return alert("Please allow pop-ups to print the guide.");
  w.document.write(html); w.document.close();
}

// The slim "Step-by-step" pill that sits at the top of task screens.
function GuideBar() {
  const { T, user, view } = useApp();
  const gids = [].concat(VIEW_GUIDE[view] || []);
  const g = gids.map((id) => GUIDES.find((x) => x.id === id)).find((x) => { try { return x && x.roles(user); } catch (e) { return false; } });
  if (!g) return null;
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-3 -mb-1 flex justify-end">
      <button onClick={() => openGuide(g.id)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: hexToRgba(T.accent, 0.12), color: T.accent, border: `1px solid ${hexToRgba(T.accent, 0.3)}` }}>
        <BookOpen size={13} /> Step-by-step: {g.title} <ChevronRight size={13} />
      </button>
    </div>
  );
}

// The guide drawer: bottom sheet on phones, side panel on desktop. The screen
// behind stays fully usable — you DO the task while the guide keeps score.
function GuideDrawer() {
  const { T, user, building, view, setView } = useApp();
  const [openId, setOpenId] = useState(null); // "library" | guide id | null
  useEffect(() => { guideBus.open = setOpenId; return () => { guideBus.open = null; }; }, []);
  const uid = user && user.id;
  const g = openId && openId !== "library" ? GUIDES.find((x) => x.id === openId) : null;
  const [done, setDone] = useState([]);
  useEffect(() => { if (!g) return; try { setDone(JSON.parse(localStorage.getItem(guideKey(g.id, uid)) || "[]")); } catch (e) { setDone([]); } }, [openId]);
  if (!openId) return null;
  const save = (arr) => { setDone(arr); try { localStorage.setItem(guideKey(g.id, uid), JSON.stringify(arr)); } catch (e) {} };
  const toggle = (i) => save(done.includes(i) ? done.filter((x) => x !== i) : [...done, i]);
  const showMe = (st) => {
    const run = () => {
      const el = st.target && document.querySelector(st.target);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("nalo-guide-pulse");
      setTimeout(() => el.classList.remove("nalo-guide-pulse"), 2600);
    };
    if (st.view && view !== st.view) { setView(st.view); setTimeout(run, 420); } else run();
  };
  const close = () => setOpenId(null);
  const list = guidesFor(user);
  const pct = g ? Math.round((done.length / g.steps.length) * 100) : 0;
  return (
    <>
      <style>{`@keyframes naloGuidePulse { 0%,100% { box-shadow: 0 0 0 0 ${hexToRgba(T.accent, 0)}; } 30% { box-shadow: 0 0 0 6px ${hexToRgba(T.accent, 0.45)}; } }
      .nalo-guide-pulse { animation: naloGuidePulse 1.3s ease-out 2; border-radius: 12px; }`}</style>
      <div className="fixed inset-0 z-40 md:bg-transparent bg-black/30" onClick={close} style={{ pointerEvents: "auto" }} />
      <div className="fixed z-50 bottom-0 left-0 right-0 md:left-auto md:top-0 md:w-[400px] flex flex-col rounded-t-2xl md:rounded-none md:border-l" style={{ background: T.bg, borderColor: T.border, maxHeight: "calc(78vh + var(--sab))", height: "auto", paddingBottom: "var(--sab)", boxShadow: "0 -12px 40px rgba(0,0,0,0.35)", ...(window.innerWidth >= 768 ? { maxHeight: "100vh", height: "100vh", paddingTop: "var(--sat)" } : {}) }}>
        <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          {g && <button onClick={() => setOpenId("library")} className="p-1 -ml-1 rounded-lg" style={{ color: T.textMuted }}><ChevronLeft size={18} /></button>}
          <BookOpen size={16} style={{ color: T.accent }} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate" style={{ color: T.text }}>{g ? g.title : "Guides"}</div>
            <div className="text-[11px]" style={{ color: T.textMuted }}>{g ? `${g.who} · about ${g.mins} min · do it with the screen open` : "Step-by-step, with the screen open — pick a task"}</div>
          </div>
          {g && <button onClick={() => printGuide(g, building)} title="Print this guide" className="p-1.5 rounded-lg" style={{ color: T.accent, background: hexToRgba(T.accent, 0.12) }}><Printer size={15} /></button>}
          <button onClick={close} className="p-1.5 rounded-lg" style={{ color: T.textMuted }}><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!g && GUIDE_SECTIONS.map(([sk, sl]) => { const inSec = list.filter((x) => x.sec === sk); if (!inSec.length) return null; return (
            <div key={sk}>
              <div className="text-[10px] uppercase tracking-widest font-bold mt-2 mb-2" style={{ color: T.textMuted }}>{sl}</div>
              {inSec.map((x) => { let dn = 0; try { dn = JSON.parse(localStorage.getItem(guideKey(x.id, uid)) || "[]").length; } catch (e) {}
            return (
              <button key={x.id} onClick={() => setOpenId(x.id)} className="w-full flex items-center gap-3 rounded-xl px-3 py-3 mb-2 text-left" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                <span className="grid place-items-center rounded-lg shrink-0" style={{ width: 36, height: 36, background: hexToRgba(T.accent, 0.14), color: T.accent }}><x.icon size={17} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold leading-snug" style={{ color: T.text }}>{x.title}</span>
                  <span className="block text-[11px] mt-0.5" style={{ color: T.textMuted }}>{x.who} · {x.mins} min{dn > 0 && dn < x.steps.length ? ` · ${dn}/${x.steps.length} done` : dn >= x.steps.length ? " · ✓ completed" : ""}</span>
                </span>
                <ChevronRight size={15} style={{ color: T.textMuted }} />
              </button>
            ); })}
            </div>
          ); })}
          {g && (<>
            <p className="text-[13px] mb-2.5" style={{ color: T.textMuted }}>{g.intro}</p>
            <div className="h-1.5 rounded-full mb-3" style={{ background: hexToRgba(T.accent, 0.15) }}><div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})` }} /></div>
            {g.steps.map((st, i) => { const isDone = done.includes(i);
              return (
                <div key={i} className="flex gap-2.5 rounded-xl px-3 py-2.5 mb-2" style={{ background: T.surface, border: `1px solid ${isDone ? hexToRgba("#34d399", 0.5) : T.border}`, opacity: isDone ? 0.75 : 1 }}>
                  <button onClick={() => toggle(i)} aria-label={isDone ? "Mark step not done" : "Mark step done"} className="grid place-items-center rounded-full shrink-0 mt-0.5" style={{ width: 22, height: 22, border: `2px solid ${isDone ? "#34d399" : hexToRgba(T.accent, 0.5)}`, background: isDone ? "#34d399" : "transparent", color: "#fff" }}>{isDone ? <Check size={13} /> : <span className="text-[10px] font-bold" style={{ color: T.accent }}>{i + 1}</span>}</button>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-relaxed" style={{ color: T.text, textDecoration: isDone ? "line-through" : "none" }}><GuideText text={st.t} T={T} /></div>
                    {st.check && !isDone && <div className="text-[11px] mt-1" style={{ color: "#2f9e77" }}>✓ You'll know it worked: {st.check}</div>}
                    {st.target && !isDone && <button onClick={() => showMe(st)} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ color: T.accent, background: hexToRgba(T.accent, 0.12) }}><Eye size={11} /> Show me</button>}
                  </div>
                </div>
              ); })}
            <div className="flex items-center justify-between mt-1 mb-3">
              <button onClick={() => save([])} className="text-[11px] font-semibold" style={{ color: T.textMuted }}>Reset progress</button>
              <button onClick={() => printGuide(g, building)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3 py-1.5" style={{ color: T.accent, background: hexToRgba(T.accent, 0.12), border: `1px solid ${hexToRgba(T.accent, 0.3)}` }}><Printer size={13} /> Print this guide</button>
            </div>
            {pct === 100 && <div className="rounded-xl px-3 py-2.5 mb-2 text-[13px] font-semibold text-center" style={{ background: hexToRgba("#34d399", 0.14), color: "#2f9e77", border: `1px solid ${hexToRgba("#34d399", 0.4)}` }}>🌊 Done — you just Nalo'd it.</div>}
          </>)}
        </div>
      </div>
    </>
  );
}

const DemoOnly = ({ title, sub, hint }) => (<div><Head title={title} sub={sub} /><Wrap><Empty icon={Sparkles} title="Connects in production" hint={hint} /></Wrap></div>);
const useAuthId = () => {
  const { backend } = useApp();
  const [uid, setUid] = useState(backend ? null : DEMO_UID);
  useEffect(() => { if (backend) supabase.auth.getSession().then(({ data }) => setUid(data && data.session ? data.session.user.id : null)); }, [backend]);
  return uid;
};
const VOTE_COLOR = { yes: SEMANTIC.ok, no: SEMANTIC.bad, abstain: "#8a93a3" };

// ---------- alerts (in-app notification centre) -------------------------------
// Every announcement, message, application, vote and key issue writes a row to
// app_notifications (DB triggers). This view is where people see them; the
// sidebar badge polls the unread count each minute.
const ALERT_VIEW = { announcements: "announcements", applications: "bookings", parking_permits: "bookings", motions: "voting", maintenance: "mworkflow", threads: "messaging", unit_access_items: "unitsearch" };
function AlertsView() { return <AlertsLive />; }
function AlertsLive() {
  const { T, buildingId, setView, flash } = useApp();
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true);
  const reload = () => listNotifications(buildingId).then((r) => { setRows(r); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { reload(); }, [buildingId]);
  const open = async (n) => {
    if (!n.read_at) { try { await markNotificationRead(n.id); } catch (e) {} }
    const v = ALERT_VIEW[n.ref_table];
    if (v) setView(v); else reload();
  };
  const unread = rows.filter((r) => !r.read_at);
  return (
    <div>
      <Head title="Alerts" sub="Everything that needs your eyes, newest first" />
      <Wrap>
        {unread.length > 0 && <Btn kind="ghost" onClick={async () => { await markAllNotificationsRead(buildingId); reload(); flash("All caught up"); }}><Check size={14} /> Mark all read ({unread.length})</Btn>}
        {loading && <Card style={{ padding: 16 }}><div style={{ color: T.textMuted }}>Loading…</div></Card>}
        {!loading && rows.length === 0 && <Empty icon={Bell} title="No alerts yet" hint="Announcements, applications, votes and maintenance activity will land here." />}
        {rows.map((n) => (
          <Card key={n.id} style={{ padding: 14, cursor: "pointer", opacity: n.read_at ? 0.65 : 1, border: n.read_at ? undefined : `1px solid ${hexToRgba(T.accent, 0.4)}` }}>
            <div onClick={() => open(n)} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg grid place-items-center shrink-0 mt-0.5" style={{ background: hexToRgba(T.accent, 0.14), color: T.accent }}><Bell size={14} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{n.title}</div>
                {n.body && <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>{n.body}</div>}
                <div className="text-[11px] mt-1" style={{ color: T.textMuted }}>{fmtDate(localDay(n.created_at))}{ALERT_VIEW[n.ref_table] ? " · tap to open" : ""}</div>
              </div>
              {!n.read_at && <span className="h-2 w-2 rounded-full shrink-0 mt-2" style={{ background: T.accent }} />}
            </div>
          </Card>))}
      </Wrap>
    </div>
  );
}

// ---------- voting (motions + proxies) ---------------------------------------
function VotingView() { return <VotingLive />; }
function VotingLive() {
  const { T, store, user, buildingId, flash } = useApp();
  const uid = useAuthId();
  const [motions, setMotions] = useState([]); const [votes, setVotes] = useState([]); const [proxies, setProxies] = useState([]);
  const [mcomments, setMcomments] = useState([]); const [matts, setMatts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nf, setNf] = useState({ title: "", description: "", attachments: [] });
  const [comments, setComments] = useState({});
  const [queries, setQueries] = useState({});
  const [amend, setAmend] = useState({});   // mid -> { conds, reason, draft } while a member is amending Conditions of Approval
  const [showHist, setShowHist] = useState({});
  const [showNew, setShowNew] = useState(false);
  const [pf, setPf] = useState({ proxy: "", from: today(), to: addDays(today(), 14) });
  const bccMembers = (store.users || []).filter((m) => m.buildingId === buildingId && (m.role === "bcc" || m.role === "admin") && m.authId);
  const reload = async () => {
    try {
      const ms = await listMotions(buildingId);
      setMotions(ms);
      setVotes(await listMotionVotes(ms.map((m) => m.id)));
      setProxies(await listProxies(buildingId));
      setMcomments(await listMotionComments(ms.map((m) => m.id)));
      // supporting detail: pull attachments for application-linked motions
      const appIds = ms.filter((m) => m.context_type === "application" && m.context_id).map((m) => m.context_id);
      setMatts(appIds.length ? await listApplicationAttachments(appIds) : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [buildingId]);
  const myActiveProxy = proxies.find((p) => p.status === "active" && p.proxy_user_id === uid && p.date_from <= today() && p.date_to >= today());
  const votesFor = (mid) => votes.filter((v) => v.motion_id === mid);
  const memberName = (authId) => { const u = (store.users || []).find((x) => x.authId === authId || x.id === authId); return u ? u.name : "Member"; };
  const saveAmendment = async (m) => {
    const a = amend[m.id]; if (!a) return;
    const conds = (a.conds || []).map((c) => c.trim()).filter(Boolean);
    const reason = (a.reason || "").trim();
    if (!reason) { flash("Give the committee a reason for the change — it goes on the record"); return; }
    const before = (m.details && m.details.conditions) || [];
    if (JSON.stringify(conds) === JSON.stringify(before)) { flash("No change to the conditions"); return; }
    const n = votesFor(m.id).length;
    if (n > 0 && !confirm(`Saving this amendment sets aside ${n} vote${n === 1 ? "" : "s"} already cast. Every BCC member will be asked to vote again on the amended conditions. Continue?`)) return;
    const nextV = (m.version || 1) + 1;  // read before the call: demo mode mutates m in place
    try {
      await amendMotionConditions(m.id, conds, reason, user.name);
      setAmend((prev) => { const q = { ...prev }; delete q[m.id]; return q; });
      flash(n > 0 ? `Amended — now v${nextV}. ${n} earlier vote${n === 1 ? "" : "s"} set aside, BCC members alerted to vote again` : `Amended — now v${nextV}. BCC members alerted`);
      reload();
    } catch (e) { flash(String(e.message || e)); }
  };
  const open = async () => {
    if (!nf.title.trim()) return;
    try { await createMotion(buildingId, uid, { title: nf.title.trim(), description: nf.description.trim(), details: { attachments: nf.attachments || [] } }); setNf({ title: "", description: "", attachments: [] }); setShowNew(false); flash("Motion opened — every BCC member has been alerted" + ((nf.attachments || []).length ? ` with ${nf.attachments.length} document${nf.attachments.length === 1 ? "" : "s"}` : "")); reload(); }
    catch (e) { flash(String(e.message || e)); }
  };
  const vote = async (m, v, proxy) => {
    try { await castVote(m.id, uid, v, comments[m.id] || "", proxy); flash(proxy ? `Vote recorded as proxy for ${proxy.principal_name}` : "Vote recorded"); reload(); }
    catch (e) { flash(String(e.message || e).includes("duplicate") || String(e.message || e).includes("uq_motion") ? "That member has already voted on this motion" : String(e.message || e)); }
  };
  const appoint = async () => {
    const p = bccMembers.find((m) => m.id === pf.proxy);
    if (!p) { flash("Choose a proxy — must be another BCC voting member"); return; }
    try {
      await createProxy(buildingId, { principal_user_id: uid, principal_name: user.name, proxy_user_id: p.authId, proxy_name: p.name, date_from: pf.from, date_to: pf.to });
      flash("Proxy appointed — download the signed form for the record"); reload();
    } catch (e) { flash(String(e.message || e)); }
  };
  const tally = (m) => {
    const vs = votesFor(m.id);
    const yes = vs.filter((v) => v.vote === "yes").length, no = vs.filter((v) => v.vote === "no").length, ab = vs.filter((v) => v.vote === "abstain").length;
    const seg = (n, c) => n > 0 && <div style={{ width: `${(n / m.eligible_count) * 100}%`, background: c }} className="h-full" />;
    return (<div className="mt-2">
      <div className="h-2 rounded-full overflow-hidden flex" style={{ background: T.surfaceAlt }}>{seg(yes, SEMANTIC.ok)}{seg(no, SEMANTIC.bad)}{seg(ab, VOTE_COLOR.abstain)}</div>
      <div className="text-xs mt-1" style={{ color: T.textMuted }}>{yes} yes · {no} no · {ab} abstained — majority needs <b style={{ color: T.text }}>{m.threshold} of {m.eligible_count}</b>{(m.version || 1) > 1 ? ` · votes on v${m.version}` : ""}</div>
    </div>);
  };
  const motionCard = (m) => {
    const vs = votesFor(m.id);
    const mine = vs.find((v) => (v.proxy_for_user_id || v.voter_user_id) === uid);
    const principalVoted = myActiveProxy && vs.some((v) => (v.proxy_for_user_id || v.voter_user_id) === myActiveProxy.principal_user_id);
    const sc = m.status === "passed" ? SEMANTIC.ok : m.status === "failed" ? SEMANTIC.bad : m.status === "withdrawn" ? VOTE_COLOR.abstain : SEMANTIC.warn;
    return (
      <Card key={m.id} style={{ padding: 16 }}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{m.title}</div>
            <div className="text-xs" style={{ color: T.textMuted }}>{m.context_type !== "general" ? `${m.context_type} · ` : ""}opened {fmtDate(localDay(m.opened_at))}{m.outcome_note ? ` — ${m.outcome_note}` : ""}</div>
            {m.description && <div className="text-sm mt-1" style={{ color: T.textMuted }}>{m.description}</div>}
          </div>
          <Badge color={sc}>{m.status}</Badge>
        </div>
        {tally(m)}
        {(m.details && m.details.trail && m.details.trail.length > 0) && (<div className="mt-2 rounded-xl p-2.5" style={{ background: T.surfaceAlt }}>
          <div className="text-[11px] font-bold mb-1" style={{ color: T.textMuted }}>FROM THE MAINTENANCE WORKFLOW</div>
          {m.details.trail.map((t2, i) => (<div key={i} className="text-xs py-0.5" style={{ color: T.textMuted }}>• {t2}</div>))}
        </div>)}
        {(m.details && ((m.details.conditions && m.details.conditions.length > 0) || (m.details.history && m.details.history.length > 0))) && (() => {
          const ver = m.version || 1; const a = amend[m.id]; const hist = m.details.history || []; const nVotes = vs.length;
          return (<div className="mt-2 rounded-xl p-2.5" style={{ background: T.surfaceAlt, border: `1px solid ${hexToRgba(SEMANTIC.ok, 0.35)}` }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="text-[11px] font-bold flex-1" style={{ color: SEMANTIC.ok }}>CONDITIONS OF APPROVAL <span style={{ color: T.textMuted }}>v{ver}</span>{m.status === "passed" ? " — BINDING" : m.status === "open" ? " (proposed — apply automatically if passed)" : ""}</div>
              {m.status === "open" && !a && isCommittee(user.role) && <button className="text-[11px] font-semibold" style={{ color: T.accent }} onClick={() => setAmend({ ...amend, [m.id]: { conds: [...(m.details.conditions || [])], reason: "", draft: "" } })}>Amend</button>}
            </div>
            {!a && (m.details.conditions || []).map((c, i) => (<div key={i} className="text-xs py-0.5 flex items-start gap-1.5" style={{ color: T.textMuted }}><span>{i + 1}.</span><span className="flex-1">{c}</span></div>))}
            {a && (<div className="space-y-1.5">
              {a.conds.map((c, i) => (<div key={i} className="flex items-start gap-1.5"><span className="text-xs pt-2" style={{ color: T.textMuted }}>{i + 1}.</span>
                <Input value={c} onChange={(e) => { const conds = a.conds.slice(); conds[i] = e.target.value; setAmend({ ...amend, [m.id]: { ...a, conds } }); }} style={{ flex: 1 }} />
                <button title="Remove condition" className="pt-2" onClick={() => setAmend({ ...amend, [m.id]: { ...a, conds: a.conds.filter((_, j) => j !== i) } })} style={{ color: SEMANTIC.bad }}><X size={13} /></button></div>))}
              <div className="flex gap-2"><Input placeholder="Add a condition…" value={a.draft} onChange={(e) => setAmend({ ...amend, [m.id]: { ...a, draft: e.target.value } })} style={{ flex: 1 }} /><Btn kind="ghost" onClick={() => { const c = (a.draft || "").trim(); if (!c) return; setAmend({ ...amend, [m.id]: { ...a, conds: [...a.conds, c], draft: "" } }); }}><Plus size={13} /></Btn></div>
              <Input placeholder="Reason for the amendment (required — goes on the record)" value={a.reason} onChange={(e) => setAmend({ ...amend, [m.id]: { ...a, reason: e.target.value } })} />
              <div className="text-[11px]" style={{ color: nVotes > 0 ? SEMANTIC.warn : T.textMuted }}>{nVotes > 0 ? `${nVotes} vote${nVotes === 1 ? "" : "s"} already cast against v${ver} will be set aside (kept on the record) and every BCC member asked to vote again.` : "No votes cast yet — the amendment is recorded and every BCC member is alerted."}</div>
              <div className="flex gap-2"><Btn grad onClick={() => saveAmendment(m)}><Check size={14} /> Save amendment (v{ver + 1})</Btn><Btn kind="ghost" onClick={() => setAmend((prev) => { const q = { ...prev }; delete q[m.id]; return q; })}>Cancel</Btn></div>
            </div>)}
            {hist.length > 0 && (<div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${T.border}` }}>
              <button className="text-[11px] font-bold inline-flex items-center gap-1" style={{ color: T.textMuted }} onClick={() => setShowHist({ ...showHist, [m.id]: !showHist[m.id] })}><History size={11} /> AMENDMENT HISTORY ({hist.length}) {showHist[m.id] ? "▾" : "▸"}</button>
              {showHist[m.id] && hist.slice().reverse().map((h, i) => { const sv = h.superseded_votes || []; return (
                <div key={i} className="text-xs mt-1.5 rounded-lg p-2" style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textMuted }}>
                  <div><b style={{ color: T.text }}>v{h.version_from} → v{h.version_to}</b> · {h.by || memberName(h.by_user_id)} · {fmtDate(localDay(h.at))}</div>
                  <div className="mt-0.5"><i>Reason:</i> {h.reason}</div>
                  <div className="mt-1 text-[11px] font-bold">CONDITIONS AS AT v{h.version_from}</div>
                  {(h.conditions_before || []).map((c, j) => { const removed = !(h.conditions_after || []).includes(c); return (<div key={j} className="py-0.5 flex items-start gap-1.5" style={{ textDecoration: removed ? "line-through" : "none", color: removed ? SEMANTIC.bad : T.textMuted }}><span>{j + 1}.</span><span className="flex-1">{c}</span></div>); })}
                  {(h.conditions_after || []).filter((c) => !(h.conditions_before || []).includes(c)).map((c, j) => (<div key={"n" + j} className="py-0.5 flex items-start gap-1.5" style={{ color: SEMANTIC.ok }}><span>+</span><span className="flex-1">{c}</span></div>))}
                  <div className="mt-1 text-[11px] font-bold">VOTES SET ASIDE ({sv.length})</div>
                  {sv.length === 0 ? <div>None — no votes had been cast.</div> : sv.map((v, j) => (<div key={j}>• {memberName(v.proxy_for_user_id || v.voter_user_id)}{v.proxy_for_user_id ? ` (by proxy, ${memberName(v.voter_user_id)})` : ""} voted <b style={{ color: T.text }}>{v.vote}</b>{v.comment ? ` — “${v.comment}”` : ""} · {fmtDate(localDay(v.created_at))}</div>))}
                </div>); })}
            </div>)}
          </div>);
        })()}
        {(matts.filter((a) => a.application_id === m.context_id).length > 0 || (m.details && m.details.quote_file)) && (
          <div className="flex gap-2 flex-wrap mt-2">
            {matts.filter((a) => a.application_id === m.context_id).map((a) => (
              <button key={a.id} onClick={async () => { try { window.open(await mediaUrl(a.storage_path), "_blank"); } catch (e) { flash("Couldn't open the file"); } }} className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1" style={{ background: T.surfaceAlt, color: T.accent, border: `1px solid ${T.border}` }}><Paperclip size={11} /> {a.file_name}</button>))}
            {m.details && m.details.quote_file && (
              <button onClick={async () => { try { window.open(await mediaUrl(m.details.quote_file), "_blank"); } catch (e) { flash("Couldn't open the quote"); } }} className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1" style={{ background: T.surfaceAlt, color: T.accent, border: `1px solid ${T.border}` }}><Paperclip size={11} /> Quote document</button>)}
          </div>)}
        {(m.details && m.details.attachments && m.details.attachments.length > 0) && (
          <div className="flex gap-2 flex-wrap mt-2">
            {m.details.attachments.map((a, i) => (
              <a key={i} href={a.data} download={a.name} className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1" style={{ background: T.surfaceAlt, color: T.accent, border: `1px solid ${T.border}` }}><Paperclip size={11} /> {a.name}</a>))}
          </div>)}
        {vs.filter((v) => v.comment).length > 0 && <div className="mt-2 space-y-1">{vs.filter((v) => v.comment).map((v) => (<div key={v.id} className="text-xs" style={{ color: T.textMuted }}>• “{v.comment}” — voted {v.vote}{v.proxy_for_user_id ? " (by proxy)" : ""}</div>))}</div>}
        {mcomments.filter((c) => c.motion_id === m.id).length > 0 && (<div className="mt-2 space-y-1">
          <div className="text-[11px] font-bold" style={{ color: T.textMuted }}>QUESTIONS & CLARIFICATIONS</div>
          {mcomments.filter((c) => c.motion_id === m.id).map((c) => (<div key={c.id} className="text-xs" style={{ color: T.textMuted }}><b style={{ color: T.text }}>{c.author_name || "Member"}:</b> {c.body}</div>))}
        </div>)}
        {m.status === "open" && (<div className="mt-2 flex gap-2">
          <Input placeholder="Ask for more information before voting…" value={queries[m.id] || ""} onChange={(e) => setQueries({ ...queries, [m.id]: e.target.value })} style={{ flex: 1 }} />
          <Btn kind="ghost" onClick={async () => { const t2 = (queries[m.id] || "").trim(); if (!t2) return; try { await addMotionComment(m.id, t2, user.name); setQueries({ ...queries, [m.id]: "" }); flash("Question posted — BCC members alerted"); reload(); } catch (e) { flash(String(e.message || e)); } }}><Send size={13} /> Ask</Btn>
        </div>)}
        {m.status === "open" && (<div className="mt-3 pt-3 space-y-2.5" style={{ borderTop: `1px solid ${T.border}` }}>
          {mine ? <div className="text-sm" style={{ color: T.textMuted }}><Check size={14} className="inline" style={{ color: SEMANTIC.ok }} /> You voted <b style={{ color: T.text }}>{mine.vote}</b></div> : (<>
            <Input placeholder="Comment (optional)" value={comments[m.id] || ""} onChange={(e) => setComments({ ...comments, [m.id]: e.target.value })} />
            <div className="flex gap-2 flex-wrap">
              <Btn grad onClick={() => vote(m, "yes")}><ThumbsUp size={14} /> Yes</Btn>
              <Btn kind="ghost" onClick={() => vote(m, "no")}><X size={14} /> No</Btn>
              <Btn kind="ghost" onClick={() => vote(m, "abstain")}>Abstain</Btn>
            </div></>)}
          {myActiveProxy && !principalVoted && <div className="flex gap-2 items-center flex-wrap"><span className="text-xs" style={{ color: T.textMuted }}>As proxy for {myActiveProxy.principal_name}:</span><Btn kind="ghost" onClick={() => vote(m, "yes", myActiveProxy)}>Yes</Btn><Btn kind="ghost" onClick={() => vote(m, "no", myActiveProxy)}>No</Btn><Btn kind="ghost" onClick={() => vote(m, "abstain", myActiveProxy)}>Abstain</Btn></div>}
          {m.opened_by === uid && <Btn kind="ghost" onClick={async () => { try { await withdrawMotion(m.id); flash("Motion withdrawn"); reload(); } catch (e) { flash(String(e.message || e)); } }}>Withdraw motion</Btn>}
        </div>)}
      </Card>
    );
  };
  const openM = motions.filter((m) => m.status === "open"); const closedM = motions.filter((m) => m.status !== "open");
  return (
    <div>
      <Head title="Voting" sub="Committee decisions with a majority rule and permanent audit trail" />
      <Wrap>
        <HowTo id="voting" steps={["Open a motion (or one arrives automatically from an application or the maintenance workflow).", "Every BCC member gets an alert, reviews the attachments and the Conditions of Approval, asks questions if unsure, then votes yes / no / abstain with an optional comment. Need to change the conditions? Any BCC member can Amend with a reason: earlier votes are set aside on the record and everyone votes again on what they can now see.", "The majority rule is automatic — the moment it's reached, the decision executes itself and everyone is notified. Away? Appoint a proxy below."]} sell="A decision that used to need a meeting, three reply-all chains and someone taking minutes now happens on six phones before dinner — minutes included." />
        <div className="flex gap-2"><Btn grad onClick={() => setShowNew(!showNew)}><Plus size={15} /> New motion</Btn></div>
        {showNew && (<Card style={{ padding: 18 }}><SectionTitle>Open a motion</SectionTitle><div className="space-y-3">
          <Field label="Motion"><Input value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="e.g. Accept CoastClean quote for lobby deep clean — $850" /></Field>
          <Field label="Background (optional)"><Input value={nf.description} onChange={(e) => setNf({ ...nf, description: e.target.value })} /></Field>
          <Field label="Supporting documents (optional) — quotes, reports, plans, any file type">
            <label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-3 px-3 text-sm cursor-pointer"><Paperclip size={15} /> Attach documents<input type="file" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); files.forEach((file) => readUpload(file, (data) => setNf((p) => ({ ...p, attachments: [...(p.attachments || []), { name: file.name, type: file.type, data }] })), flash)); e.target.value = ""; }} /></label>
            {(nf.attachments || []).length > 0 && <div className="flex flex-wrap gap-2 mt-2">{nf.attachments.map((a, i) => (<span key={i} className="text-xs px-2 py-1 rounded-lg inline-flex items-center gap-1.5" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><Paperclip size={11} /> {a.name}<button type="button" onClick={() => setNf((p) => ({ ...p, attachments: p.attachments.filter((_, j) => j !== i) }))} style={{ color: SEMANTIC.bad }}><X size={11} /></button></span>))}</div>}
          </Field>
          <div className="text-xs" style={{ color: T.textMuted }}>Every BCC member is alerted, and any documents you attach stay with the motion. It passes with a majority of all BCC members and executes automatically.</div>
          <Btn grad onClick={open}>Open motion</Btn>
        </div></Card>)}
        <SectionTitle>Open motions{openM.length ? ` (${openM.length})` : ""}</SectionTitle>
        {loading && <Card style={{ padding: 16 }}><div style={{ color: T.textMuted }}>Loading…</div></Card>}
        {!loading && openM.length === 0 && <Empty icon={Vote} title="Nothing awaiting a vote" hint="Raise a motion here, or send a recommended quote to vote from the Maintenance Workflow." />}
        {openM.map((m) => motionCard(m))}
        {closedM.length > 0 && (<><SectionTitle>Decided</SectionTitle>{closedM.map((m) => motionCard(m))}</>)}
        <SectionTitle>Proxies</SectionTitle>
        <Card style={{ padding: 16 }}>
          <div className="text-xs mb-3" style={{ color: T.textMuted }}>Going away? Appoint another BCC voting member as your proxy (QLD Standard Module ss 121–125: one proxy per holder; can't be used once you vote yourself).</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Your proxy"><Select value={pf.proxy} onChange={(e) => setPf({ ...pf, proxy: e.target.value })}><option value="">Choose a BCC member…</option>{bccMembers.filter((m) => m.authId !== uid).map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}</Select></Field>
            <Field label="From"><Input type="date" value={pf.from} onChange={(e) => setPf({ ...pf, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={pf.to} onChange={(e) => setPf({ ...pf, to: e.target.value })} /></Field>
          </div>
          <Btn grad style={{ marginTop: 10 }} onClick={appoint}>Appoint proxy</Btn>
          {proxies.length > 0 && <div className="mt-4 space-y-2">{proxies.map((p) => (
            <div key={p.id} className="flex items-center flex-wrap gap-2 text-sm py-1.5" style={{ borderTop: `1px dashed ${T.border}` }}>
              <div className="flex-1 min-w-0 basis-full sm:basis-auto">{p.principal_name} → <b>{p.proxy_name}</b> <span className="text-xs" style={{ color: T.textMuted }}>{fmtDate(p.date_from)} – {fmtDate(p.date_to)}</span></div>
              <Badge color={p.status === "active" ? SEMANTIC.ok : VOTE_COLOR.abstain}>{p.status}</Badge>
              <Btn kind="ghost" onClick={() => openProxyFormPdf(p.id).catch(() => flash("Couldn't generate the form"))}><Download size={13} /> Form</Btn>
              {p.status === "active" && (p.principal_user_id === uid || isCommittee(user.role)) && <Btn kind="ghost" onClick={async () => { await revokeProxy(buildingId, p.id); flash("Proxy revoked"); reload(); }}>Revoke</Btn>}
            </div>))}</div>}
        </Card>
      </Wrap>
    </div>
  );
}

// ---------- maintenance workflow ---------------------------------------------
const MACT_ICON = { comment: MessageSquare, triage: ClipboardCheck, status_change: RefreshCw, quote_requested: Send, quote_added: DollarSign, recommendation: ThumbsUp, vote_opened: Vote, decision: Gavel, contractor_confirmed: Check };
const MWF_STEPS = ["Reported", "Triaged", "Quotes in", "Recommended", "At vote", "Contractor confirmed"];
const MWF_NEXT = [
  "Triage this issue so the sub-committee and BCC can see it's being handled — add an optional note and tap Triage.",
  "Collect quotes from your trades. Add each supplier, amount and the quote document in the Quotes card below.",
  "Compare the quotes you've gathered, then tap Recommend on the best one.",
  "Send the recommended quote to a vote — the whole trail travels with the motion to the BCC.",
  "The motion is now with the committee in Voting. When it passes, come back here and confirm the contractor.",
  "Done — the works are approved and the contractor confirmed. This issue's trail is complete.",
];
function mwfStage(trail, quotes) {
  const kinds = new Set((trail || []).map((a) => a.kind));
  if (kinds.has("contractor_confirmed")) return 5;
  if (kinds.has("vote_opened") || (quotes || []).some((q) => q.status === "accepted")) return 4;
  if ((quotes || []).some((q) => q.status === "recommended")) return 3;
  if ((quotes || []).length > 0) return 2;
  if (kinds.has("triage")) return 1;
  return 0;
}
function MaintProgress({ trail, quotes }) {
  const { T } = useApp();
  const cur = mwfStage(trail, quotes);
  return (
    <Card style={{ padding: 16 }}>
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
        {MWF_STEPS.map((s, i) => { const done = i < cur, active = i === cur; const c = done ? SEMANTIC.ok : active ? T.accent : T.border; return (
          <div key={s} className="flex items-center gap-1.5 shrink-0">
            <span className="h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold shrink-0" style={{ background: (done || active) ? c : "transparent", color: (done || active) ? T.accentText : T.textMuted, border: `1.5px solid ${c}` }}>{done ? <Check size={12} /> : i + 1}</span>
            <span className="text-xs font-medium whitespace-nowrap" style={{ color: active ? T.text : T.textMuted }}>{s}</span>
            {i < MWF_STEPS.length - 1 && <div className="h-0.5 w-6 rounded" style={{ background: i < cur ? SEMANTIC.ok : T.border }} />}
          </div>
        ); })}
      </div>
      <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.14 : 0.08), border: `1px solid ${hexToRgba(T.accent, 0.3)}` }}>
        <ChevronRight size={16} style={{ color: T.accent }} className="mt-0.5 shrink-0" />
        <div><div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: T.accent }}>Next step</div><div className="text-sm mt-0.5">{MWF_NEXT[cur]}</div></div>
      </div>
    </Card>
  );
}
function MaintWorkflowView() { return <MaintWorkflowLive />; }
function MaintWorkflowLive() {
  const { T, store, user, buildingId, flash } = useApp();
  const uid = useAuthId();
  const issues = (store.maintenance || []).filter((m) => m.buildingId === buildingId);
  const [sel, setSel] = useState(null);
  const [trail, setTrail] = useState([]); const [quotes, setQuotes] = useState([]); const [contractors, setContractors] = useState([]);
  const [note, setNote] = useState("");
  const [qf, setQf] = useState({ supplier: "", amount: "", contractor: "", file: null });
  const reload = async (mid) => {
    const id = mid || (sel && sel.id); if (!id) return;
    try { setTrail(await listMaintActivity(buildingId, id)); setQuotes(await listMaintQuotes(buildingId, id)); } catch (e) { console.error(e); }
  };
  useEffect(() => { listContractors(buildingId).then(setContractors).catch(() => {}); }, [buildingId]);
  const pick = (m) => { setSel(m); reload(m.id); };
  const act = async (kind, body, extra) => {
    try { await addMaintActivity(buildingId, sel.id, kind, body, extra); setNote(""); reload(); flash("Recorded — the workflow group has been alerted"); }
    catch (e) { flash(String(e.message || e)); }
  };
  const addQuote = async () => {
    if (!qf.supplier.trim()) { flash("Who is the quote from?"); return; }
    try {
      let file_path = null;
      if (qf.file) { const up = await uploadMedia(buildingId, "quotes", qf.file); file_path = up.path; }
      await addMaintQuote(buildingId, sel.id, { supplier_name: qf.supplier.trim(), amount: qf.amount ? Number(qf.amount) : null, contractor_id: qf.contractor || null, file_path });
      setQf({ supplier: "", amount: "", contractor: "", file: null });
      reload(); flash("Quote added to the trail");
    } catch (e) { flash(String(e.message || e)); }
  };
  const recommend = async (q) => { await setQuoteStatus(q.id, "recommended"); await act("recommendation", `Sub-committee recommends ${q.supplier_name}${q.amount ? ` at $${q.amount}` : ""}.`, { quote_id: q.id }); };
  const toVote = async (q) => {
    try {
      // Carry the sub-committee's working into the motion: trail comments + quote document
      const snapshot = trail.filter((a) => a.body).slice(-8).map((a) => `${a.kind.replace(/_/g, " ")}: ${a.body}`);
      await createMotion(buildingId, uid, {
        title: `Accept ${q.supplier_name} quote${q.amount ? ` $${q.amount}` : ""} — ${sel.title || sel.id}`,
        description: sel.description || "Raised from the maintenance workflow.",
        context_type: "maintenance", context_id: sel.id,
        details: { quote_id: q.id, quote_file: q.file_path || null, trail: snapshot },
      });
      await act("vote_opened", `Motion opened to accept ${q.supplier_name}.`, { quote_id: q.id });
      flash("Motion opened with the full trail attached — BCC members alerted. Track it in Voting.");
    } catch (e) { flash(String(e.message || e)); }
  };
  const QSC = { requested: T.textMuted, received: SEMANTIC.warn, shortlisted: T.accent, recommended: T.accent, accepted: SEMANTIC.ok, rejected: SEMANTIC.bad };
  return (
    <div>
      <Head title="Maintenance Workflow" sub="Issue → triage → quotes → recommendation → vote → contractor confirmed" />
      <Wrap>
        <HowTo id="mworkflow" steps={["Pick a reported issue and hit Triage — the sub-committee and BCC are alerted that it's being handled.", "Collect quotes as they arrive: supplier, amount, the document itself, linked to your registered contractors.", "Recommend the best quote and Send to vote — the motion carries the whole trail. When it passes, the winning quote is accepted, the rest close, and you confirm the contractor. Done."]} sell="Thirty emails, two spreadsheets and a lost PDF — replaced by one trail every committee member can read in a minute." />
        {!sel && (<>
          <SectionTitle>Pick an issue</SectionTitle>
          {issues.length === 0 && <Empty icon={Wrench} title="No maintenance issues" hint="Issues reported in Maintenance appear here for the sub-committee to work." />}
          {issues.map((m) => (<Card key={m.id} style={{ padding: 14, cursor: "pointer" }} ><div onClick={() => pick(m)} className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl grid place-items-center shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${HUE.maintenance[0]}, ${HUE.maintenance[1]})` }}><Wrench size={16} /></div><div className="flex-1 min-w-0"><div className="font-semibold text-sm">{m.title || m.id}</div><div className="text-xs" style={{ color: T.textMuted }}>{m.status || ""}{m.reportedBy ? ` · ${m.reportedBy}` : ""}</div></div><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card>))}
        </>)}
        {sel && (<>
          <button onClick={() => setSel(null)} className="text-sm inline-flex items-center gap-1" style={{ color: T.accent }}><ArrowLeft size={14} /> All issues</button>
          <MaintProgress trail={trail} quotes={quotes} />
          <Card style={{ padding: 16 }}>
            <SectionTitle>Step 1 · This issue</SectionTitle>
            <div className="font-bold">{sel.title || sel.id}</div>
            {sel.description && <div className="text-sm mt-1" style={{ color: T.textMuted }}>{sel.description}</div>}
            <div className="flex gap-2 mt-3 flex-wrap">
              <Input placeholder="Add a note, triage decision or update…" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
              <Btn kind="ghost" onClick={() => note.trim() && act("comment", note.trim())}>Comment</Btn>
              <Btn kind="ghost" onClick={() => act("triage", note.trim() || `Triaged by ${user.name}. Action commenced.`)}>Triage</Btn>
              <Btn kind="ghost" onClick={() => act("contractor_confirmed", note.trim() || "Contractor confirmed and works scheduled.")}>Contractor confirmed</Btn>
            </div>
          </Card>
          <Card style={{ padding: 16 }}>
            <SectionTitle>Step 2 · Quotes</SectionTitle>
            {quotes.map((q) => (<div key={q.id} className="flex items-center gap-2 py-2 text-sm flex-wrap" style={{ borderBottom: `1px dashed ${T.border}` }}>
              <div className="flex-1 min-w-0"><b>{q.supplier_name}</b>{q.amount ? ` · $${Number(q.amount).toLocaleString()}` : ""}</div>
              <Badge color={QSC[q.status] || T.accent}>{q.status}</Badge>
              {q.file_path && <Btn kind="ghost" onClick={async () => { try { window.open(await mediaUrl(q.file_path), "_blank"); } catch (e) { flash("Couldn't open the quote"); } }}><Paperclip size={13} /> Open</Btn>}
              {["received", "shortlisted"].includes(q.status) && <Btn kind="ghost" onClick={() => recommend(q)}><ThumbsUp size={13} /> Recommend</Btn>}
              {q.status === "recommended" && <Btn grad onClick={() => toVote(q)}><Vote size={13} /> Send to vote</Btn>}
            </div>))}
            <div className="grid sm:grid-cols-4 gap-2.5 mt-3">
              <Input placeholder="Supplier" value={qf.supplier} onChange={(e) => setQf({ ...qf, supplier: e.target.value })} />
              <Input placeholder="Amount $" type="number" value={qf.amount} onChange={(e) => setQf({ ...qf, amount: e.target.value })} />
              <Select value={qf.contractor} onChange={(e) => setQf({ ...qf, contractor: e.target.value })}><option value="">Registered contractor…</option>{contractors.map((c) => (<option key={c.id} value={c.id}>{c.company_name} ({c.trade})</option>))}</Select>
              <input type="file" onChange={(e) => setQf({ ...qf, file: (e.target.files || [])[0] || null })} className="text-xs self-center" style={{ color: T.textMuted }} />
            </div>
            <Btn style={{ marginTop: 10 }} onClick={addQuote}><Plus size={14} /> Add quote</Btn>
          </Card>
          <Card style={{ padding: 16 }}>
            <SectionTitle>Full activity trail</SectionTitle>
            {trail.length === 0 && <div className="text-sm" style={{ color: T.textMuted }}>Nothing recorded yet — triage the issue to start the trail.</div>}
            {trail.map((a) => { const Ic = MACT_ICON[a.kind] || MessageSquare; return (
              <div key={a.id} className="flex gap-3 py-2" style={{ borderBottom: `1px dashed ${T.border}` }}>
                <div className="h-7 w-7 rounded-lg grid place-items-center shrink-0 mt-0.5" style={{ background: hexToRgba(T.accent, 0.14), color: T.accent }}><Ic size={13} /></div>
                <div className="flex-1 min-w-0"><div className="text-sm">{a.body || a.kind}</div><div className="text-[11px]" style={{ color: T.textMuted }}>{a.kind.replace(/_/g, " ")} · {fmtDate(localDay(a.created_at))}</div></div>
              </div>); })}
          </Card>
        </>)}
      </Wrap>
    </div>
  );
}

// ---------- contracts register -----------------------------------------------
function ContractsView() { return <ContractsLive />; }
function ContractsLive() {
  const { T, buildingId, flash } = useApp();
  const [rows, setRows] = useState([]); const [adding, setAdding] = useState(false);
  const [doc, setDoc] = useState(null);
  const [f, setF] = useState({ party_name: "", party_abn: "", purpose: "", category: "", start_date: "", end_date: "", term_months: "", auto_renew: false, value_annual: "", contact_name: "", contact_phone: "" });
  const reload = () => listContracts(buildingId).then(setRows).catch(() => {});
  useEffect(() => { reload(); }, [buildingId]);
  const save = async () => {
    if (!f.party_name.trim()) { flash("Who is the contract with?"); return; }
    try {
      let document_path = null;
      if (doc) { const up = await uploadMedia(buildingId, "contracts", doc); document_path = up.path; }
      await saveContract(buildingId, { ...f, document_path, term_months: f.term_months ? Number(f.term_months) : null, value_annual: f.value_annual ? Number(f.value_annual) : null, start_date: f.start_date || null, end_date: f.end_date || null });
      setF({ party_name: "", party_abn: "", purpose: "", category: "", start_date: "", end_date: "", term_months: "", auto_renew: false, value_annual: "", contact_name: "", contact_phone: "" });
      setDoc(null); setAdding(false); reload(); flash("Contract recorded");
    } catch (e) { flash(String(e.message || e)); }
  };
  const soon = addDays(today(), 60);
  return (
    <div>
      <Head title="Contracts" sub="Term, expiry and value — nothing renews unnoticed" />
      <Wrap>
        <HowTo id="contracts" steps={["Add each contract the building holds — who, what for, dates, value — and upload the document itself.", "Anything expiring within 60 days glows amber, so renewals become decisions, not surprises.", "Link contracts to assets so the lift's record shows exactly who maintains it and until when."]} sell="No more finding out the cleaning contract auto-renewed at last year's price — the register watches the dates so no one has to." />
        <Btn grad onClick={() => setAdding(!adding)}><Plus size={15} /> Add contract</Btn>
        {adding && (<Card style={{ padding: 18 }}><div className="grid sm:grid-cols-2 gap-3">
          <Field label="Contracted party"><Input value={f.party_name} onChange={(e) => setF({ ...f, party_name: e.target.value })} placeholder="Sunshine Lifts Pty Ltd" /></Field>
          <Field label="ABN (optional)"><Input value={f.party_abn} onChange={(e) => setF({ ...f, party_abn: e.target.value })} /></Field>
          <Field label="Purpose"><Input value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="Quarterly lift maintenance + 24hr breakdown" /></Field>
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="">Choose a category…</option>
            {["lift maintenance", "cleaning", "gardening / landscaping", "insurance", "building management", "caretaking", "fire services", "pest control", "pool maintenance", "security", "waste management", "utilities / energy", "air conditioning / HVAC", "audit / accounting", "legal", "general maintenance", "other"].map((t) => (<option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>))}
          </Select></Field>
          <Field label="Start"><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
          <Field label="End / expiry"><Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>
          <Field label="Term (months)"><Input type="number" value={f.term_months} onChange={(e) => setF({ ...f, term_months: e.target.value })} /></Field>
          <Field label="Annual value $"><Input type="number" value={f.value_annual} onChange={(e) => setF({ ...f, value_annual: e.target.value })} /></Field>
          <Field label="Contact"><Input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.contact_phone} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm mt-3" style={{ color: T.textMuted }}><input type="checkbox" checked={f.auto_renew} onChange={(e) => setF({ ...f, auto_renew: e.target.checked })} /> Auto-renews</label>
        <Field label="Upload the contract (PDF / Word)"><input type="file" onChange={(e) => setDoc((e.target.files || [])[0] || null)} className="text-sm" style={{ color: T.textMuted }} /></Field>
        <Btn grad style={{ marginTop: 10 }} onClick={save}>Save contract</Btn></Card>)}
        {rows.length === 0 && <Empty icon={Briefcase} title="No contracts recorded" hint="Add your lift, cleaning, gardening and insurance contracts so expiry never surprises you." />}
        {rows.map((c) => { const expiring = c.end_date && c.end_date <= soon && c.status === "active"; return (
          <Card key={c.id} style={{ padding: 16, border: expiring ? `1px solid ${SEMANTIC.warn}` : undefined }}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{c.party_name} {c.category && <span className="text-xs font-normal" style={{ color: T.textMuted }}>· {c.category}</span>}</div>
                <div className="text-xs" style={{ color: T.textMuted }}>{c.purpose || ""}</div>
                <div className="text-xs mt-1" style={{ color: expiring ? SEMANTIC.warn : T.textMuted }}>{c.start_date ? `${fmtDate(c.start_date)} → ` : ""}{c.end_date ? fmtDate(c.end_date) : "no end date"}{c.term_months ? ` · ${c.term_months} mths` : ""}{c.auto_renew ? " · auto-renews" : ""}{c.value_annual ? ` · $${Number(c.value_annual).toLocaleString()}/yr` : ""}{expiring ? " — expiring soon" : ""}</div>
              </div>
              <Badge color={c.status === "active" ? SEMANTIC.ok : c.status === "expired" ? SEMANTIC.bad : SEMANTIC.warn}>{c.status}</Badge>
              {c.document_path && <Btn kind="ghost" onClick={async () => { try { window.open(await mediaUrl(c.document_path), "_blank"); } catch (e) { flash("Couldn't open the contract"); } }}><Paperclip size={14} /></Btn>}
              <Btn kind="ghost" onClick={async () => { if (confirm("Remove this contract?")) { await deleteContract(buildingId, c.id); reload(); } }}><Trash2 size={14} /></Btn>
            </div>
          </Card>); })}
      </Wrap>
    </div>
  );
}

// ---------- contractors register ----------------------------------------------
function ContractorsView() { return <ContractorsLive />; }
function ContractorsLive() {
  const { T, buildingId, flash } = useApp();
  const [rows, setRows] = useState([]); const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ company_name: "", trade: "", contact_name: "", phone: "", email: "", licence_no: "", insurance_expiry: "", status: "approved", rating: "" });
  const reload = () => listContractors(buildingId).then(setRows).catch(() => {});
  useEffect(() => { reload(); }, [buildingId]);
  const save = async () => {
    if (!f.company_name.trim() || !f.trade.trim()) { flash("Company and trade are required"); return; }
    try {
      await saveContractor(buildingId, { ...f, trade: f.trade.trim().toLowerCase(), rating: f.rating ? Number(f.rating) : null, insurance_expiry: f.insurance_expiry || null });
      setF({ company_name: "", trade: "", contact_name: "", phone: "", email: "", licence_no: "", insurance_expiry: "", status: "approved", rating: "" });
      setAdding(false); reload(); flash("Contractor added");
    } catch (e) { flash(String(e.message || e)); }
  };
  const soon = addDays(today(), 60);
  const byTrade = {};
  rows.forEach((c) => { (byTrade[c.trade] = byTrade[c.trade] || []).push(c); });
  return (
    <div>
      <Head title="Contractors" sub="Approved & preferred trades, licences and insurance" />
      <Wrap>
        <HowTo id="contractors" steps={["Build your trusted trades list once — licence numbers, insurance expiry, preferred or approved status, a star rating.", "Insurance renewing within 60 days glows amber.", "Quotes in the Maintenance Workflow link straight to this register, so due diligence is already done when you vote."]} sell="“Who did we use for the gate last time, and were they insured?” — answered in two taps, forever." />
        <Btn grad onClick={() => setAdding(!adding)}><Plus size={15} /> Add contractor</Btn>
        {adding && (<Card style={{ padding: 18 }}><div className="grid sm:grid-cols-2 gap-3">
          <Field label="Company"><Input value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></Field>
          <Field label="Trade / service"><Select value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })}>
            <option value="">Choose a trade…</option>
            {["electrical", "plumbing", "structural / engineering", "building / carpentry", "cleaning", "painting", "gardening / landscaping", "lift / elevator", "fire safety", "pest control", "security / CCTV", "pool maintenance", "air conditioning / HVAC", "waterproofing", "roofing", "glazing", "locksmith", "waste management", "concreting / paving", "handyman / general", "other"].map((t) => (<option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>))}
          </Select></Field>
          <Field label="Contact"><Input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Licence no."><Input value={f.licence_no} onChange={(e) => setF({ ...f, licence_no: e.target.value })} /></Field>
          <Field label="Insurance expiry"><Input type="date" value={f.insurance_expiry} onChange={(e) => setF({ ...f, insurance_expiry: e.target.value })} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="preferred">Preferred</option><option value="approved">Approved</option><option value="trial">Trial</option><option value="suspended">Suspended</option></Select></Field>
          <Field label="Rating 1–5 (optional)"><Input type="number" min="1" max="5" value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })} /></Field>
        </div><Btn grad style={{ marginTop: 10 }} onClick={save}>Save contractor</Btn></Card>)}
        {rows.length === 0 && <Empty icon={HardHat} title="No contractors yet" hint="Build your trusted trades list — quotes in the Maintenance Workflow can link straight to them." />}
        {Object.keys(byTrade).sort().map((t) => (<div key={t}>
          <SectionTitle>{t.charAt(0).toUpperCase() + t.slice(1)}</SectionTitle>
          {byTrade[t].map((c) => { const insSoon = c.insurance_expiry && c.insurance_expiry <= soon; return (
            <Card key={c.id} style={{ padding: 14, marginBottom: 8, border: insSoon ? `1px solid ${SEMANTIC.warn}` : undefined }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{c.company_name} {c.rating ? <span style={{ color: T.accent }}>{"★".repeat(c.rating)}</span> : null}</div>
                  <div className="text-xs" style={{ color: T.textMuted }}>{[c.contact_name, c.phone, c.licence_no && `Lic ${c.licence_no}`].filter(Boolean).join(" · ")}</div>
                  {c.insurance_expiry && <div className="text-xs" style={{ color: insSoon ? SEMANTIC.warn : T.textMuted }}>Insurance to {fmtDate(c.insurance_expiry)}{insSoon ? " — renewing soon" : ""}</div>}
                </div>
                <Badge color={c.status === "preferred" ? T.accent : c.status === "suspended" ? SEMANTIC.bad : SEMANTIC.ok}>{c.status}</Badge>
                <Btn kind="ghost" onClick={async () => { if (confirm("Remove this contractor?")) { await deleteContractor(buildingId, c.id); reload(); } }}><Trash2 size={14} /></Btn>
              </div>
            </Card>); })}
        </div>))}
      </Wrap>
    </div>
  );
}

// One finding, in full: the duty it tests, what was asked for, and every event
// against it with its photograph. This is the screen that answers "what actually
// happened with CB-0072", which a number on a tile never could.
function FindingDrawer({ finding: f, events, onClose, canClose, onAct, inWalk, photoReady, onPhoto, onAmend }) {
  const { T } = useApp();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Amending: the committee can correct a finding while it is open. The database insists on
  // a reason and writes the before and after of every changed field into the trail below.
  const [amending, setAmending] = useState(false);
  const blankAm = () => ({ cls: f.class, location: f.location || "", observation: f.observation || "", outcome: f.required_outcome || "",
    owner: f.owner || "", due: f.due_date || "", risk: f.risk_rating || "medium", reason: "" });
  const [am, setAm] = useState(blankAm);
  const saveAmend = async () => {
    if (am.reason.trim().length < 3) return;
    const patch = {};
    if (am.cls !== f.class) patch.class = am.cls;
    if (am.location !== (f.location || "")) patch.location = am.location;
    if (am.observation.trim() && am.observation !== (f.observation || "")) patch.observation = am.observation;
    if (am.outcome !== (f.required_outcome || "")) patch.required_outcome = am.outcome;
    if (am.owner !== (f.owner || "")) patch.owner = am.owner;
    if (am.due !== (f.due_date || "")) patch.due_date = am.due;
    const riskWant = am.cls === "H" ? am.risk : "";
    if (riskWant !== (f.risk_rating || "")) patch.risk_rating = riskWant;
    if (!Object.keys(patch).length) { setAmending(false); return; }
    setBusy(true);
    try { if (await onAmend(f, patch, am.reason.trim())) setAmending(false); }
    finally { setBusy(false); }
  };
  const act = async (kind) => {
    setBusy(true);
    try { await onAct(kind, f, note); setNote(""); }
    finally { setBusy(false); }
  };
  const [urls, setUrls] = useState({});
  const evs = (events || []).filter((e) => e.finding_id === f.id)
    .sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1));
  useEffect(() => {
    let alive = true;
    (async () => {
      const out = {};
      for (const e of evs) {
        if (!e.photo_path) continue;
        try { out[e.id] = await mediaUrl(e.photo_path); } catch (err) { /* gone from storage */ }
      }
      if (alive) setUrls(out);
    })();
    return () => { alive = false; };
  }, [f.id]);
  const cls = WT_CLASS[f.class] || ["Finding", ""];
  const tone = f.class === "H" ? SEMANTIC.bad : f.overdue ? SEMANTIC.warn : T.accent;
  const row = (k, v) => v ? (<div className="flex gap-3 py-1.5 text-sm" style={{ borderBottom: `1px dashed ${T.border}` }}>
    <div className="w-32 shrink-0 text-xs pt-0.5" style={{ color: T.textMuted }}>{k}</div><div className="flex-1">{v}</div></div>) : null;
  const EVENT_LABEL = { raised: "Raised", observed_again: "Still present", updated: "Amended", closed: "Closed", reopened: "Reopened", promoted: "Sent to maintenance", superseded: "Superseded" };
  const FIELD_LABEL = { class: "Class", location: "Where", observation: "Observed", required_outcome: "Done looks like", owner: "Owner", due_date: "Due", risk_rating: "Risk", section_id: "Duty group" };
  const showVal = (k, v) => (v == null || v === "" ? "blank" : k === "due_date" ? fmtDate(v) : k === "class" ? `${v} ${(WT_CLASS[v] || [""])[0]}` : String(v));
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ background: "rgba(8,16,28,0.55)" }} onClick={onClose}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 sticky top-0 z-10" style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-lg font-bold">{f.ref}</div>
            <Badge color={tone}>{cls[0]}</Badge>
            <Badge color={f.status === "closed" ? SEMANTIC.ok : tone}>{f.status}</Badge>
            {f.risk_rating && <Badge color={SEMANTIC.bad}>{String(f.risk_rating).toUpperCase()} RISK</Badge>}
            {f.overdue && <Badge color={SEMANTIC.bad}>OVERDUE</Badge>}
            <div className="flex-1" />
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: T.textMuted }}><X size={18} /></button>
          </div>
          <div className="text-xs mt-1" style={{ color: T.textMuted }}>{f.location}</div>
        </div>
        <div className="px-5 py-4">
          {row("Observation", f.observation)}
          {row("Required outcome", f.required_outcome)}
          {row("Duty tested", f.standard_snapshot || (f.section_name ? `Group: ${f.section_name}` : null))}
          {f.standard_is_general && row("Note", <span style={{ color: SEMANTIC.warn }}>Rests on the general duties in clause 3.2 or 3.4 rather than a Schedule 1 line, so it is weaker evidence.</span>)}
          {row("Owner", f.owner)}
          {row("Due", f.due_date ? fmtDate(f.due_date) : null)}
          {row("First raised", fmtDate(f.first_raised_on))}
          {row("Open for", `${f.walks_open || 1} walk${(f.walks_open || 1) === 1 ? "" : "s"}`)}
          {f.closed_at && row("Closed", fmtDate(f.closed_at))}

          <SectionTitle>History</SectionTitle>
          {evs.length === 0 && <div className="text-sm" style={{ color: T.textMuted }}>No events recorded.</div>}
          {evs.map((e) => (
            <div key={e.id} className="py-2.5 flex gap-3" style={{ borderBottom: `1px dashed ${T.border}` }}>
              <div className="w-28 shrink-0">
                <div className="text-xs font-semibold">{EVENT_LABEL[e.event] || e.event}</div>
                <div className="text-[11px]" style={{ color: T.textMuted }}>{fmtDate(e.occurred_at)}</div>
              </div>
              <div className="flex-1 text-sm">
                {e.event === "updated" && e.note && <div className="text-[11px] font-semibold" style={{ color: T.textMuted }}>Reason</div>}
                {e.note && <div>{e.note}</div>}
                {e.changes && Object.keys(e.changes).length > 0 && (<div className="mt-1 text-xs rounded-lg px-2.5 py-1.5" style={{ background: T.surfaceAlt }}>
                  {Object.entries(e.changes).map(([k, v]) => (<div key={k}><b>{FIELD_LABEL[k] || k}:</b> {showVal(k, v && v.from)} <span style={{ color: T.textMuted }}>to</span> {showVal(k, v && v.to)}</div>))}
                </div>)}
                {e.photo_path && (urls[e.id]
                  ? <button onClick={() => window.open(urls[e.id], "_blank")} className="mt-1.5 block" title="Open the full image">
                      <img src={urls[e.id]} alt="" style={{ maxWidth: 180, borderRadius: 8, border: `1px solid ${T.border}` }} />
                    </button>
                  : <div className="text-[11px] mt-1" style={{ color: T.textMuted }}>loading photo...</div>)}
              </div>
            </div>))}
          <div className="text-[11px] mt-3" style={{ color: T.textMuted }}>This trail is append-only. Entries cannot be edited or removed once recorded.</div>

          {f.status === "open" && onAct && (<div className="mt-4 rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <div className="text-xs font-semibold mb-1.5">Update this finding</div>
            <div className="text-[11px] mb-2" style={{ color: T.textMuted }}>
              {inWalk ? "Recorded against the walk you have open." : "Recorded against the register, not a walk. Use this when something is confirmed done between walks."}
            </div>
            <Input placeholder="How was this confirmed? (optional but worth it)" value={note} onChange={(e) => setNote(e.target.value)} />
            {onPhoto && (<label className="mt-2 text-xs px-2.5 py-2 rounded-lg cursor-pointer inline-flex items-center gap-1.5 w-full justify-center" style={{ background: photoReady ? hexToRgba(T.accent, 0.18) : T.surface, color: photoReady ? T.accent : T.textMuted, border: `1px dashed ${photoReady ? T.accent : T.border}` }}>
              <ImageIcon size={14} /> {photoReady ? "Photo ready: it goes with whichever button you press" : "Take a photo (the after photo, if you are closing it)"}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(f, (e.target.files || [])[0])} />
            </label>)}
            <div className="flex gap-2 mt-2 flex-wrap">
              <Btn kind="ghost" disabled={busy} onClick={() => act("still")}>Still present</Btn>
              {canClose && <Btn grad disabled={busy} onClick={() => act("close")}><Check size={14} /> Confirm done and close</Btn>}
            </div>
            {!canClose && <div className="text-[11px] mt-2" style={{ color: T.textMuted }}>Only the committee can close a finding at this building.</div>}
          </div>)}
          {f.status === "open" && onAmend && canClose && !amending && (<div className="mt-3">
            <Btn kind="ghost" onClick={() => { setAm(blankAm()); setAmending(true); }}><Pencil size={13} /> Amend this finding</Btn>
          </div>)}
          {f.status === "open" && amending && (<div className="mt-3 rounded-xl p-3 space-y-2" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <div className="text-xs font-semibold">Amend {f.ref}</div>
            <div className="text-[11px]" style={{ color: T.textMuted }}>Every change and your reason are added to the history above, where anyone can see them. Nothing already recorded is overwritten.</div>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(WT_CLASS).map(([k, v]) => (
                <button key={k} onClick={() => setAm({ ...am, cls: k })} title={v[1]} className="text-[11px] px-2.5 py-1 rounded-lg font-semibold"
                  style={{ background: am.cls === k ? hexToRgba(T.accent, 0.2) : T.surface, color: am.cls === k ? T.accent : T.textMuted, border: `1px solid ${am.cls === k ? T.accent : T.border}` }}>{k} · {v[0]}</button>))}
            </div>
            <Input placeholder="Where exactly?" value={am.location} onChange={(e) => setAm({ ...am, location: e.target.value })} />
            <Input placeholder="What was observed?" value={am.observation} onChange={(e) => setAm({ ...am, observation: e.target.value })} />
            <Input placeholder="What does done look like?" value={am.outcome} onChange={(e) => setAm({ ...am, outcome: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Owner" value={am.owner} onChange={(e) => setAm({ ...am, owner: e.target.value })} />
              <Input type="date" value={am.due} onChange={(e) => setAm({ ...am, due: e.target.value })} />
            </div>
            {am.cls === "H" && (<Select value={am.risk} onChange={(e) => setAm({ ...am, risk: e.target.value })}>
              {["low", "medium", "high", "critical"].map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)} risk</option>)}
            </Select>)}
            <Input placeholder="Why is it being amended? (required)" value={am.reason} onChange={(e) => setAm({ ...am, reason: e.target.value })} />
            <div className="flex gap-2">
              <Btn grad disabled={busy || am.reason.trim().length < 3} onClick={saveAmend}>Save amendment</Btn>
              <Btn kind="ghost" onClick={() => setAmending(false)}>Cancel</Btn>
            </div>
          </div>)}
          {f.status === "closed" && (<div className="mt-4 text-xs rounded-xl p-3" style={{ background: hexToRgba(SEMANTIC.ok, 0.08), border: `1px solid ${hexToRgba(SEMANTIC.ok, 0.35)}` }}>
            <b style={{ color: SEMANTIC.ok }}>Closed and verified{f.closed_at ? ` on ${fmtDate(localDay(f.closed_at))}` : ""}.</b> This record is fixed. If the problem comes back, raise it as a new finding and mention {f.ref} in what you observed.
          </div>)}
        </div>
      </div>
    </div>
  );
}

// ---------- monthly walk-through ------------------------------------------------
function WalkthroughView() { return <WalkthroughLive />; }
function WalkthroughLive() {
  const { T, building, buildingId, user, flash, store, update } = useApp();
  const [items, setItems] = useState([]); const [walks, setWalks] = useState([]);
  const [walkId, setWalkId] = useState(null); const [results, setResults] = useState({});
  const [notes, setNotes] = useState({}); const [photos, setPhotos] = useState({});
  const [maintSent, setMaintSent] = useState({});
  // The platform Admin account is not a walk attendee: it is how NaloHub reaches a
  // building, not a person who walks it. Committee members already hold the bcc role.
  const staff = (store.users || []).filter((m) => m.buildingId === buildingId && ["bcc", "manager"].includes(m.role) && m.status === "active");
  const residents = (store.users || []).filter((m) => m.buildingId === buildingId && ["owner", "tenant"].includes(m.role) && m.status === "active");
  const [att, setAtt] = useState(null); // { sel: {id:true}, resPick, extName, extOrg }
  // Nobody is pre-ticked. An attendee list that fills itself in produces walks
// that record people who were never there, which is worse than no list at all.
  const attState = att || { sel: {}, resPick: "", extName: "", extOrg: "" };
  const setAttState = (patch) => setAtt({ ...attState, ...patch });
  const roleTag = (m) => (m.role === "manager" ? "BM" : m.role === "admin" ? "Admin" : m.role === "tenant" ? "Resident" : m.role === "owner" ? "Resident" : "BCC");
  const composeAttendees = () => {
    const names = (store.users || []).filter((m) => attState.sel[m.id]).map((m) => `${m.name} (${roleTag(m)})`);
    if (attState.extName.trim()) names.push(`${attState.extName.trim()}${attState.extOrg.trim() ? ` (${attState.extOrg.trim()})` : " (external)"}`);
    return names.join(", ");
  };
  const [editing, setEditing] = useState(false);
  const [ni, setNi] = useState({ area: "", item: "" });
  // ---- the register (0021-0023): sections, findings, and the event trail ----
  const [sections, setSections] = useState([]);
  const [findings, setFindings] = useState([]);
  const [fEvents, setFEvents] = useState([]);
  const [raiseFor, setRaiseFor] = useState(null);   // section row, or "other"
  const [draft, setDraft] = useState({ cls: "S", location: "", observation: "", outcome: "", owner: "BM", due: "", risk: "medium", photoPath: "" });
  const [fPhoto, setFPhoto] = useState({});        // findingId -> freshly captured photo path
  const [detail, setDetail] = useState(null);      // the finding open in the drawer
  const [tile, setTile] = useState(null);          // which register tile is drilled into
  const [search, setSearch] = useState("");        // searches every finding, open or closed
  const [nwAsk, setNwAsk] = useState(null);        // the group being recorded as not walked
  const [nwReason, setNwReason] = useState("");
  const isCttee = ["bcc", "admin"].includes(user.role);
  const loadRegister = async () => {
    try {
      const [sec, fs, ev] = await Promise.all([
        listWalkSections(buildingId), listFindings(buildingId), listFindingEvents(buildingId),
      ]);
      setSections(sec); setFindings(fs); setFEvents(ev);
    } catch (e) { console.error(e); }
  };
  const openF = findings.filter((f) => f.status === "open");
  const carriedF = (wid) => openF.filter((f) => f.first_raised_walk_id !== wid);
  const hazardF = openF.filter((f) => f.class === "H");
  const overdueF = openF.filter((f) => f.overdue);
  const recurF = openF.filter((f) => f.class === "S" && (f.walks_open || 0) >= 3);
  const closedF = findings.filter((f) => f.status === "closed").sort((a, b) => (String(b.closed_at || "") > String(a.closed_at || "") ? 1 : -1));
  const q = search.trim().toLowerCase();
  const hits = q ? findings.filter((f) => [f.ref, f.location, f.observation, f.owner, f.section_name, (WT_CLASS[f.class] || [""])[0]]
    .filter(Boolean).join(" ").toLowerCase().includes(q)) : [];
  const prevWalkOf = (w) => walks.filter((x) => x.id !== w.id && x.walk_date <= w.walk_date).sort((a, b) => (a.walk_date < b.walk_date ? 1 : -1))[0] || null;
  const [reporting, setReporting] = useState(false);
  const report = async (w) => {
    if (!w) return flash("Open or select a walk first");
    const win = openReportWindow();
    if (!win) return flash("Your browser blocked the report tab. Allow pop-ups for this site, then press Export PDF again.");
    setReporting(true);
    try {
      const photos = await collectEvidence(findings, fEvents, (d, t) => reportProgress(win, d, t));
      printWalkReport({ walk: w, building, sections, findings, events: fEvents,
                        prevWalk: prevWalkOf(w), walks, photos, win });
    } catch (e) { try { win.close(); } catch (e2) { /* already closed */ } flash(String(e.message || e)); }
    finally { setReporting(false); }
  };
  const amendF = async (f, patch, reason) => {
    try {
      await amendFinding(buildingId, f.id, patch, reason);
      const fresh = await listFindings(buildingId);
      setFindings(fresh); setFEvents(await listFindingEvents(buildingId));
      setDetail(fresh.find((x) => x.id === f.id) || null);
      flash(`${f.ref} amended. The change and your reason are on its record.`);
      return true;
    } catch (e) {
      flash(String(e.message || e).replace(/^.*committee act.*$/i, "Only the committee can amend a finding at this building."));
      return false;
    }
  };
  // Per-group controls on a walk. "Not walked" is recorded on the walk itself, so the report
  // lists it and stops counting that group as inspected. "Nothing to report" answers every
  // question in the group not yet answered as OK, in one tap.
  const curWalk = walks.find((x) => x.id === walkId) || null;
  const nwList = notWalkedList(curWalk);
  const notWalkedArea = (area) => nwList.find((x) => x.name === area) || null;
  const setNotWalked = async (area, reason) => {
    const sec = sections.find((x) => x.name === area) || null;
    const next = nwList.filter((x) => x.name !== area).concat(reason === null ? [] : [{ section_id: sec ? sec.id : null, name: area, reason: reason || "" }]);
    try {
      await setWalkMeta(walkId, { sections_not_walked: next });
      await reload(); setNwAsk(null); setNwReason("");
      flash(reason === null ? `${area} is back in this walk` : `${area} recorded as not walked`);
    } catch (e) { flash(String(e.message || e)); }
  };
  const nothingToReport = async (area) => {
    const ids = items.filter((i) => i.area === area && !results[i.id]).map((i) => i.id);
    if (!ids.length) return flash("Every question in this group already has an answer");
    try {
      await setWalkResultsBulk(walkId, ids, "ok");
      const m = { ...results }; ids.forEach((x) => { m[x] = "ok"; }); setResults(m);
      flash(`${area}: ${ids.length} question${ids.length === 1 ? "" : "s"} marked OK`);
    } catch (e) { flash(String(e.message || e)); }
  };
  const submitFinding = async (sec) => {
    if (!draft.observation.trim()) return flash("Say what was observed");
    try {
      await raiseFinding(buildingId, {
        cls: draft.cls, sectionId: sec && sec.id ? sec.id : null, sectionName: sec && sec.name,
        location: draft.location, observation: draft.observation.trim(), outcome: draft.outcome,
        owner: draft.owner, due: draft.due || null, risk: draft.risk, walkId,
        standard: sec && sec.duty_reference, photoPath: draft.photoPath || null,
      });
      setDraft({ cls: "S", location: "", observation: "", outcome: "", owner: "BM", due: "", risk: "medium", photoPath: "" });
      setRaiseFor(null); await loadRegister(); flash("Finding raised and on the register");
    } catch (e) { flash(String(e.message || e)); }
  };
  // One capture flow for everything. The photo is uploaded straight away and held
  // against the finding until the next action consumes it, so the same shot can be
  // the "still present" evidence or the closing half of a before-and-after pair.
  const snapFinding = async (f, file) => {
    if (!file) return;
    try {
      const up = await uploadMedia(buildingId, "walkthrough", file);
      setFPhoto((m) => ({ ...m, [f.id]: up.path }));
      flash("Photo attached to " + f.ref);
    } catch (e) { flash(String(e.message || e)); }
  };
  const snapDraft = async (file) => {
    if (!file) return;
    try { const up = await uploadMedia(buildingId, "walkthrough", file); setDraft((d) => ({ ...d, photoPath: up.path })); flash("Photo attached"); }
    catch (e) { flash(String(e.message || e)); }
  };
  // The drawer can act on a finding whether or not a walk is open. Closing
  // between walks is a real thing that happens, and forcing someone to start a
  // walk just to record it is what produced phantom walks in the first place.
  const actOnFinding = async (kind, f, note) => {
    const w = walkId || null;
    try {
      if (kind === "still") {
        await observeFindingAgain(f.id, w, note || (w ? "Still present at this walk" : "Still present, confirmed between walks"), fPhoto[f.id] || null);
        flash(`${f.ref} recorded as still present`);
      } else if (kind === "close") {
        await closeFinding(buildingId, f.id, w, note || (w ? "Verified at the walk" : "Confirmed done between walks"), fPhoto[f.id] || null);
        flash(`${f.ref} closed and verified`);
      } else if (kind === "reopen") {
        await reopenFinding(buildingId, f.id, w, note || "Reopened");
        flash(`${f.ref} reopened`);
      }
      setFPhoto((m) => { const n = { ...m }; delete n[f.id]; return n; });
      const fresh = await listFindings(buildingId);
      setFindings(fresh); setFEvents(await listFindingEvents(buildingId));
      setDetail(fresh.find((x) => x.id === f.id) || null);
    } catch (e) { flash(String(e.message || e).replace(/^.*committee verification.*$/i, "Only the committee can close a finding at this building.")); }
  };
  const stillThere = async (f) => {
    try {
      await observeFindingAgain(f.id, walkId, "Still present at this walk", fPhoto[f.id] || null);
      setFPhoto((m) => { const n = { ...m }; delete n[f.id]; return n; });
      await loadRegister(); flash(`${f.ref} recorded as still present`);
    } catch (e) { flash(String(e.message || e)); }
  };
  const closeF = async (f) => {
    if (!fPhoto[f.id] && !window.confirm(`Close ${f.ref} with no closing photo?\n\nA before-and-after pair is the strongest evidence the work was done.`)) return;
    try {
      await closeFinding(buildingId, f.id, walkId, "Verified at the walk", fPhoto[f.id] || null);
      setFPhoto((m) => { const n = { ...m }; delete n[f.id]; return n; });
      await loadRegister(); flash(`${f.ref} closed and verified`);
    } catch (e) { flash(String(e.message || e).replace(/^.*committee verification.*$/i, "Only the committee can close a finding at this building.")); }
  };
  const reload = async () => {
    try { setItems(await listWalkItems(buildingId)); setWalks(await listWalks(buildingId)); } catch (e) { console.error(e); }
  };
  useEffect(() => { reload(); loadRegister(); }, [buildingId]);
  const start = async () => {
    const openOne = walks.find((w) => w.status === "in_progress");
    if (openOne) {
      const same = String(openOne.walk_date) === today();
      if (!window.confirm(`There is already a walk ${same ? "started today" : "in progress from " + fmtWalkDate(openOne.walk_date)} that has not been issued.\n\nOK to continue that one instead.\nCancel to start a second walk anyway.`)) {
        return openWalk(openOne);
      }
    }
    if (!Object.values(attState.sel).some(Boolean) && !attState.extName.trim()
        && !window.confirm("No attendees selected. Record the walk with nobody listed?")) return;
    try { const id = await createWalk(buildingId, composeAttendees() || user.name); setWalkId(id); setResults({}); setNotes({}); setPhotos({}); setMaintSent({}); setAtt(null); reload(); }
    catch (e) { flash(String(e.message || e)); }
  };
  const discard = async (w) => {
    if (!window.confirm(`Discard the walk of ${fmtWalkDate(w.walk_date)}?\n\nThis removes it from the record entirely. Only possible while nothing has been recorded against it.`)) return;
    try { await discardWalk(buildingId, w.id); if (walkId === w.id) setWalkId(null); await reload(); flash("Walk discarded"); }
    catch (e) { flash(String(e.message || e)); }
  };
  const openWalk = async (w) => {
    setWalkId(w.id);
    loadRegister();
    const rs = await listWalkResults(w.id);
    const m = {}; const n = {}; const p = {}; const ms = {};
    rs.forEach((r) => { m[r.item_id] = r.result; if (r.note) n[r.item_id] = r.note; if (r.photo_path) p[r.item_id] = r.photo_path; if (r.maintenance_id) ms[r.item_id] = r.maintenance_id; });
    setResults(m); setNotes(n); setPhotos(p); setMaintSent(ms);
  };
  const mark = async (item, result) => {
    try { await setWalkResultPhoto(walkId, item.id, result, notes[item.id], photos[item.id]); setResults({ ...results, [item.id]: result }); }
    catch (e) { flash(String(e.message || e)); }
  };
  // Snap or attach a photo against any item, whatever its status
  const snap = async (item, file) => {
    if (!file) return;
    try {
      const up = await uploadMedia(buildingId, "walkthrough", file);
      await setWalkResultPhoto(walkId, item.id, results[item.id] || null, notes[item.id], up.path);
      setPhotos({ ...photos, [item.id]: up.path });
      flash("Photo attached");
    } catch (e) { flash(String(e.message || e)); }
  };
  // There is one way to finish a walk: Issue this walk, on the Finish card. The old
  // "Complete walk" button set status=completed with no issued_at, and since only
  // in-progress walks offered Continue, a walk ended that way could never be issued.
  const goFinish = () => { const el = document.getElementById("wt-finish"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  // Export any walk to Word, embedding photo evidence
  // Word, mirroring the report: same eight parts, same branding, same photo pairs.
  // Kept because some committees file Word and some print PDF; both come off the
  // same register so they cannot disagree.
  const NAVY = "0B1F3A", TEAL = "1FA6A6", GREY = "5C6670";
  const wT = (t, o = {}) => new DocxT({ text: String(t == null ? "" : t), size: o.size || 16, bold: o.bold, color: o.color, italics: o.italics });
  const wP = (t, o = {}) => new DocxP({ spacing: { before: o.before || 0, after: o.after == null ? 60 : o.after }, children: Array.isArray(t) ? t : [wT(t, o)] });
  const wH = (t) => new DocxP({ spacing: { before: 240, after: 90 }, border: { bottom: { style: DocxB.SINGLE, size: 10, color: TEAL } }, children: [wT(t, { size: 24, bold: true, color: NAVY })] });
  const wCell = (kids, o = {}) => new DocxTC({
    width: { size: o.w || 1500, type: DocxW.DXA },
    shading: o.fill ? { type: DocxSh.CLEAR, fill: o.fill, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: Array.isArray(kids) ? kids : [wP(kids, { after: 0, size: 15, bold: o.bold, color: o.color })],
  });
  const WIDTHS = { 6: [900, 500, 1800, 2400, 2200, 1400], 5: [900, 1800, 3400, 1200, 1900], 7: [900, 500, 1500, 2100, 1900, 1300, 1000] };
  const wTable = (heads, rows) => {
    const w = WIDTHS[heads.length] || heads.map(() => Math.floor(9200 / heads.length));
    return new DocxTable({
      columnWidths: w,
      width: { size: w.reduce((a, b) => a + b, 0), type: DocxW.DXA },
      rows: [new DocxTR({ tableHeader: true, children: heads.map((h, i) => wCell(h, { w: w[i], fill: NAVY, color: "FFFFFF", bold: true })) })]
        .concat(rows.map((r) => new DocxTR({ children: r.map((c, i) => wCell(c, { w: w[i], bold: i === 0 })) }))),
    });
  };
  const exportWalk = async (w) => {
    try {
      flash("Building the Word report with photo evidence...");
      const ev = fEvents, P = await collectEvidenceBuffers(findings, ev);
      const wid = w.id, F = findings;
      const dmy = (d) => (d ? fmtDate(d) : "");
      const openF2 = F.filter((x) => x.status === "open");
      const { closedHere, since } = walkClosures(w, walks, F);
      const nwl = notWalkedList(w);
      const closedWhen = (f) => dmy(f.closed_at) + (f.closed_walk_id ? "" : " (between walks)");
      const newHere = F.filter((x) => x.status === "open" && x.first_raised_walk_id === wid);
      const carriedHere = F.filter((x) => x.status === "open" && x.first_raised_walk_id !== wid);
      const only = (arr) => arr.filter((x) => ["S", "R"].includes(x.class));
      const byC = (c) => openF2.filter((x) => x.class === c);
      const rec = openF2.filter((x) => x.class === "S" && (x.walks_open || 0) >= 3).sort((a, b) => (b.walks_open || 0) - (a.walks_open || 0));
      const dueTxt = (f) => (f.due_date ? dmy(f.due_date) + (f.overdue ? "  OVERDUE" : "") : "");
      const ageTxt = (f) => `${f.walks_open || 1} walk${(f.walks_open || 1) === 1 ? "" : "s"} · since ${dmy(f.first_raised_on)}`;
      const shot = (buf) => (buf ? new DocxP({ spacing: { after: 20 }, children: [new DocxImg({ type: "jpg", data: buf.data, transformation: { width: buf.w, height: buf.h } })] }) : null);
      const evidenceCell = (f, w2) => {
        const p = P[f.id] || {};
        const kids = [];
        if (p.raised) { kids.push(shot(p.raised)); kids.push(wP("Raised " + dmy(f.first_raised_on), { size: 12, color: GREY, after: 40 })); }
        if (p.closed) { kids.push(shot(p.closed)); kids.push(wP("Closed " + closedWhen(f), { size: 12, color: GREY, after: 0 })); }
        (p.observed || []).forEach((o) => { kids.push(shot(o)); kids.push(wP("Seen " + dmy(o.on), { size: 12, color: GREY, after: 40 })); });
        return kids.length ? kids.filter(Boolean) : [wP("", { after: 0 })];
      };
      const withEvidence = (heads, arr, cols) => wTable(heads.concat("Evidence"),
        arr.map((f) => cols.map((c) => (typeof c === "function" ? c(f) : f[c])).concat([evidenceCell(f)])));

      const K = [
        new DocxP({ spacing: { after: 40 }, children: [wT("NaloHub", { bold: true, size: 26, color: NAVY }), wT("   Building Walk Through", { size: 26, color: GREY })] }),
        new DocxP({ spacing: { after: 160 }, border: { bottom: { style: DocxB.SINGLE, size: 12, color: TEAL } },
          children: [wT(`${building.name}${building.address ? " · " + building.address : ""} · Walk of ${dmy(w.walk_date)}`, { size: 18, color: GREY })] }),
        wP(`Generated ${new Date().toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}`, { color: GREY, size: 14, after: 120 }),
        wP(`${closedHere.length} closed since last walk  ·  ${only(newHere).length} raised  ·  ${carriedHere.length} carried  ·  ${F.filter((x) => x.overdue).length} overdue  ·  ${byC("H").length} open hazards`, { bold: true, after: 140 }),
      ];
      if (byC("H").length) K.push(wP(`${byC("H").length} workplace health and safety hazard${byC("H").length === 1 ? "" : "s"} open. See Part 5.`, { bold: true, color: "AA3333", after: 140 }));

      K.push(wH("Part 1 · Walk record"));
      K.push(wTable(["Field", "Detail"], [
        ["Date of walk", dmy(w.walk_date)], ["In attendance", w.attendees || ""],
        ["Areas not walked", notWalkedText(w) || "None. All groups were inspected."],
        ["Status", w.issued_at ? "Issued " + dmy(w.issued_at) : "Draft, not yet issued"]]));

      K.push(wH("Part 2 · Closed since last walk"));
      K.push(wP("Before and after, side by side. This is the proof the work was done.", { color: GREY, size: 15 }));
      K.push(closedHere.length ? withEvidence(["Ref", "Cls", "Location", "What it was", "Outcome", "Closed"], closedHere,
        ["ref", "class", "location", "observation", "required_outcome", closedWhen]) : wP("Nothing closed since the last walk.", { color: GREY, size: 15 }));
      if (since.length) {
        K.push(new DocxP({ spacing: { before: 160, after: 20 }, children: [wT("Closed since this walk", { bold: true, size: 19, color: NAVY })] }));
        K.push(wP("Confirmed done after this walk, up to the moment this copy was made.", { color: GREY, size: 15 }));
        K.push(withEvidence(["Ref", "Cls", "Location", "What it was", "Outcome", "Closed"], since,
          ["ref", "class", "location", "observation", "required_outcome", closedWhen]));
      }

      K.push(wH("Part 3 · The walk, by duty group"));
      for (const sec of sections) {
        const mine = only(newHere).filter((f) => f.section_id === sec.id);
        K.push(new DocxP({ spacing: { before: 140, after: 20 }, children: [wT(sec.name, { bold: true, size: 19, color: NAVY })] }));
        K.push(wP(sec.duty_reference || "", { size: 13, color: TEAL, italics: true, after: 60 }));
        const nwHit = nwl.find((x) => (x.section_id && x.section_id === sec.id) || x.name === sec.name);
        K.push(mine.length ? withEvidence(["Ref", "Cls", "Location", "Observation", "Required outcome", "Owner / due"], mine,
          ["ref", "class", "location", "observation", "required_outcome", (f) => [f.owner, dueTxt(f)].filter(Boolean).join("  ·  ")])
          : nwHit ? wP(`Not walked on this walk${nwHit.reason ? ": " + nwHit.reason : ""}.`, { color: "9A6408", size: 15, italics: true })
          : wP("Inspected, nothing raised.", { color: "2F7D5D", size: 15 }));
      }

      K.push(wH("Part 4 · Carried and overdue"));
      K.push(only(carriedHere).length ? wTable(["Ref", "Cls", "Location", "Observation", "Required outcome", "Open for", "Owner / due"],
        only(carriedHere).sort((a, b) => (b.walks_open || 0) - (a.walks_open || 0)).map((f) => [f.ref, f.class, f.location, f.observation, f.required_outcome, ageTxt(f), [f.owner, dueTxt(f)].filter(Boolean).join("  ·  ")]))
        : wP("Nothing carried.", { color: GREY, size: 15 }));

      K.push(wH("Part 5 · Workplace health and safety"));
      K.push(byC("H").length ? withEvidence(["Ref", "Risk", "Location", "Hazard", "Control", "Open for"], byC("H"),
        ["ref", (f) => String(f.risk_rating || "").toUpperCase(), "location", "observation", "required_outcome", ageTxt]) : wP("No open hazards.", { color: "2F7D5D", size: 15 }));

      for (const [title, cls, heads, cols] of [
        ["Part 6 · For Body Corporate decision", "C", ["Ref", "Matter", "What is needed to decide", "Owner", "Due"], ["ref", "location", "observation", "owner", dueTxt]],
        ["Part 7 · Lot owner and by-law matters", "L", ["Ref", "Lot", "Matter", "Action", "Owner"], ["ref", "location", "observation", "required_outcome", "owner"]],
        ["Part 8 · Contract and governance", "G", ["Ref", "Deliverable", "Detail", "Owner", "Due"], ["ref", "location", "observation", "owner", dueTxt]]]) {
        const arr = byC(cls);
        K.push(wH(title));
        K.push(arr.length ? wTable(heads, arr.map((f) => cols.map((c) => (typeof c === "function" ? c(f) : f[c])))) : wP("Nothing in this section.", { color: GREY, size: 15 }));
      }

      K.push(wH("Appendix A · Recurrence schedule"));
      K.push(wP("Standard-class findings open at three or more walks, with every date observed. Produced from the register, not written.", { color: GREY, size: 15 }));
      K.push(rec.length ? withEvidence(["Ref", "Cls", "Duty group", "Location", "Observation", "Open for"], rec,
        ["ref", "class", (f) => f.section_name || "", "location", "observation", ageTxt])
        : wP("No standard-class finding has reached three walks.", { color: GREY, size: 15 }));

      K.push(wH("Appendix B · Finding classes"));
      K.push(wTable(["Class", "Meaning"], Object.entries(WT_CLASS).map(([k, v]) => [k, `${v[0]}. ${v[1]}`])));
      K.push(wP("Standard-class findings are observations against a cited duty, not breach allegations, and are never promoted into the maintenance register. They escalate by recurrence.", { color: GREY, size: 15, before: 100 }));
      K.push(wP("Prepared from the NaloHub Walk Through register. Every entry is backed by the in-app trail: who, what, when. Suitable for tabling in committee meeting minutes.", { color: GREY, size: 13, before: 200 }));

      const doc = new DocxDocument({ sections: [{ properties: { page: { margin: { top: 700, bottom: 700, left: 700, right: 700 } } }, children: K }] });
      const blob = await DocxPacker.toBlob(doc);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Walk-Through-${building.name.replace(/[^\w]+/g, "-")}-${w.walk_date}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      flash("Word report downloaded");
    } catch (e) { flash(String(e.message || e)); }
  };
  const areas = [...new Set(items.map((i) => i.area))];
  const current = walks.find((w) => w.id === walkId);
  return (
    <div>
      <Head title="Walk-Through" sub="Monthly BM + BCC inspection checklist" />
      <Wrap>
        <HowTo id="walkthrough" steps={["Start a walk and confirm who is attending. Your duty groups and their standing questions load automatically, each one citing the Schedule 1 duty it tests and how often the agreement requires it.", "Deal with what is carried from last time first. Photograph anything still present, or close it if it is done. The before and after pair is what proves the work happened.", "Raise new findings where you find them. Give each one a class, an owner, a date and a photo, and say plainly what done looks like.", "Issue the walk, then open the Report. It carries the photo evidence, the recurrence schedule and how the building is tracking, ready to send to the committee."]} sell="Findings keep their own reference and stay on the register until someone verifies they are done, so nothing quietly drops off between walks. The report writes itself from that record." />
        {items.length === 0 && (<Card style={{ padding: 18 }}>
          <SectionTitle>Set up your checklist</SectionTitle>
          <div className="text-sm mb-3" style={{ color: T.textMuted }}>Load the standard 22-item building checklist (fire safety, access, lifts, common areas, amenities, building fabric, services, grounds). You can tailor it later.</div>
          <Btn grad data-guide="g-walk-load" onClick={async () => { try { await seedWalkDefaults(buildingId); reload(); flash("Standard checklist loaded"); } catch (e) { flash(String(e.message || e)); } }}>Load standard checklist</Btn>
        </Card>)}
        {items.length > 0 && !walkId && (<>
          <Card style={{ padding: 18 }}>
            <SectionTitle>Start this month's walk</SectionTitle>
            <div className="text-xs mb-1.5" style={{ color: T.textMuted }}>Committee and building manager. Tap to deselect anyone not attending:</div>
            <div className="flex gap-1.5 flex-wrap mb-3">{staff.map((m) => (
              <button key={m.id} onClick={() => setAttState({ sel: { ...attState.sel, [m.id]: !attState.sel[m.id] } })} className="text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ background: attState.sel[m.id] ? hexToRgba(SEMANTIC.ok, 0.15) : T.surfaceAlt, color: attState.sel[m.id] ? SEMANTIC.ok : T.textMuted, border: `1px solid ${attState.sel[m.id] ? SEMANTIC.ok : T.border}`, textDecoration: attState.sel[m.id] ? "none" : "line-through" }}>{attState.sel[m.id] ? <Check size={12} /> : <X size={12} />} {m.name} · {roleTag(m)}</button>))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Add a resident (optional)"><Select value={attState.resPick} onChange={(e) => { const v = e.target.value; if (v) setAttState({ sel: { ...attState.sel, [v]: true }, resPick: "" }); }}>
                <option value="">Choose a resident…</option>
                {residents.filter((m) => !attState.sel[m.id]).map((m) => (<option key={m.id} value={m.id}>{m.name}{m.unit ? ` · Unit ${m.unit}` : ""}</option>))}
              </Select></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="External party (optional)"><Input value={attState.extName} onChange={(e) => setAttState({ extName: e.target.value })} placeholder="Name" /></Field>
                <Field label="From"><Input value={attState.extOrg} onChange={(e) => setAttState({ extOrg: e.target.value })} placeholder="e.g. Acme Fire Services" /></Field>
              </div>
            </div>
            {residents.some((m) => attState.sel[m.id]) && <div className="flex gap-1.5 flex-wrap mt-2">{residents.filter((m) => attState.sel[m.id]).map((m) => (<button key={m.id} onClick={() => setAttState({ sel: { ...attState.sel, [m.id]: false } })} className="text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ background: hexToRgba(T.accent, 0.14), color: T.accent, border: `1px solid ${T.accent}` }}><Check size={12} /> {m.name} · Resident <X size={11} /></button>))}</div>}
            <div className="flex gap-2 mt-3.5"><Btn grad data-guide="g-walk-start" onClick={start}><ClipboardList size={15} /> Start walk-through</Btn><Btn kind="ghost" onClick={() => setEditing(!editing)}><Pencil size={14} /> {editing ? "Done editing" : "Edit checklist"}</Btn></div>
          </Card>
          {editing && (<Card style={{ padding: 16 }}>
            <SectionTitle>Tailor the checklist for {building.name}</SectionTitle>
            {[...new Set(items.map((i) => i.area))].map((area) => (<div key={area} className="mb-2">
              <div className="text-xs font-bold mb-1" style={{ color: T.textMuted }}>{area.toUpperCase()}</div>
              {items.filter((i) => i.area === area).map((i) => (<div key={i.id} className="flex items-center gap-2 py-1 text-sm" style={{ borderBottom: `1px dashed ${T.border}` }}><div className="flex-1">{i.item}</div><Btn kind="ghost" onClick={async () => { await removeWalkItem(buildingId, i.id); reload(); }}><Trash2 size={13} /></Btn></div>))}
            </div>))}
            <div className="grid sm:grid-cols-3 gap-2.5 mt-3">
              <Input placeholder="Area (e.g. Fire Safety)" value={ni.area} onChange={(e) => setNi({ ...ni, area: e.target.value })} list="wt-areas" />
              <Input placeholder="What to check" value={ni.item} onChange={(e) => setNi({ ...ni, item: e.target.value })} />
              <Btn onClick={async () => { if (!ni.area.trim() || !ni.item.trim()) return; await addWalkItem(buildingId, ni.area.trim(), ni.item.trim()); setNi({ area: "", item: "" }); reload(); flash("Item added"); }}><Plus size={14} /> Add item</Btn>
            </div>
            <datalist id="wt-areas">{[...new Set(items.map((i) => i.area))].map((a) => <option key={a} value={a} />)}</datalist>
          </Card>)}
          {findings.length > 0 && (<>
            {hazardF.length > 0 && (<Card style={{ padding: 0, overflow: "hidden", border: `1px solid ${hexToRgba(SEMANTIC.bad, 0.45)}` }}>
              <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: hexToRgba(SEMANTIC.bad, 0.12) }}>
                <AlertTriangle size={15} style={{ color: SEMANTIC.bad }} />
                <div className="text-sm font-bold" style={{ color: SEMANTIC.bad }}>
                  {hazardF.length} open safety hazard{hazardF.length === 1 ? "" : "s"}
                </div>
              </div>
              {hazardF.map((f) => (
                <button key={f.id} onClick={() => setDetail(f)} className="w-full text-left px-5 py-3" style={{ borderTop: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="text-sm">{f.ref}</b>
                    <Badge color={SEMANTIC.bad}>{String(f.risk_rating || "").toUpperCase()}</Badge>
                    <div className="text-sm flex-1">{f.location}</div>
                    <div className="text-[11px]" style={{ color: T.textMuted }}>open {f.walks_open || 1} walk{(f.walks_open || 1) === 1 ? "" : "s"}</div>
                    <ChevronRight size={15} style={{ color: T.textMuted }} />
                  </div>
                  <div className="text-xs mt-1" style={{ color: T.textMuted }}>{f.observation}</div>
                </button>))}
            </Card>)}

            <Card style={{ padding: 16 }}>
              <SectionTitle>The register</SectionTitle>
              <div className="text-xs mb-3" style={{ color: T.textMuted }}>Every finding keeps its reference for good. Tap a number to see what is behind it, or search every finding, open or closed.</div>
              <div className="mb-3"><Input placeholder="Search by reference, place or words, e.g. CB-0041 or bins" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              {q && (<div className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-xs font-semibold" style={{ color: T.textMuted }}>{hits.length} finding{hits.length === 1 ? "" : "s"} matching "{search.trim()}"</div>
                  <div className="flex-1" />
                  <button onClick={() => setSearch("")} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-lg" style={{ color: T.accent, background: hexToRgba(T.accent, 0.1) }}><X size={12} /> Clear</button>
                </div>
                {hits.slice(0, 60).map((f) => (
                  <button key={f.id} onClick={() => setDetail(f)} className="w-full text-left py-2 flex items-start gap-2" style={{ borderBottom: `1px dashed ${T.border}` }}>
                    <b className="text-xs w-16 shrink-0 pt-0.5">{f.ref}</b>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{f.location}</div>
                      <div className="text-[11px]" style={{ color: T.textMuted }}>{f.observation}</div>
                    </div>
                    <Badge color={f.status === "closed" ? SEMANTIC.ok : f.class === "H" ? SEMANTIC.bad : T.accent}>{f.status === "closed" ? "closed " + fmtDate(localDay(f.closed_at)) : "open"}</Badge>
                    <ChevronRight size={14} style={{ color: T.textMuted, marginTop: 2 }} />
                  </button>))}
              </div>)}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[["open", openF.length, "open", T.accent],
                  ["hazard", hazardF.length, "hazard" + (hazardF.length === 1 ? "" : "s"), SEMANTIC.bad],
                  ["overdue", overdueF.length, "overdue", SEMANTIC.warn],
                  ["recur", recurF.length, "at 3+ walks", SEMANTIC.warn],
                  ["closed", closedF.length, "closed", SEMANTIC.ok]].map(([k, n, l, c]) => (
                  <button key={k} onClick={() => setTile(tile === k ? null : k)} disabled={!n}
                    className="rounded-xl px-3 py-2.5 text-left transition"
                    style={{ background: tile === k ? hexToRgba(c, 0.18) : n ? hexToRgba(c, 0.08) : T.surfaceAlt,
                             border: `1px solid ${tile === k ? c : n ? hexToRgba(c, 0.35) : T.border}`, cursor: n ? "pointer" : "default" }}>
                    <div className="text-xl font-bold leading-none" style={{ color: n ? c : T.textMuted }}>{n}</div>
                    <div className="text-[10px] mt-1 flex items-center gap-1" style={{ color: T.textMuted }}>
                      {l}{n ? <ChevronRight size={10} /> : null}
                    </div>
                  </button>))}
              </div>
              {tile && (<div className="mt-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-xs font-semibold" style={{ color: T.textMuted }}>
                    {tile === "open" ? "Every open finding" : tile === "hazard" ? "Safety hazards" : tile === "overdue" ? "Past their due date" : tile === "closed" ? "Closed and verified, newest first. These records are fixed." : "Open at three or more walks"}
                  </div>
                  <div className="flex-1" />
                  <button onClick={() => setTile(null)} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-lg" style={{ color: T.accent, background: hexToRgba(T.accent, 0.1) }}>
                    <X size={12} /> Close
                  </button>
                </div>
                {(tile === "closed" ? closedF : (tile === "open" ? openF : tile === "hazard" ? hazardF : tile === "overdue" ? overdueF : recurF)
                  .slice().sort((a, b) => (b.walks_open || 0) - (a.walks_open || 0)))
                  .map((f) => (
                    <button key={f.id} onClick={() => setDetail(f)} className="w-full text-left py-2 flex items-start gap-2" style={{ borderBottom: `1px dashed ${T.border}` }}>
                      <b className="text-xs w-16 shrink-0 pt-0.5">{f.ref}</b>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{f.location}</div>
                        <div className="text-[11px]" style={{ color: T.textMuted }}>{f.observation}</div>
                      </div>
                      <div className="text-[11px] shrink-0 text-right pt-0.5" style={{ color: f.overdue ? SEMANTIC.bad : T.textMuted }}>
                        {f.status === "closed" ? `closed ${fmtDate(localDay(f.closed_at))}` : f.due_date ? fmtDate(f.due_date) : `${f.walks_open || 1} walk${(f.walks_open || 1) === 1 ? "" : "s"}`}
                      </div>
                      <ChevronRight size={14} style={{ color: T.textMuted, marginTop: 2 }} />
                    </button>))}
              </div>)}
            </Card>
          </>)}
          <SectionTitle>Past walks</SectionTitle>
          {walks.length === 0 && <Empty icon={ClipboardList} title="No walks recorded yet" />}
          {walks.map((w) => (<Card key={w.id} style={{ padding: 14 }}><div className="flex items-center gap-3 flex-wrap"><div className="flex-1 min-w-[160px]"><div className="font-semibold text-sm">{fmtWalkDate(w.walk_date)}</div><div className="text-xs" style={{ color: T.textMuted }}>{w.attendees || ""}{w.summary ? ` · ${w.summary}` : ""}</div></div><Badge color={w.issued_at ? SEMANTIC.ok : w.status === "completed" ? T.accent : SEMANTIC.warn}>{w.issued_at ? "issued" : w.status.replace(/_/g, " ")}</Badge><Btn kind="ghost" onClick={() => report(w)} title="Opens the report, then use Save as PDF in the print dialog"><Printer size={13} /> {reporting ? "Building..." : "Export PDF"}</Btn><Btn kind="ghost" onClick={() => exportWalk(w)} title="Downloads a Word file straight away"><Download size={13} /> Export Word</Btn>{!w.issued_at && <Btn kind="ghost" onClick={() => openWalk(w)} title="Reopen this unissued walk, carry on, and issue it from the Finish card">Continue this walk</Btn>}{w.status === "in_progress" && <Btn kind="ghost" onClick={() => discard(w)} title="Remove a walk that was opened but never walked"><Trash2 size={13} /></Btn>}</div></Card>))}
        </>)}
        {walkId && (<>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div className="px-5 py-3.5" style={{ background: `linear-gradient(135deg, ${hexToRgba(T.accent, 0.16)}, ${hexToRgba(T.accent2, 0.08)})` }}>
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: T.accent }}>NaloHub · Building Walk-Through</div>
              <div className="font-bold mt-0.5">{building.name}</div>
              <div className="text-xs" style={{ color: T.textMuted }}>{building.address}{current ? ` · ${fmtWalkDate(current.walk_date)}` : ""}</div>
              {current && current.attendees && <div className="text-xs mt-1" style={{ color: T.textMuted }}>Attending: {current.attendees}</div>}
            </div>
          </Card>
          <div className="flex items-center gap-3">
            <button onClick={() => setWalkId(null)} className="text-sm inline-flex items-center gap-1" style={{ color: T.accent }}><ArrowLeft size={14} /> Walks</button>
            <div className="text-sm flex-1" style={{ color: T.textMuted }}>{Object.keys(results).length}/{items.length} checked</div>
            <Btn grad onClick={goFinish} title="Jump to the Finish card, where the walk is issued">Go to Finish</Btn>
          </div>
          {carriedF(walkId).length > 0 && (<Card style={{ padding: 16 }}>
            <SectionTitle>Carried from earlier walks ({carriedF(walkId).length})</SectionTitle>
            <div className="text-xs mb-2.5" style={{ color: T.textMuted }}>Mark each one still present, or close it if it is done. {isCttee ? "" : "Closing is the committee's act; you can record what you saw."}</div>
            {carriedF(walkId).sort((a, b) => (b.walks_open || 0) - (a.walks_open || 0)).map((f) => (
              <div key={f.id} className="py-2.5" style={{ borderBottom: `1px dashed ${T.border}` }}>
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm"><b>{f.ref}</b> <span style={{ color: T.textMuted }}>{f.location}</span></div>
                    <div className="text-xs mt-0.5">{f.observation}</div>
                    <div className="text-[11px] mt-1 flex items-center gap-2 flex-wrap" style={{ color: T.textMuted }}>
                      <Badge color={f.class === "H" ? SEMANTIC.bad : (f.walks_open || 0) >= 3 ? SEMANTIC.warn : T.accent}>{(WT_CLASS[f.class] || ["?"])[0]}</Badge>
                      <span>open {f.walks_open || 1} walk{(f.walks_open || 1) === 1 ? "" : "s"}</span>
                      <span>since {fmtDate(f.first_raised_on)}</span>
                      {f.overdue && <span style={{ color: SEMANTIC.bad, fontWeight: 700 }}>OVERDUE</span>}
                    </div>
                  </div>
                  <label className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1" style={{ background: fPhoto[f.id] ? hexToRgba(T.accent, 0.18) : T.surfaceAlt, color: fPhoto[f.id] ? T.accent : T.textMuted, border: `1px solid ${fPhoto[f.id] ? T.accent : T.border}` }}>
                    <ImageIcon size={13} /> {fPhoto[f.id] ? "Photo ready" : "Photo"}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => snapFinding(f, (e.target.files || [])[0])} />
                  </label>
                  <Btn kind="ghost" onClick={() => stillThere(f)}>Still present</Btn>
                  {isCttee && <Btn kind="ghost" onClick={() => closeF(f)}><Check size={13} /> Close</Btn>}
                  <Btn kind="ghost" onClick={() => setDetail(f)} title="Full history and every photo">Detail</Btn>
                </div>
              </div>))}
          </Card>)}
          {areas.map((area) => (<Card key={area} style={{ padding: 16 }}>
            <SectionTitle>{area}</SectionTitle>
            {(sections.find((x) => x.name === area) || {}).duty_reference && (
              <div className="text-[11px] -mt-1.5 mb-2 italic" style={{ color: T.accent }}>{(sections.find((x) => x.name === area) || {}).duty_reference}</div>)}
            <div className="flex gap-1.5 flex-wrap items-center mb-1.5">
              {notWalkedArea(area)
                ? (<><div className="text-xs flex-1" style={{ color: SEMANTIC.warn }}>Not walked on this walk{notWalkedArea(area).reason ? `: ${notWalkedArea(area).reason}` : ""}. The report lists it and does not count it as inspected.</div>
                    <Btn kind="ghost" onClick={() => setNotWalked(area, null)}>Undo</Btn></>)
                : nwAsk === area
                  ? (<><div className="flex-1 min-w-[200px]"><Input placeholder="Why not? e.g. locked, key with the contractor" value={nwReason} onChange={(e) => setNwReason(e.target.value)} /></div>
                      <Btn onClick={() => setNotWalked(area, nwReason.trim())}>Record as not walked</Btn>
                      <Btn kind="ghost" onClick={() => { setNwAsk(null); setNwReason(""); }}>Cancel</Btn></>)
                  : (<><Btn kind="ghost" onClick={() => nothingToReport(area)} title="Answer every unanswered question in this group as OK"><Check size={13} /> Nothing to report</Btn>
                      <Btn kind="ghost" onClick={() => { setNwAsk(area); setNwReason(""); }} title="Record that this group was not inspected on this walk">Not walked</Btn></>)}
            </div>
            {!notWalkedArea(area) && items.filter((i) => i.area === area).map((i) => (
              <div key={i.id} className="py-2.5" style={{ borderBottom: `1px dashed ${T.border}` }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 text-sm min-w-[200px]">{i.item}</div>
                  {[["ok", "OK", SEMANTIC.ok], ["issue", "Issue", SEMANTIC.bad], ["na", "N/A", VOTE_COLOR.abstain]].map(([v, l, c]) => (
                    <button key={v} onClick={() => mark(i, v)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: results[i.id] === v ? hexToRgba(c, 0.2) : T.surfaceAlt, color: results[i.id] === v ? c : T.textMuted, border: `1px solid ${results[i.id] === v ? c : T.border}` }}>{l}</button>))}
                  <label className="text-xs px-2.5 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1" style={{ background: photos[i.id] ? hexToRgba(T.accent, 0.18) : T.surfaceAlt, color: photos[i.id] ? T.accent : T.textMuted, border: `1px solid ${photos[i.id] ? T.accent : T.border}` }}>
                    <ImageIcon size={13} /> {photos[i.id] ? "Photo ✓" : "Photo"}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => snap(i, (e.target.files || [])[0])} />
                  </label>
                </div>
                {results[i.id] === "issue" && (<div className="mt-2 space-y-2">
                  <Input placeholder="What's wrong?" value={notes[i.id] || ""} onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })} onBlur={() => mark(i, "issue")} />
                  {maintSent[i.id]
                    ? <div className="text-xs flex items-center gap-1.5" style={{ color: SEMANTIC.ok }}><Check size={13} /> Logged as a maintenance issue. Track it in Maintenance.</div>
                    : <Btn kind="ghost" onClick={async () => {
                        try {
                          const mid = "m" + Math.random().toString(36).slice(2, 8);
                          update((s2) => s2.maintenance.unshift({ id: mid, buildingId, title: i.item, category: "Common area", location: i.area, description: `${notes[i.id] || "Issue found during the monthly walk-through."} (Raised from the walk-through of ${current ? fmtDate(current.walk_date) : "today"}.)`, raisedBy: user.name, status: "new", triageOwner: "", date: today(), reportedAt: new Date().toISOString() }));
                          await setWalkResultMaint(walkId, i.id, mid);
                          setMaintSent({ ...maintSent, [i.id]: mid });
                          flash("Sent to Maintenance. The workflow team has it.");
                        } catch (e) { flash(String(e.message || e)); }
                      }}><Wrench size={13} /> Log as maintenance issue</Btn>}
                </div>)}
              </div>))}
            {!notWalkedArea(area) && (() => {
              const sec = sections.find((x) => x.name === area) || null;
              const mine = findings.filter((f) => f.status === "open" && f.first_raised_walk_id === walkId && sec && f.section_id === sec.id);
              const open = raiseFor === area;
              return (<div className="mt-3">
                {mine.map((f) => (<div key={f.id} className="text-xs mb-1.5 rounded-lg px-2.5 py-1.5" style={{ background: hexToRgba(T.accent, 0.08) }}><b>{f.ref}</b> · {f.observation}</div>))}
                {!open && <Btn kind="ghost" onClick={() => setRaiseFor(area)}><Plus size={13} /> Raise a finding here</Btn>}
                {open && (<div className="rounded-xl p-3 space-y-2" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(WT_CLASS).map(([k, v]) => (
                      <button key={k} onClick={() => setDraft({ ...draft, cls: k })} title={v[1]} className="text-[11px] px-2.5 py-1 rounded-lg font-semibold"
                        style={{ background: draft.cls === k ? hexToRgba(T.accent, 0.2) : T.surface, color: draft.cls === k ? T.accent : T.textMuted, border: `1px solid ${draft.cls === k ? T.accent : T.border}` }}>{k} · {v[0]}</button>))}
                  </div>
                  <div className="text-[11px]" style={{ color: T.textMuted }}>{(WT_CLASS[draft.cls] || [])[1]}{draft.cls === "S" ? " · Never promoted to maintenance; it escalates by recurrence." : ""}</div>
                  <Input placeholder="Where exactly?" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
                  <Input placeholder="What was observed?" value={draft.observation} onChange={(e) => setDraft({ ...draft, observation: e.target.value })} />
                  <Input placeholder="What does done look like?" value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Owner" value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
                    <Input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
                  </div>
                  <label className="text-xs px-2.5 py-2 rounded-lg cursor-pointer inline-flex items-center gap-1.5 w-full justify-center" style={{ background: draft.photoPath ? hexToRgba(T.accent, 0.18) : T.surface, color: draft.photoPath ? T.accent : T.textMuted, border: `1px dashed ${draft.photoPath ? T.accent : T.border}` }}>
                    <ImageIcon size={14} /> {draft.photoPath ? "Photo attached" : "Take the before photo"}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => snapDraft((e.target.files || [])[0])} />
                  </label>
                  {draft.cls === "H" && (<Select value={draft.risk} onChange={(e) => setDraft({ ...draft, risk: e.target.value })}>
                    {["low", "medium", "high", "critical"].map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)} risk</option>)}
                  </Select>)}
                  <div className="flex gap-2"><Btn grad onClick={() => submitFinding(sec)}>Raise it</Btn><Btn kind="ghost" onClick={() => setRaiseFor(null)}>Cancel</Btn></div>
                </div>)}
              </div>);
            })()}
          </Card>))}
          <div id="wt-finish" style={{ scrollMarginTop: 72 }} />
          <Card style={{ padding: 16 }}>
            <SectionTitle>Finish</SectionTitle>
            <div className="text-xs mb-2.5" style={{ color: T.textMuted }}>Issuing fixes this walk as a point in time. Findings keep moving afterwards; the issued walk does not.</div>
            <Field label="Any other areas not walked, and why"><Input placeholder="Groups marked Not walked above are already recorded" onBlur={(e) => setWalkMeta(walkId, { areas_not_walked: e.target.value || null }).catch(() => {})} /></Field>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Btn grad onClick={async () => { try { await issueWalk(buildingId, walkId, `${carriedF(walkId).length} carried · ${findings.filter((f) => f.first_raised_walk_id === walkId).length} raised`); await reload(); await loadRegister(); flash("Walk issued"); } catch (e) { flash(String(e.message || e)); } }}><Check size={15} /> Issue this walk</Btn>
              <Btn kind="ghost" onClick={() => report(current)}><Printer size={14} /> {reporting ? "Building..." : "Export PDF"}</Btn>
              <Btn kind="ghost" onClick={() => exportWalk(current)}><Download size={14} /> Export Word</Btn>
            </div>
          </Card>
        </>)}
        {detail && <FindingDrawer key={detail.id + (detail.status || "")} finding={detail} events={fEvents} inWalk={!!walkId}
          canClose={isCttee} onAct={actOnFinding} onClose={() => setDetail(null)}
          photoReady={!!fPhoto[detail.id]} onPhoto={snapFinding} onAmend={amendF} />}
      </Wrap>
    </div>
  );
}

// ---------- approvals -------------------------------------------------------
function Approvals() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const pendingUsers = store.users.filter((u) => u.buildingId === buildingId && u.status === "pending");
  const pendingBookings = store.bookings.filter((b) => b.buildingId === buildingId && b.status === "pending");
  const [notes, setNotes] = useState({});
  const decideUser = (id, ok) => { update((s) => { if (ok) s.users.find((x) => x.id === id).status = "active"; else s.users = s.users.filter((x) => x.id !== id); }); flash(ok ? "Access approved · welcome email sent" : "Request declined"); };
  const decideBooking = (id, ok) => { update((s) => { const b = s.bookings.find((x) => x.id === id); b.status = ok ? "confirmed" : "declined"; b.decidedBy = user.name; b.decidedAt = today(); b.decisionNote = notes[id] || ""; }); flash(ok ? "Approved · requester emailed" : "Declined · requester emailed"); };
  return (
    <div><Head title="Approvals" sub="Access requests and bookings that need a decision" /><Wrap>
      <SectionTitle>Access requests</SectionTitle>
      {pendingUsers.length === 0 && <Empty icon={UserPlus} title="No one waiting" hint="New residents appear here for approval." />}
      {pendingUsers.map((u) => (<Card key={u.id} style={{ padding: 16 }}><div className="flex-1 min-w-0"><div className="font-semibold">{u.name} <span style={{ color: T.textMuted }} className="font-normal text-sm">· Unit {u.unit}</span></div><div style={{ color: T.textMuted }} className="text-xs mt-0.5">Requesting {ROLE_LABEL[u.role]} access · {u.email}</div></div><div className="flex gap-2 mt-3"><Btn grad onClick={() => decideUser(u.id, true)}><Check size={15} /> Approve</Btn><Btn kind="ghost" onClick={() => decideUser(u.id, false)}><X size={15} /> Decline</Btn></div></Card>))}
      <SectionTitle>Booking requests</SectionTitle>
      {pendingBookings.length === 0 && <Empty icon={CalendarCheck} title="No bookings to review" />}
      {pendingBookings.map((b) => { const M = FAC_META[b.facility]; return (<Card key={b.id} style={{ padding: 16 }}><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center shrink-0 text-white" style={{ background: `linear-gradient(135deg, ${HUE.bookings[0]}, ${HUE.bookings[1]})` }}><M.icon size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold">{M.label} · {b.bookedBy}</div><div style={{ color: T.textMuted }} className="text-xs">{fmtDate(b.fromDate)} → {fmtDate(b.toDate)}{b.note && ` · ${b.note}`}</div></div></div><div className="mt-3"><Input placeholder="Note to requester (optional)" value={notes[b.id] || ""} onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })} /></div><div className="flex gap-2 mt-2.5"><Btn grad onClick={() => decideBooking(b.id, true)}><Check size={15} /> Approve</Btn><Btn kind="ghost" onClick={() => decideBooking(b.id, false)}><X size={15} /> Decline</Btn></div></Card>); })}
    </Wrap></div>
  );
}

// ---------- action register (BCC) -------------------------------------------
function actionFlags(a) { const t = today(); const overdue = a.status === "open" && a.due && a.due < t; const soon = a.status === "open" && a.due && a.due >= t && a.due <= addDays(t, 7); return { overdue, soon }; }
function ActionRegister() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.actions.filter((a) => a.buildingId === buildingId).sort((a, b) => (a.status === b.status ? (a.due < b.due ? -1 : 1) : a.status === "open" ? -1 : 1));
  const bcc = store.users.filter((u) => u.buildingId === buildingId && (u.role === "bcc" || u.role === "admin" || u.msc));
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", detail: "", assignee: bcc[0]?.name || "", due: "", priority: "med" });
  const [editId, setEditId] = useState(null);
  const [ef, setEf] = useState({ assignee: "", due: "", priority: "med", note: "" });
  const add = () => { if (!f.title.trim()) return; update((s) => s.actions.unshift({ id: "ac" + Math.random().toString(36).slice(2, 6), buildingId, ...f, status: "open", note: "", docs: [] })); setF({ title: "", detail: "", assignee: bcc[0]?.name || "", due: "", priority: "med" }); setAdding(false); flash("Action added"); };
  const toggle = (id) => update((s) => { const a = s.actions.find((x) => x.id === id); a.status = a.status === "open" ? "done" : "open"; });
  const startEdit = (a) => { setEditId(a.id); setEf({ assignee: a.assignee || "", due: a.due || "", priority: a.priority || "med", note: a.note || "" }); };
  const saveEdit = (id) => { update((s) => { const a = s.actions.find((x) => x.id === id); a.assignee = ef.assignee; a.due = ef.due; a.priority = ef.priority; a.note = ef.note; }); setEditId(null); flash("Action updated"); };
  const addDoc = (id, name) => { if (!name) return; update((s) => { const a = s.actions.find((x) => x.id === id); a.docs = a.docs || []; a.docs.push(name); }); flash("Document attached"); };
  const PRI = { high: SEMANTIC.bad, med: SEMANTIC.warn, low: T.textMuted };
  return (<div><Head title="Action Register" sub="Committee tasks, owners and deadlines" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> Add</HeaderAction>} /><Wrap>
    {adding && (<Card style={{ padding: 18 }}><div className="space-y-3">
      <Field label="Action"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Renew building insurance" /></Field>
      <Field label="Detail (optional)"><Input value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3"><Field label="Owner"><Select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>{bcc.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</Select></Field><Field label="Due"><Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field><Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></Select></Field></div>
      <div className="flex gap-2"><Btn grad onClick={add}>Add action</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
    </div></Card>)}
    {list.length === 0 && <Empty icon={ListChecks} title="No actions yet" hint="Track committee tasks and deadlines here." />}
    {list.map((a) => { const { overdue, soon } = actionFlags(a); const done = a.status === "done"; const editing = editId === a.id; const docs = a.docs || []; return (
      <Card key={a.id} style={{ padding: 16, opacity: done ? 0.6 : 1 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => toggle(a.id)} className="h-6 w-6 rounded-md grid place-items-center shrink-0" style={{ border: `2px solid ${done ? SEMANTIC.ok : T.border}`, background: done ? SEMANTIC.ok : "transparent" }}>{done && <Check size={14} className="text-white" />}</button>
          <div className="flex-1 min-w-0"><div className={`font-semibold ${done ? "line-through" : ""}`}>{a.title}</div><div style={{ color: T.textMuted }} className="text-xs">{a.assignee}{a.due ? ` · due ${fmtDate(a.due)}` : ""}{a.detail ? ` · ${a.detail}` : ""}</div></div>
          {!done && overdue && <Badge color={SEMANTIC.bad}>Overdue</Badge>}
          {!done && !overdue && soon && <Badge color={SEMANTIC.warn}>Due soon</Badge>}
          <Badge color={PRI[a.priority]}>{a.priority}</Badge>
          <button onClick={() => editing ? setEditId(null) : startEdit(a)} style={{ color: T.textMuted }}><Pencil size={14} /></button>
        </div>
        {a.note && !editing && <div style={{ color: T.textMuted }} className="text-xs mt-2 flex items-start gap-1.5"><MessageSquare size={12} className="mt-0.5 shrink-0" /> {a.note}</div>}
        {docs.length > 0 && <div className="flex flex-wrap gap-2 mt-2">{docs.map((d, i) => <FileChip key={i} name={d} color={T.accent} />)}</div>}
        {editing && (<div className="mt-3 space-y-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <div className="grid sm:grid-cols-3 gap-3"><Field label="Owner"><Select value={ef.assignee} onChange={(e) => setEf({ ...ef, assignee: e.target.value })}>{bcc.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</Select></Field><Field label="Expected due date"><Input type="date" value={ef.due} onChange={(e) => setEf({ ...ef, due: e.target.value })} /></Field><Field label="Priority"><Select value={ef.priority} onChange={(e) => setEf({ ...ef, priority: e.target.value })}><option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></Select></Field></div>
          <Field label="Status / progress note"><TextArea rows={2} value={ef.note} onChange={(e) => setEf({ ...ef, note: e.target.value })} placeholder="e.g. Quotes received, awaiting committee approval." /></Field>
          <Field label="Attach a document"><label style={{ borderColor: T.border, color: T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-2.5 px-3 text-sm cursor-pointer"><Paperclip size={14} /> Choose a file<input type="file" className="hidden" onChange={(e) => addDoc(a.id, e.target.files?.[0]?.name || "")} /></label></Field>
          <div className="flex gap-2"><Btn grad onClick={() => saveEdit(a.id)}>Save changes</Btn><Btn kind="ghost" onClick={() => setEditId(null)}>Cancel</Btn></div>
        </div>)}
      </Card>
    ); })}
  </Wrap></div>);
}

// ---------- reports (BCC) ---------------------------------------------------
// ---------- NaloHub-branded Maintenance Report (Word) ------------------------
// Pure builders: assembled data in → docx children out. Card-per-issue layout
// with status chips, at-a-glance stats and colour-coded sections. Palette
// mirrors the NaloHub brand; tested against docx 8.5.0.
const RPT = {
  navy: "0A2030", blue: "0D7FC6", teal: "06B6C7", ink: "1A2733", muted: "56697E",
  light: "EEF4F9", line: "C9D6E2", green: "1F7A4C", greenBg: "E8F5EE",
  amber: "B45309", amberBg: "FDF3E7", W: 9000,
};
const RPT_STATUS = {
  new: ["New", "6B7480", "EEF0F3"], triaged: ["Triaged", "B45309", "FDF3E7"],
  in_progress: ["In progress", "1D6FB8", "E7F1FA"], resolved: ["Resolved", "1F7A4C", "E8F5EE"],
  at_vote: ["At vote", "B45309", "FDF3E7"],
};
const rptNoB = () => ({ style: DocxB.NONE, size: 0, color: "FFFFFF" });
const rptB = (color, size) => ({ style: DocxB.SINGLE, size: size || 4, color: color || RPT.line });
const rptT = (p) => new DocxT({ size: 20, color: RPT.ink, ...(typeof p === "string" ? { text: p } : p) });
const rptP = (parts, o = {}) => new DocxP({ spacing: { after: o.after != null ? o.after : 60, line: o.line || 264, before: o.before || 0 }, alignment: o.align, border: o.border, indent: o.indent, children: (Array.isArray(parts) ? parts : [parts]).map(rptT) });
const rptCell = (kids, o = {}) => new DocxTC({
  width: { size: o.w || RPT.W, type: DocxW.DXA }, columnSpan: o.span,
  shading: o.fill ? { type: DocxSh.CLEAR, fill: o.fill } : undefined,
  margins: { top: o.tm != null ? o.tm : 80, bottom: o.bm != null ? o.bm : 60, left: 140, right: 140 },
  borders: o.borders, verticalAlign: "center", children: kids,
});
const rptB64ToU8 = (b64) => { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; };
const rptImage = (dataUrl) => {
  try {
    const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(String(dataUrl || ""));
    if (!m) return null;
    const type = m[1].toLowerCase().startsWith("j") ? "jpg" : m[1].toLowerCase();
    return new DocxImg({ type, data: rptB64ToU8(m[2]), transformation: { width: 250, height: 188 } });
  } catch (e) { return null; }
};
const rptSec = (label, lines, color) => {
  const out = [rptP([{ text: label, bold: true, size: 16, color: color || RPT.blue, characterSpacing: 20 }], { after: 30, before: 60 })];
  lines.forEach((l) => out.push(rptP(Array.isArray(l) ? l : [l], { after: 24, indent: { left: 160 } })));
  return out;
};
function rptIssueCard(it) {
  const st = RPT_STATUS[it.statusKey] || RPT_STATUS.new;
  const stLabel = st[0], stColor = st[1], stBg = st[2];
  const body = [];
  if (it.description) body.push(...rptSec("DESCRIPTION", [it.description]));
  if (it.updates && it.updates.length) body.push(...rptSec("PROGRESS UPDATES", it.updates.map((u) => [{ text: u.date + "  ", color: RPT.muted, size: 18 }, { text: u.text }, { text: "  — " + u.by, color: RPT.muted, size: 18 }])));
  if (it.quotes && it.quotes.length) body.push(...rptSec("QUOTES", it.quotes.map((q) => [{ text: q.supplier, bold: true }, { text: q.amount ? "  " + q.amount : "" }, { text: q.tag ? "   " + q.tag : "", bold: q.tag === "ACCEPTED", color: q.tag === "ACCEPTED" ? RPT.green : RPT.muted, size: 18 }, { text: q.note ? "   " + q.note : "", color: RPT.muted, size: 18 }])));
  if (it.works && it.works.length) body.push(...rptSec("APPROVED WORKS / SUPPLIERS", it.works.map((w) => [{ text: w.head, bold: true }, { text: w.cost ? "  " + w.cost : "", color: RPT.green, bold: true }, { text: w.meta ? "   " + w.meta : "", color: RPT.muted, size: 18 }])));
  if (it.decisions && it.decisions.length) body.push(...rptSec("COMMITTEE DECISION", it.decisions.map((d) => [{ text: d.outcome + "  ", bold: true, color: d.passed ? RPT.green : RPT.amber }, { text: d.text }]), RPT.green));
  if (it.trail && it.trail.length) body.push(...rptSec("WORKFLOW TRAIL", it.trail.map((a) => [{ text: a.date + "  ", color: RPT.muted, size: 18 }, { text: a.kind, bold: true, size: 18, color: RPT.muted }, { text: a.body ? " — " + a.body : "", size: 18, color: RPT.muted }])));
  if (it.history) body.push(...rptSec("STATUS HISTORY", [[{ text: it.history, size: 18, color: RPT.muted }]], RPT.muted));
  const rows = [
    new DocxTR({ children: [
      rptCell([rptP([{ text: it.title, bold: true, size: 24 }, { text: "   " + it.category, color: RPT.muted, size: 18 }, it.historical ? { text: "   HISTORICAL RECORD", size: 14, bold: true, color: RPT.muted, characterSpacing: 20 } : { text: "" }], { after: 0 })], { w: 6800, fill: RPT.light, borders: { top: rptB(stColor, 12), bottom: rptB(), left: rptB(stColor, 12), right: rptNoB() } }),
      rptCell([rptP([{ text: stLabel.toUpperCase(), bold: true, size: 18, color: stColor, characterSpacing: 20 }], { after: it.ageText ? 20 : 0, align: "right" }), ...(it.ageText ? [rptP([{ text: it.ageText, size: 16, color: RPT.muted }], { after: 0, align: "right" })] : [])], { w: 2200, fill: stBg, borders: { top: rptB(stColor, 12), bottom: rptB(), left: rptNoB(), right: rptB(stColor, 12) } }),
    ] }),
    new DocxTR({ children: [rptCell([rptP([{ text: it.metaText, size: 18, color: RPT.muted }], { after: 0 })], { span: 2, tm: 50, bm: 40, borders: { top: rptNoB(), bottom: body.length || it.image ? { style: DocxB.DASHED, size: 4, color: RPT.line } : rptNoB(), left: rptB(), right: rptB() } })] }),
  ];
  if (body.length || it.image) {
    const kids = [...body];
    if (it.image) { kids.push(rptP([{ text: "PHOTO", bold: true, size: 16, color: RPT.blue, characterSpacing: 20 }], { after: 30, before: 60 })); kids.push(new DocxP({ spacing: { after: 40 }, indent: { left: 160 }, children: [it.image] })); }
    rows.push(new DocxTR({ children: [rptCell(kids, { span: 2, borders: { top: rptNoB(), bottom: rptB(), left: rptB(), right: rptB() } })] }));
  }
  return new DocxTable({ width: { size: RPT.W, type: DocxW.DXA }, columnWidths: [6800, 2200], borders: { top: rptNoB(), bottom: rptNoB(), left: rptNoB(), right: rptNoB(), insideHorizontal: rptNoB(), insideVertical: rptNoB() }, rows });
}
// Waiting-on derived from the live workflow when the item has no explicit value.
function mwfWaitingOn(m, trail, quotes) {
  if (m.waitingOn) return m.waitingOn;
  const kinds = new Set((trail || []).map((a) => a.kind));
  if (kinds.has("contractor_confirmed")) return "contractor";
  if (kinds.has("decision")) return "ready";
  if (kinds.has("vote_opened")) return "committee";
  if ((quotes || []).some((q) => q.status === "recommended")) return "committee";
  if (kinds.has("triage") && !(quotes || []).length && !(m.quotes || []).length) return "quote";
  return "";
}
const rptMoney = (n) => "$" + Math.round(Number(n) || 0).toLocaleString();
const rptParseMoney = (v) => { const n = Number(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
function rptResolvedTable(items) {
  const hdr = (t, w, align) => rptCell([rptP([{ text: t.toUpperCase(), bold: true, size: 14, color: RPT.muted, characterSpacing: 20 }], { after: 0, align })], { w, tm: 50, bm: 40, borders: { top: rptNoB(), bottom: rptB(RPT.line, 8), left: rptNoB(), right: rptNoB() } });
  const td = (parts, w, align, bold) => rptCell([rptP((Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === "string" ? { text: p, size: 18, bold } : { size: 18, ...p })), { after: 0, align })], { w, tm: 50, bm: 40, borders: { top: rptNoB(), bottom: rptB(RPT.line, 4), left: rptNoB(), right: rptNoB() } });
  const W = [2200, 1200, 1300, 1300, 700, 1300, 1000];
  const rows = [new DocxTR({ tableHeader: true, children: [hdr("Item", W[0]), hdr("Category", W[1]), hdr("Reported", W[2]), hdr("Resolved", W[3]), hdr("Days", W[4], "right"), hdr("Contractor", W[5]), hdr("Cost", W[6], "right")] })];
  let total = 0, days = 0, nd = 0;
  items.forEach((it) => {
    total += it.cost; if (it.days != null) { days += it.days; nd++; }
    rows.push(new DocxTR({ cantSplit: true, children: [td(it.title, W[0], undefined, true), td([{ text: it.category, color: RPT.muted }], W[1]), td(it.reported, W[2]), td(it.resolved, W[3]), td(it.days != null ? String(it.days) : "—", W[4], "right"), td([{ text: it.contractor || "—", color: RPT.muted }], W[5]), td(it.cost ? rptMoney(it.cost) : (it.costText || "—"), W[6], "right")] }));
  });
  rows.push(new DocxTR({ children: [
    rptCell([rptP([{ text: `${items.length} item${items.length === 1 ? "" : "s"} resolved`, bold: true, size: 18 }], { after: 0 })], { w: W[0] + W[1] + W[2] + W[3], span: 4, tm: 60, bm: 40, borders: { top: rptB(RPT.line, 8), bottom: rptNoB(), left: rptNoB(), right: rptNoB() } }),
    rptCell([rptP([{ text: nd ? Math.round(days / nd) + " avg" : "—", bold: true, size: 18 }], { after: 0, align: "right" })], { w: W[4], tm: 60, bm: 40, borders: { top: rptB(RPT.line, 8), bottom: rptNoB(), left: rptNoB(), right: rptNoB() } }),
    rptCell([rptP([{ text: "", size: 18 }], { after: 0 })], { w: W[5], tm: 60, bm: 40, borders: { top: rptB(RPT.line, 8), bottom: rptNoB(), left: rptNoB(), right: rptNoB() } }),
    rptCell([rptP([{ text: rptMoney(total), bold: true, size: 18 }], { after: 0, align: "right" })], { w: W[6], tm: 60, bm: 40, borders: { top: rptB(RPT.line, 8), bottom: rptNoB(), left: rptNoB(), right: rptNoB() } }),
  ] }));
  return new DocxTable({ width: { size: RPT.W, type: DocxW.DXA }, columnWidths: W, borders: { top: rptNoB(), bottom: rptNoB(), left: rptNoB(), right: rptNoB(), insideHorizontal: rptNoB(), insideVertical: rptNoB() }, rows });
}
function rptBuildKids(d) {
  const kids = [];
  const noB = { top: rptNoB(), bottom: rptNoB(), left: rptNoB(), right: rptNoB(), insideHorizontal: rptNoB(), insideVertical: rptNoB() };
  const eyebrow = (t) => kids.push(rptP([{ text: t.toUpperCase(), bold: true, size: 15, color: RPT.muted, characterSpacing: 30 }], { before: 140, after: 60 }));
  kids.push(rptP([{ text: "N A L O H U B", bold: true, color: RPT.teal, size: 20, characterSpacing: 40 }], { after: 120 }));
  kids.push(rptP([{ text: "Maintenance Report", bold: true, size: 52, color: RPT.navy }], { after: 60 }));
  kids.push(rptP([{ text: d.buildingName, bold: true, size: 26, color: RPT.blue }], { after: 40 }));
  kids.push(rptP([{ text: d.periodText, size: 20, color: RPT.muted }], { after: 140, border: { bottom: { style: DocxB.SINGLE, size: 12, color: RPT.teal, space: 6 } } }));
  // ---- At a glance: five tiles
  eyebrow("At a glance");
  const stat = (label, value, color) => rptCell([
    rptP([{ text: String(value), bold: true, size: 34, color: color || RPT.ink }], { after: 10, align: "center" }),
    rptP([{ text: label.toUpperCase(), size: 14, color: RPT.muted, characterSpacing: 20 }], { after: 0, align: "center" }),
  ], { w: 1800, fill: RPT.light, borders: { top: rptB(), bottom: rptB(), left: rptB(), right: rptB() }, tm: 110, bm: 90 });
  kids.push(new DocxTable({ width: { size: RPT.W, type: DocxW.DXA }, columnWidths: [1800, 1800, 1800, 1800, 1800], borders: { top: rptB(), bottom: rptB(), left: rptB(), right: rptB(), insideHorizontal: rptB(), insideVertical: rptB() }, rows: [
    new DocxTR({ children: [
      stat("Items in this report", d.stats.total),
      stat("Resolved in period", d.stats.resolved, RPT.green),
      stat("Open now", d.stats.open, d.stats.open > 0 ? RPT.amber : RPT.green),
      stat("Avg days to resolve", d.stats.avg != null ? d.stats.avg : "—", RPT.blue),
      stat("Approved this period", rptMoney(d.stats.approved), RPT.ink),
    ] }),
  ] }));
  // ---- Needs a decision from the committee
  const dec = d.openItems.filter((it) => it.waitingOn === "committee");
  eyebrow("Needs a decision from the committee");
  if (dec.length) {
    const recTotal = dec.reduce((a, it) => a + (it.recAmount || 0), 0);
    const oldestWait = Math.max(...dec.map((it) => it.waitingDays || 0));
    const panel = [];
    panel.push(rptP([{ text: String(dec.length), bold: true, size: 56, color: RPT.amber }, { text: "  item" + (dec.length === 1 ? " is" : "s are") + " waiting on your decision", bold: true, size: 26, color: RPT.amber }], { after: 40 }));
    panel.push(rptP([{ text: "Recommended quotes totalling ", size: 18, color: RPT.ink }, { text: rptMoney(recTotal), bold: true, size: 18 }, { text: ". The oldest has been with the committee for ", size: 18 }, { text: oldestWait + " day" + (oldestWait === 1 ? "" : "s"), bold: true, size: 18 }, { text: ". Nothing below can move until it is voted on.", size: 18 }], { after: 100 }));
    const W = [3500, 1800, 1000, 1300, 1000];
    const h = (t, w, al) => rptCell([rptP([{ text: t.toUpperCase(), bold: true, size: 13, color: RPT.amber, characterSpacing: 20 }], { after: 0, align: al })], { w, tm: 40, bm: 30, borders: { top: rptNoB(), bottom: rptB("E8C9A6", 6), left: rptNoB(), right: rptNoB() } });
    const c = (parts, w, al) => rptCell([rptP((Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === "string" ? { text: p, size: 17 } : { size: 17, ...p })), { after: 0, align: al })], { w, tm: 50, bm: 40, borders: { top: rptNoB(), bottom: rptB("E8C9A6", 3), left: rptNoB(), right: rptNoB() } });
    const rows = [new DocxTR({ tableHeader: true, children: [h("Item", W[0]), h("Recommended", W[1]), h("Amount", W[2], "right"), h("Sent to vote", W[3]), h("Waiting", W[4], "right")] })];
    dec.sort((x, y) => (y.waitingDays || 0) - (x.waitingDays || 0)).forEach((it) => rows.push(new DocxTR({ cantSplit: true, children: [
      rptCell([rptP([{ text: it.title, bold: true, size: 17 }], { after: 0 }), rptP([{ text: it.category, color: RPT.muted, size: 14 }], { after: 0 })], { w: W[0], tm: 50, bm: 40, borders: { top: rptNoB(), bottom: rptB("E8C9A6", 3), left: rptNoB(), right: rptNoB() } }),
      c(it.recSupplier || "—", W[1]),
      c(it.recAmount ? rptMoney(it.recAmount) : "—", W[2], "right"),
      c(it.sentDate || "—", W[3]),
      c([{ text: it.waitingDays != null ? it.waitingDays + " day" + (it.waitingDays === 1 ? "" : "s") : "—", bold: true, color: RPT.amber }], W[4], "right"),
    ] })));
    panel.push(new DocxTable({ width: { size: 8600, type: DocxW.DXA }, columnWidths: W, borders: noB, rows }));
    kids.push(new DocxTable({ width: { size: RPT.W, type: DocxW.DXA }, columnWidths: [RPT.W], borders: noB, rows: [new DocxTR({ children: [rptCell(panel, { fill: RPT.amberBg, tm: 140, bm: 120, borders: { top: rptB(RPT.amber, 12), bottom: rptB(RPT.amber, 12), left: rptB(RPT.amber, 12), right: rptB(RPT.amber, 12) } })] })] }));
  } else {
    kids.push(new DocxTable({ width: { size: RPT.W, type: DocxW.DXA }, columnWidths: [RPT.W], borders: noB, rows: [new DocxTR({ children: [rptCell([rptP([{ text: "Nothing is waiting on a committee decision.", bold: true, size: 20, color: RPT.green }], { after: 0 })], { fill: RPT.greenBg, tm: 100, bm: 90, borders: { top: rptB(RPT.green, 12), bottom: rptB(RPT.green, 12), left: rptB(RPT.green, 12), right: rptB(RPT.green, 12) } })] })] }));
  }
  // ---- What the open items are waiting on
  if (d.openItems.length) {
    eyebrow(`What the ${d.openItems.length} open item${d.openItems.length === 1 ? " is" : "s are"} waiting on`);
    const counts = {}; d.openItems.forEach((it) => { counts[it.waitingOn || ""] = (counts[it.waitingOn || ""] || 0) + 1; });
    const max = Math.max(...Object.values(counts));
    const rows = M_WAITING.filter((w) => counts[w[0]]).map(([k, label, color]) => {
      const n = counts[k]; const barW = Math.max(300, Math.round(5200 * n / max));
      return new DocxTR({ children: [
        rptCell([rptP([{ text: "■ ", color, size: 18 }, { text: label, size: 18 }], { after: 0 })], { w: 2400, tm: 40, bm: 30, borders: noB }),
        rptCell([new DocxTable({ width: { size: 5400, type: DocxW.DXA }, columnWidths: [barW, 5400 - barW], borders: noB, rows: [new DocxTR({ children: [rptCell([rptP([{ text: "", size: 6 }], { after: 0 })], { w: barW, fill: color, tm: 20, bm: 20, borders: noB }), rptCell([rptP([{ text: "", size: 6 }], { after: 0 })], { w: 5400 - barW, fill: RPT.light, tm: 20, bm: 20, borders: noB })] })] })], { w: 5400, tm: 20, bm: 20, borders: noB }),
        rptCell([rptP([{ text: String(n), bold: true, size: 18 }, { text: " item" + (n === 1 ? "" : "s"), size: 18, color: RPT.muted }], { after: 0, align: "right" })], { w: 1200, tm: 40, bm: 30, borders: noB }),
      ] });
    });
    kids.push(new DocxTable({ width: { size: RPT.W, type: DocxW.DXA }, columnWidths: [2400, 5400, 1200], borders: noB, rows }));
    if (d.oldestLine) kids.push(new DocxTable({ width: { size: RPT.W, type: DocxW.DXA }, columnWidths: [RPT.W], borders: noB, rows: [new DocxTR({ children: [rptCell([rptP([{ text: "Oldest open item: ", bold: true, size: 18 }, { text: d.oldestLine, size: 18 }], { after: 0 })], { fill: RPT.light, tm: 80, bm: 70, borders: { top: rptNoB(), bottom: rptNoB(), left: rptB(RPT.blue, 14), right: rptNoB() } })] })] }));
    kids.push(rptP([{ text: "", size: 6 }], { after: 40 }));
  }
  kids.push(new DocxTable({ width: { size: RPT.W, type: DocxW.DXA }, columnWidths: [RPT.W], borders: noB, rows: [new DocxTR({ children: [rptCell([rptP([{ text: "By category: ", bold: true, size: 18 }, { text: d.catLine, size: 18 }], { after: 0 })], { fill: RPT.light, tm: 80, bm: 70, borders: { top: rptNoB(), bottom: rptNoB(), left: rptB(RPT.blue, 14), right: rptNoB() } })] })] }));
  const footer = () => {
    kids.push(rptP([{ text: "Prepared from the NaloHub maintenance register and workflow audit trail — every entry is backed by the in-app trail (who, what, when). Suitable for tabling in committee meeting minutes.", italics: true, size: 18, color: RPT.muted }], { before: 120, border: { top: { style: DocxB.SINGLE, size: 4, color: RPT.line, space: 6 } } }));
    kids.push(rptP([{ text: "Be in the Nalo 🌊  ·  portal.nalohub.com", size: 16, color: RPT.teal }], { after: 0 }));
  };
  footer();
  // ---- Detail: open items grouped by what they are waiting on
  if (d.openItems.length) {
    kids.push(new DocxP({ pageBreakBefore: true, spacing: { after: 0 }, children: [] }));
    M_WAITING.forEach(([k, label, color, bg]) => {
      const items = d.openItems.filter((it) => (it.waitingOn || "") === k);
      if (!items.length) return;
      kids.push(new DocxTable({ width: { size: RPT.W, type: DocxW.DXA }, columnWidths: [RPT.W], borders: noB, rows: [
        new DocxTR({ children: [rptCell([rptP([{ text: "OPEN ITEMS — DETAIL", bold: true, size: 15, color: RPT.muted, characterSpacing: 30 }, { text: "   ·   waiting on " + label.toLowerCase(), bold: true, size: 20, color }, { text: "   " + items.length + " item" + (items.length === 1 ? "" : "s"), size: 18, color: RPT.muted }], { after: 0 })], { fill: bg, borders: { top: rptNoB(), bottom: rptNoB(), left: { style: DocxB.SINGLE, size: 22, color }, right: rptNoB() }, tm: 90, bm: 70 })] }),
      ] }));
      kids.push(rptP([{ text: "", size: 8 }], { after: 60 }));
      items.forEach((it) => { kids.push(rptIssueCard(it)); kids.push(rptP([{ text: "", size: 8 }], { after: 90 })); });
    });
  }
  // ---- Resolved this period: compact table
  if (d.resolvedRows.length) {
    eyebrow(`Resolved this period — ${d.resolvedRows.length} item${d.resolvedRows.length === 1 ? "" : "s"}`);
    kids.push(rptResolvedTable(d.resolvedRows));
    kids.push(rptP([{ text: "Full description, quotes, recommendation and workflow trail for each resolved item remain in the register and can be produced on request. ", size: 17, color: RPT.muted }, { text: d.approvedLine || "", size: 17, color: RPT.muted }], { before: 80, after: 40 }));
  }
  if (d.openItems.length || d.resolvedRows.length) footer();
  return kids;
}

function Reports() {
  const { T, store, building, buildingId, flash } = useApp();
  const maint = store.maintenance.filter((m) => m.buildingId === buildingId);
  const [mr, setMr] = useState({ from: addDays(today(), -90), to: today(), busy: false });
  const books = store.bookings.filter((b) => b.buildingId === buildingId);
  const msgs = store.messages.filter((m) => m.buildingId === buildingId);
  const acts = store.actions.filter((a) => a.buildingId === buildingId);
  const motions = store.meetings.filter((m) => m.buildingId === buildingId).flatMap((m) => (m.motions || []).map((mo) => ({ ...mo, meeting: m.title, date: m.date }))).filter((mo) => mo.status === "decided" || mo.outcome);
  // Minute-ready Maintenance Report (Word) for a selected period: every issue
  // with description, updates, quotes, approved works, workflow trail and the
  // committee's vote outcome. Prod pulls the trail/quotes/motions live; the
  // demo uses its seeded equivalents.
  const exportMaintReport = async () => {
    if (mr.busy) return;
    setMr((x) => ({ ...x, busy: true }));
    try {
      const from = mr.from || "0000-01-01", to = mr.to || "9999-12-31";
      const dOf = (v) => localDay(v);
      const inRange = (m) => { const rep = dOf(m.reportedAt || m.date); const res = m.status === "resolved" ? (dOf(m.resolvedAt) || rep) : null; return rep <= to && (!res || res >= from); };
      const rows = maint.filter(inRange).sort((a, b) => (a.category === b.category ? (dOf(a.reportedAt || a.date) < dOf(b.reportedAt || b.date) ? -1 : 1) : (a.category < b.category ? -1 : 1)));
      if (!rows.length) { flash("No maintenance issues in that period"); setMr((x) => ({ ...x, busy: false })); return; }
      let appMotions = []; try { appMotions = (await listMotions(buildingId)).filter((mo) => mo.context_type === "maintenance"); } catch (e) { /* motions unavailable — report still builds */ }
      const motByIssue = {}; appMotions.forEach((mo) => { (motByIssue[mo.context_id] = motByIssue[mo.context_id] || []).push(mo); });
      const openRows = rows.filter((m) => m.status !== "resolved");
      const resolvedRows = rows.filter((m) => m.status === "resolved");
      const resolvedIn = resolvedRows.filter((m) => dOf(m.resolvedAt) >= from && dOf(m.resolvedAt) <= to);
      const reportedIn = rows.filter((m) => dOf(m.reportedAt || m.date) >= from);
      const solved = resolvedIn.filter((m) => daysToResolve(m) != null);
      const avg = solved.length ? Math.round(solved.reduce((a, m) => a + daysToResolve(m), 0) / solved.length) : null;
      const cats = {}; rows.forEach((m) => { cats[m.category] = (cats[m.category] || 0) + 1; });
      // assemble each issue into the card shape the branded builder expects
      const toItem = async (m) => {
        let wq = []; try { wq = await listMaintQuotes(buildingId, m.id); } catch (e) { /* no workflow quotes */ }
        let trail = []; try { trail = await listMaintActivity(buildingId, m.id); } catch (e) { /* no trail */ }
        const dtr = daysToResolve(m);
        // Exactly one ACCEPTED quote per item, across the legacy register and the
        // workflow: if more than one claims it, the most recent keeps it and the
        // rest are shown as superseded.
        const allQ = [
          ...(m.quotes || []).map((q) => ({ supplier: q.supplier || "—", amountN: rptParseMoney(q.amount), amount: q.amount || "", acc: !!q.accepted, tag: q.accepted ? "ACCEPTED" : "", note: q.note || "", when: dOf(q.date) })),
          ...(wq || []).map((q) => ({ supplier: q.supplier_name, amountN: Number(q.amount) || 0, amount: q.amount ? rptMoney(q.amount) : "", acc: q.status === "accepted", tag: q.status === "accepted" ? "ACCEPTED" : q.status === "recommended" ? "RECOMMENDED" : (q.status || ""), note: "", when: dOf(q.created_at) })),
        ];
        const accepted = allQ.filter((q) => q.acc).sort((x, y) => (x.when < y.when ? 1 : -1));
        accepted.slice(1).forEach((q) => { q.tag = "superseded"; q.acc = false; });
        const rec = wq.find((q) => q.status === "recommended") || wq.find((q) => q.status === "accepted") || null;
        const voteAct = (trail || []).find((a) => a.kind === "vote_opened");
        const mot = (motByIssue[m.id] || []).slice().sort((x, y) => (String(x.opened_at) < String(y.opened_at) ? 1 : -1))[0];
        const sentISO = voteAct ? dOf(voteAct.created_at) : mot && mot.opened_at ? dOf(mot.opened_at) : m.waitingOn === "committee" && m.waitingSince ? dOf(m.waitingSince) : "";
        const waitingOn = m.status === "resolved" ? "" : mwfWaitingOn(m, trail, wq);
        const waitingDays = waitingOn === "committee" && sentISO ? Math.max(0, Math.round((new Date(today()) - new Date(sentISO)) / 86400000)) : (m.waitingSince ? Math.max(0, Math.round((new Date(today()) - new Date(dOf(m.waitingSince))) / 86400000)) : null);
        const passed = (motByIssue[m.id] || []).filter((mo) => mo.status === "passed");
        // Approved spend attributable to this item inside the period: works recorded
        // in range plus quotes accepted by a motion decided in range (de-duplicated).
        let approved = 0; const seenQ = new Set();
        (m.resolutions || []).forEach((r) => { const dd = dOf(r.date); if (dd >= from && dd <= to) approved += rptParseMoney(r.cost); });
        passed.forEach((mo) => { const dd = dOf(mo.decided_at); const qid = mo.details && mo.details.quote_id; const q = wq.find((x) => x.id === qid); if (q && dd >= from && dd <= to && !seenQ.has(q.id)) { seenQ.add(q.id); if (!(m.resolutions || []).length) approved += Number(q.amount) || 0; } });
        const contractor = (m.resolutions || []).map((r) => r.supplier).filter(Boolean)[0] || (accepted[0] && accepted[0].supplier) || "";
        return {
          title: m.title || m.id, category: m.category || "", statusKey: waitingOn === "committee" && sentISO ? "at_vote" : m.status, historical: !!m.historical,
          waitingOn, waitingDays, sentDate: sentISO ? fmtDate(sentISO) : "",
          recSupplier: rec ? rec.supplier_name : (accepted[0] ? accepted[0].supplier : ""), recAmount: rec ? Number(rec.amount) || 0 : (accepted[0] ? accepted[0].amountN : 0),
          approved, contractor,
          cost: (m.resolutions || []).reduce((a, r) => a + rptParseMoney(r.cost), 0) || (accepted[0] ? accepted[0].amountN : 0),
          costText: (m.resolutions || []).some((r) => /included|nil|n\/a/i.test(String(r.cost))) ? "included" : "",
          reported: fmtDate(dOf(m.reportedAt || m.date)), resolved: m.resolvedAt ? fmtDate(dOf(m.resolvedAt)) : "", days: dtr,
          ageText: m.status === "resolved" ? (dtr != null ? `resolved in ${dtr} day${dtr === 1 ? "" : "s"}` : "") : `${daysOpen(m)} day${daysOpen(m) === 1 ? "" : "s"} open${waitingOn === "committee" && sentISO ? " · sent " + fmtDate(sentISO) : ""}`,
          metaText: `Reported ${fmtDate(dOf(m.reportedAt || m.date))} by ${m.raisedBy || "—"}${m.location ? "  ·  " + m.location : ""}${m.triageOwner ? "  ·  Assigned to " + m.triageOwner : ""}${m.status === "resolved" && m.resolvedAt ? "  ·  Resolved " + fmtDate(dOf(m.resolvedAt)) : ""}`,
          description: m.description || "",
          image: rptImage(m.image),
          updates: (m.updates || []).map((u) => ({ date: fmtDate(u.date), text: u.text, by: u.by })),
          quotes: allQ.map((q) => ({ supplier: q.supplier, amount: q.amount, tag: q.tag, note: q.note })),
          works: (m.resolutions || []).map((r) => ({ head: [r.supplier, r.note].filter(Boolean).join(" — ") || "—", cost: r.cost || "", meta: `recorded by ${r.by} ${fmtDate(r.date)}` })),
          decisions: (motByIssue[m.id] || []).map((mo) => ({
            outcome: mo.status === "passed" ? "PASSED" : mo.status === "failed" ? "FAILED" : mo.status === "withdrawn" ? "WITHDRAWN" : "AT VOTE",
            passed: mo.status === "passed",
            text: `${mo.title}${mo.outcome_note ? " — " + mo.outcome_note : ""}${mo.decided_at ? " · decided " + fmtDate(dOf(mo.decided_at)) : ""}`,
          })),
          trail: (trail || []).map((a) => ({ date: fmtDate(dOf(a.created_at)), kind: String(a.kind || "").replace(/_/g, " "), body: a.body || "" })),
          history: (m.statusHistory || []).length > 1 ? (m.statusHistory || []).map((h) => `${h.from ? (M_STATUS[h.from] ? M_STATUS[h.from].label : h.from) : "Reported"} → ${M_STATUS[h.to] ? M_STATUS[h.to].label : h.to} (${fmtDate(dOf(h.at))}, ${h.by})`).join("; ") : "",
        };
      };
      const openItems = []; for (const m of openRows) openItems.push(await toItem(m));
      const resolvedRows2 = []; for (const m of resolvedIn) resolvedRows2.push(await toItem(m));
      resolvedRows2.sort((x, y) => ((x.days == null ? 999 : x.days) - (y.days == null ? 999 : y.days)));
      const approvedTotal = [...openItems, ...resolvedRows2].reduce((a, it) => a + (it.approved || 0), 0);
      const approvedOpen = openItems.reduce((a, it) => a + (it.approved || 0), 0);
      const oldest = openRows.slice().sort((x, y) => daysOpen(y) - daysOpen(x))[0];
      const oldestLine = oldest ? `${oldest.title} — reported ${fmtDate(dOf(oldest.reportedAt || oldest.date))}, ${daysOpen(oldest)} days open.${oldest.triageOwner ? " Assigned to " + oldest.triageOwner + "." : ""}${(() => { const it = openItems.find((x) => x.title === (oldest.title || oldest.id)); return it && it.sentDate ? " With the committee since " + it.sentDate + "." : ""; })()}` : "";
      const kids = rptBuildKids({
        buildingName: building.name,
        periodText: `Period: ${mr.from ? fmtDate(mr.from) : "all history"} – ${fmtDate(mr.to || today())}  ·  Generated ${fmtDate(today())}  ·  Prepared for the Body Corporate Committee`,
        stats: { total: rows.length, reported: reportedIn.length, resolved: resolvedIn.length, open: openRows.length, avg, approved: approvedTotal },
        catLine: Object.keys(cats).sort((x, y) => cats[y] - cats[x]).map((k) => `${k} ${cats[k]}`).join("  ·  "),
        oldestLine,
        approvedLine: approvedOpen > 0 ? `Approved works on items still open add ${rptMoney(approvedOpen)}, giving ${rptMoney(approvedTotal)} approved this period.` : "",
        openItems, resolvedRows: resolvedRows2,
      });
      const doc = new DocxDocument({ styles: { default: { document: { run: { font: "Calibri", size: 20, color: RPT.ink } } } }, sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: kids }] });
      const blob = await DocxPacker.toBlob(doc);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `maintenance-report-${building.name.replace(/\s+/g, "-").toLowerCase()}-${mr.from || "start"}-to-${mr.to || today()}.docx`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      flash("Maintenance report downloaded — ready to table");
    } catch (e) { flash(String(e.message || e)); }
    setMr((x) => ({ ...x, busy: false }));
  };
  const exportDecisions = () => { const lines = ["DECISIONS REGISTER — " + building.name, "Generated " + fmtDate(today()), ""]; motions.forEach((mo) => { lines.push((mo.ref ? "[" + mo.ref + "] " : "") + mo.title); lines.push("  Meeting: " + mo.meeting + " (" + fmtDate(mo.meetingDate || mo.date) + ")"); lines.push("  Decided: " + fmtDate(mo.decidedDate || mo.date) + (mo.decidedTime ? " " + mo.decidedTime : "")); lines.push("  Moved: " + (mo.mover || "—") + (mo.seconder ? ", seconded " + mo.seconder : "")); lines.push("  Vote: for " + mo.forCount + " / against " + mo.againstCount + " / abstain " + mo.abstainCount + " — " + mo.outcome); lines.push(""); }); downloadText("decisions-" + building.name.replace(/\s+/g, "-").toLowerCase() + ".txt", lines.join("\n")); };
  const byCount = (arr, key) => arr.reduce((a, x) => { a[x[key]] = (a[x[key]] || 0) + 1; return a; }, {});
  const mStat = byCount(maint, "status"), mCat = byCount(maint, "category");
  const bStat = byCount(books, "status");
  const mgCat = byCount(msgs, "category");
  const Bar = ({ label, n, total, color }) => (<div className="mb-2"><div className="flex justify-between text-xs mb-1"><span>{label}</span><span style={{ color: T.textMuted }}>{n}</span></div><div className="h-2 rounded-full" style={{ background: T.surfaceAlt }}><div className="h-full rounded-full" style={{ width: `${total ? (n / total) * 100 : 0}%`, background: color }} /></div></div>);
  return (
    <div>
      <Head title="Reports" sub="A snapshot for the committee" action={<HeaderAction onClick={() => window.print()}><Printer size={16} /> Print</HeaderAction>} />
      <Wrap>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">Word · minute-ready</span>}>Maintenance report for the BCC</SectionTitle>
          <p style={{ color: T.textMuted }} className="text-sm mb-3">Pick a period and download a minute-ready Word report. Page one is the summary: what's waiting on the committee (and since when), what every open item is blocked by, and approved spend for the period. Detail follows, grouped by what each item is waiting on, with resolved items in a compact table.</p>
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <Field label="From"><Input type="date" value={mr.from} onChange={(e) => setMr({ ...mr, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={mr.to} onChange={(e) => setMr({ ...mr, to: e.target.value })} /></Field>
            <Btn grad data-guide="g-report-word" onClick={exportMaintReport} disabled={mr.busy}><Download size={15} /> {mr.busy ? "Building report…" : "Word report"}</Btn>
          </div>
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{maint.length} total</span>}>Maintenance</SectionTitle>
          <div className="grid grid-cols-3 gap-3 text-center mb-4">{(() => { const openIssues = maint.filter((m) => m.status !== "resolved"); const solved = maint.filter((m) => daysToResolve(m) != null); const avg = solved.length ? Math.round(solved.reduce((a, m) => a + daysToResolve(m), 0) / solved.length) : null; const oldest = openIssues.length ? Math.max(...openIssues.map(daysOpen)) : null; return [["Open issues", openIssues.length, SEMANTIC.warn], ["Avg days to resolve", avg == null ? "—" : avg, SEMANTIC.ok], ["Oldest open (days)", oldest == null ? "—" : oldest, oldest != null ? agingColor(oldest) : T.textMuted]].map(([label, n, c]) => (<div key={label} className="rounded-xl py-3" style={{ background: T.surfaceAlt }}><div className="text-2xl font-bold" style={{ color: c }}>{n}</div><div style={{ color: T.textMuted }} className="text-xs">{label}</div></div>)); })()}</div>
          <div className="grid sm:grid-cols-2 gap-x-6"><div><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">By status</div>{M_FLOW.map((s) => <Bar key={s} label={M_STATUS[s].label} n={mStat[s] || 0} total={maint.length} color={M_STATUS[s].c} />)}</div><div><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">By type</div>{Object.keys(mCat).map((c) => <Bar key={c} label={c} n={mCat[c]} total={maint.length} color={T.accent} />)}</div></div>
          <div className="mt-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Time to resolve — by category</div>
            {(() => { const rows = MAINT_CATEGORIES.map((c) => { const inCat = maint.filter((m) => m.category === c); const solved = inCat.filter((m) => daysToResolve(m) != null); return { c, total: inCat.length, resolved: solved.length, avg: solved.length ? Math.round(solved.reduce((a, m) => a + daysToResolve(m), 0) / solved.length) : null }; }).filter((r) => r.total > 0); return rows.length === 0 ? <p style={{ color: T.textMuted }} className="text-sm">No issues yet.</p> : rows.map((r) => (<div key={r.c} className="flex items-center justify-between py-1.5 text-sm" style={{ borderBottom: `1px solid ${T.border}` }}><span>{r.c}</span><span style={{ color: T.textMuted }} className="text-xs">{r.resolved}/{r.total} resolved{r.avg != null ? ` · avg ${r.avg} day${r.avg === 1 ? "" : "s"}` : " · no resolved data yet"}</span></div>)); })()}
          </div>
          <div className="mt-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Open issues — aging</div>
            {(() => { const openIssues = maint.filter((m) => m.status !== "resolved").sort((a, b) => daysOpen(b) - daysOpen(a)); return openIssues.length === 0 ? <p style={{ color: T.textMuted }} className="text-sm">Nothing open. Nice.</p> : openIssues.map((m) => (<div key={m.id} className="flex items-center justify-between gap-3 py-1.5" style={{ borderBottom: `1px solid ${T.border}` }}><div className="min-w-0"><div className="text-sm font-medium truncate">{m.title}</div><div style={{ color: T.textMuted }} className="text-[11px]">{m.category} · reported {fmtDate(m.reportedAt || m.date)} · {M_STATUS[m.status].label}</div></div><Badge color={agingColor(daysOpen(m))}>{daysOpen(m)} day{daysOpen(m) === 1 ? "" : "s"}</Badge></div>)); })()}
          </div>
          <div className="mt-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Approved works recorded</div>{maint.filter((m) => m.resolutions.length).length === 0 ? <p style={{ color: T.textMuted }} className="text-sm">No approved works recorded yet.</p> : maint.filter((m) => m.resolutions.length).map((m) => (<div key={m.id} className="mb-2.5"><div className="text-sm font-semibold">{m.title}</div>{m.resolutions.map((r) => <div key={r.id} style={{ color: T.textMuted }} className="text-xs ml-3 mt-0.5">• {[r.supplier, r.note].filter(Boolean).join(" — ")}{r.cost ? ` (${r.cost})` : ""}</div>)}</div>))}</div>
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{books.length} total</span>}>Bookings</SectionTitle>
          <div className="grid grid-cols-3 gap-3 text-center">{[["confirmed", "Confirmed", SEMANTIC.ok], ["pending", "Pending", SEMANTIC.warn], ["declined", "Declined", SEMANTIC.bad]].map(([k, label, c]) => (<div key={k} className="rounded-xl py-3" style={{ background: T.surfaceAlt }}><div className="text-2xl font-bold" style={{ color: c }}>{bStat[k] || 0}</div><div style={{ color: T.textMuted }} className="text-xs">{label}</div></div>))}</div>
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{msgs.length} total</span>}>Messaging</SectionTitle>
          {MSG_CATEGORIES.map((c) => <Bar key={c} label={c} n={mgCat[c] || 0} total={msgs.length} color={HUE.messaging[1]} />)}
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{acts.filter((a) => a.status === "open").length} open</span>}>Action register</SectionTitle>
          <div className="grid grid-cols-3 gap-3 text-center">{[["Open", acts.filter((a) => a.status === "open").length, T.accent], ["Overdue", acts.filter((a) => actionFlags(a).overdue).length, SEMANTIC.bad], ["Completed", acts.filter((a) => a.status === "done").length, SEMANTIC.ok]].map(([label, n, c]) => (<div key={label} className="rounded-xl py-3" style={{ background: T.surfaceAlt }}><div className="text-2xl font-bold" style={{ color: c }}>{n}</div><div style={{ color: T.textMuted }} className="text-xs">{label}</div></div>))}</div>
        </Card>
        <Card style={{ padding: 18 }}><SectionTitle right={<div className="flex items-center gap-2"><span style={{ color: T.textMuted }} className="text-[11px]">{motions.length} recorded</span>{motions.length > 0 && <button onClick={exportDecisions} className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: T.accent }}><Download size={12} /> Export</button>}</div>}>Decisions register</SectionTitle>
          {motions.length === 0 && <p style={{ color: T.textMuted }} className="text-sm">No motions recorded yet.</p>}
          <div className="space-y-1">{motions.map((mo) => (<div key={mo.id} className="flex items-start justify-between gap-3 py-2" style={{ borderBottom: `1px solid ${T.border}` }}><div className="min-w-0"><div className="text-sm font-medium">{mo.title}</div><div style={{ color: T.textMuted }} className="text-[11px]">{mo.ref ? mo.ref + " · " : ""}{mo.meeting} · decided {fmtDate(mo.decidedDate || mo.date)}{mo.decidedTime ? " " + mo.decidedTime : ""} · for {mo.forCount} / against {mo.againstCount} / abstain {mo.abstainCount}</div></div><Badge color={mo.outcome === "Carried" ? SEMANTIC.ok : SEMANTIC.bad}>{mo.outcome}</Badge></div>))}</div>
        </Card>
      </Wrap>
    </div>
  );
}

// ---------- events ----------------------------------------------------------
function RSVP({ event }) {
  const { T, update, user } = useApp();
  const set = (kind) => update((s) => { const e = s.events.find((x) => x.id === event.id); ["going", "maybe", "cantGo"].forEach((k) => { e[k] = e[k].filter((n) => n !== user.name); }); if (kind) e[kind].push(user.name); });
  const states = [["going", "Going", SEMANTIC.ok], ["maybe", "Maybe", SEMANTIC.warn], ["cantGo", "Can't go", SEMANTIC.bad]];
  return (<div className="flex gap-2 flex-wrap">{states.map(([k, label, c]) => { const on = event[k].includes(user.name); return (<button key={k} onClick={() => set(on ? null : k)} className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: on ? c : "transparent", color: on ? "#fff" : T.text, border: `1px solid ${on ? c : T.border}` }}>{label}</button>); })}</div>);
}
function Events() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.events.filter((e) => e.buildingId === buildingId);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState(null);
  const [f, setF] = useState({ title: "", date: "", timeFrom: "", timeTo: "", location: "", teamsLink: "", organiser: "", image: "" });
  const add = () => { if (!f.title.trim()) return; update((s) => s.events.unshift({ id: "e" + Math.random().toString(36).slice(2, 6), buildingId, ...f, organiser: f.organiser || user.name, going: [], maybe: [], cantGo: [] })); setF({ title: "", date: "", timeFrom: "", timeTo: "", location: "", teamsLink: "", organiser: "", image: "" }); setAdding(false); flash("Event posted"); };

  if (open) {
    const e = store.events.find((x) => x.id === open); if (!e) { setOpen(null); return null; }
    const canEd = isCommittee(user.role) || e.organiser === user.name;
    const startEdit = () => { setEf({ title: e.title, date: e.date, timeFrom: e.timeFrom, timeTo: e.timeTo, location: e.location, teamsLink: e.teamsLink, organiser: e.organiser, image: e.image }); setEditing(true); };
    const saveEdit = () => { update((s) => { const ev = s.events.find((x) => x.id === e.id); Object.assign(ev, { title: ef.title.trim() || ev.title, date: ef.date, timeFrom: ef.timeFrom, timeTo: ef.timeTo, location: ef.location, teamsLink: ef.teamsLink, organiser: ef.organiser, image: ef.image }); }); setEditing(false); flash("Event updated"); };
    const removeEvent = () => { update((s) => { s.events = s.events.filter((x) => x.id !== e.id); }); setEditing(false); setOpen(null); flash("Event removed"); };
    return (<div><Head title="Event" onBack={() => { setEditing(false); setOpen(null); }} backLabel="All events" /><Wrap>
      {editing ? (<Card style={{ padding: 18 }}><div className="space-y-3">
        <Field label="Title"><Input value={ef.title} onChange={(e) => setEf({ ...ef, title: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3"><Field label="Date"><Input type="date" value={ef.date} onChange={(e) => setEf({ ...ef, date: e.target.value })} /></Field><Field label="From"><Input type="time" value={ef.timeFrom} onChange={(e) => setEf({ ...ef, timeFrom: e.target.value })} /></Field><Field label="To"><Input type="time" value={ef.timeTo} onChange={(e) => setEf({ ...ef, timeTo: e.target.value })} /></Field></div>
        <div className="grid sm:grid-cols-2 gap-3"><Field label="Location (physical)"><Input value={ef.location} onChange={(e) => setEf({ ...ef, location: e.target.value })} /></Field><Field label="Teams link (digital)"><Input value={ef.teamsLink} onChange={(e) => setEf({ ...ef, teamsLink: e.target.value })} placeholder="https://teams…" /></Field></div>
        <Field label="Organiser"><Input value={ef.organiser} onChange={(e) => setEf({ ...ef, organiser: e.target.value })} /></Field>
        <Field label="Promo image"><ImagePick value={ef.image} onChange={(v) => setEf({ ...ef, image: v })} /></Field>
        <div className="flex gap-2 flex-wrap"><Btn grad onClick={saveEdit}>Save changes</Btn><Btn kind="ghost" onClick={() => setEditing(false)}>Cancel</Btn><Btn kind="ghost" onClick={removeEvent}><Trash2 size={14} /> Remove</Btn></div>
      </div></Card>) : (
      <Card style={{ padding: 0, overflow: "hidden" }}>{e.image && <img src={e.image} alt="" className="w-full h-56 object-cover" />}<div className="p-6">
        <div className="flex items-start justify-between gap-3"><h2 className="text-2xl font-bold">{e.title}</h2>{canEd && <button onClick={startEdit} className="text-sm font-semibold inline-flex items-center gap-1 shrink-0" style={{ color: T.accent }}><Pencil size={14} /> Edit</button>}</div>
        <div className="space-y-2 mt-3 text-sm">
          <div className="flex items-center gap-2"><Calendar size={16} style={{ color: T.accent }} /> {fmtDate(e.date)}{e.timeFrom && ` · ${e.timeFrom}–${e.timeTo}`}</div>
          {e.location && <div className="flex items-center gap-2"><MapPin size={16} style={{ color: T.accent }} /> {e.location}</div>}
          {e.organiser && <div className="flex items-center gap-2"><Users size={16} style={{ color: T.accent }} /> Organised by {e.organiser}</div>}
        </div>
        {e.teamsLink && <div className="mt-4"><Btn grad onClick={() => openExternal(e.teamsLink)}><Video size={16} /> Join via Teams</Btn></div>}
        <div className="mt-5" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <div className="flex gap-4 text-sm mb-3" style={{ color: T.textMuted }}><span><b style={{ color: SEMANTIC.ok }}>{e.going.length}</b> going</span><span><b style={{ color: SEMANTIC.warn }}>{e.maybe.length}</b> maybe</span><span><b style={{ color: SEMANTIC.bad }}>{e.cantGo.length}</b> can't</span></div>
          <div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Your response</div>
          <RSVP event={e} />
          {e.going.length > 0 && <div style={{ color: T.textMuted }} className="text-xs mt-3">Going: {e.going.join(", ")}</div>}
        </div>
      </div></Card>)}
    </Wrap></div>);
  }
  return (
    <div>
      <Head title="Events" sub="What's on in the building" action={<HeaderAction data-guide="g-event-add" onClick={() => setAdding(true)}><Plus size={16} /> Add</HeaderAction>} />
      <Wrap>
        {adding && (<Card style={{ padding: 18 }}><div className="space-y-3">
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3"><Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field><Field label="From"><Input type="time" value={f.timeFrom} onChange={(e) => setF({ ...f, timeFrom: e.target.value })} /></Field><Field label="To"><Input type="time" value={f.timeTo} onChange={(e) => setF({ ...f, timeTo: e.target.value })} /></Field></div>
          <div className="grid sm:grid-cols-2 gap-3"><Field label="Location (physical)"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field><Field label="Teams link (digital)"><Input value={f.teamsLink} onChange={(e) => setF({ ...f, teamsLink: e.target.value })} placeholder="https://teams…" /></Field></div>
          <Field label="Organiser"><Input value={f.organiser} onChange={(e) => setF({ ...f, organiser: e.target.value })} placeholder={user.name} /></Field>
          <Field label="Promo image (optional)"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} /></Field>
          <div className="flex gap-2"><Btn grad onClick={add}>Post event</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
        </div></Card>)}
        {list.map((e) => (<button key={e.id} onClick={() => setOpen(e.id)} className="w-full text-left"><Card hover style={{ padding: 0, overflow: "hidden" }}>{e.image && <img src={e.image} alt="" className="w-full h-40 object-cover" />}<div className="p-[18px]"><div className="flex items-start justify-between gap-2"><div className="font-semibold text-[17px]">{e.title}</div><ChevronRight size={16} style={{ color: T.textMuted }} /></div><div style={{ color: T.textMuted }} className="text-sm mt-1 flex flex-wrap gap-x-3"><span className="inline-flex items-center gap-1"><Calendar size={13} /> {fmtDate(e.date)}{e.timeFrom && ` · ${e.timeFrom}`}</span>{e.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {e.location}</span>}{e.teamsLink && <span className="inline-flex items-center gap-1"><Video size={13} /> Teams</span>}</div><div className="flex gap-3 text-xs mt-2.5" style={{ color: T.textMuted }}><span><b style={{ color: SEMANTIC.ok }}>{e.going.length}</b> going</span><span><b style={{ color: SEMANTIC.warn }}>{e.maybe.length}</b> maybe</span></div></div></Card></button>))}
      </Wrap>
    </div>
  );
}

// ---------- gallery (lightbox + save) ---------------------------------------
function Gallery() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.gallery.filter((g) => g.buildingId === buildingId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const newCount = list.filter((g) => g.createdAt > (user.lastSeenGallery || "")).length;
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState("All");
  const [light, setLight] = useState(null);
  const [f, setF] = useState({ caption: "", category: GALLERY_CATEGORIES[0], image: "" });
  const [slide, setSlide] = useState(0);
  // Photos are NOT carried in the building load — the store holds captions and
  // categories only. Fetch the actual images once, when this screen opens.
  // `src(g)` prefers an image already in hand (a photo just uploaded in this
  // session) and falls back to the fetched map.
  const [imgs, setImgs] = useState({});
  useEffect(() => {
    let live = true;
    getGalleryImages(buildingId).then((m) => { if (live) setImgs(m || {}); }).catch(() => {});
    return () => { live = false; };
  }, [buildingId]);
  const src = (g) => (g ? (g.image || imgs[g.id] || "") : "");
  const recent = list.slice(0, 10);
  useEffect(() => { if (recent.length < 2) return; const id = setInterval(() => setSlide((s) => (s + 1) % recent.length), 3500); return () => clearInterval(id); }, [recent.length]);
  useEffect(() => { const t = setTimeout(() => update((s) => { const u = s.users.find((x) => x.id === user.id); if (u) u.lastSeenGallery = nowISO(); }), 1200); return () => clearTimeout(t); }, []);
  const add = () => { if (!f.image && !f.caption.trim()) return; update((s) => s.gallery.unshift({ id: "g" + Math.random().toString(36).slice(2, 6), buildingId, caption: f.caption.trim() || "Untitled", category: f.category, color: T.accent, image: f.image, postedBy: user.name, createdAt: nowISO() })); setF({ caption: "", category: GALLERY_CATEGORIES[0], image: "" }); setAdding(false); flash("Photo added to the gallery"); };
  const filtered = cat === "All" ? list : list.filter((g) => g.category === cat);
  const cur = recent[slide];
  const save = (g) => { const d = src(g); if (!d) { flash("Sample tile — upload photos to save"); return; } const a = document.createElement("a"); a.href = d; a.download = (g.caption || "photo") + ".png"; a.click(); };
  return (
    <div>
      <Head title="Gallery" sub="Photos from the community" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> Add photo</HeaderAction>} />
      <Wrap>
        {newCount > 0 && <Card style={{ padding: 14, background: hexToRgba(T.accent, T.mode === "dark" ? 0.16 : 0.1), border: `1px solid ${hexToRgba(T.accent, 0.3)}` }}><div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={16} style={{ color: T.accent }} /> {newCount} new photo{newCount > 1 ? "s" : ""} since you last looked</div></Card>}
        {adding && (<Card style={{ padding: 18 }}><div className="space-y-3"><Field label="Photo"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} /></Field><div className="grid sm:grid-cols-2 gap-3"><Field label="Caption"><Input value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} placeholder="Name this photo" /></Field><Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{GALLERY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field></div><div className="flex gap-2"><Btn grad onClick={add}>Add photo</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div></div></Card>)}
        {recent.length > 0 && cur && (<button onClick={() => setLight(cur)} className="relative rounded-2xl overflow-hidden block w-full" style={{ height: 220, border: `1px solid ${T.border}` }}>{src(cur) ? <img src={src(cur)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center" style={{ background: `linear-gradient(135deg, ${cur.color}, ${hexToRgba(cur.color, 0.55)})` }}><ImageIcon className="text-white/70" size={32} /></div>}<div className="absolute inset-x-0 bottom-0 p-4 text-white text-left" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}><div className="font-semibold">{cur.caption}</div><div className="text-xs text-white/80">{cur.category} · {cur.postedBy}</div></div><div className="absolute bottom-3 right-3 flex gap-1.5">{recent.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === slide ? 16 : 6, background: i === slide ? "#fff" : "rgba(255,255,255,0.5)" }} />)}</div></button>)}
        <div className="flex gap-2 flex-wrap">{["All", ...GALLERY_CATEGORIES].map((c) => { const on = cat === c; return <button key={c} onClick={() => setCat(c)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: on ? T.accent : T.surface, color: on ? T.accentText : T.textMuted, border: `1px solid ${on ? "transparent" : T.border}` }}>{c}</button>; })}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{filtered.map((g) => (<button key={g.id} onClick={() => setLight(g)} className="text-left"><div className="rounded-2xl overflow-hidden aspect-square">{src(g) ? <img src={src(g)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center" style={{ background: `linear-gradient(135deg, ${g.color}, ${hexToRgba(g.color, 0.6)})` }}><ImageIcon className="text-white/70" /></div>}</div><div className="text-sm mt-1.5 font-medium">{g.caption}</div><div style={{ color: T.textMuted }} className="text-xs">{g.category} · {g.postedBy}</div></button>))}</div>
      </Wrap>
      {light && (<div className="fixed inset-0 z-[80] grid place-items-center p-5" onClick={() => setLight(null)}><div className="absolute inset-0 bg-black/80" /><div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}><button onClick={() => setLight(null)} className="absolute -top-10 right-0 text-white/80 p-1"><X size={24} /></button>{src(light) ? <img src={src(light)} alt="" className="w-full rounded-2xl" /> : <div className="w-full aspect-video grid place-items-center rounded-2xl" style={{ background: `linear-gradient(135deg, ${light.color}, ${hexToRgba(light.color, 0.6)})` }}><ImageIcon className="text-white/70" size={40} /></div>}<div className="flex items-center justify-between mt-3 text-white"><div><div className="font-semibold">{light.caption}</div><div className="text-xs text-white/70">{light.category} · {light.postedBy}</div></div><button onClick={() => save(light)} className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5"><Download size={16} /> Save</button></div></div></div>)}
    </div>
  );
}

// ---------- marketplace -----------------------------------------------------
function Marketplace() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const live = store.marketplace.filter((m) => m.buildingId === buildingId && (m.status !== "active" || addDays(localDay(m.createdAt), 30) >= today()));
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [f, setF] = useState({ title: "", price: "", contact: user.phone || user.email || "", desc: "", image: "" });
  const add = () => { if (!f.title.trim()) return; update((s) => s.marketplace.unshift({ id: "p" + Math.random().toString(36).slice(2, 6), buildingId, ...f, seller: user.name, status: "active", createdAt: nowISO() })); setF({ title: "", price: "", contact: user.phone || user.email || "", desc: "", image: "" }); setAdding(false); flash("Listed · auto-expires in 30 days unless renewed"); };
  const setStatus = (id, status) => update((s) => { s.marketplace.find((x) => x.id === id).status = status; });
  const renew = (id) => { update((s) => { s.marketplace.find((x) => x.id === id).createdAt = nowISO(); }); flash("Listing renewed for 30 days"); };
  const remove = (id) => { update((s) => { s.marketplace = s.marketplace.filter((x) => x.id !== id); }); setOpen(null); };

  if (open) {
    const m = store.marketplace.find((x) => x.id === open); if (!m) { setOpen(null); return null; }
    const mine = m.seller === user.name; const daysLeft = 30 - daysBetween(localDay(m.createdAt), today());
    return (<div><Head title="Listing" onBack={() => setOpen(null)} backLabel="Marketplace" /><Wrap>
      <Card style={{ padding: 0, overflow: "hidden" }}>{m.image && <img src={m.image} alt="" className="w-full h-56 object-cover" />}<div className="p-6">
        <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{m.title}</h2><div className="text-2xl font-bold" style={{ color: T.accent }}>{m.price}</div></div>
        <p className="text-[15px] mt-3">{m.desc}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2"><span style={{ color: T.textMuted }} className="text-sm">{m.seller}</span>{m.status !== "active" && <Badge color={m.status === "sold" ? SEMANTIC.ok : SEMANTIC.warn}>{m.status === "sold" ? "Sold" : "Pending"}</Badge>}{m.status === "active" && <span style={{ color: daysLeft <= 5 ? SEMANTIC.warn : T.textMuted }} className="text-xs">{daysLeft}d left</span>}</div>
        <div className="mt-4" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Contact the seller</div><Btn grad onClick={() => openExternal(m.contact.includes("@") ? `mailto:${m.contact}` : `tel:${m.contact}`)}><Phone size={15} /> {m.contact}</Btn></div>
        {mine && (<div className="flex gap-2 mt-4 flex-wrap">{m.status !== "sold" && <Btn kind="soft" onClick={() => setStatus(m.id, "pending")}>Mark pending</Btn>}{m.status !== "sold" && <Btn kind="soft" onClick={() => setStatus(m.id, "sold")}>Mark sold</Btn>}<Btn kind="ghost" onClick={() => renew(m.id)}><RefreshCw size={14} /> Renew</Btn><Btn kind="ghost" onClick={() => remove(m.id)}><Trash2 size={14} /> Remove</Btn></div>)}
      </div></Card>
    </Wrap></div>);
  }
  return (
    <div>
      <Head title="Marketplace" sub="Buy & sell within the building" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> List item</HeaderAction>} />
      <Wrap>
        {adding && (<Card style={{ padding: 18 }}><div className="space-y-3"><Field label="Photo (optional)"><ImagePick value={f.image} onChange={(v) => setF({ ...f, image: v })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Item"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field><Field label="Price"><Input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="$" /></Field></div><Field label="Contact (so buyers can reach you)"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Phone or email" /></Field><Field label="Details"><TextArea rows={2} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></Field><p style={{ color: T.textMuted }} className="text-xs flex items-center gap-1.5"><ClockIcon size={13} /> Listings auto-expire after 30 days unless renewed or marked sold/pending.</p><div className="flex gap-2"><Btn grad onClick={add}>List item</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div></div></Card>)}
        {live.length === 0 && <Empty icon={ShoppingBag} title="Nothing listed yet" hint="List something your neighbours might want." />}
        {live.map((m) => { const daysLeft = 30 - daysBetween(localDay(m.createdAt), today()); const stc = m.status === "sold" ? SEMANTIC.ok : m.status === "pending" ? SEMANTIC.warn : T.textMuted; return (
          <button key={m.id} onClick={() => setOpen(m.id)} className="w-full text-left"><Card hover style={{ padding: 14 }}><div className="flex items-center gap-3">{m.image ? <img src={m.image} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" /> : <div className="h-14 w-14 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}><ShoppingBag size={20} /></div>}<div className="flex-1 min-w-0"><div className="font-semibold truncate">{m.title}</div><div style={{ color: T.textMuted }} className="text-xs">{m.seller}{m.status === "active" ? ` · ${daysLeft}d left` : ""}</div></div><div className="text-right"><div className="font-bold" style={{ color: T.accent }}>{m.price}</div>{m.status !== "active" && <Badge color={stc}>{m.status === "sold" ? "Sold" : "Pending"}</Badge>}</div><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>
        ); })}
      </Wrap>
    </div>
  );
}

// ---------- messaging -------------------------------------------------------
function Messaging() {
  const { T, store, update, building, buildingId, user, flash } = useApp();
  const list = store.messages.filter((m) => m.buildingId === buildingId && (isApprover(user.role) || m.from === user.name));
  const [f, setF] = useState({ to: "Committee (BCC)", category: "Query", subject: "", body: "", doc: "" });
  const send = () => { if (!f.subject.trim()) { flash("Give your message a subject so the committee can see what it's about"); return; } if (!f.body.trim()) { flash("Add your message before sending"); return; } if (f.category === "Application" && !f.doc) { flash("Applications need a document attached"); return; } update((s) => s.messages.unshift({ id: "msg" + Math.random().toString(36).slice(2, 6), buildingId, ...f, from: user.name, date: today() })); setF({ to: "Committee (BCC)", category: "Query", subject: "", body: "", doc: "" }); flash("Message sent"); };
  return (
    <div>
      <Head title="Messaging" sub="Contact the committee or building manager" />
      <Wrap>
        {(building.modules ? building.modules.whatsapp !== false : true) && <Card style={{ padding: 14 }}><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}><MessageCircle size={20} /></div><div className="flex-1 min-w-0"><div className="font-semibold text-sm">{building.whatsappName || "WhatsApp Group"}</div><div style={{ color: T.textMuted }} className="text-xs">For quick chatter — keep formal requests here in the portal.</div></div><Btn grad onClick={() => building.whatsappLink ? openExternal(building.whatsappLink) : flash("WhatsApp Group not set up")}><ExternalLink size={15} /> Open</Btn></div></Card>}
        <Card style={{ padding: 18 }}><div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Field label="To"><Select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option>Committee (BCC)</option><option>Building manager</option></Select></Field><Field label="Type"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{MSG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field></div>
          <Field label="Subject"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
          <Field label="Message"><TextArea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          {f.category === "Application" && <Field label="Document (required for applications)"><label style={{ borderColor: f.doc ? T.accent : T.border, color: f.doc ? T.text : T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-3 px-3 text-sm cursor-pointer"><Paperclip size={15} /> {f.doc || "Attach your application document"}<input type="file" className="hidden" onChange={(e) => setF({ ...f, doc: e.target.files?.[0]?.name || "" })} /></label></Field>}
          <Btn grad onClick={send}>Send message</Btn>
        </div></Card>
        {list.map((m) => (<Card key={m.id} style={{ padding: 16 }}><div className="flex items-center justify-between flex-wrap gap-2"><div className="font-semibold min-w-0">{m.subject}</div><div className="flex flex-wrap gap-1.5 min-w-0"><Badge color={HUE.messaging[1]}>{m.category}</Badge><Badge color={T.textMuted}>→ {m.to}</Badge></div></div><p style={{ color: T.textMuted }} className="text-sm mt-1">{m.body}</p>{m.doc && <div className="mt-2"><FileChip name={m.doc} color={T.accent} /></div>}<div style={{ color: T.textMuted }} className="text-xs mt-2">{m.from} · {fmtDate(m.date)}</div></Card>))}
      </Wrap>
    </div>
  );
}

// ---------- directory -------------------------------------------------------
function Directory() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const canManage = isCommittee(user.role);
  const [sort, setSort] = useState("towerfloor");
  const [showUnlisted, setShowUnlisted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: "", unit: "", tower: "", floor: "", role: "owner", phone: "", email: "" });
  const [editId, setEditId] = useState(null);
  const [ef, setEf] = useState({});
  const numish = (v) => { const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10); return isNaN(n) ? Infinity : n; };
  const byTowerFloor = (a, b) => String(a.tower || "").localeCompare(String(b.tower || ""), undefined, { numeric: true }) || (numish(a.floor) - numish(b.floor)) || String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true });
  const base = store.users.filter((u) => u.buildingId === buildingId && u.status === "active" && (u.directoryOptIn || (canManage && showUnlisted)));
  const sorted = [...base].sort((a, b) => {
    if (sort === "towerfloor") return byTowerFloor(a, b);
    if (sort === "unit") return String(a.unit).localeCompare(String(b.unit), undefined, { numeric: true });
    if (sort === "first") return a.name.localeCompare(b.name);
    return a.name.split(" ").slice(-1)[0].localeCompare(b.name.split(" ").slice(-1)[0]);
  });
  const setSelf = (k) => update((s) => { const u = s.users.find((x) => x.id === user.id); u[k] = !u[k]; });
  const setSelfVal = (k, v) => update((s) => { const u = s.users.find((x) => x.id === user.id); u[k] = v; });
  const ROLE_OPTS = [["owner", "Owner"], ["tenant", "Tenant"], ["bcc", "Committee"], ["manager", "Manager"]];
  const addPerson = () => { if (!nf.name.trim()) { flash("Add a name first"); return; } update((s) => s.users.push({ id: "u" + Math.random().toString(36).slice(2, 8), buildingId, name: nf.name.trim(), unit: nf.unit.trim(), tower: nf.tower.trim(), floor: nf.floor.trim(), role: nf.role, status: "active", email: nf.email.trim(), phone: nf.phone.trim(), directoryOptIn: true, showPhone: !!nf.phone.trim(), showEmail: !!nf.email.trim(), msc: false, lastSeenGallery: nowISO() })); setNf({ name: "", unit: "", tower: "", floor: "", role: "owner", phone: "", email: "" }); setAdding(false); flash("Added to directory"); };
  const beginEdit = (u) => { setEditId(u.id); setEf({ name: u.name || "", unit: u.unit || "", tower: u.tower || "", floor: u.floor || "", phone: u.phone || "", email: u.email || "", role: u.role, directoryOptIn: !!u.directoryOptIn, showPhone: !!u.showPhone, showEmail: !!u.showEmail }); };
  const saveEdit = () => { update((s) => { const u = s.users.find((x) => x.id === editId); if (u) Object.assign(u, { name: ef.name.trim(), unit: ef.unit.trim(), tower: ef.tower.trim(), floor: ef.floor.trim(), phone: ef.phone.trim(), email: ef.email.trim(), role: ef.role, directoryOptIn: ef.directoryOptIn, showPhone: ef.showPhone, showEmail: ef.showEmail }); }); setEditId(null); flash("Details saved"); };
  const SORTS = [["towerfloor", "Tower & floor"], ["unit", "Unit"], ["first", "First name"], ["last", "Last name"]];
  return (
    <div>
      <Head title="Directory" sub={canManage ? "Neighbours listed — plus committee management" : "Neighbours who chose to be listed"} action={canManage && <HeaderAction data-guide="g-add-person" onClick={() => { setAdding((v) => !v); setEditId(null); }}><Plus size={16} /> Add person</HeaderAction>} />
      <Wrap>
        <Card style={{ padding: 16 }}><div className="space-y-3">
          <div><div style={{ color: T.textMuted }} className="text-xs font-semibold uppercase tracking-wider mb-2">Your contact details</div><div className="grid sm:grid-cols-2 gap-3"><Field label="Phone"><Input value={user.phone || ""} onChange={(e) => setSelfVal("phone", e.target.value)} placeholder="04xx xxx xxx" /></Field><Field label="Email"><Input value={user.email || ""} onChange={(e) => setSelfVal("email", e.target.value)} placeholder="you@seahaven.com.au" /></Field></div></div>
          <Toggle label="Show me in the directory" hint="Nothing of yours appears unless this is on." on={user.directoryOptIn} onClick={() => setSelf("directoryOptIn")} />
          {user.directoryOptIn && (<><Toggle label="Show my phone" on={user.showPhone} onClick={() => setSelf("showPhone")} small /><Toggle label="Show my email" on={user.showEmail} onClick={() => setSelf("showEmail")} small /></>)}
        </div></Card>

        {canManage && adding && (<Card style={{ padding: 16 }}><div className="space-y-2.5">
          <SectionTitle>Add someone to the directory</SectionTitle>
          <Field label="Full name"><Input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="e.g. Sandra Pho" /></Field>
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Unit"><Input value={nf.unit} onChange={(e) => setNf({ ...nf, unit: e.target.value })} placeholder="412" /></Field>
            <Field label="Tower"><Input value={nf.tower} onChange={(e) => setNf({ ...nf, tower: e.target.value })} placeholder="A" /></Field>
            <Field label="Floor"><Input value={nf.floor} onChange={(e) => setNf({ ...nf, floor: e.target.value })} placeholder="4" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Role"><Select value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value })}>{ROLE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="Mobile"><Input value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} placeholder="04xx xxx xxx" /></Field>
          </div>
          <Field label="Email"><Input value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} placeholder="name@example.com" /></Field>
          <div className="flex gap-2"><Btn grad onClick={addPerson}>Add to directory</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
          <div className="text-xs" style={{ color: T.textMuted }}>Adding someone here lists them in the directory — please only add residents' details with their knowledge.</div>
        </div></Card>)}

        <div className="flex items-center gap-2 flex-wrap"><span style={{ color: T.textMuted }} className="text-xs font-semibold uppercase tracking-wider">Sort</span>{SORTS.map(([k, label]) => { const on = sort === k; return <button key={k} onClick={() => setSort(k)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: on ? T.accent : T.surface, color: on ? T.accentText : T.textMuted, border: `1px solid ${on ? "transparent" : T.border}` }}>{label}</button>; })}</div>
        {canManage && <Toggle label="Show unlisted residents" hint="Committee-only view — see and manage residents who haven't opted in." on={showUnlisted} onClick={() => setShowUnlisted((v) => !v)} small />}

        {sorted.length === 0 && <Empty icon={Users} title="No one listed yet" hint={canManage ? "Add someone above, or ask residents to opt in." : "Opt in above to start the directory."} />}
        {sorted.map((u) => (editId === u.id
          ? (<Card key={u.id} style={{ padding: 16 }}><div className="space-y-2.5">
              <Field label="Full name"><Input value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} /></Field>
              <div className="grid grid-cols-3 gap-2.5">
                <Field label="Unit"><Input value={ef.unit} onChange={(e) => setEf({ ...ef, unit: e.target.value })} /></Field>
                <Field label="Tower"><Input value={ef.tower} onChange={(e) => setEf({ ...ef, tower: e.target.value })} /></Field>
                <Field label="Floor"><Input value={ef.floor} onChange={(e) => setEf({ ...ef, floor: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Role"><Select value={ef.role} onChange={(e) => setEf({ ...ef, role: e.target.value })}>{ROLE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
                <Field label="Mobile"><Input value={ef.phone} onChange={(e) => setEf({ ...ef, phone: e.target.value })} /></Field>
              </div>
              <Field label="Email"><Input value={ef.email} onChange={(e) => setEf({ ...ef, email: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-3 pt-1"><Toggle label="Listed in directory" on={ef.directoryOptIn} onClick={() => setEf({ ...ef, directoryOptIn: !ef.directoryOptIn })} small /><Toggle label="Show phone" on={ef.showPhone} onClick={() => setEf({ ...ef, showPhone: !ef.showPhone })} small /><Toggle label="Show email" on={ef.showEmail} onClick={() => setEf({ ...ef, showEmail: !ef.showEmail })} small /></div>
              <div className="flex gap-2"><Btn grad onClick={saveEdit}>Save</Btn><Btn kind="ghost" onClick={() => setEditId(null)}>Cancel</Btn></div>
            </div></Card>)
          : (<Card key={u.id} style={{ padding: 14 }}><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl grid place-items-center font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})` }}>{u.unit}</div><div className="flex-1 min-w-0"><div className="font-semibold text-sm">{u.name}{u.id === user.id && <span style={{ color: T.textMuted }} className="font-normal"> (you)</span>}{canManage && !u.directoryOptIn && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: T.surfaceAlt, color: T.textMuted }}>Not listed</span>}</div><div style={{ color: T.textMuted }} className="text-xs">{[u.tower && `Tower ${u.tower}`, u.floor && `L${u.floor}`, `Unit ${u.unit}`, ROLE_LABEL[u.role]].filter(Boolean).join(" · ")}</div></div><div className="text-right space-y-0.5">{u.showPhone && u.phone && <a href={`tel:${u.phone}`} className="text-xs flex items-center justify-end gap-1" style={{ color: T.accent }}><Phone size={12} /> {u.phone}</a>}{u.showEmail && <a href={`mailto:${u.email}`} className="text-xs flex items-center justify-end gap-1" style={{ color: T.accent }}><Mail size={12} /> Email</a>}{canManage && <button onClick={() => { beginEdit(u); setAdding(false); }} className="text-xs flex items-center justify-end gap-1" style={{ color: T.accent }}><Pencil size={12} /> Edit</button>}</div></div></Card>)
        ))}
      </Wrap>
    </div>
  );
}
function Toggle({ label, hint, on, onClick, small }) {
  const { T } = useApp();
  return (<div className="flex items-center gap-3"><div className="flex-1"><div className={`font-semibold ${small ? "text-[13px]" : "text-sm"}`}>{label}</div>{hint && <div style={{ color: T.textMuted }} className="text-xs">{hint}</div>}</div><button onClick={onClick} className="w-12 h-7 rounded-full transition relative shrink-0" style={{ background: on ? T.accent : T.border }}><span className="absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all" style={{ left: on ? 22 : 2 }} /></button></div>);
}

// ---------- documents -------------------------------------------------------
function Documents() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const canManage = isCommittee(user.role);
  const all = store.documents.filter((d) => d.buildingId === buildingId);
  const visible = all.filter((d) => d.visibility === "committee" ? isCommittee(user.role) : d.visibility === "owners" ? (d.released && (user.role === "owner" || isCommittee(user.role))) : d.released);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", category: DOC_CATEGORIES[0], visibility: "all", fileType: "", fileName: "", fileData: "" });
  const release = (id) => { update((s) => { const d = s.documents.find((x) => x.id === id); d.released = true; if (d.visibility === "committee") d.visibility = "owners"; }); flash("Document released"); };
  const upload = () => { if (!f.fileName) { flash("Choose a file to upload"); return; } if (!f.category) { flash("Pick a category so people can find it"); return; } update((s) => s.documents.unshift({ id: "d" + Math.random().toString(36).slice(2, 6), buildingId, title: f.title.trim() || f.fileName.replace(/\.[^.]+$/, ""), category: f.category, visibility: f.visibility, released: f.visibility !== "committee", uploadedBy: user.name, date: today(), fileType: f.fileType, fileData: f.fileData })); setF({ title: "", category: DOC_CATEGORIES[0], visibility: "all", fileType: "", fileName: "", fileData: "" }); setAdding(false); flash("Document filed"); };
  // File bytes are not loaded with the building — fetch this document's
  // payload on demand. Access is re-checked server-side by the row's RLS.
  const [fetching, setFetching] = useState(null);
  const openDoc = async (d) => {
    if (fetching) return;
    let payload = d.fileData;
    if (!payload) {
      setFetching(d.id);
      try { payload = await getDocumentFile(d.id); }
      catch (e) { payload = null; flash("Couldn't fetch the file — try again"); setFetching(null); return; }
      setFetching(null);
    }
    if (!payload) { flash(`No file attached to ${d.title}`); return; }
    const a = document.createElement("a");
    a.href = payload; a.download = d.title + "." + (d.fileType || "file").toLowerCase(); a.click();
  };
  const cats = [...new Set(visible.map((d) => d.category))];
  return (
    <div>
      <Head title="Documents" sub={canManage ? "The committee's record of activity & source of truth" : "Building documents available to you"} action={canManage && <HeaderAction data-guide="g-doc-upload" onClick={() => setAdding(true)}><Upload size={16} /> Upload</HeaderAction>} />
      <Wrap>
        {adding && (<Card style={{ padding: 18 }}><div className="space-y-3">
          <Field label="File (any type)"><label style={{ borderColor: f.fileName ? T.accent : T.border, color: f.fileName ? T.text : T.textMuted }} className="flex items-center gap-2 border-2 border-dashed rounded-xl py-4 px-3 text-sm cursor-pointer"><Upload size={16} /> {f.fileName || "Choose a file to upload"}<input type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readUpload(file, (d) => setF((p) => ({ ...p, fileName: file.name, fileType: (file.name.split(".").pop() || "").toUpperCase(), fileData: d })), flash); }} /></label></Field>
          <Field label="Title (optional)"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Defaults to the file name" /></Field>
          <div className="grid sm:grid-cols-2 gap-3"><Field label="Category (required)"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="Who can see it"><Select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value })}><option value="all">All residents</option><option value="owners">Owners only</option><option value="committee">Committee only (working file)</option></Select></Field></div>
          <div className="flex gap-2"><Btn grad onClick={upload}>File document</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
        </div></Card>)}
        {cats.length === 0 && <Empty icon={FolderOpen} title="No documents yet" hint={canManage ? "Upload your first record." : "Documents will appear here once released."} />}
        {cats.map((cat) => (<div key={cat}><SectionTitle><span className="inline-flex items-center gap-1.5"><FolderOpen size={13} /> {cat}</span></SectionTitle>{visible.filter((d) => d.category === cat).map((d) => (<div key={d.id} role="button" tabIndex={0} onClick={() => openDoc(d)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDoc(d); } }} className="w-full text-left cursor-pointer"><Card hover style={{ padding: 14, marginBottom: 8 }}><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}><FileText size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold text-sm truncate">{d.title}</div><div style={{ color: T.textMuted }} className="text-[11px] flex flex-wrap gap-x-2">{d.fileType && <span>{d.fileType}</span>}<span>Filed {fmtDate(d.date)} · {d.uploadedBy}</span></div>{!d.released && <div style={{ color: SEMANTIC.warn }} className="text-[11px] flex items-center gap-1 mt-0.5"><Lock size={10} /> Committee only — not yet released</div>}</div>{canManage && !d.released ? <Btn grad onClick={(e) => { e.stopPropagation(); release(d.id); }} className="!px-3 !py-1.5 !text-xs">Release</Btn> : fetching === d.id ? <span style={{ color: T.textMuted }} className="text-[11px] font-semibold shrink-0">fetching…</span> : <Download size={16} style={{ color: T.textMuted }} />}</div></Card></div>))}</div>))}
      </Wrap>
    </div>
  );
}

// ---------- meetings --------------------------------------------------------
function Meetings() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.meetings.filter((m) => m.buildingId === buildingId);
  const [open, setOpen] = useState(null);
  const [agItem, setAgItem] = useState("");
  const bcc = store.users.filter((u) => u.buildingId === buildingId && (u.role === "bcc" || u.role === "admin"));
  const [showMo, setShowMo] = useState(false);
  const [mo, setMo] = useState({ title: "", ref: "", mover: "", seconder: "", meetingDate: "" });
  const [recId, setRecId] = useState(null);
  const [decF, setDecF] = useState({ forCount: "", againstCount: "", abstainCount: "", decidedDate: today(), decidedTime: "" });
  const canEdit = isCommittee(user.role);
  const minutesDoc = (name) => store.documents.find((d) => d.buildingId === buildingId && d.title === name);
  const STANDING = ["Welcome & apologies", "Confirm previous minutes", "Maintenance update", "Financial report", "Correspondence", "General business"];
  if (open) {
    const m = store.meetings.find((x) => x.id === open); if (!m) { setOpen(null); return null; }
    const md = m.minutes ? minutesDoc(m.minutes) : null;
    const set = (kind) => update((s) => { const mm = s.meetings.find((x) => x.id === m.id); ["going", "apologies"].forEach((k) => { mm[k] = mm[k].filter((n) => n !== user.name); }); if (kind) mm[kind].push(user.name); });
    const draft = () => { const openA = store.actions.filter((a) => a.buildingId === buildingId && a.status === "open"); const items = ["Welcome & apologies", "Confirm previous minutes"]; openA.forEach((a) => items.push("Action review: " + a.title)); items.push("Maintenance update", "Financial report", "Correspondence", "General business"); update((s) => { s.meetings.find((x) => x.id === m.id).agenda = items; }); flash("Draft agenda generated from open actions"); };
    const addAg = () => { if (!agItem.trim()) return; update((s) => s.meetings.find((x) => x.id === m.id).agenda.push(agItem.trim())); setAgItem(""); };
    const rmAg = (i) => update((s) => { s.meetings.find((x) => x.id === m.id).agenda.splice(i, 1); });
    const addProposed = () => { if (!mo.title.trim()) return; update((s) => s.meetings.find((x) => x.id === m.id).motions.push({ id: "mo" + Math.random().toString(36).slice(2, 6), ref: mo.ref.trim(), title: mo.title.trim(), mover: mo.mover, seconder: mo.seconder, meetingDate: mo.meetingDate || m.date, status: "proposed", forCount: 0, againstCount: 0, abstainCount: 0, outcome: "", decidedDate: "", decidedTime: "" })); setMo({ title: "", ref: "", mover: "", seconder: "", meetingDate: "" }); setShowMo(false); flash("Proposed motion added"); };
    const openRec = (x) => { setRecId(x.id); setDecF({ forCount: "", againstCount: "", abstainCount: "", decidedDate: x.meetingDate || m.date || today(), decidedTime: "" }); };
    const recordDec = (id) => { if (!decF.decidedDate || !decF.decidedTime) { flash("Add the date and time the decision was taken"); return; } const f = +decF.forCount || 0, a = +decF.againstCount || 0, ab = +decF.abstainCount || 0; update((s) => { const x = s.meetings.find((y) => y.id === m.id).motions.find((y) => y.id === id); x.forCount = f; x.againstCount = a; x.abstainCount = ab; x.outcome = f > a ? "Carried" : "Lost"; x.status = "decided"; x.decidedDate = decF.decidedDate; x.decidedTime = decF.decidedTime; }); setRecId(null); flash("Decision recorded"); };
    const rmMotion = (id) => update((s) => { const mm = s.meetings.find((x) => x.id === m.id); mm.motions = mm.motions.filter((y) => y.id !== id); });
    return (<div><Head title="Meeting" onBack={() => setOpen(null)} backLabel="All meetings" /><Wrap>
      <Card style={{ padding: 24 }}>
        <h2 className="text-xl font-bold">{m.title}</h2>
        <div className="space-y-2 mt-3 text-sm">
          <div className="flex items-center gap-2"><Calendar size={16} style={{ color: T.accent }} /> {fmtDate(m.date)}{m.timeFrom && ` · ${m.timeFrom}–${m.timeTo}`}</div>
          {m.location && <div className="flex items-center gap-2"><MapPin size={16} style={{ color: T.accent }} /> {m.location}</div>}
        </div>
        {m.teamsLink && <div className="mt-4"><Btn grad onClick={() => openExternal(m.teamsLink)}><Video size={16} /> Join via Teams</Btn></div>}
        {m.note && <p style={{ color: T.textMuted }} className="text-sm mt-4">{m.note}</p>}
        {m.minutes && <div className="mt-4"><div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Minutes</div>{md ? <FileChip name={md.title} data={md.fileData} docId={md.id} color={T.accent} /> : <Badge color={T.textMuted}>{m.minutes}</Badge>}</div>}
        <div className="mt-5" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <div className="flex gap-4 text-sm mb-3" style={{ color: T.textMuted }}><span><b style={{ color: SEMANTIC.ok }}>{m.going.length}</b> attending</span><span><b style={{ color: SEMANTIC.warn }}>{m.apologies.length}</b> apologies</span></div>
          <div style={{ color: T.textMuted }} className="text-[11px] uppercase tracking-wider font-bold mb-2">Your response</div>
          <div className="flex gap-2">{[["going", "I'll attend", SEMANTIC.ok], ["apologies", "Send apologies", SEMANTIC.warn]].map(([k, label, c]) => { const on = m[k].includes(user.name); return <button key={k} onClick={() => set(on ? null : k)} className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: on ? c : "transparent", color: on ? "#fff" : T.text, border: `1px solid ${on ? c : T.border}` }}>{label}</button>; })}</div>
        </div>
      </Card>

      <Card style={{ padding: 18 }}><SectionTitle right={canEdit && <button onClick={draft} className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: T.accent }}><RefreshCw size={12} /> Draft from open actions</button>}>Agenda</SectionTitle>
        {m.agenda.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-2">No agenda yet.{canEdit ? " Draft one from open actions or add items below." : ""}</p>}
        <ol className="space-y-1.5">{m.agenda.map((it, i) => (<li key={i} className="flex items-center gap-2 text-sm"><span className="h-5 w-5 rounded-full grid place-items-center text-[11px] font-bold shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}>{i + 1}</span><span className="flex-1">{it}</span>{canEdit && <button onClick={() => rmAg(i)} style={{ color: T.textMuted }}><X size={13} /></button>}</li>))}</ol>
        {canEdit && <div className="flex gap-2 mt-3"><Input value={agItem} onChange={(e) => setAgItem(e.target.value)} placeholder="Add agenda item" /><Btn grad onClick={addAg}><Plus size={15} /></Btn></div>}
      </Card>

      <Card style={{ padding: 18 }}><SectionTitle right={canEdit && <button onClick={() => setShowMo((v) => !v)} className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: T.accent }}><Plus size={12} /> Add motion</button>}>Motions &amp; decisions</SectionTitle>
        {showMo && canEdit && (<div className="space-y-3 mb-4 rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
          <Field label="Motion"><Input value={mo.title} onChange={(e) => setMo({ ...mo, title: e.target.value })} placeholder="e.g. Approve the carpark door repair quote" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Reference no. (optional)"><Input value={mo.ref} onChange={(e) => setMo({ ...mo, ref: e.target.value })} placeholder="e.g. M-2026-014" /></Field><Field label="Meeting date"><Input type="date" value={mo.meetingDate || m.date} onChange={(e) => setMo({ ...mo, meetingDate: e.target.value })} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Moved by"><Select value={mo.mover} onChange={(e) => setMo({ ...mo, mover: e.target.value })}><option value="">Select…</option>{bcc.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</Select></Field><Field label="Seconded by"><Select value={mo.seconder} onChange={(e) => setMo({ ...mo, seconder: e.target.value })}><option value="">Select…</option>{bcc.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</Select></Field></div>
          <div className="flex gap-2"><Btn grad onClick={addProposed}><Plus size={15} /> Add proposed motion</Btn><Btn kind="ghost" onClick={() => setShowMo(false)}>Cancel</Btn></div>
        </div>)}
        {m.motions.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-2">No motions yet.{canEdit ? " Add proposed motions to vote on, then record each decision." : ""}</p>}
        <div className="space-y-2.5">{m.motions.map((x) => { const decided = x.status === "decided"; return (
          <div key={x.id} className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">{x.ref && <span style={{ color: T.textMuted }} className="text-[11px] font-bold">{x.ref}</span>}<div className="font-medium text-sm">{x.title}</div></div>
              <div className="flex items-center gap-1.5 shrink-0"><Badge color={decided ? (x.outcome === "Carried" ? SEMANTIC.ok : SEMANTIC.bad) : SEMANTIC.warn}>{decided ? x.outcome : "Proposed"}</Badge>{canEdit && <button onClick={() => rmMotion(x.id)} style={{ color: T.textMuted }}><X size={13} /></button>}</div>
            </div>
            <div style={{ color: T.textMuted }} className="text-[11px] mt-1.5">{(x.mover || x.seconder) && <>Moved {x.mover || "—"}{x.seconder && `, seconded ${x.seconder}`} · </>}Meeting {fmtDate(x.meetingDate || m.date)}</div>
            {decided && <div style={{ color: T.textMuted }} className="text-[11px] mt-0.5">For {x.forCount} / against {x.againstCount} / abstain {x.abstainCount} · decided {fmtDate(x.decidedDate)}{x.decidedTime ? ` ${x.decidedTime}` : ""}</div>}
            {!decided && canEdit && (recId === x.id ? (<div className="mt-3 space-y-3" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div className="grid grid-cols-3 gap-2"><Field label="For"><Input type="number" value={decF.forCount} onChange={(e) => setDecF({ ...decF, forCount: e.target.value })} /></Field><Field label="Against"><Input type="number" value={decF.againstCount} onChange={(e) => setDecF({ ...decF, againstCount: e.target.value })} /></Field><Field label="Abstain"><Input type="number" value={decF.abstainCount} onChange={(e) => setDecF({ ...decF, abstainCount: e.target.value })} /></Field></div>
              <div className="grid grid-cols-2 gap-2"><Field label="Decision date"><Input type="date" value={decF.decidedDate} onChange={(e) => setDecF({ ...decF, decidedDate: e.target.value })} /></Field><Field label="Decision time"><Input type="time" value={decF.decidedTime} onChange={(e) => setDecF({ ...decF, decidedTime: e.target.value })} /></Field></div>
              <div className="flex gap-2"><Btn grad onClick={() => recordDec(x.id)}><Vote size={15} /> Save decision</Btn><Btn kind="ghost" onClick={() => setRecId(null)}>Cancel</Btn></div>
            </div>) : <div className="mt-2"><Btn kind="soft" onClick={() => openRec(x)} className="!py-1.5 !text-xs"><Vote size={13} /> Record decision</Btn></div>)}
          </div>
        ); })}</div>
      </Card>
    </Wrap></div>);
  }
  return (<div><Head title="Meetings" sub="AGM and committee meetings" /><Wrap>{list.map((m) => (<button key={m.id} onClick={() => setOpen(m.id)} className="w-full text-left"><Card hover style={{ padding: 16 }}><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl grid place-items-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${HUE.meetings[0]}, ${HUE.meetings[1]})` }}><Gavel size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold">{m.title}</div><div style={{ color: T.textMuted }} className="text-xs">{fmtDate(m.date)}{m.timeFrom && ` · ${m.timeFrom}`}{m.motions.filter((x) => x.status === "decided").length > 0 && ` · ${m.motions.filter((x) => x.status === "decided").length} decision(s)`}</div></div><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>))}</Wrap></div>);
}

// ---------- key & fob register (committee only) -----------------------------
// Reads unit_access_items, the same table Unit Search uses. Four views behind
// one screen: the register itself, the building's descriptor catalogue, unit
// entitlements, and the Caretaker's annual audit.
//
// Descriptors are per-building DATA, not a fixed list (migration 0019). The
// Curve Birtinya BCC asked for thirteen "descriptors", but eight differed only
// by fire-stair level and two were the Purpose axis welded into a string. A
// fixed list would make a new level a schema change and bake one building's
// floor plan into every building. Each descriptor still carries an item_type
// and purpose underneath, so the filters keep working.
//
// Holder honesty is unchanged: a device with no recorded holder says so rather
// than borrowing the unit's occupants.
const AI_TYPES = [["key", "Key"], ["fob", "Fob"], ["remote", "Remote"], ["swipe_card", "Swipe card"], ["digital_card", "Digital card"], ["other", "Other"]];
const AI_PURPOSES = [["resident", "Resident"], ["master", "Master"], ["service", "Service"], ["other", "Other"]];
// 'lost' is legacy and still renders; new withdrawals are Suspended, which the
// BCC asked for explicitly: lost devices are suspended and never deleted.
const AI_STATUSES = [["issued", "Issued"], ["on_hand", "On hand"], ["returned", "Returned"], ["suspended", "Suspended"], ["lost", "Lost"], ["deactivated", "Deactivated"]];
const AI_STATUS_PICK = [["issued", "Issued"], ["on_hand", "On hand (held by the BM)"], ["returned", "Returned"], ["suspended", "Suspended"]];
const AI_ROLES = [["owner", "Owner"], ["managing_agent", "Managing agent"], ["tenant", "Tenant"], ["building_manager", "Building manager"], ["contractor", "Contractor"], ["other", "Other"]];
const aiLabel = (pairs, v) => { const hit = pairs.find((p) => p[0] === v); return hit ? hit[1] : (v || "—"); };
const KF_CSV_HEADERS = ["unit", "descriptor", "identifier", "holder", "issued_to_role", "status", "notes"];
const KF_ENT_HEADERS = ["unit", "descriptor", "entitlement"];
const KF_CLASSIFY_HEADERS = ["identifier", "descriptor"];
const blankAI = () => ({ unit: "", descriptor_id: "", identifier: "", label: "", issued_to: "", issued_to_role: "", owner_authority: false, owner_authority_by: "", issued_at: today(), status: "issued", notes: "" });
const blankDesc = () => ({ id: "", name: "", item_type: "key", purpose: "resident", stock_tracked: false, sort: 0, active: true });
// Building-level devices (no unit) sort first: a master key matters more to the
// committee than lot 101's third fob.
const aiSort = (a, b) => {
  const ua = String(a.unit_number || ""), ub = String(b.unit_number || "");
  if (!ua !== !ub) return ua ? 1 : -1;
  const na = parseInt(ua, 10), nb = parseInt(ub, 10);
  const an = !isNaN(na), bn = !isNaN(nb);
  if (an && bn && na !== nb) return na - nb;
  if (an !== bn) return an ? -1 : 1;
  return ua.localeCompare(ub) || (a.descriptor_sort || 0) - (b.descriptor_sort || 0)
    || String(a.identifier || "").localeCompare(String(b.identifier || ""));
};

// Module level: a form declared inside the screen gets a new function identity
// every render and remounts on each keystroke. ARCHITECTURE section 9.
function AccessItemForm({ v, setV, units, descriptors }) {
  const { T } = useApp();
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const needsAuthority = v.issued_to_role === "tenant";
  return (<div className="space-y-3">
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Unit"><Select value={v.unit} onChange={set("unit")}><option value="">Common property — no unit</option>{units.map((u) => <option key={u.id} value={u.unit_number}>{u.unit_number}</option>)}</Select></Field>
      <Field label="Descriptor"><Select value={v.descriptor_id} onChange={set("descriptor_id")}><option value="">— not classified —</option>{descriptors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
    </div>
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Key number / serial"><Input value={v.identifier} onChange={set("identifier")} placeholder="e.g. 29305D36" /></Field>
      <Field label="Status"><Select value={v.status} onChange={set("status")}>{AI_STATUS_PICK.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
    </div>
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Issued to (name)"><Input value={v.issued_to} onChange={set("issued_to")} placeholder="Leave blank if not recorded" /></Field>
      <Field label="They are the"><Select value={v.issued_to_role} onChange={set("issued_to_role")}><option value="">— not recorded —</option>{AI_ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
    </div>
    {needsAuthority && (<Card style={{ padding: 12, background: hexToRgba(SEMANTIC.warn, 0.08), border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.35)}` }}>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={!!v.owner_authority} onChange={(e) => setV({ ...v, owner_authority: e.target.checked })} className="mt-1" />
        <span>The owner has authorised this issue to the tenant.</span>
      </label>
      {v.owner_authority && <div className="mt-2"><Field label="Authorised by"><Input value={v.owner_authority_by} onChange={set("owner_authority_by")} placeholder="Owner's name" /></Field></div>}
    </Card>)}
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Issued on"><Input type="date" value={v.issued_at || ""} onChange={set("issued_at")} /></Field>
      <Field label="Label (optional)"><Input value={v.label} onChange={set("label")} /></Field>
    </div>
    <Field label="Notes (optional)"><Input value={v.notes} onChange={set("notes")} /></Field>
  </div>);
}

function DescriptorForm({ v, setV }) {
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (<div className="space-y-3">
    <Field label="Name — exactly as the committee says it"><Input value={v.name} onChange={set("name")} placeholder="Building and Fire Stairs Key - Level 8" /></Field>
    <div className="grid sm:grid-cols-3 gap-3">
      <Field label="Device type"><Select value={v.item_type} onChange={set("item_type")}>{AI_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <Field label="Purpose"><Select value={v.purpose} onChange={set("purpose")}>{AI_PURPOSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <Field label="Order"><Input type="number" value={v.sort} onChange={set("sort")} /></Field>
    </div>
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={!!v.stock_tracked} onChange={(e) => setV({ ...v, stock_tracked: e.target.checked })} className="mt-1" />
      <span>Counted as stock on hand at the annual audit (fobs and remotes normally are; keys normally are not).</span>
    </label>
  </div>);
}

function KeyFobRegister() {
  const { T, store, buildingId, flash, user } = useApp();
  const bldg = (store.buildings || []).find((b) => b.id === buildingId) || {};
  const canEdit = isCommittee(user.role) || (user.role === "manager" && !!bldg.bmRegistryWrite);

  const [tab, setTab] = useState("register");   // register | descriptors | entitlements | audit
  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [descriptors, setDescriptors] = useState([]);
  const [ents, setEnts] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fDesc, setFDesc] = useState("all");
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState(blankAI());
  const [editId, setEditId] = useState(null);
  const [ef, setEf] = useState(blankAI());
  const [dEdit, setDEdit] = useState(null);
  const [df, setDf] = useState(blankDesc());
  const [entUnit, setEntUnit] = useState("");

  // NOT gated on `backend`: the demo shims answer all of these, and gating a
  // data load on `backend` is what left Unit Search empty in v0.29.1.
  const load = async () => {
    setBusy(true);
    try {
      const [items, us, ds, es, au] = await Promise.all([
        listAccessItems(buildingId), listUnits(buildingId), listAccessDescriptors(buildingId),
        listAccessEntitlements(buildingId), runAccessAudit(buildingId),
      ]);
      setRows(items || []); setUnits(us || []); setDescriptors(ds || []); setEnts(es || []); setAuditRows(au || []);
    } catch (e) { flash("Couldn't load the register."); }
    setBusy(false);
  };
  useEffect(() => { load(); }, [buildingId]);

  const legacy = useMemo(() => (store.keyfobs || []).filter((k) => k.buildingId === buildingId).map((k) => ({
    id: k.id, legacy: true, unit_number: k.unit || "",
    item_type: String(k.type || "key").toLowerCase().replace(/ /g, "_"),
    purpose: "resident", identifier: k.serial || "", label: k.label || "", descriptor: "",
    issued_to: k.holder || "", issued_at: k.issued || "", status: k.status || "issued",
    notes: k.notes || "", occupants: [], descriptor_sort: 9999,
  })), [store.keyfobs, buildingId]);

  const all = useMemo(() => rows.concat(legacy).slice().sort(aiSort), [rows, legacy]);
  const descById = useMemo(() => { const m = {}; descriptors.forEach((d) => { m[d.id] = d; }); return m; }, [descriptors]);
  const unitById = useMemo(() => { const m = {}; units.forEach((u) => { m[u.id] = u.unit_number; }); return m; }, [units]);

  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hay = (r) => [r.unit_number, r.identifier, r.label, r.issued_to, r.descriptor].concat(r.occupants || []).join(" ").toLowerCase();
    return all.filter((r) => (fDesc === "all" || r.descriptor_id === fDesc || (fDesc === "none" && !r.descriptor_id))
      && (!needle || hay(r).includes(needle)));
  }, [all, q, fDesc]);
  const shown = useMemo(() => base.filter((r) => fStatus === "all" || r.status === fStatus), [base, fStatus]);
  const filtering = q.trim() !== "" || fDesc !== "all";
  const clearAll = () => { setQ(""); setFDesc("all"); setFStatus("all"); };

  const counts = useMemo(() => {
    const c = { total: base.length, registerTotal: all.length,
      units: new Set(base.map((r) => r.unit_number).filter(Boolean)).size,
      noHolder: base.filter((r) => !String(r.issued_to || "").trim()).length,
      unclassified: base.filter((r) => !r.descriptor_id && !r.legacy).length };
    AI_STATUSES.forEach(([k]) => { c[k] = base.filter((r) => r.status === k).length; });
    return c;
  }, [base, all]);

  const unitIdFor = (no) => { const u = units.find((x) => btrimU(x.unit_number) === btrimU(no)); return u ? u.id : null; };
  const patchFrom = (v) => ({
    descriptor_id: v.descriptor_id || null,
    identifier: String(v.identifier).trim() || null, label: String(v.label).trim() || null,
    issued_to: String(v.issued_to).trim() || null, issued_to_role: v.issued_to_role || null,
    owner_authority: !!v.owner_authority, owner_authority_by: String(v.owner_authority_by || "").trim() || null,
    issued_at: v.issued_at || null, status: v.status || "issued", notes: String(v.notes).trim() || null,
  });

  const add = async () => {
    if (!String(f.identifier).trim() && !f.descriptor_id) { flash("Add a key number or pick a descriptor."); return; }
    if (f.issued_to_role === "tenant" && !f.owner_authority) { flash("A tenant issue needs the owner's authority."); return; }
    try {
      const p = patchFrom(f);
      p.item_type = (descById[f.descriptor_id] || {}).item_type || "key";
      p.purpose = (descById[f.descriptor_id] || {}).purpose || "resident";
      await addAccessItem(buildingId, unitIdFor(f.unit), p);
      setF(blankAI()); setAdding(false); flash("Added to the register"); await load();
    } catch (e) { flash("Couldn't add that device."); }
  };
  const startEdit = (r) => { setEditId(r.id); setEf({
    unit: r.unit_number || "", descriptor_id: r.descriptor_id || "", identifier: r.identifier || "",
    label: r.label || "", issued_to: r.issued_to || "", issued_to_role: r.issued_to_role || "",
    owner_authority: !!r.owner_authority, owner_authority_by: r.owner_authority_by || "",
    issued_at: localDay(r.issued_at), status: r.status || "issued", notes: r.notes || "" }); };
  const saveEdit = async (r) => {
    if (ef.issued_to_role === "tenant" && !ef.owner_authority) { flash("A tenant issue needs the owner's authority."); return; }
    try {
      const p = patchFrom(ef);
      p.unit_id = unitIdFor(ef.unit);
      p.item_type = (descById[ef.descriptor_id] || {}).item_type || r.item_type || "key";
      p.purpose = (descById[ef.descriptor_id] || {}).purpose || r.purpose || "resident";
      p.returned_at = ef.status === "returned" ? today() : null;
      await updateAccessItem(buildingId, r.id, p);
      setEditId(null); flash("Device updated"); await load();
    } catch (e) { flash("Couldn't save that change."); }
  };
  const setStatus = async (r, status) => {
    try { await updateAccessItem(buildingId, r.id, { status, returned_at: status === "returned" ? today() : null }); await load(); }
    catch (e) { flash("Couldn't update the status."); }
  };
  const suspend = async (r) => {
    const reason = window.prompt("Why is this being suspended? (lost, withdrawn, damaged)");
    if (reason === null) return;
    try { await suspendAccessItem(buildingId, r.id, reason); flash("Suspended — the record is kept"); await load(); }
    catch (e) { flash("Couldn't suspend that device."); }
  };
  const remove = async (r) => {
    try { await deleteAccessItem(buildingId, r.id); flash("Device removed"); await load(); }
    catch (e) { flash("Couldn't remove that device."); }
  };
  const attachReceipt = async (r, file) => {
    if (!file) return;
    setBusy(true);
    try { await uploadAccessReceipt(buildingId, r.id, file); flash("Signed receipt attached"); await load(); }
    catch (e) { flash("Couldn't upload that receipt."); }
    setBusy(false);
  };
  const openReceipt = async (r) => {
    try { const u = await accessReceiptUrl(r.receipt_path); if (u) window.open(u, "_blank"); }
    catch (e) { flash("Couldn't open that receipt."); }
  };

  // ---- CSV in and out -------------------------------------------------------
  const exportRegister = () => downloadCSV("nalohub-keyfob-register.csv", toCSV(KF_CSV_HEADERS, shown.map((r) => ({
    unit: r.unit_number || "", descriptor: r.descriptor || "", identifier: r.identifier || "",
    holder: r.issued_to || "", issued_to_role: r.issued_to_role || "", status: r.status, notes: r.notes || "",
  }))));
  const exportAudit = () => downloadCSV("nalohub-key-audit-" + today() + ".csv", toCSV(
    ["scope", "unit", "descriptor", "entitlement", "issued", "on_hand", "held", "suspended", "variance"],
    auditRows.map((a) => ({ scope: a.scope, unit: a.unit_number || "", descriptor: a.descriptor,
      entitlement: a.entitlement, issued: a.issued, on_hand: a.on_hand, held: a.held,
      suspended: a.suspended, variance: a.variance }))));
  const csvIn = (headers, handler) => async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const parsed = parseCSV(await readFileText(file));
      const res = await handler(parsed);
      flash(res);
      await load();
    } catch (err) { flash("Couldn't read that file."); }
    setBusy(false);
  };
  const onEntCsv = csvIn(KF_ENT_HEADERS, async (parsed) => {
    const r = await bulkSetAccessEntitlements(buildingId, parsed);
    return r.set + " entitlement(s) set" + (r.skipped.length ? " · " + r.skipped.length + " skipped" : "");
  });
  const onClassifyCsv = csvIn(KF_CLASSIFY_HEADERS, async (parsed) => {
    const r = await bulkClassifyAccessItems(buildingId, parsed);
    return r.classified + " device(s) classified" + (r.skipped.length ? " · " + r.skipped.length + " skipped" : "");
  });

  const STC = { issued: SEMANTIC.ok, on_hand: "#3b82f6", returned: T.textMuted, lost: SEMANTIC.bad, suspended: SEMANTIC.bad, deactivated: T.textMuted };
  const csvBtn = { display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 600 };
  const chip = (key, on, label, onClick) => <button key={key} onClick={onClick} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: on ? T.accent : T.surface, color: on ? T.accentText : T.textMuted, border: `1px solid ${on ? "transparent" : T.border}` }}>{label}</button>;
  const tabBtn = (k, label) => <button key={k} onClick={() => setTab(k)} className="px-3.5 py-2 rounded-xl text-sm font-semibold" style={{ background: tab === k ? T.accent : T.surface, color: tab === k ? T.accentText : T.textMuted, border: `1px solid ${tab === k ? "transparent" : T.border}` }}>{label}</button>;

  // Plain function call, not <Row/> — the nested-component remount trap.
  const row = (r) => {
    if (editId === r.id) return (<Card key={r.id} style={{ padding: 18 }}>
      <AccessItemForm v={ef} setV={setEf} units={units} descriptors={descriptors} />
      <div className="flex gap-2 mt-3"><Btn grad onClick={() => saveEdit(r)}>Save</Btn><Btn kind="ghost" onClick={() => setEditId(null)}>Cancel</Btn></div>
    </Card>);
    const holder = String(r.issued_to || "").trim();
    const occ = (r.occupants || []).filter(Boolean);
    return (<Card key={r.id} style={{ padding: 14 }}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, T.mode === "dark" ? 0.2 : 0.12), color: T.accent }}><KeyRound size={18} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-x-2 gap-y-1 flex-wrap">
            <span>{r.unit_number ? "Unit " + r.unit_number : "Common property"}</span>
            <span style={{ color: T.textMuted }}>·</span>
            <span>{r.descriptor || aiLabel(AI_TYPES, r.item_type)}</span>
            {r.identifier && <span style={{ color: T.textMuted }}>· #{r.identifier}</span>}
            {!r.descriptor && !r.legacy && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ background: hexToRgba(SEMANTIC.warn, 0.16), color: SEMANTIC.warn }}>unclassified</span>}
            {r.legacy && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: T.surfaceAlt, color: T.textMuted, border: `1px solid ${T.border}` }}>legacy register</span>}
          </div>
          <div className="text-xs mt-1" style={{ color: T.textMuted }}>
            {r.label ? r.label + " · " : ""}
            <span style={{ color: STC[r.status] || T.textMuted, fontWeight: 600 }}>{aiLabel(AI_STATUSES, r.status)}</span>
            {r.issued_at ? " · issued " + fmtDate(localDay(r.issued_at)) : ""}
            {r.suspended_reason ? " · " + r.suspended_reason : ""}
          </div>
          <div className="text-xs mt-1">
            {holder
              ? <span>Holder: <span className="font-medium">{holder}</span>{r.issued_to_role ? <span style={{ color: T.textMuted }}> ({aiLabel(AI_ROLES, r.issued_to_role)})</span> : null}{r.owner_authority ? <span style={{ color: SEMANTIC.ok }}> · owner authorised{r.owner_authority_by ? " by " + r.owner_authority_by : ""}</span> : null}</span>
              : <span style={{ color: SEMANTIC.warn, fontWeight: 600 }}>Holder not recorded</span>}
          </div>
          {!holder && occ.length > 0 && <div className="text-[11px] mt-1" style={{ color: T.textMuted }}>Recorded against the lot. Current occupants: {occ.join(", ")} — not a record of who holds it.</div>}
          <div className="text-[11px] mt-1.5 flex items-center gap-2 flex-wrap">
            {r.receipt_path
              ? <button onClick={() => openReceipt(r)} className="inline-flex items-center gap-1 font-semibold" style={{ color: T.accent }}><Paperclip size={12} /> Signed receipt</button>
              : <span style={{ color: T.textMuted }}>No signed receipt on file</span>}
            {canEdit && !r.legacy && <label className="inline-flex items-center gap-1 cursor-pointer font-semibold" style={{ color: T.textMuted }}><Upload size={12} /> {r.receipt_path ? "Replace" : "Attach"}<input type="file" className="hidden" onChange={(e) => attachReceipt(r, e.target.files && e.target.files[0])} /></label>}
          </div>
          {r.notes && <div className="text-[11px] mt-1.5" style={{ color: T.textMuted }}>{r.notes}</div>}
        </div>
        {canEdit && !r.legacy && (<div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex gap-1.5">
            <Btn kind="ghost" onClick={() => startEdit(r)}><Pencil size={14} /></Btn>
            <Btn kind="ghost" onClick={() => remove(r)}><Trash2 size={14} /></Btn>
          </div>
          {r.status === "issued" && <div className="flex gap-1.5"><Btn kind="ghost" onClick={() => setStatus(r, "on_hand")}>On hand</Btn><Btn kind="ghost" onClick={() => setStatus(r, "returned")}>Returned</Btn></div>}
          {r.status === "on_hand" && <Btn kind="ghost" onClick={() => setStatus(r, "issued")}>Issue</Btn>}
          {r.status !== "suspended" && <Btn kind="ghost" onClick={() => suspend(r)}>Suspend</Btn>}
          {r.status === "suspended" && <Btn kind="ghost" onClick={() => setStatus(r, "on_hand")}>Reinstate</Btn>}
        </div>)}
      </div>
    </Card>);
  };

  // ---- audit view -----------------------------------------------------------
  const auditView = () => {
    const unitRows = auditRows.filter((a) => a.scope === "unit");
    const stockRows = auditRows.filter((a) => a.scope === "stock");
    const unclRows = auditRows.filter((a) => a.scope === "unclassified");
    // A row with no entitlement set is NOT a variance: there is nothing to vary
    // from, and the table already shows "—" for it. Counting those as variances
    // made the demo read "28 variances" over a table showing none, which is the
    // same misleading-counter bug as v0.32.1. A count beside a table has to
    // describe that table.
    const withEnt = unitRows.filter((a) => a.entitlement > 0);
    const variances = withEnt.filter((a) => a.variance !== 0);
    const noEnt = unitRows.length - withEnt.length;
    const unclTotal = unclRows.reduce((n, a) => n + a.issued + a.on_hand + a.suspended + a.returned, 0);
    const cell = { padding: "6px 8px", fontSize: 12, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" };
    const head = { ...cell, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", fontSize: 10 };
    const table = (title, list, showUnit) => list.length === 0 ? null : (
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div className="px-4 py-3 font-semibold text-sm" style={{ borderBottom: `1px solid ${T.border}` }}>{title}</div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{(showUnit ? ["Unit"] : []).concat(["Descriptor", "Entitled", "Issued", "On hand", "Held", "Suspended", "Variance"]).map((h) => <th key={h} style={{ ...head, textAlign: h === "Descriptor" || h === "Unit" ? "left" : "right" }}>{h}</th>)}</tr></thead>
          <tbody>{list.map((a, i) => (<tr key={i}>
            {showUnit && <td style={cell}>{a.unit_number || "—"}</td>}
            <td style={cell}>{a.descriptor}</td>
            <td style={{ ...cell, textAlign: "right" }}>{a.entitlement || "—"}</td>
            <td style={{ ...cell, textAlign: "right" }}>{a.issued}</td>
            <td style={{ ...cell, textAlign: "right" }}>{a.on_hand}</td>
            <td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{a.held}</td>
            <td style={{ ...cell, textAlign: "right", color: a.suspended ? SEMANTIC.bad : T.textMuted }}>{a.suspended || "—"}</td>
            <td style={{ ...cell, textAlign: "right", fontWeight: 700, color: a.variance === 0 ? SEMANTIC.ok : SEMANTIC.bad }}>{a.entitlement ? (a.variance > 0 ? "+" + a.variance : a.variance) : "—"}</td>
          </tr>))}</tbody>
        </table></div>
      </Card>);
    return (<>
      <HowTo id="keyaudit" steps={["Check each unit's Held against its Entitled. A variance is a discrepancy to chase.", "Count the fobs and remotes physically on hand and compare with the Stock table.", "⟨Download the audit⟩ gives you the whole thing as a spreadsheet to sign off."]} sell="The annual key audit as a single reconciliation, instead of a clipboard and a filing cabinet." />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["Units reconciled", new Set(withEnt.map((a) => a.unit_number)).size, false],
          ["Variances", variances.length, true],
          ["No entitlement set", noEnt, true],
          ["Not yet classified", unclTotal, true]].map(([l, v, warn]) => (
          <Card key={l} style={{ padding: 14 }}><div className="text-2xl font-bold" style={{ color: warn && v > 0 ? SEMANTIC.warn : T.text }}>{v}</div><div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>{l}</div></Card>))}
      </div>
      {noEnt > 0 && (<Card style={{ padding: 14, background: hexToRgba(SEMANTIC.warn, 0.08), border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.35)}` }}>
        <div className="text-sm flex items-start gap-2">
          <AlertTriangle size={15} style={{ color: SEMANTIC.warn, marginTop: 2, flexShrink: 0 }} />
          <span><span className="font-semibold">{noEnt} unit and descriptor combinations have devices but no entitlement.</span> Nothing says how many that unit is supposed to hold, so those rows show a count but cannot be reconciled. Set the numbers on the Entitlements tab, or load them all at once from the committee's own sheet.</span>
        </div>
      </Card>)}
      {unclTotal > 0 && (<Card style={{ padding: 14, background: hexToRgba(SEMANTIC.warn, 0.08), border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.35)}` }}>
        <div className="text-sm flex items-start gap-2">
          <AlertTriangle size={15} style={{ color: SEMANTIC.warn, marginTop: 2, flexShrink: 0 }} />
          <span><span className="font-semibold">{unclTotal} devices have no descriptor yet.</span> They are counted below but cannot be reconciled against an entitlement until each one is identified. Use ⟨Classify from CSV⟩ on the Register tab once the building manager confirms which key number is which.</span>
        </div>
      </Card>)}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={exportAudit} style={csvBtn}><Download size={14} /> Download the audit</button>
      </div>
      {auditRows.length === 0 ? <Empty icon={ClipboardCheck} title="Nothing to audit yet" hint="Set entitlements and classify the devices, and the reconciliation appears here." />
        : <>{table("By unit", unitRows, true)}{table("Building stock on hand", stockRows, false)}{table("Not yet classified", unclRows, true)}</>}
    </>);
  };

  // ---- entitlements view ----------------------------------------------------
  const entView = () => {
    const uid = unitIdFor(entUnit);
    const entFor = (did) => { const e = ents.find((x) => x.unit_id === uid && x.descriptor_id === did); return e ? e.entitlement : 0; };
    const save = async (did, val) => {
      if (!uid) return;
      try { await setAccessEntitlement(buildingId, uid, did, val); await load(); }
      catch (e) { flash("Couldn't save that entitlement."); }
    };
    return (<>
      <HowTo id="keyents" steps={["Pick a unit, then set how many of each descriptor it is entitled to hold.", "Or load every unit at once with ⟨Upload entitlements⟩ using the CSV template.", "The audit compares these numbers against what is actually issued and on hand."]} sell="The entitlement is the reference the whole audit reconciles against, so it is worth setting once, properly." />
      <Card style={{ padding: 14, background: T.surfaceAlt }}>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => downloadCSV("nalohub-entitlements-template.csv", toCSV(KF_ENT_HEADERS, units.slice(0, 3).flatMap((u) => descriptors.slice(0, 3).map((d) => ({ unit: u.unit_number, descriptor: d.name, entitlement: 1 })))))} style={csvBtn}><Download size={14} /> CSV template</button>
          {canEdit && <label style={csvBtn}><Upload size={14} /> Upload entitlements<input type="file" accept=".csv,text/csv" onChange={onEntCsv} className="hidden" /></label>}
          <span style={{ color: T.textMuted, fontSize: 11 }}>Columns: {KF_ENT_HEADERS.join(", ")}</span>
        </div>
        <div className="text-xs mt-2" style={{ color: T.textMuted }}>{ents.length} entitlement{ents.length === 1 ? "" : "s"} recorded across {new Set(ents.map((e) => e.unit_id)).size} unit{new Set(ents.map((e) => e.unit_id)).size === 1 ? "" : "s"}.</div>
      </Card>
      <Card style={{ padding: 14 }}>
        <Field label="Unit"><Select value={entUnit} onChange={(e) => setEntUnit(e.target.value)}><option value="">— pick a unit —</option>{units.map((u) => <option key={u.id} value={u.unit_number}>{u.unit_number}</option>)}</Select></Field>
      </Card>
      {uid && <Card style={{ padding: 0, overflow: "hidden" }}>
        {descriptors.map((d) => (<div key={d.id} className="px-4 py-2.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex-1 text-sm">{d.name}</div>
          <input type="number" min="0" defaultValue={entFor(d.id)} disabled={!canEdit}
            onBlur={(e) => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== entFor(d.id)) save(d.id, v); }}
            style={{ width: 84, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }}
            className="rounded-lg px-2.5 py-1.5 text-sm text-right outline-none" />
        </div>))}
      </Card>}
    </>);
  };

  // ---- descriptor catalogue -------------------------------------------------
  const descView = () => (<>
    <HowTo id="keydesc" steps={["These are your building's own names for its keys, fobs and remotes.", "⟨Add⟩ a descriptor for anything missing, for example another fire stairs level.", "Retire one you no longer use; it is kept, not deleted, so existing devices keep their history."]} sell="Every building names its keys differently. This list is yours, not a fixed set someone else chose." />
    {canEdit && (dEdit === "new" || dEdit ? (
      <Card style={{ padding: 18 }}>
        <DescriptorForm v={df} setV={setDf} />
        <div className="flex gap-2 mt-3">
          <Btn grad onClick={async () => {
            if (!String(df.name).trim()) { flash("Give it a name."); return; }
            try { await saveAccessDescriptor(buildingId, df); setDEdit(null); setDf(blankDesc()); flash("Descriptor saved"); await load(); }
            catch (e) { flash("Couldn't save that. Is the name already used?"); }
          }}>Save</Btn>
          <Btn kind="ghost" onClick={() => { setDEdit(null); setDf(blankDesc()); }}>Cancel</Btn>
        </div>
      </Card>
    ) : <div><Btn grad onClick={() => { setDEdit("new"); setDf(blankDesc()); }}><Plus size={15} /> Add a descriptor</Btn></div>)}
    {descriptors.length === 0 ? <Empty icon={Tag} title="No descriptors yet" hint="Add the names your building uses for its keys, fobs and remotes." />
      : <Card style={{ padding: 0, overflow: "hidden" }}>{descriptors.map((d) => (
        <div key={d.id} className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{d.name}</div>
            <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
              {aiLabel(AI_TYPES, d.item_type)} · {aiLabel(AI_PURPOSES, d.purpose)}{d.stock_tracked ? " · stock counted" : ""}
              {" · "}{all.filter((r) => r.descriptor_id === d.id).length} on the register
            </div>
          </div>
          {canEdit && <div className="flex gap-1.5 shrink-0">
            <Btn kind="ghost" onClick={() => { setDEdit(d.id); setDf({ ...d }); }}><Pencil size={14} /></Btn>
            <Btn kind="ghost" onClick={async () => { try { await setAccessDescriptorActive(buildingId, d.id, false); flash("Retired"); await load(); } catch (e) { flash("Couldn't retire that."); } }}>Retire</Btn>
          </div>}
        </div>))}</Card>}
  </>);

  // ---- register view --------------------------------------------------------
  const registerView = () => (<>
    <HowTo id="keyfobs" steps={["Type a unit number, a resident's name or a key number — one box searches all three.", "Narrow with the status chips or the descriptor menu.", "⟨Add⟩ records a device; leave the unit blank for a building key. ⟨Classify from CSV⟩ sets descriptors in bulk."]} sell="Who holds what, across every lot and the common areas, with the gaps showing instead of hiding." />
    <Card style={{ padding: 14 }}>
      <div className="flex items-center gap-2"><Search size={15} style={{ color: T.textMuted, flexShrink: 0 }} /><Input placeholder="Unit, name or key number…" value={q} onChange={(e) => setQ(e.target.value)} />{q && <Btn kind="ghost" onClick={() => setQ("")}><X size={14} /></Btn>}</div>
    </Card>
    {filtering && (<Card style={{ padding: 12, background: hexToRgba(T.accent, 0.08), border: `1px solid ${hexToRgba(T.accent, 0.35)}` }}>
      <div className="text-sm flex items-center gap-2 flex-wrap">
        <Search size={14} style={{ color: T.accent, flexShrink: 0 }} />
        <span><span className="font-semibold">{counts.total} of {counts.registerTotal}</span> {counts.total === 1 ? "device" : "devices"}{" "}
          {q.trim() ? <>matching <span className="font-semibold">{q.trim()}</span></> : "matching these filters"}</span>
        <button onClick={clearAll} className="text-xs font-semibold underline" style={{ color: T.accent }}>Clear</button>
      </div>
    </Card>)}
    <div className="grid grid-cols-3 gap-3">
      {[[filtering ? "Devices found" : "Devices", counts.total], ["Units covered", counts.units], ["No holder recorded", counts.noHolder]].map(([l, v]) => (
        <Card key={l} style={{ padding: 14 }}><div className="text-2xl font-bold">{v}</div><div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>{l}</div></Card>))}
    </div>
    {!filtering && counts.unclassified > 0 && (<Card style={{ padding: 14, background: hexToRgba(SEMANTIC.warn, 0.08), border: `1px solid ${hexToRgba(SEMANTIC.warn, 0.35)}` }}>
      <div className="text-sm flex items-start gap-2">
        <AlertTriangle size={15} style={{ color: SEMANTIC.warn, marginTop: 2, flexShrink: 0 }} />
        <span><span className="font-semibold">{counts.unclassified} devices have no descriptor.</span> They came across as one undifferentiated batch, so nothing says which is a fire stairs key and which is a unit door key. Until they are classified the audit cannot reconcile them against an entitlement.</span>
      </div>
    </Card>)}
    <Card style={{ padding: 14, background: T.surfaceAlt }}>
      <p style={{ color: T.textMuted }} className="text-sm flex items-center gap-2 mb-3"><Lock size={14} /> Visible to the committee only — residents can't see this page.</p>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={exportRegister} style={csvBtn}><Download size={14} /> Download register</button>
        {canEdit && <button type="button" onClick={() => downloadCSV("nalohub-classify-template.csv", toCSV(KF_CLASSIFY_HEADERS, all.filter((r) => !r.descriptor_id && !r.legacy).slice(0, 500).map((r) => ({ identifier: r.identifier || "", descriptor: "" }))))} style={csvBtn}><Download size={14} /> Classify template</button>}
        {canEdit && <label style={csvBtn}><Upload size={14} /> Classify from CSV<input type="file" accept=".csv,text/csv" onChange={onClassifyCsv} className="hidden" /></label>}
        <span style={{ color: T.textMuted, fontSize: 11 }}>Columns: {KF_CLASSIFY_HEADERS.join(", ")}</span>
      </div>
    </Card>
    {adding && canEdit && (<Card style={{ padding: 18 }}>
      <AccessItemForm v={f} setV={setF} units={units} descriptors={descriptors} />
      <div className="flex gap-2 mt-3"><Btn grad onClick={add}>Add device</Btn><Btn kind="ghost" onClick={() => { setAdding(false); setF(blankAI()); }}>Cancel</Btn></div>
    </Card>)}
    <div className="flex gap-2 flex-wrap">
      {chip("s-all", fStatus === "all", "All " + counts.total, () => setFStatus("all"))}
      {AI_STATUSES.filter(([k]) => counts[k] > 0 || ["issued", "on_hand", "suspended"].includes(k)).map(([k, l]) => chip("s-" + k, fStatus === k, l + " " + (counts[k] || 0), () => setFStatus(k)))}
    </div>
    <Select value={fDesc} onChange={(e) => setFDesc(e.target.value)}>
      <option value="all">All descriptors</option>
      <option value="none">Not yet classified</option>
      {descriptors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </Select>
    {busy ? <Card style={{ padding: 24 }}><div className="text-sm" style={{ color: T.textMuted }}>Loading the register…</div></Card>
      : shown.length === 0
        ? <>
            <Empty icon={KeyRound} title={all.length ? "Nothing matches that search" : "Nothing here yet"} hint={all.length ? "Try a unit number, a resident's name or a key number." : "Add a device, or upload the building manager's register as a CSV."} />
            {filtering && <div className="text-center"><Btn kind="ghost" onClick={clearAll}>Clear the search</Btn></div>}
          </>
        : <>{shown.map(row)}{shown.length < all.length && <div className="text-xs text-center pt-1" style={{ color: T.textMuted }}>Showing {shown.length} of {all.length}</div>}</>}
  </>);

  return (<div>
    <Head title="Key & Fob Register" sub="Every access device in the building, what each unit is entitled to, and the annual audit"
      action={canEdit && tab === "register" ? <HeaderAction onClick={() => setAdding(true)} data-guide="keyfob-add"><Plus size={16} /> Add</HeaderAction> : null} />
    <Wrap>
      <div className="flex gap-2 flex-wrap">
        {tabBtn("register", "Register")}
        {tabBtn("entitlements", "Entitlements")}
        {tabBtn("audit", "Audit")}
        {tabBtn("descriptors", "Descriptors")}
      </div>
      {tab === "register" && registerView()}
      {tab === "entitlements" && entView()}
      {tab === "audit" && auditView()}
      {tab === "descriptors" && descView()}
    </Wrap>
  </div>);
}

function FireSafety() {
  const { T, store, update, building, user, flash } = useApp();
  const canEdit = isCommittee(user.role);
  const [c, setC] = useState({ label: "", number: "" });
  const std = [
    { label: "Emergency — Police, Fire, Ambulance", number: "000" },
    { label: "Emergency from a mobile", number: "112" },
    { label: "Text emergency (hearing / speech impaired)", number: "106" },
    { label: "SES — storm & flood", number: "132 500" },
    { label: "Poisons Information", number: "13 11 26" },
    { label: "13 HEALTH", number: "13 43 25 84" },
  ];
  const custom = building.emergency || [];
  const addC = () => { if (!c.label.trim() || !c.number.trim()) return; update((s) => { const b = s.buildings.find((x) => x.id === building.id); b.emergency = b.emergency || []; b.emergency.push({ label: c.label.trim(), number: c.number.trim() }); }); setC({ label: "", number: "" }); flash("Contact added"); };
  const rmC = (i) => update((s) => { s.buildings.find((x) => x.id === building.id).emergency.splice(i, 1); });
  return (<div><Head title="Fire Safety" sub="Evacuation plan, emergency contacts & references" /><Wrap>
    <Card style={{ padding: 18, borderLeft: `4px solid ${SEMANTIC.bad}` }}>
      <div className="flex items-center gap-2 mb-2"><ShieldAlert size={18} style={{ color: SEMANTIC.bad }} /><div className="font-semibold text-[17px]">Evacuation plan</div></div>
      {building.evacPlan ? (<>
        <p style={{ color: T.textMuted }} className="text-sm mb-3">Your building's emergency evacuation diagram and procedure. Know your nearest exit and assembly area before you need them.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <a href={building.evacPlan.data} download={building.evacPlan.name} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[15px] font-semibold" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: T.accentText }}><Download size={16} /> View / download evacuation plan</a>
          <span style={{ color: T.textMuted }} className="text-xs">{building.evacPlan.name}</span>
          {canEdit && <button onClick={() => update((s) => { delete s.buildings.find((b) => b.id === building.id).evacPlan; })} style={{ color: SEMANTIC.bad }} className="text-xs">Remove</button>}
        </div>
        {/^data:image\//.test(building.evacPlan.data || "") && <img src={building.evacPlan.data} alt="Evacuation plan" className="mt-3 rounded-xl w-full" style={{ border: `1px solid ${T.border}` }} />}
      </>) : (<p style={{ color: T.textMuted }} className="text-sm">{canEdit ? "No evacuation plan uploaded yet — add your building's evacuation diagram so every resident can find it here." : "No evacuation plan uploaded yet. Ask your committee to add the building's evacuation diagram."}</p>)}
      {canEdit && <div className="mt-3"><label style={{ borderColor: T.border, color: T.textMuted }} className="inline-flex items-center gap-2 border-2 border-dashed rounded-xl py-2.5 px-3 text-sm cursor-pointer"><Upload size={15} /> {building.evacPlan ? "Replace plan" : "Upload evacuation plan (PDF or image)"}<input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readUpload(file, (data) => { update((s) => { s.buildings.find((b) => b.id === building.id).evacPlan = { name: file.name, type: file.type, data }; }); flash("Evacuation plan uploaded"); }, flash); }} /></label></div>}
    </Card>
    <Card style={{ padding: 18 }}><SectionTitle>Emergency contacts</SectionTitle>
      {std.map((x, i) => (<div key={i} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}><span className="text-sm">{x.label}</span><a href={`tel:${x.number.replace(/\s/g, "")}`} className="font-bold" style={{ color: T.accent }}>{x.number}</a></div>))}
      {building.buildingManager && <div className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}><span className="text-sm">Building manager — {building.buildingManager}</span><span style={{ color: T.textMuted }} className="text-xs">on site</span></div>}
      {custom.map((x, i) => (<div key={i} className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${T.border}` }}><span className="text-sm">{x.label}</span><div className="flex items-center gap-2"><a href={`tel:${x.number.replace(/\s/g, "")}`} className="font-bold" style={{ color: T.accent }}>{x.number}</a>{canEdit && <button onClick={() => rmC(i)} style={{ color: T.textMuted }}><X size={13} /></button>}</div></div>))}
      {canEdit && (<div className="mt-3 space-y-2"><div className="grid grid-cols-2 gap-2"><Input value={c.label} onChange={(e) => setC({ ...c, label: e.target.value })} placeholder="Label" /><Input value={c.number} onChange={(e) => setC({ ...c, number: e.target.value })} placeholder="Number" /></div><Btn grad onClick={addC}><Plus size={15} /> Add contact</Btn></div>)}
    </Card>
    <Card style={{ padding: 18 }}><div className="flex items-center gap-2 mb-2"><Flame size={18} style={{ color: SEMANTIC.bad }} /><div className="font-semibold">Queensland smoke alarm law</div></div>
      <ul className="space-y-2 text-sm" style={{ color: T.text }}>
        <li>• All Queensland homes, townhouses and units must have <b>interconnected photoelectric smoke alarms</b> by <b>1 January 2027</b> (already required for properties sold or leased since 1 January 2022).</li>
        <li>• Alarms must be photoelectric — ionisation alarms are no longer permitted — comply with <b>AS 3786-2014</b>, be under 10 years old, and interconnected so when one sounds, they all sound.</li>
        <li>• Required in every bedroom, in hallways connecting bedrooms, and on every storey.</li>
        <li>• The law applies to both houses/townhouses (class 1a) and units/apartments (class 2).</li>
      </ul>
      <div style={{ color: T.textMuted }} className="text-xs mt-3">Source: Queensland Fire Department (fire.qld.gov.au) and qld.gov.au — general information only. Confirm your building's obligations with your strata manager or a licensed installer.</div>
      <div className="flex gap-2 mt-3 flex-wrap"><Btn kind="ghost" onClick={() => openExternal("https://www.fire.qld.gov.au/prepare/fire/smoke-alarms")}><ExternalLink size={14} /> QFD smoke alarms</Btn><Btn kind="ghost" onClick={() => openExternal("https://www.qld.gov.au/emergency/safety/fire/smoke-alarms")}><ExternalLink size={14} /> qld.gov.au</Btn></div>
    </Card>
    <Card style={{ padding: 18 }}><SectionTitle>In an emergency</SectionTitle>
      <ul className="space-y-2 text-sm">
        <li>• If there's fire or smoke, get out and stay out — call <b>000</b> from a safe place.</li>
        <li>• Use the stairs, never the lifts. Follow the exit signs to your assembly area.</li>
        <li>• Close doors behind you to slow the spread; don't stop to collect belongings.</li>
        <li>• If you can't get out, stay low, seal door gaps with wet towels and signal from a window.</li>
      </ul>
      <div style={{ color: T.textMuted }} className="text-xs mt-3">The building's full evacuation plan is shown at the top of this page.</div>
    </Card>
  </Wrap></div>);
}

// ---------- business directory ----------------------------------------------
function BusinessDirectory() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const list = store.businesses.filter((b) => b.buildingId === buildingId);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [cat, setCat] = useState("All");
  const [f, setF] = useState({ name: "", category: BUSINESS_CATEGORIES[0], phone: "", contact: "", desc: "" });
  const [note, setNote] = useState("");
  const add = () => { if (!f.name.trim()) return; update((s) => s.businesses.unshift({ id: "biz" + Math.random().toString(36).slice(2, 6), buildingId, ...f, addedBy: user.name, recommendations: [] })); setF({ name: "", category: BUSINESS_CATEGORIES[0], phone: "", contact: "", desc: "" }); setAdding(false); flash("Business added"); };
  const toggleRec = (id, withNote) => update((s) => { const b = s.businesses.find((x) => x.id === id); const mine = b.recommendations.find((r) => r.by === user.name); if (mine) b.recommendations = b.recommendations.filter((r) => r.by !== user.name); else b.recommendations.push({ by: user.name, note: withNote || "" }); });

  if (open) {
    const b = store.businesses.find((x) => x.id === open); if (!b) { setOpen(null); return null; }
    const recommended = b.recommendations.some((r) => r.by === user.name);
    return (<div><Head title="Business" onBack={() => setOpen(null)} backLabel="Directory" /><Wrap>
      <Card style={{ padding: 24 }}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{b.name}</h2><div className="mt-1"><Badge color={T.accent}>{b.category}</Badge></div></div><div className="text-right"><div className="text-lg font-bold" style={{ color: b.recommendations.length ? SEMANTIC.ok : T.textMuted }}>{b.recommendations.length}</div><div style={{ color: T.textMuted }} className="text-[11px]">recommend</div></div></div>
        {b.desc && <p className="text-sm mt-3">{b.desc}</p>}
        <div className="flex flex-wrap gap-2 mt-4">{b.phone && <Btn grad onClick={() => openExternal(`tel:${b.phone.replace(/\s/g, "")}`)}><Phone size={15} /> {b.phone}</Btn>}{b.contact && <Btn kind="soft" onClick={() => openExternal(b.contact.includes("@") ? `mailto:${b.contact}` : `https://${b.contact.replace(/^https?:\/\//, "")}`)}>{b.contact.includes("@") ? <Mail size={15} /> : <ExternalLink size={15} />} {b.contact}</Btn>}</div>
        <div style={{ color: T.textMuted }} className="text-xs mt-3">Added by {b.addedBy}</div>
        <div className="mt-5" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <SectionTitle>Resident recommendations</SectionTitle>
          {b.recommendations.length === 0 && <p style={{ color: T.textMuted }} className="text-sm mb-2">No recommendations yet — be the first.</p>}
          <div className="space-y-2 mb-3">{b.recommendations.map((r, i) => (<div key={i} className="rounded-xl p-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><div className="text-sm font-medium flex items-center gap-1.5"><ThumbsUp size={13} style={{ color: SEMANTIC.ok }} /> {r.by}{r.by === user.name ? " (you)" : ""}</div>{r.note && <p style={{ color: T.textMuted }} className="text-sm mt-1">{r.note}</p>}</div>))}</div>
          {recommended ? <Btn kind="ghost" onClick={() => toggleRec(b.id)}><X size={15} /> Remove my recommendation</Btn> : (<div className="space-y-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" /><Btn grad onClick={() => { toggleRec(b.id, note); setNote(""); }}><ThumbsUp size={15} /> Recommend</Btn></div>)}
        </div>
      </Card>
    </Wrap></div>);
  }
  const cats = ["All", ...Array.from(new Set(list.map((b) => b.category)))];
  const filtered = cat === "All" ? list : list.filter((b) => b.category === cat);
  return (<div><Head title="Business Directory" sub="Trusted local services, recommended by residents" action={<HeaderAction onClick={() => setAdding(true)}><Plus size={16} /> Add</HeaderAction>} /><Wrap>
    {adding && (<Card style={{ padding: 18 }}><div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Business name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{BUSINESS_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field><Field label="Email or website"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="name@seahaven.com.au" /></Field></div>
      <Field label="Note (optional)"><TextArea rows={2} value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="Why you'd recommend them" /></Field>
      <div className="flex gap-2"><Btn grad onClick={add}>Add business</Btn><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn></div>
    </div></Card>)}
    <div className="flex gap-2 flex-wrap">{cats.map((c) => { const on = cat === c; return <button key={c} onClick={() => setCat(c)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: on ? T.accent : T.surface, color: on ? T.accentText : T.textMuted, border: `1px solid ${on ? "transparent" : T.border}` }}>{c}</button>; })}</div>
    {filtered.length === 0 && <Empty icon={Store} title="No businesses yet" hint="Add a trusted local service for your neighbours." />}
    {filtered.map((b) => (<button key={b.id} onClick={() => setOpen(b.id)} className="w-full text-left"><Card hover style={{ padding: 14 }}><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl grid place-items-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${HUE.directory[0]}, ${HUE.directory[1]})` }}><Store size={18} /></div><div className="flex-1 min-w-0"><div className="font-semibold truncate">{b.name}</div><div style={{ color: T.textMuted }} className="text-xs">{b.category}{b.phone ? ` · ${b.phone}` : ""}</div></div><div className="flex items-center gap-1" style={{ color: b.recommendations.length ? SEMANTIC.ok : T.textMuted }}><ThumbsUp size={14} /> <span className="text-sm font-bold">{b.recommendations.length}</span></div><ChevronRight size={16} style={{ color: T.textMuted }} /></div></Card></button>))}
  </Wrap></div>);
}

// ---------- settings --------------------------------------------------------
// The building's single public inbound address, for the committee to advertise.
function BuildingInboxCard() {
  const { T, building, buildingId, backend, user, flash } = useApp();
  const canSee = isCommittee(user.role) || user.role === "manager";
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const demoAddr = useMemo(() => (building.name || "building").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) + "@send.nalohub.com", [building.name]);
  useEffect(() => {
    let live = true;
    if (!backend) { setAddr(demoAddr); return; }
    setBusy(true);
    ensureBuildingMailbox(buildingId).then((r) => { if (live) setAddr((r && r.address) || ""); }).catch(() => {}).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [buildingId, backend, demoAddr]);
  if (!canSee) return null;
  const copy = () => { try { navigator.clipboard.writeText(addr); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) { flash("Copy failed — select the address and copy it manually"); } };
  return (
    <Card style={{ padding: 18 }}>
      <SectionTitle>Building email address</SectionTitle>
      <p style={{ color: T.textMuted }} className="text-sm mb-3">Share this one address so residents, contractors, agents or your strata manager can email your building directly — everything sent here arrives in <b>Correspondence</b> (a new sender drops into the Unfiled tray for one-tap filing). No personal inbox required, and it's the same address for the whole committee.</p>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="px-3 py-2 rounded-xl text-sm font-semibold" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }}>{busy ? "…" : (addr || "—")}</code>
        {addr && <Btn kind="soft" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Paperclip size={14} /> Copy</>}</Btn>}
      </div>
      {!backend
        ? <div className="text-[11px] mt-2" style={{ color: T.textMuted }}>Demo preview — a real, unique address is provisioned per building in the live app.</div>
        : <div className="text-[11px] mt-2" style={{ color: T.textMuted }}>Goes live once inbound email is enabled for send.nalohub.com. Replies to messages you send from Correspondence already thread back here automatically.</div>}
    </Card>
  );
}
function SettingsView() {
  const { T, store, update, building, buildingId, user, flash, backend, platformAdmin } = useApp();
  const canEdit = isCommittee(user.role);
  const [myCeleb, setMyCeleb] = useState(() => celebPref(user.id));
  const setB = (k, v) => update((s) => { s.buildings.find((b) => b.id === building.id)[k] = v; });
  const [r, setR] = useState({ name: "", unit: "", email: "", phone: "", role: "owner", msc: false });
  const [rbulk, setRbulk] = useState("");
  const residents = store.users.filter((u) => u.buildingId === buildingId && u.status === "active");
  const importResidents = () => { const rows = rbulk.split("\n").map((l) => l.trim()).filter(Boolean); if (!rows.length) return; update((s) => rows.forEach((l) => { const [name, unit, role, email, phone] = l.split(",").map((x) => (x || "").trim()); if (!name) return; s.users.push({ id: "u" + Math.random().toString(36).slice(2, 8), buildingId, name, unit: unit || "", role: (() => { const x = (role || "").toLowerCase(); return x.startsWith("t") ? "tenant" : (x.startsWith("b") || x.includes("committee")) ? "bcc" : x.startsWith("m") ? "manager" : x.startsWith("s") ? "strata" : "owner"; })(), status: "active", email: email || "", phone: phone || "", directoryOptIn: false, showPhone: false, showEmail: false, msc: false, lastSeenGallery: nowISO() }); })); setRbulk(""); flash(`${rows.length} resident(s) imported`); };
  const addResident = () => { if (!r.name.trim()) return; update((s) => s.users.push({ id: "u" + Math.random().toString(36).slice(2, 6), buildingId, name: r.name.trim(), unit: r.unit.trim(), email: r.email.trim(), phone: r.phone.trim(), role: r.role, msc: r.msc, status: "active", directoryOptIn: false, showPhone: false, showEmail: false, lastSeenGallery: nowISO() })); setR({ name: "", unit: "", email: "", phone: "", role: "owner", msc: false }); flash("Person added"); };
  return (
    <div>
      <Head title="Settings" sub={building.name} />
      <Wrap>
        <Card style={{ padding: 18 }}><SectionTitle>Logo</SectionTitle><div className="flex items-center gap-3">{building.logoImage ? <img src={building.logoImage} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="h-14 w-14 rounded-xl grid place-items-center font-black" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: T.accentText }}>{building.logoText}</div>}<label style={{ borderColor: T.border, color: T.text }} className="border rounded-xl px-3 py-2 text-sm cursor-pointer inline-flex items-center gap-2"><Upload size={15} /> Upload image<input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, (d) => update((s) => { s.buildings.find((b) => b.id === building.id).logoImage = d; }), flash, { maxDim: LOGO_MAX_DIM, keepAlpha: true }); }} /></label>{building.logoImage && <button onClick={() => update((s) => { s.buildings.find((b) => b.id === building.id).logoImage = ""; })} style={{ color: T.textMuted }} className="text-xs underline">Use initials</button>}</div></Card>
        <Card style={{ padding: 18 }}><SectionTitle>Appearance</SectionTitle><ThemeGrid value={building.themeId} onChange={(id) => update((s) => { s.buildings.find((b) => b.id === building.id).themeId = id; })} /></Card>
        <Card style={{ padding: 18 }}><SectionTitle>Building Details</SectionTitle>
          {canEdit ? (<div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3"><Field label="Building name"><Input value={building.name} onChange={(e) => setB("name", e.target.value)} /></Field><Field label="Tower / building description"><Input value={building.towerDesc || ""} onChange={(e) => setB("towerDesc", e.target.value)} placeholder="e.g. East Tower / Building 2" /></Field></div>
            <Field label="Type"><Input value={building.type} onChange={(e) => setB("type", e.target.value)} /></Field>
            <Field label="Address"><Input value={building.address} onChange={(e) => setB("address", e.target.value)} /></Field>
            <Field label="Scheme / plan reference"><Input value={building.schemeRef || ""} onChange={(e) => setB("schemeRef", e.target.value)} placeholder="e.g. CTS 12345 (QLD) · SP 45678 (NSW) · OC/PS (VIC)" /></Field>
            <div className="grid grid-cols-3 gap-3"><Field label="Units"><Input type="number" value={building.units} onChange={(e) => setB("units", Number(e.target.value) || 0)} /></Field><Field label="Floors"><Input type="number" value={building.floors} onChange={(e) => setB("floors", Number(e.target.value) || 0)} /></Field><Field label="Towers"><Input type="number" value={building.towers} onChange={(e) => setB("towers", Number(e.target.value) || 0)} /></Field></div>
            <div className="grid sm:grid-cols-2 gap-3"><Field label="Committee (BCC) email"><Input value={building.bccEmail || ""} onChange={(e) => setB("bccEmail", e.target.value)} placeholder="committee@yourbuilding.org" /></Field><Field label="Building manager"><Input value={building.buildingManager || ""} onChange={(e) => setB("buildingManager", e.target.value)} /></Field></div>
          </div>) : (<div className="space-y-1.5 text-sm"><Row label="Name" value={building.name} />{building.towerDesc && <Row label="Tower / building" value={building.towerDesc} />}<Row label="Type" value={building.type} /><Row label="Address" value={building.address || "—"} />{building.schemeRef && <Row label="Scheme / plan" value={building.schemeRef} />}<Row label="Units" value={`${building.units} · ${building.floors} floors · ${building.towers} tower(s)`} /><Row label="Committee email" value={building.bccEmail || "—"} /><Row label="Building manager" value={building.buildingManager || "—"} /></div>)}
          {!canEdit && <p style={{ color: T.textMuted }} className="text-xs mt-3 flex items-center gap-1.5"><Lock size={12} /> Only the committee can change building details.</p>}
        </Card>
        <BuildingInboxCard />
        <Card style={{ padding: 18 }}><SectionTitle>Strata Management</SectionTitle>
          {canEdit ? (<div className="space-y-3">
            <Field label="Management firm"><Input value={building.strataManager || ""} onChange={(e) => setB("strataManager", e.target.value)} placeholder="e.g. Definitive Strata Co." /></Field>
            <div className="grid sm:grid-cols-3 gap-3"><Field label="Contact name"><Input value={building.strataContactName || ""} onChange={(e) => setB("strataContactName", e.target.value)} /></Field><Field label="Phone"><Input value={building.strataContactPhone || ""} onChange={(e) => setB("strataContactPhone", e.target.value)} /></Field><Field label="Email"><Input value={building.strataContactEmail || ""} onChange={(e) => setB("strataContactEmail", e.target.value)} /></Field></div>
            <p style={{ color: T.textMuted }} className="text-xs">Strata personnel who need to post formal notices can be added as a Strata manager under People &amp; Units above.</p>
          </div>) : (<div className="space-y-1.5 text-sm"><Row label="Firm" value={building.strataManager || "—"} /><Row label="Contact" value={building.strataContactName || "—"} />{building.strataContactPhone && <Row label="Phone" value={building.strataContactPhone} />}{building.strataContactEmail && <Row label="Email" value={building.strataContactEmail} />}</div>)}
        </Card>
        {canEdit && (<Card style={{ padding: 18 }}><SectionTitle right={<span style={{ color: T.textMuted }} className="text-[11px]">{residents.length} listed</span>}>People &amp; Units</SectionTitle>
          <p style={{ color: T.textMuted }} className="text-sm mb-3">Pre-load names against unit numbers. More than one name per unit is fine.</p>
          <div className="space-y-3"><div className="grid sm:grid-cols-2 gap-3"><Field label="Name"><Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field><Field label="Role"><Select value={r.role} onChange={(e) => setR({ ...r, role: e.target.value })}><option value="owner">Owner</option><option value="tenant">Tenant</option><option value="bcc">Committee (BCC)</option><option value="manager">Building manager</option><option value="strata">Strata manager</option></Select></Field></div><div className="grid sm:grid-cols-2 gap-3"><Field label="Unit (blank for strata / manager)"><Input value={r.unit} onChange={(e) => setR({ ...r, unit: e.target.value })} /></Field><Field label="Phone"><Input value={r.phone} onChange={(e) => setR({ ...r, phone: e.target.value })} placeholder="04xx xxx xxx" /></Field></div><Field label="Email"><Input value={r.email} onChange={(e) => setR({ ...r, email: e.target.value })} /></Field><Toggle label="Also on Maintenance Sub-Committee (MSC)" on={r.msc} onClick={() => setR({ ...r, msc: !r.msc })} small /><Btn grad onClick={addResident}><Plus size={15} /> Add person</Btn>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 4 }}><Field label="Bulk import — name, unit, role, email, phone (one per line)"><TextArea rows={3} value={rbulk} onChange={(e) => setRbulk(e.target.value)} placeholder={"Sandra Pho, 412, owner, sandra@seahaven.com.au, 0400 555 666"} /></Field><div className="mt-2"><Btn kind="soft" onClick={importResidents}><Upload size={15} /> Import residents</Btn></div></div></div>
        </Card>)}
        {canEdit && (<Card style={{ padding: 18 }}><SectionTitle>Community &amp; celebrations</SectionTitle>
          <p style={{ color: T.textMuted }} className="text-sm mb-3">How warm NaloHub is with residents — the welcome, badges, "aboard" meter and little thank-yous that help {building.name} feel like home.</p>
          <div className="grid grid-cols-3 gap-2">{[["full", "Full", "Welcome, badges, meter & celebrations"], ["gentle", "Gentle", "The layer stays; celebrations go quiet"], ["essentials", "Essentials", "Switch the welcome layer off"]].map(([v, l, d]) => { const on = communityMode(building) === v; return (<button key={v} onClick={() => setB("community", v)} className="rounded-xl px-3 py-2.5 text-left" style={{ background: on ? hexToRgba(T.accent, 0.14) : T.surfaceAlt, border: `1.5px solid ${on ? T.accent : T.border}` }}><div className="text-sm font-semibold" style={{ color: on ? T.accent : T.text }}>{l}</div><div style={{ color: T.textMuted }} className="text-[10.5px] mt-0.5 leading-snug">{d}</div></button>); })}</div>
          {communityMode(building) === "essentials" && <p className="text-xs mt-3 flex items-start gap-1.5" style={{ color: SEMANTIC.warn }}><AlertTriangle size={13} className="mt-0.5 shrink-0" /> Most communities leave this on — the welcome layer is what helps residents actually pick NaloHub up. Worth a conversation before switching it off.</p>}
        </Card>)}
        {canEdit && (<Card style={{ padding: 18 }}><SectionTitle>Features for this building</SectionTitle><p style={{ color: T.textMuted }} className="text-sm mb-3">Turn modules on or off for residents of {building.name}.</p><div className="space-y-2.5">{OPTIONAL_MODULES.concat("whatsapp").map((k) => { const on = building.modules ? building.modules[k] !== false : true; return (<Toggle key={k} label={MODULE_LABELS[k]} on={on} onClick={() => update((s) => { const b = s.buildings.find((x) => x.id === building.id); b.modules = b.modules || {}; b.modules[k] = !on; })} small />); })}</div></Card>)}
        {platformAdmin && backend && (<Card style={{ padding: 18 }}><SectionTitle>Nalo premium suite</SectionTitle><p style={{ color: T.textMuted }} className="text-sm mb-3">NaloPilot, By-Laws, Compliance Calendar and Dispute Records — switched on for buildings on the Professional plan. Platform admin only.</p><Toggle label={building.premiumSuite === true ? "Enabled for this building" : "Not enabled"} on={building.premiumSuite === true} onClick={() => setB("premiumSuite", building.premiumSuite === true ? false : true)} small /></Card>)}
        <Card style={{ padding: 18 }}><SectionTitle>Your celebrations</SectionTitle>
          <p style={{ color: T.textMuted }} className="text-sm mb-3">Your own dial for badges and cheerful messages — entirely up to you.</p>
          <div className="grid grid-cols-3 gap-2">{[["on", "On"], ["gentle", "Gentle"], ["off", "Off"]].map(([v, l]) => { const on = myCeleb === v; return (<button key={v} onClick={() => { setMyCeleb(v); try { localStorage.setItem(celebKey(user.id), v); } catch (e) {} }} className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: on ? hexToRgba(T.accent, 0.14) : T.surfaceAlt, border: `1.5px solid ${on ? T.accent : T.border}`, color: on ? T.accent : T.text }}>{l}</button>); })}</div>
        </Card>
        <ProvenanceCard />
        <BMRegistryCard />
        <DataExportCard />
        {canEdit && (<Card style={{ padding: 18 }}><SectionTitle>Menu labels</SectionTitle><p style={{ color: T.textMuted }} className="text-sm mb-3">Rename sidebar sections to suit your building (e.g. “Business Directory” → “Support Local”). Leave blank for the default.</p><div className="space-y-3">{RENAMABLE.map((k) => { const def = (NAV.find((n) => n.key === k) || {}).label || k; const cur = (building.labels && building.labels[k]) || ""; return (<Field key={k} label={def}><Input value={cur} placeholder={def} onChange={(e) => update((s) => { const b = s.buildings.find((x) => x.id === building.id); b.labels = { ...(b.labels || {}) }; const v = e.target.value; if (v.trim()) b.labels[k] = v; else delete b.labels[k]; })} /></Field>); })}</div></Card>)}
        {canEdit && (<Card style={{ padding: 18 }}><SectionTitle>WhatsApp group</SectionTitle><div className="space-y-3"><Field label="Group name"><Input value={building.whatsappName || ""} onChange={(e) => update((s) => { s.buildings.find((b) => b.id === building.id).whatsappName = e.target.value; })} placeholder="e.g. SeaHaven Residents" /></Field><Field label="Invite link"><Input value={building.whatsappLink || ""} onChange={(e) => update((s) => { s.buildings.find((b) => b.id === building.id).whatsappLink = e.target.value; })} placeholder="https://chat.whatsapp.com/…" /></Field><p style={{ color: T.textMuted }} className="text-xs">In WhatsApp: open the group → Group info → "Invite to group via link". Paste it here once — residents tap straight through.</p></div></Card>)}
      </Wrap>
    </div>
  );
}
function Row({ label, value }) { const { T } = useApp(); return <div className="flex justify-between gap-4 py-1"><span style={{ color: T.textMuted }}>{label}</span><span className="font-medium text-right">{value}</span></div>; }

// ---------- pending ---------------------------------------------------------
function PendingScreen() {
  const { T, building, user, setBuildingId } = useApp();
  return (<div style={{ background: T.appBg, color: T.text }} className="min-h-screen grid place-items-center px-5"><Card style={{ padding: 32, maxWidth: 380 }}><div className="text-center"><div className="h-14 w-14 rounded-2xl grid place-items-center mx-auto mb-4" style={{ background: hexToRgba(SEMANTIC.warn, 0.15), color: SEMANTIC.warn }}><ClockIcon size={26} /></div><div className="font-semibold text-lg">Access Requested</div><p style={{ color: T.textMuted }} className="text-sm mt-1.5">Your request to join {building.name} as {ROLE_LABEL[user.role]} is with the committee. You'll get an email when it's approved.</p><Btn kind="ghost" onClick={() => setBuildingId(null)} className="mt-5">Back to buildings</Btn></div></Card></div>);
}

// ============================================================================
// NaloPilot governance suite (demo) — NaloPilot Q&A, By-Laws, Compliance
// Calendar, Dispute Records. Demo-only for now (NAV demoOnly flag); the
// production versions run on the NaloHub-Sandbox backend (2,139 ingested
// legislation sections, FTS search, SHA-256 audit chain, inbound-email
// capture) and swap in when those modules are promoted to the live app.
// ============================================================================

function seedBylaws() {
  const mk = (num, title, text, supplementary) => ({ id: "bl" + num, buildingId: "b1", num, title, text, supplementary: !!supplementary, adopted: supplementary ? "2024 AGM" : "" });
  return [
    mk(1, "Noise", "An occupier must not create noise likely to interfere with the peaceful enjoyment of another occupier. Quiet hours are 10pm–7am. Music, power tools and gatherings must be kept to a reasonable level at all times."),
    mk(2, "Animals", "An occupier may keep one small pet (a dog or cat under 10kg, a bird, or fish) with the committee's written approval. Approval must not be unreasonably withheld and may carry conditions about noise, waste and common-property behaviour. Pets must be leashed or carried on common property. Assistance animals are always permitted and do not require approval."),
    mk(3, "Vehicles & parking", "An occupier must park only in their allocated space. Visitor parking is for genuine visitors, limited to 48 hours per stay, and must not be used to store residents' vehicles. No parking on driveways, turning bays or other common property."),
    mk(4, "Renovations & alterations", "An occupier must obtain the committee's written approval before any works that affect the building's structure, waterproofing, plumbing, electrical services or external appearance. Hard flooring must be installed with acoustic underlay meeting the committee's specification."),
    mk(5, "Smoking", "Smoking (including vaping) is not permitted on common property. An occupier must ensure smoke from their lot does not drift into another lot or onto common property."),
    mk(6, "Rubbish & recycling", "All rubbish must be securely bagged and placed in the correct chute or bin. Large items must not be left in bin rooms or on common property — contact the building manager to arrange collection. Recycling must follow the signage in the bin room."),
    mk(7, "External appearance", "An occupier must not hang washing, towels or bedding on a balcony where visible from outside the building, and must not affix signage, aerials or awnings to the exterior without committee approval."),
    mk(8, "Obstruction of common property", "An occupier must not obstruct lobbies, corridors, stairways or fire escapes, and must not store personal items on common property without written approval."),
    mk(9, "Short-stay letting", "A lot must not be advertised or let for stays shorter than 3 months without the committee's written approval. Owners are responsible for their guests' compliance with all by-laws.", true),
  ];
}

function seedCompliance() {
  const mk = (id, title, detail, due, status, note, rule, docs) => ({ id, buildingId: "b1", title, detail, due, status, note: note || "", rule, docs: docs || [] });
  return [
    mk("cp1", "Annual General Meeting", "Must be held within 3 months of the 30 June financial year end.", "2026-09-30", "in_progress", "Venue booked · agenda drafting underway", "Standard Module — annual general meetings"),
    mk("cp2", "Building insurance renewal", "Full replacement-value cover must be maintained without a gap.", "2026-08-15", "not_started", "", "Standard Module — insurance"),
    mk("cp3", "Fire & evacuation annual statement", "Annual occupier statement and evacuation-plan review.", "2026-07-24", "waiting", "Awaiting contractor's certificate — chased 8 Jul", "QLD fire safety legislation"),
    mk("cp4", "Lift registration renewal", "Registrable plant — renewal was due 30 June.", "2026-06-30", "in_progress", "Renewal lodged 28 Jun — confirmation not yet received", "WHS (registrable plant) requirements"),
    mk("cp5", "Sinking fund forecast review", "Forecast must cover 9 years and be reviewed regularly.", "2027-06-30", "not_started", "", "Standard Module — sinking fund"),
    mk("cp6", "Pool safety certificate renewal", "Shared pool — certificate renews every 12 months.", "2026-05-20", "done", "Certificate issued 18 May 2026", "QLD pool safety laws", [{ name: "pool-safety-certificate.pdf", data: "" }]),
    mk("cp7", "Insurance replacement valuation", "Independent valuation at least every 5 years.", "2031-05-01", "not_started", "Last valuation May 2026", "Standard Module — insurance"),
  ];
}

function seedDisputes() {
  return [
    { id: "dp1", buildingId: "b1", ref: "DISP-0001", title: "Noise complaint — late-night gatherings, Unit 407", category: "Noise", status: "formal", openedAt: "2026-05-12", events: [
      { seq: 1, at: "2026-05-12", type: "stage", by: "Committee (BCC)", text: "Complaint received from Unit 402 and logged." },
      { seq: 2, at: "2026-05-13", type: "correspondence", channel: "Email", by: "Secretary", text: "Acknowledgement sent to complainant. Occupier of 407 notified of the complaint and invited to respond within 14 days." },
      { seq: 3, at: "2026-05-20", type: "update", by: "Secretary", text: "Occupier responded — disputes the frequency described, agrees to keep noise down after 10pm." },
      { seq: 4, at: "2026-06-02", type: "document", by: "Secretary", fileName: "noise-diary-may.pdf", text: "Complainant's noise diary for May added to the record." },
      { seq: 5, at: "2026-06-09", type: "stage", by: "Committee (BCC)", text: "Escalated to formal dispute — self-resolution step commenced; formal contravention notice issued." },
    ] },
    { id: "dp2", buildingId: "b1", ref: "DISP-0002", title: "Visitor parking — resident vehicle stored in visitor bay", category: "Parking & vehicles", status: "complaint", openedAt: "2026-06-28", events: [
      { seq: 1, at: "2026-06-28", type: "stage", by: "Building manager", text: "Complaint logged — white SUV in visitor bay 2 for six consecutive nights." },
      { seq: 2, at: "2026-07-01", type: "correspondence", channel: "Letter", by: "Building manager", text: "Friendly reminder of By-law 3 left on vehicle and emailed to the registered owner of Unit 210." },
    ] },
  ];
}

// --- NaloPilot knowledge (demo library) -------------------------------------
// A curated selection of commonly-asked provisions. The production NaloPilot
// searches the full ingested library (2,139 sections of the BCCM Act 1997 and
// Standard Module) with full-text + semantic search on the server.
const NALO_SYN = [
  [/\b(pets?|dogs?|cats?|puppy|kitten|birds?|animals?)\b/i, ["animal", "pet"]],
  [/\b(park(ing)?|cars?|vehicles?|carpark|garage|driveway)\b/i, ["vehicle", "parking"]],
  [/\b(renovat|alter|flooring|bathroom|kitchen|paint|install)\w*/i, ["renovation", "alteration"]],
  [/\b(nois(e|y)|part(y|ies)|music|loud)\w*/i, ["noise"]],
  [/\b(smok|cigarette|vap)\w*/i, ["smoking"]],
  [/\b(agm|annual general)\b/i, ["annual general meeting", "meeting"]],
  [/\b(lev(y|ies)|contributions?|fees|budget)\b/i, ["contributions", "levies"]],
  [/\b(vot(e|ing)|motions?|ballot|proxy)\b/i, ["voting", "motion"]],
  [/\b(committee|chairperson|chair|secretary|treasurer)\b/i, ["committee"]],
  [/\binsur\w*/i, ["insurance"]],
  [/\b(repair|maintain|maintenance|broken|leak|fix)\w*/i, ["maintenance"]],
  [/\b(disputes?|complain\w*|neighbours?|breach|contravention)\b/i, ["dispute", "complaint"]],
  [/\b(rent(al)?|lease|tenants?|airbnb|short.?stay|letting)\b/i, ["letting", "tenant"]],
  [/\b(meetings?|notice|quorum|egm|general meeting)\b/i, ["meeting"]],
  [/\b(rubbish|garbage|bins?|recycl\w*|waste)\b/i, ["rubbish"]],
  [/\b(balcon(y|ies)|washing|clothes|towels?)\b/i, ["external appearance", "balcony"]],
  [/\b(sinking fund|capital works)\b/i, ["sinking fund", "contributions"]],
];
const AU_STATE_NAMES = { QLD: "Queensland", NSW: "New South Wales", VIC: "Victoria", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", ACT: "the ACT", NT: "the Northern Territory" };
const buildingState = (b) => { const m = (((b && (b.state || b.address)) || "") + "").toUpperCase().match(/\b(QLD|NSW|VIC|WA|SA|TAS|ACT|NT)\b/); return m ? m[1] : "QLD"; };
// One library per Australian state & territory — the demo carries the most-asked
// provisions of each; production ingests each Act in full and keeps it current.
const NALO_LAW = {
  QLD: { name: "Body Corporate and Community Management Act 1997 (Qld) & Standard Module", corp: "body corporate", tribunal: "the BCCM Commissioner's office, then QCAT", entries: [
    { ref: "BCCM Act s 94", title: "Body corporate's general functions", keys: ["maintenance", "committee", "common property"], text: "The body corporate must administer the common property and body corporate assets for the benefit of owners, and enforce the community management statement (including the by-laws). It must act reasonably in everything it does." },
    { ref: "BCCM Act s 169", title: "By-laws for the scheme", keys: ["by-law", "animal", "vehicle", "noise"], text: "A community titles scheme's by-laws provide for the administration, management and control of the common property and lots. By-laws bind the body corporate, owners and occupiers — including tenants." },
    { ref: "BCCM Act s 180", title: "Limitations on by-laws", keys: ["by-law", "animal", "pet"], text: "A by-law must not be oppressive or unreasonable in the circumstances. In practice this means blanket prohibitions (for example, a total pet ban) are open to challenge — conditions must be reasonable." },
    { ref: "BCCM Act s 181", title: "Guide, hearing and assistance dogs", keys: ["animal", "pet"], text: "A by-law cannot exclude or restrict a person with a disability who relies on a guide, hearing or assistance dog — the dog may reside in and visit the lot and be on common property." },
    { ref: "BCCM Act Ch 6", title: "Dispute resolution", keys: ["dispute", "complaint"], text: "Disputes follow a staged path: self-resolution between the parties first, then conciliation, then adjudication through the Office of the Commissioner for Body Corporate and Community Management. Harder matters can reach QCAT. Keeping a complete written record at every stage is what makes the later stages work." },
    { ref: "Standard Module — AGMs", title: "Annual general meetings", keys: ["annual general meeting", "meeting"], text: "The body corporate must hold an annual general meeting within 3 months after the end of its financial year. Notice, motions and voting papers must go to all owners ahead of the meeting." },
    { ref: "Standard Module — committee", title: "The committee", keys: ["committee", "voting"], text: "A committee — chairperson, secretary, treasurer and ordinary members — is elected at each AGM and makes day-to-day decisions for the body corporate. Some decisions are reserved for general meetings of all owners." },
    { ref: "Standard Module — contributions", title: "Levies & budgets", keys: ["contributions", "levies", "sinking fund"], text: "Each AGM adopts an administrative fund budget (day-to-day running costs) and a sinking fund budget (long-term capital items). Contributions are levied on owners in proportion to their lot entitlements." },
    { ref: "Standard Module — sinking fund", title: "Sinking fund forecast", keys: ["sinking fund", "contributions"], text: "The body corporate must keep a sinking fund forecast covering expected capital expenditure over at least 9 years, and review it regularly so levies stay realistic." },
    { ref: "Standard Module — insurance", title: "Insurance", keys: ["insurance"], text: "The body corporate must insure the building and common property for full replacement value, and maintain public risk insurance over the common property. An independent replacement valuation is required at least every 5 years." },
    { ref: "Standard Module — maintenance", title: "Maintenance responsibilities", keys: ["maintenance"], text: "The body corporate maintains common property in good condition (structure, roof, exterior, shared services). An owner maintains the inside of their lot. Boundaries — like a leaking balcony door — often need the registered plans to determine who is responsible; the committee can arrange that check." },
    { ref: "Standard Module — voting", title: "Voting at general meetings", keys: ["voting", "motion", "meeting"], text: "Most motions are decided by ordinary resolution — a simple majority of votes cast in person, by proxy or in writing. Some decisions need a special resolution or resolution without dissent." },
  ] },
  NSW: { name: "Strata Schemes Management Act 2015 (NSW)", corp: "owners corporation", tribunal: "NSW Fair Trading mediation, then NCAT", entries: [
    { ref: "SSMA 2015 — roles", title: "Who's who in a NSW scheme", keys: ["committee", "common property"], text: "The owners corporation (all owners together) is the legal entity; a strata committee of up to 9 members handles day-to-day decisions. A strata managing agent, if appointed, acts on delegation — the committee stays responsible. Reforms that commenced in 2025–26 tightened agent disclosure and accountability." },
    { ref: "SSMA 2015 — AGMs", title: "Annual general meetings", keys: ["annual general meeting", "meeting"], text: "The owners corporation must hold an annual general meeting once in each financial year of the corporation, with proper notice and agenda to all owners." },
    { ref: "SSMA 2015 s 106", title: "Duty to maintain common property", keys: ["maintenance"], text: "The owners corporation has a strict duty to properly maintain and keep in good repair the common property. An owner who suffers loss because of a breach can claim compensation." },
    { ref: "SSMA 2015 — funds", title: "Levies, admin & capital works funds", keys: ["contributions", "levies", "sinking fund"], text: "Owners pay contributions to an administrative fund (running costs) and a capital works fund (long-term works). A 10-year capital works fund plan is required and must be reviewed at least every 5 years." },
    { ref: "SSMA 2015 s 139", title: "Limits on by-laws", keys: ["by-law", "noise", "vehicle"], text: "A by-law must not be harsh, unconscionable or oppressive. By-laws bind owners, occupiers and the owners corporation, and are enforceable through notices to comply and NCAT." },
    { ref: "SSMA 2015 s 137B", title: "Pets", keys: ["animal", "pet"], text: "A by-law that prohibits keeping an animal is of no force if the animal doesn't unreasonably interfere with another occupant's use and enjoyment of their lot or common property — blanket pet bans are unenforceable in NSW." },
    { ref: "SSMA 2015 — insurance", title: "Insurance", keys: ["insurance"], text: "The owners corporation must insure the building for replacement value under a damage policy, plus required liability cover. Annual fire safety statements also apply to most apartment buildings under NSW planning law." },
    { ref: "SSMA 2015 — disputes", title: "Dispute resolution", keys: ["dispute", "complaint"], text: "Try internal resolution first, then free mediation through NSW Fair Trading; unresolved matters go to the NSW Civil and Administrative Tribunal (NCAT), which can make binding orders. A complete written record is your best asset at every stage." },
  ] },
  VIC: { name: "Owners Corporations Act 2006 (Vic)", corp: "owners corporation", tribunal: "Consumer Affairs Victoria conciliation, then VCAT", entries: [
    { ref: "OC Act 2006 — roles", title: "Who's who in a Victorian scheme", keys: ["committee", "common property"], text: "The owners corporation manages the common property; larger owners corporations elect a committee to act between general meetings. The 2021 amendments introduced tiers — obligations scale with the number of lots." },
    { ref: "OC Act 2006 — AGMs", title: "Annual general meetings", keys: ["annual general meeting", "meeting"], text: "An owners corporation that collects annual fees must hold an AGM; no more than 15 months may pass between annual general meetings." },
    { ref: "OC Act 2006 — fees", title: "Fees & maintenance funds", keys: ["contributions", "levies", "sinking fund"], text: "Annual fees cover ordinary running costs; special fees fund extraordinary items. Prescribed (larger) owners corporations must have a maintenance plan and maintenance fund for long-term capital works." },
    { ref: "OC Act 2006 — repairs", title: "Repairs & maintenance", keys: ["maintenance"], text: "The owners corporation must repair and maintain the common property, its chattels, fixtures, fittings and services. Owners maintain their own lots." },
    { ref: "OC Act 2006 — rules", title: "Rules of the owners corporation", keys: ["by-law", "noise", "vehicle", "animal", "pet"], text: "Schemes have registered rules (or the model rules by default) covering matters like noise, parking, pets and common property use. Rules must not be oppressive or discriminatory, and are enforced through notices and, ultimately, VCAT." },
    { ref: "OC Act 2006 — insurance", title: "Insurance", keys: ["insurance"], text: "Owners corporations (other than some 2-lot schemes) must hold reinstatement and replacement insurance for the building and public liability insurance for common property." },
    { ref: "OC Act 2006 — disputes", title: "Dispute resolution", keys: ["dispute", "complaint"], text: "The path is: internal complaint under the scheme's grievance procedure, conciliation through Consumer Affairs Victoria, then the Victorian Civil and Administrative Tribunal (VCAT). Keep every step documented." },
  ] },
  WA: { name: "Strata Titles Act 1985 (WA), as reformed in 2020", corp: "strata company", tribunal: "the State Administrative Tribunal (SAT)", entries: [
    { ref: "STA 1985 — roles", title: "Who's who in a WA scheme", keys: ["committee", "common property"], text: "The strata company (all owners) is the legal entity; a council of the strata company makes day-to-day decisions. Strata managers must be contracted in writing with defined duties since the 2020 reforms." },
    { ref: "STA 1985 — AGMs", title: "Annual general meetings", keys: ["annual general meeting", "meeting"], text: "The strata company must hold an annual general meeting each year, with notice and voting papers to all owners." },
    { ref: "STA 1985 — funds", title: "Levies & the 10-year plan", keys: ["contributions", "levies", "sinking fund"], text: "Owners pay contributions to an administrative fund; designated (larger) schemes must also keep a reserve fund guided by a 10-year maintenance plan." },
    { ref: "STA 1985 — maintenance", title: "Repairs & maintenance", keys: ["maintenance"], text: "The strata company must keep the common property in good and serviceable repair. Owners are responsible for their own lots." },
    { ref: "STA 1985 — by-laws", title: "By-laws", keys: ["by-law", "noise", "vehicle", "animal", "pet"], text: "Schemes are governed by Schedule 1 (governance) and Schedule 2 (conduct) by-laws, which can be amended and must be registered with Landgate to take effect. By-laws must be reasonable, and bind owners and occupiers." },
    { ref: "STA 1985 — insurance", title: "Insurance", keys: ["insurance"], text: "The strata company must insure buildings on the scheme for replacement value and hold required liability cover." },
    { ref: "STA 1985 — disputes", title: "Dispute resolution", keys: ["dispute", "complaint"], text: "Since the 2020 reforms, the State Administrative Tribunal (SAT) is the primary venue for WA strata disputes — it can order compliance, repairs and compensation. A complete record of correspondence and decisions is what wins these matters." },
  ] },
  SA: { name: "Strata Titles Act 1988 (SA) / Community Titles Act 1996 (SA)", corp: "strata / community corporation", tribunal: "SACAT (with a strong emphasis on mediation)", entries: [
    { ref: "SA strata — roles", title: "Who's who in an SA scheme", keys: ["committee", "common property"], text: "Depending on how the scheme was created, it's a strata corporation (Strata Titles Act 1988) or community corporation (Community Titles Act 1996). A management committee can be appointed to act between general meetings." },
    { ref: "SA strata — AGMs", title: "Annual general meetings", keys: ["annual general meeting", "meeting"], text: "The corporation must hold an annual general meeting each year to set contributions, present accounts and elect the committee." },
    { ref: "SA strata — funds", title: "Contributions & funds", keys: ["contributions", "levies", "sinking fund"], text: "Owners contribute to administrative costs, and corporations commonly maintain a sinking or reserve fund for long-term works — larger community schemes have stricter fund and statement requirements." },
    { ref: "SA strata — maintenance", title: "Repairs & maintenance", keys: ["maintenance"], text: "The corporation must maintain the common property in good condition; owners maintain their own units/lots." },
    { ref: "SA strata — articles", title: "Articles & by-laws", keys: ["by-law", "noise", "vehicle", "animal", "pet"], text: "Schemes are governed by articles (strata) or by-laws (community schemes) binding owners and occupiers, covering matters like noise, parking and animals. Changes generally need a special resolution and registration." },
    { ref: "SA strata — insurance", title: "Insurance", keys: ["insurance"], text: "The corporation must insure buildings for replacement value and hold public liability insurance over the common property." },
    { ref: "SA strata — disputes", title: "Dispute resolution", keys: ["dispute", "complaint"], text: "Disputes go to the South Australian Civil and Administrative Tribunal (SACAT), which pushes hard for mediated outcomes first; some matters can also go to the Magistrates Court. Documentation is decisive either way." },
  ] },
  TAS: { name: "Strata Titles Act 1998 (Tas)", corp: "body corporate", tribunal: "the Recorder of Titles", entries: [
    { ref: "STA 1998 — roles", title: "Who's who in a Tasmanian scheme", keys: ["committee", "common property"], text: "The body corporate (all owners) manages the scheme; larger schemes elect a committee of management. Small schemes have deliberately simplified rules." },
    { ref: "STA 1998 — meetings", title: "General meetings", keys: ["annual general meeting", "meeting"], text: "The body corporate holds general meetings to set contributions and make decisions; larger schemes hold annual general meetings with notice to all owners." },
    { ref: "STA 1998 — funds", title: "Contributions & funds", keys: ["contributions", "levies", "sinking fund"], text: "Owners contribute to the body corporate's administrative costs, and schemes commonly maintain a fund for long-term maintenance. Contributions follow unit entitlements." },
    { ref: "STA 1998 — maintenance", title: "Repairs & maintenance", keys: ["maintenance"], text: "The body corporate maintains the common property; owners maintain their own lots. Where a defect crosses the boundary, the registered plan determines responsibility." },
    { ref: "STA 1998 — by-laws", title: "By-laws", keys: ["by-law", "noise", "vehicle", "animal", "pet"], text: "The standard by-laws in the Act apply unless the scheme registers its own, covering conduct matters like noise, vehicles and animals. By-laws bind owners and occupiers." },
    { ref: "STA 1998 — insurance", title: "Insurance", keys: ["insurance"], text: "The body corporate must insure scheme buildings for replacement value and hold required liability cover." },
    { ref: "STA 1998 — disputes", title: "Dispute resolution", keys: ["dispute", "complaint"], text: "Tasmania is unusual: strata disputes go to the Recorder of Titles, who can order compliance with the Act and by-laws. A clean written record of the dispute is exactly what the Recorder wants to see." },
  ] },
  ACT: { name: "Unit Titles (Management) Act 2011 (ACT)", corp: "owners corporation", tribunal: "ACAT", entries: [
    { ref: "UTMA 2011 — roles", title: "Who's who in an ACT scheme", keys: ["committee", "common property"], text: "The owners corporation manages the units plan; an executive committee handles day-to-day decisions between general meetings." },
    { ref: "UTMA 2011 — AGMs", title: "Annual general meetings", keys: ["annual general meeting", "meeting"], text: "The owners corporation must hold an annual general meeting each financial year to adopt budgets, elect the executive committee and decide general business." },
    { ref: "UTMA 2011 — funds", title: "Funds & the sinking fund plan", keys: ["contributions", "levies", "sinking fund"], text: "Owners pay general fund contributions for running costs, and the corporation must maintain a sinking fund backed by a long-term (10-year) sinking fund plan for capital works." },
    { ref: "UTMA 2011 — maintenance", title: "Repairs & maintenance", keys: ["maintenance"], text: "The owners corporation must maintain the common property and defined parts of the buildings; owners maintain their own units." },
    { ref: "UTMA 2011 — rules", title: "Rules", keys: ["by-law", "noise", "vehicle", "animal", "pet"], text: "Default rules in the Act apply unless the corporation adopts its own by special resolution (and registers them). Rules bind owners and occupiers and are enforced through rule-infringement notices, then ACAT." },
    { ref: "UTMA 2011 — insurance", title: "Insurance", keys: ["insurance"], text: "The owners corporation must insure the buildings for replacement value and hold public liability insurance for the common property." },
    { ref: "UTMA 2011 — disputes", title: "Dispute resolution", keys: ["dispute", "complaint"], text: "Unit title disputes go to the ACT Civil and Administrative Tribunal (ACAT), which can make binding orders about rules, repairs, meetings and money. Bring the complete record." },
  ] },
  NT: { name: "Unit Titles Act 1975 (NT) / Unit Title Schemes Act 2009 (NT)", corp: "body corporate", tribunal: "NTCAT", entries: [
    { ref: "NT units — roles", title: "Who's who in an NT scheme", keys: ["committee", "common property"], text: "Depending on when and how the scheme was created it sits under the Unit Titles Act 1975 or the Unit Title Schemes Act 2009. The body corporate (all owners) is the legal entity; a committee can act between general meetings." },
    { ref: "NT units — AGMs", title: "Annual general meetings", keys: ["annual general meeting", "meeting"], text: "The body corporate must hold an annual general meeting each year to set contributions, present accounts and elect the committee." },
    { ref: "NT units — funds", title: "Contributions & funds", keys: ["contributions", "levies", "sinking fund"], text: "Owners pay contributions in proportion to unit entitlements; schemes commonly keep a sinking fund for long-term capital works." },
    { ref: "NT units — maintenance", title: "Repairs & maintenance", keys: ["maintenance"], text: "The body corporate maintains the common property in good repair; owners maintain their own units." },
    { ref: "NT units — by-laws", title: "By-laws / scheme rules", keys: ["by-law", "noise", "vehicle", "animal", "pet"], text: "Default by-laws or registered scheme rules cover conduct matters — noise, parking, animals, common property use — and bind owners and occupiers." },
    { ref: "NT units — insurance", title: "Insurance", keys: ["insurance"], text: "The body corporate must insure scheme buildings for replacement value and hold required liability cover." },
    { ref: "NT units — disputes", title: "Dispute resolution", keys: ["dispute", "complaint"], text: "Unit title disputes go to the Northern Territory Civil and Administrative Tribunal (NTCAT). As everywhere: the side with the complete, dated record has the easier day." },
  ] },
};
const naloExpand = (q) => { const keys = new Set(); NALO_SYN.forEach(([re, ks]) => { if (re.test(q)) ks.forEach((k) => keys.add(k)); }); q.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3).forEach((w) => keys.add(w)); return [...keys]; };
const naloScore = (keys, hay) => keys.reduce((n, k) => n + (hay.includes(k) ? (k.length > 5 ? 2 : 1) : 0), 0);
function naloSearch(q, bylaws, state) {
  const keys = naloExpand(q);
  const lib = (NALO_LAW[state] || NALO_LAW.QLD).entries;
  const bl = bylaws.map((b) => ({ b, s: naloScore(keys, (b.title + " " + b.text).toLowerCase()) })).filter((x) => x.s > 0).sort((a, z) => z.s - a.s).slice(0, 2).map((x) => x.b);
  const act = lib.map((a) => ({ a, s: naloScore(keys, (a.title + " " + a.keys.join(" ") + " " + a.text).toLowerCase()) })).filter((x) => x.s > 1).sort((a, z) => z.s - a.s).slice(0, 3).map((x) => x.a);
  return { bl, act };
}
const NALO_STARTERS = ["Can we keep a pet?", "What are the visitor parking rules?", "When must our AGM be held?", "Who fixes a leaking balcony door?", "How are levies set?", "A neighbour dispute — what's the process?"];

function NaloDisclaimer({ state }) {
  const { T } = useApp();
  return <div className="text-[11px] mt-2 flex items-start gap-1.5" style={{ color: T.textMuted }}><Info size={12} className="shrink-0 mt-0.5" /> General information from your by-laws and {AU_STATE_NAMES[state] || "your state's"} legislation — not legal or professional advice. For advice on your situation, speak to a qualified professional.</div>;
}

// By-laws arrive from two places with two shapes: added in-app they carry `num`
// (a number); bulk-loaded from a registered CMS they carry `number` (a string,
// verbatim as printed). Read both, and always sort numerically — the table has
// no ORDER BY, so without this the list comes back in whatever order Postgres
// feels like, which is what Curve saw.
const blNum = (b) => { const n = Number(b && (b.num != null ? b.num : b.number)); return Number.isFinite(n) ? n : 0; };
const blSort = (a, z) => blNum(a) - blNum(z);

// By-law text carries real newlines and 4-spaces-per-level indents on sub-clauses.
// `white-space: pre-wrap` keeps the leading spaces but lets WRAPPED lines fall back to
// the left margin, so "(a) ..." starts indented and its second line doesn't — ragged.
// Render each line as its own block with padding instead: continuation lines then hang
// under the clause they belong to, which is how the registered document reads.
const BL_INDENT = 18;
function ByLawText({ text, className = "text-sm leading-relaxed", style }) {
  const lines = String(text || "").split("\n");
  return (
    <div className={className} style={style}>
      {lines.map((ln, i) => {
        if (!ln.trim()) return <div key={i} style={{ height: 7 }} />;
        const lead = (ln.match(/^ +/) || [""])[0].length;
        const depth = Math.min(3, Math.round(lead / 4));
        return <div key={i} style={{ paddingLeft: depth * BL_INDENT, marginBottom: 3 }}>{ln.trim()}</div>;
      })}
    </div>
  );
}

function NaloPilotView() {
  const { T, store, user, building, buildingId, backend } = useApp();
  const bylaws = (store.bylaws || []).filter((b) => !b.buildingId || b.buildingId === buildingId);
  return <NaloPilotInner bylaws={bylaws} user={user} T={T} state={buildingState(building)} backend={backend} buildingId={buildingId} />;
}
function NaloPilotInner({ bylaws, user, T, state, backend, buildingId }) {
  const law = NALO_LAW[state] || NALO_LAW.QLD;
  const [q, setQ] = useState("");
  const [thread, setThread] = useState([]);
  const [openSec, setOpenSec] = useState({});
  const [busy, setBusy] = useState(false);
  const ask = async (text) => {
    const query = (text || q).trim();
    if (!query || busy) return;
    setQ("");
    let bl, act, ans = "";
    if (backend) {
      setBusy(true);
      bl = naloSearch(query, bylaws, state).bl;
      const keys = naloExpand(query);
      const search = keys.length ? keys.join(" or ") : query;
      try {
        const { data, error } = await supabase.functions.invoke("nalo-answer", { body: { question: query, jurisdiction: state, search, buildingId } });
        if (error || !data || !Array.isArray(data.sections)) throw error || new Error("bad response");
        act = data.sections; ans = data.answer || "";
      } catch (e) {
        try { act = await searchLegislation(search, state, 4); } catch (e2) { act = []; }
      }
      setBusy(false);
    } else {
      const r = naloSearch(query, bylaws, state);
      bl = r.bl; act = r.act;
    }
    setThread((t) => [{ id: Math.random().toString(36).slice(2, 8), q: query, bl, act, ans }, ...t]);
  };
  const Face = ({ size = 38 }) => (
    <div className="rounded-2xl grid place-items-center shrink-0" style={{ width: size, height: size, background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: "#06283a", fontSize: size * 0.55 }} aria-hidden>🌊</div>
  );
  return (
    <div>
      <Head title="NaloPilot" sub={`Ask Nalo about your by-laws or ${AU_STATE_NAMES[state]} body corporate law — in plain English`} />
      <Card style={{ padding: 18 }}>
        <div className="flex items-center gap-3 mb-3">
          <Face />
          <div className="min-w-0">
            <div className="font-semibold">Hi{user && user.name ? ` ${user.name.split(" ")[0]}` : ""} — I'm Nalo, your NaloHub assistant.</div>
            <div className="text-xs" style={{ color: T.textMuted }}>I do the digging so you don't have to: your building's by-laws first, then the {law.name} — and I always show exactly where an answer came from.</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} placeholder="e.g. Can we keep a pet in our lot?" />
          <Btn onClick={() => ask()} grad disabled={busy}><Send size={15} /> {busy ? "Checking…" : "Ask"}</Btn>
        </div>
        <div className="flex gap-2 overflow-x-auto pt-3">{NALO_STARTERS.map((s) => (
          <button key={s} onClick={() => ask(s)} className="whitespace-nowrap text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: T.surfaceAlt, color: T.textMuted, border: `1px solid ${T.border}` }}>{s}</button>
        ))}</div>
      </Card>
      {thread.map((m) => (
        <Card key={m.id} style={{ padding: 18, marginTop: 12 }}>
          <div className="text-sm font-semibold mb-2" style={{ color: T.textMuted }}>You asked: <span style={{ color: T.text }}>{m.q}</span></div>
          <div className="flex items-start gap-3">
            <Face size={30} />
            <div className="flex-1 min-w-0">
              {m.bl.length === 0 && m.act.length === 0 ? (
                <p className="text-sm leading-relaxed">{backend ? <>I couldn't find this one in your by-laws or the {law.name}. That doesn't mean there's no answer — some matters live in your scheme's registered documents or other legislation. Your committee (or the <b>By-Laws</b> tab) is the best next stop.</> : <>I couldn't find this one in your by-laws or my demo law library. That doesn't mean there's no answer — some matters live in your scheme's registered documents or other legislation. In the full NaloHub app I search the complete {law.name}, kept current. For now, your committee (or the <b>By-Laws</b> tab) is the best next stop.</>}</p>
              ) : (
                <div>
                  {m.bl.length > 0 && <div>
                    <p className="text-sm leading-relaxed mb-2">Here's what <b>your building's by-laws</b> say:</p>
                    {m.bl.map((b) => (
                      <div key={b.id} className="rounded-xl px-3.5 py-3 mb-2" style={{ background: hexToRgba(T.accent, 0.08), border: `1px solid ${hexToRgba(T.accent, 0.3)}` }}>
                        <div className="text-xs font-bold mb-1" style={{ color: T.accent }}>By-law {blNum(b)} — {b.title}{b.supplementary ? " · supplementary" : ""}</div>
                        <ByLawText text={b.text} />
                      </div>
                    ))}
                  </div>}
                  {m.act.length > 0 && <div className="mt-1">
                    {m.ans && <p className="text-sm leading-relaxed mb-2">{m.ans}</p>}
                    <p className="text-sm leading-relaxed mb-2">{m.ans ? <>The <b>{AU_STATE_NAMES[state]} legislation</b> behind this — tap a section for the Act's actual wording:</> : <>{m.bl.length ? "And from " : "From "}<b>{AU_STATE_NAMES[state]} legislation</b>{backend ? " — tap a section to read the Act's actual wording:" : ":"}</>}</p>
                    {m.act.map((a) => { const k = m.id + a.ref; const open = openSec[k]; return (
                      <button key={a.ref} onClick={() => setOpenSec((o) => ({ ...o, [k]: !o[k] }))} className="w-full text-left rounded-xl px-3.5 py-3 mb-2" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
                        <div className="flex items-center gap-2"><Badge color={T.accent2}>{a.ref}</Badge><span className="text-sm font-semibold flex-1">{a.title}</span><ChevronRight size={14} style={{ color: T.textMuted, transform: open ? "rotate(90deg)" : "none", transition: ".2s" }} /></div>
                        {open && <div className="text-sm leading-relaxed mt-2" style={{ color: T.textMuted }}>{a.text}{a.source && <div className="text-[10px] mt-1.5 font-semibold uppercase tracking-wider">{a.source}</div>}</div>}
                      </button>
                    ); })}
                  </div>}
                  <div className="text-sm mt-2 flex items-start gap-1.5"><Check size={14} style={{ color: SEMANTIC.ok }} className="shrink-0 mt-0.5" /><span><b>Next step:</b> {m.bl.length ? "if you need approval or want to raise this, message your committee through the app so there's a record." : "if this affects your building specifically, check the By-Laws tab or ask your committee — decisions and approvals should always be recorded."}</span></div>
                </div>
              )}
              <NaloDisclaimer state={state} />
            </div>
          </div>
        </Card>
      ))}
      <div className="text-[11px] mt-3 px-1" style={{ color: T.textMuted }}>{backend ? <>Nalo answers from your building's state — this scheme is in {AU_STATE_NAMES[state]}, so only {AU_STATE_NAMES[state]} law applies. Nalo searches your by-laws plus the {law.name} as currently in force. ★ Premium feature.</> : <>Nalo answers from your building's state — this scheme is in {AU_STATE_NAMES[state]}, so only {AU_STATE_NAMES[state]} law applies. Demo library: your by-laws plus the most-asked provisions; the full app searches the complete legislation for every Australian state and territory, kept current. ★ Premium feature.</>}</div>
    </div>
  );
}

function ByLawsView() {
  const { T, store, update, buildingId, user, flash } = useApp();
  const committee = isCommittee(user.role);
  const list = (store.bylaws || []).filter((b) => !b.buildingId || b.buildingId === buildingId).slice().sort(blSort);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: "", text: "", supplementary: true });
  const add = () => {
    if (!f.title.trim() || !f.text.trim()) return;
    update((s) => { s.bylaws = s.bylaws || []; const num = Math.max(0, ...s.bylaws.filter((b) => b.buildingId === buildingId).map(blNum)) + 1; s.bylaws.push({ id: "bl" + Math.random().toString(36).slice(2, 6), buildingId, num, title: f.title.trim(), text: f.text.trim(), supplementary: f.supplementary, adopted: "Added " + today() }); });
    setF({ title: "", text: "", supplementary: true }); setAdding(false); flash("By-law added — visible to all residents");
  };
  return (
    <div>
      <Head title="By-Laws" sub={committee ? "Your scheme's by-laws — residents see these read-only" : "Your building's rules, in one place"} action={committee && <HeaderAction onClick={() => setAdding((v) => !v)}><Plus size={15} /> Add by-law</HeaderAction>} />
      {committee && adding && (
        <Card style={{ padding: 18, marginBottom: 12 }}>
          <SectionTitle>Add a by-law or supplementary by-law</SectionTitle>
          <div className="space-y-3">
            <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Electric vehicle charging" /></Field>
            <Field label="Text"><TextArea rows={4} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Paste the by-law text as registered in your CMS…" /></Field>
            <div className="flex items-center justify-between">
              <button onClick={() => setF({ ...f, supplementary: !f.supplementary })} className="text-sm flex items-center gap-2" style={{ color: T.textMuted }}><span className="h-5 w-5 rounded-md grid place-items-center" style={{ border: `1px solid ${T.border}`, background: f.supplementary ? T.accent : "transparent", color: "#06283a" }}>{f.supplementary && <Check size={13} />}</span> Supplementary by-law</button>
              <div className="flex gap-2"><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn><Btn onClick={add} grad>Save by-law</Btn></div>
            </div>
            <div className="text-[11px]" style={{ color: T.textMuted }}>Adding one by-law at a time is for amendments. Bulk upload of your registered CMS document is coming — for now send it to info@nalohub.com and we'll load it for you.</div>
          </div>
        </Card>
      )}
      {list.length === 0 ? <Empty icon={BookOpen} title="No by-laws loaded yet" hint={committee ? "Add your scheme's by-laws so residents (and NaloPilot) can use them." : "Your committee hasn't loaded the by-laws yet — ask them to add them so everyone can see the rules."} /> :
        list.map((b) => (
          <Card key={b.id} style={{ padding: 16, marginBottom: 10 }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge color={T.accent}>By-law {blNum(b)}</Badge>
              <span className="font-semibold text-[15px] flex-1">{b.title}</span>
              {b.supplementary && <Badge color={SEMANTIC.warn}>Supplementary{b.adopted ? ` · ${b.adopted}` : ""}</Badge>}
            </div>
            <ByLawText text={b.text} style={{ color: T.textMuted }} />
          </Card>
        ))}
      <div className="text-[11px] mt-2 px-1" style={{ color: T.textMuted }}>These by-laws also power NaloPilot — ask it "{NALO_STARTERS[0]}" and it answers from this list first. General information, not legal advice.</div>
    </div>
  );
}

// --- Compliance Calendar ------------------------------------------------------
const CP_STATUSES = [["not_started", "Not started"], ["in_progress", "In progress"], ["waiting", "Waiting on others"], ["done", "Done"]];
const cpLight = (item) => {
  if (item.status === "done") return { c: SEMANTIC.ok, label: "Done" };
  const t = today();
  if (item.due < t) return { c: SEMANTIC.bad, label: "Overdue" };
  if (item.due <= addDays(t, 45)) return { c: SEMANTIC.warn, label: "Coming due" };
  return { c: SEMANTIC.ok, label: "On track" };
};
const cpTemplateQLD = (bid) => {
  const y = new Date().getFullYear();
  const mk = (title, detail, due, rule) => ({ id: "cp" + Math.random().toString(36).slice(2, 7), buildingId: bid, title, detail, due, status: "not_started", note: "", rule, docs: [] });
  return [
    mk("Annual General Meeting", "Within 3 months of the financial year end.", `${y}-09-30`, "Standard Module — annual general meetings"),
    mk("Building insurance renewal", "Full replacement-value cover must not lapse.", addDays(today(), 60), "Standard Module — insurance"),
    mk("Fire & evacuation annual statement", "Annual occupier statement and evacuation-plan review.", addDays(today(), 90), "QLD fire safety legislation"),
    mk("Sinking fund forecast review", "Forecast must cover 9 years and be reviewed regularly.", `${y + 1}-06-30`, "Standard Module — sinking fund"),
    mk("Insurance replacement valuation", "Independent valuation at least every 5 years.", `${y + 5}-06-30`, "Standard Module — insurance"),
  ];
};
function ComplianceView() {
  const { T, store, update, building, buildingId, user, flash, backend } = useApp();
  const cpState = buildingState(building);
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ title: "", due: "", rule: "", detail: "" });
  const addItem = () => {
    if (!nf.title.trim() || !nf.due) return;
    update((s) => { s.compliance = s.compliance || []; s.compliance.push({ id: "cp" + Math.random().toString(36).slice(2, 7), buildingId, title: nf.title.trim(), detail: nf.detail.trim(), due: nf.due, status: "not_started", note: "", rule: nf.rule.trim() || "Committee-added obligation", docs: [] }); });
    setNf({ title: "", due: "", rule: "", detail: "" }); setAdding(false); flash("Obligation added to the calendar");
  };
  const loadTemplate = () => { const tpl = cpTemplateQLD(buildingId); update((s) => { s.compliance = (s.compliance || []).concat(tpl); }); flash("Standard deadlines loaded — adjust dates to your scheme"); };
  const items = (store.compliance || []).filter((i) => !i.buildingId || i.buildingId === buildingId).sort((a, z) => (a.status === "done" ? 1 : 0) - (z.status === "done" ? 1 : 0) || (a.due < z.due ? -1 : 1));
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState("");
  const setStatus = (id, status) => update((s) => { const i = s.compliance.find((x) => x.id === id); if (i) i.status = status; });
  const saveNote = (id) => { update((s) => { const i = s.compliance.find((x) => x.id === id); if (i) i.note = note.trim(); }); setNoteFor(null); flash("Progress note saved"); };
  const attach = (id, file) => {
    if (backend) {
      uploadAttachment(buildingId, "compliance", file).then((doc) => {
        update((s) => { const i = s.compliance.find((x) => x.id === id); if (i) { i.docs = i.docs || []; i.docs.push(doc); } });
        flash("Document uploaded & attached");
      }).catch(() => flash("Upload failed — check the file type and size (10MB max)"));
      return;
    }
    readUpload(file, (data) => { update((s) => { const i = s.compliance.find((x) => x.id === id); if (i) { i.docs = i.docs || []; i.docs.push({ name: file.name, data }); } }); flash("Document attached"); }, flash);
  };
  const exportAgenda = () => {
    const openItems = items.filter((i) => i.status !== "done");
    const txt = ["COMPLIANCE — STANDING AGENDA ITEM", `Generated from NaloHub · ${fmtAU(today())}`, ""].concat(openItems.map((i) => { const l = cpLight(i); return `• ${i.title} — due ${fmtAU(i.due)} [${l.label}${i.status !== "not_started" ? " · " + CP_STATUSES.find(([k]) => k === i.status)[1] : ""}]${i.note ? `\n  Note: ${i.note}` : ""}`; })).join("\n");
    try { navigator.clipboard.writeText(txt); } catch (e) {}
    const kids = [
      dxH("Compliance — standing agenda item", DocxH.HEADING_1),
      dxP([[`${building.name} · generated from NaloHub · ${fmtAU(today())}`, { italics: true, color: "666666" }]]),
      dxP([[" "]]),
    ];
    openItems.forEach((i) => {
      const l = cpLight(i);
      kids.push(dxP([[`${i.title}`, { bold: true }], [`  — due ${fmtAU(i.due)} · ${l.label}${i.status !== "not_started" ? " · " + CP_STATUSES.find(([k]) => k === i.status)[1] : ""}`, {}]], { bullet: { level: 0 } }));
      if (i.rule) kids.push(dxP([[`Under: ${i.rule}`, { color: "666666", size: 18 }]], { indent: { left: 720 } }));
      if (i.note) kids.push(dxP([[`Note: ${i.note}`, { italics: true, size: 18 }]], { indent: { left: 720 } }));
    });
    kids.push(dxP([[" "]]), dxP([["General information, not legal advice. Deadlines from NaloHub's Compliance Calendar.", { color: "888888", size: 16 }]]));
    saveDocx("compliance-agenda-item.docx", kids).then(() => flash("Word agenda downloaded — also copied as text for quick pasting"));
  };
  const counts = { red: items.filter((i) => cpLight(i).c === SEMANTIC.bad).length, amber: items.filter((i) => cpLight(i).c === SEMANTIC.warn).length };
  return (
    <div>
      <Head title="Compliance Calendar" sub="Your scheme's statutory deadlines — nothing slips past quietly" action={<div className="flex gap-2 flex-wrap"><HeaderAction onClick={() => setAdding((v) => !v)}><Plus size={15} /> Add obligation</HeaderAction><HeaderAction data-guide="g-cp-agenda" onClick={exportAgenda}><Download size={15} /> Word agenda</HeaderAction><HeaderAction onClick={() => { const headers = ["title", "due", "status", "traffic_light", "days_until_due", "rule", "note", "documents"]; const rows = items.map((i) => ({ title: i.title, due: i.due, status: (CP_STATUSES.find(([k]) => k === i.status) || ["", i.status])[1], traffic_light: cpLight(i).label, days_until_due: Math.floor((new Date(i.due + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000), rule: i.rule || "", note: i.note || "", documents: (i.docs || []).map((d) => d.name).join("; ") })); downloadCSV("compliance-calendar.csv", toCSV(headers, rows)); flash("CSV downloaded — opens straight into Excel or Google Sheets"); }}><BarChart3 size={15} /> Excel (CSV)</HeaderAction></div>} />
      {adding && (
        <Card style={{ padding: 18, marginBottom: 12 }}>
          <SectionTitle>Add an obligation</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="What must be done"><Input value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="e.g. Lift registration renewal" /></Field>
            <Field label="Due date"><Input type="date" value={nf.due} onChange={(e) => setNf({ ...nf, due: e.target.value })} /></Field>
            <Field label="Under which rule (optional)"><Input value={nf.rule} onChange={(e) => setNf({ ...nf, rule: e.target.value })} placeholder="e.g. WHS registrable plant" /></Field>
            <Field label="Detail (optional)"><Input value={nf.detail} onChange={(e) => setNf({ ...nf, detail: e.target.value })} placeholder="Anything the committee should know" /></Field>
          </div>
          <div className="flex gap-2 justify-end mt-3"><Btn kind="ghost" onClick={() => setAdding(false)}>Cancel</Btn><Btn onClick={addItem} grad>Add to calendar</Btn></div>
        </Card>
      )}
      {(counts.red > 0 || counts.amber > 0) && (
        <Card style={{ padding: 14, marginBottom: 12, border: `1px solid ${hexToRgba(counts.red ? SEMANTIC.bad : SEMANTIC.warn, 0.5)}` }}>
          <div className="flex items-center gap-2 text-sm"><AlertTriangle size={16} style={{ color: counts.red ? SEMANTIC.bad : SEMANTIC.warn }} /><span>{counts.red > 0 && <b>{counts.red} overdue</b>}{counts.red > 0 && counts.amber > 0 && " · "}{counts.amber > 0 && <span><b>{counts.amber}</b> coming due in the next 45 days</span>} — tap an item to update its status.</span></div>
        </Card>
      )}
      {items.length === 0 ? <div><Empty icon={CalendarClock} title="No deadlines yet" hint="Load the standard set for your state, then adjust dates to your scheme — or add obligations one by one." /><div className="flex justify-center mt-3"><Btn onClick={loadTemplate} grad><RefreshCw size={15} /> Load standard {cpState} deadlines</Btn></div></div> :
        items.map((i) => { const l = cpLight(i); return (
          <Card key={i.id} style={{ padding: 16, marginBottom: 10, opacity: i.status === "done" ? 0.65 : 1 }}>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: l.c, boxShadow: `0 0 8px ${hexToRgba(l.c, 0.6)}` }} title={l.label} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px]">{i.title}</div>
                <div className="text-xs" style={{ color: T.textMuted }}>Due {fmtAU(i.due)} · {i.rule}{i.detail ? ` · ${i.detail}` : ""}</div>
              </div>
              <Badge color={l.c}>{l.label}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {CP_STATUSES.map(([k, lab]) => (
                <button key={k} onClick={() => setStatus(i.id, k)} className="text-xs font-semibold rounded-full px-3 py-1.5" style={i.status === k ? { background: T.accent, color: "#06283a" } : { background: T.surfaceAlt, color: T.textMuted, border: `1px solid ${T.border}` }}>{lab}</button>
              ))}
              <button onClick={() => { setNoteFor(noteFor === i.id ? null : i.id); setNote(i.note || ""); }} className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: T.surfaceAlt, color: T.textMuted, border: `1px solid ${T.border}` }}><Pencil size={11} className="inline mr-1" />Progress note</button>
              <label className="text-xs font-semibold rounded-full px-3 py-1.5 cursor-pointer" style={{ background: T.surfaceAlt, color: T.textMuted, border: `1px solid ${T.border}` }}><Paperclip size={11} className="inline mr-1" />Attach document<input type="file" className="hidden" onChange={(e) => { const file = e.target.files && e.target.files[0]; if (file) attach(i.id, file); e.target.value = ""; }} /></label>
            </div>
            {noteFor === i.id && <div className="flex gap-2 mt-3"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Quotes requested — deciding at next committee meeting" /><Btn onClick={() => saveNote(i.id)}>Save</Btn></div>}
            {i.note && noteFor !== i.id && <div className="text-sm mt-2.5 rounded-lg px-3 py-2" style={{ background: T.surfaceAlt, color: T.textMuted }}>📝 {i.note}</div>}
            {(i.docs || []).length > 0 && <div className="flex flex-wrap gap-2 mt-2.5">{i.docs.map((d, idx) => <FileChip key={idx} name={d.name} data={d.data} path={d.path} color={l.c} />)}</div>}
          </Card>
        ); })}
      <div className="text-[11px] mt-2 px-1" style={{ color: T.textMuted }}>Deadlines are generated from the {(NALO_LAW[cpState] || NALO_LAW.QLD).name} for a {cpState} scheme with a 30 June year end. General information, not legal advice. ★ Premium feature.</div>
    </div>
  );
}

// --- Dispute Records (append-only audit trail) --------------------------------
const DP_EVENT_META = { stage: { Icon: ShieldCheck, label: "Stage" }, update: { Icon: Pencil, label: "Update" }, correspondence: { Icon: Mail, label: "Correspondence" }, document: { Icon: Paperclip, label: "Document" } };
const DP_CATS = ["Noise", "Parking & vehicles", "Pets & animals", "By-law breach", "Maintenance & damage", "Money & levies", "Behaviour", "Other"];
const daysSince = (d) => Math.max(0, Math.floor((new Date(today() + "T00:00:00") - new Date(localDay(d || today()) + "T00:00:00")) / 86400000));
const dpAge = (d) => { const n = daysSince(d.openedAt); return n < 7 ? { n, c: SEMANTIC.ok, label: "New" } : n <= 30 ? { n, c: SEMANTIC.warn, label: "Active" } : { n, c: SEMANTIC.bad, label: "Long-running" }; };
const fmtAUT = (d) => !d ? "" : d.length > 10 ? new Date(d).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : fmtAU(d);
const DP_GUIDE_HINT = "Facts make the record: dates, times, who was involved, what happened, and the impact. Leave opinions out — they weaken it.";

// Word export: builds a .docx (opens in Word, Pages, and uploads to Google Docs)
const dxH = (text, level) => new DocxP({ heading: level, children: [new DocxT(text)] });
const dxP = (runs, opts = {}) => new DocxP({ ...opts, children: runs.map(([t, o]) => new DocxT({ text: t, ...(o || {}) })) });
async function saveDocx(filename, children) {
  const doc = new DocxDocument({ sections: [{ children }], styles: { default: { document: { run: { font: "Calibri", size: 22 } } } } });
  const blob = await DocxPacker.toBlob(doc);
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function DisputeRecordsView() {
  const { T, store, update, building, buildingId, user, flash, backend } = useApp();
  const dpLaw = NALO_LAW[buildingState(building)] || NALO_LAW.QLD;
  const byLabel = `${user.name} (${ROLE_LABEL[user.role]})`;
  const refresh = async () => { try { const fresh = await loadDisputes(buildingId); update((s) => { s.disputes = fresh; }); } catch (e) {} };
  const [chain, setChain] = useState(null);
  const list = (store.disputes || []).filter((d) => !d.buildingId || d.buildingId === buildingId);
  const [openId, setOpenId] = useState(null);
  const [addKind, setAddKind] = useState(null);
  const [f, setF] = useState({ text: "", channel: "Email", fileName: "", fileData: "" });
  const [newing, setNewing] = useState(false);
  const [nf, setNf] = useState({ title: "", category: DP_CATS[0], unit: "" });
  const [dpUnits, setDpUnits] = useState([]);
  useEffect(() => { if (backend) listUnits(buildingId).then(setDpUnits).catch(() => {}); }, [buildingId, backend]);
  const [guide, setGuide] = useState(false);
  const open = list.find((d) => d.id === openId);
  React.useEffect(() => { setChain(null); if (backend && openId) { verifyDisputeChain(openId).then(setChain).catch(() => setChain(null)); } }, [openId, backend, (open && open.events ? open.events.length : 0)]);
  const append = (d, ev) => update((s) => { const x = s.disputes.find((y) => y.id === d.id); x.events.push({ seq: x.events.length + 1, at: today(), by: byLabel, ...ev }); });
  const addEvent = async () => {
    if (addKind === "document" ? !f.fileName : !f.text.trim()) return;
    if (backend) {
      try {
        let ev;
        if (addKind === "document") {
          const doc = f.fileObj ? await uploadAttachment(buildingId, "disputes", f.fileObj) : { name: f.fileName, path: "" };
          ev = { type: "document", by: byLabel, fileName: doc.name, filePath: doc.path, text: f.text.trim() || `${doc.name} added to the record.` };
        } else if (addKind === "correspondence") ev = { type: "correspondence", by: byLabel, channel: f.channel, text: f.text.trim() };
        else ev = { type: "update", by: byLabel, text: f.text.trim() };
        await appendDisputeEvent(buildingId, open.id, ev);
        await refresh();
      } catch (e) { flash("Couldn't add to the record — try again"); return; }
    } else {
      append(open, addKind === "update" ? { type: "update", text: f.text.trim() } : addKind === "correspondence" ? { type: "correspondence", channel: f.channel, text: f.text.trim() } : { type: "document", fileName: f.fileName, fileData: f.fileData, text: f.text.trim() || `${f.fileName} added to the record.` });
    }
    setF({ text: "", channel: "Email", fileName: "", fileData: "", fileObj: null }); setAddKind(null); flash("Added to the record — entries can't be edited or removed");
  };
  const escalate = async () => {
    if (backend) {
      try {
        await appendDisputeEvent(buildingId, open.id, { type: "stage", by: byLabel, text: `Escalated to formal dispute — full history carried forward. Next stop if unresolved: ${dpLaw.tribunal}.` });
        await setDisputeStatus(open.id, { title: open.title, status: "formal", category: open.category });
        await refresh();
      } catch (e) { flash("Couldn't escalate — try again"); return; }
    } else {
      append(open, { type: "stage", text: `Escalated to formal dispute — full history carried forward. Next stop if unresolved: ${dpLaw.tribunal}.` });
      update((s) => { s.disputes.find((y) => y.id === open.id).status = "formal"; });
    }
    flash("Escalated — the record travels with it");
  };
  const exportRecord = (d) => {
    const kids = [
      dxH(`Dispute record — ${d.ref}`, DocxH.HEADING_1),
      dxH(d.title, DocxH.HEADING_2),
      dxP([[`Category: ${d.category || "Uncategorised"} · Opened ${fmtAU(d.openedAt)} (day ${dpAge(d).n + 1}) · Status: ${d.status === "formal" ? "Formal dispute" : d.status === "resolved" ? "Resolved" : "Complaint"}`, {}]]),
      dxP([[`Exported from NaloHub ${fmtAU(today())} · Append-only record — entries are never edited or deleted${backend ? " · sealed with a SHA-256 tamper-evident chain" : ""}`, { italics: true, color: "666666", size: 18 }]]),
      dxP([[" "]]),
      dxH("Timeline", DocxH.HEADING_2),
    ];
    d.events.forEach((e) => {
      kids.push(dxP([[`${e.seq}. ${DP_EVENT_META[e.type].label}${e.channel ? " · " + e.channel : ""}`, { bold: true }], [`  ·  ${fmtAUT(e.at)}  ·  ${e.by}`, { color: "666666" }]]));
      kids.push(dxP([[e.text || "", {}]], { indent: { left: 360 } }));
      if (e.fileName) kids.push(dxP([[`Attachment: ${e.fileName}`, { italics: true, size: 18 }]], { indent: { left: 360 } }));
      kids.push(dxP([[" "]]));
    });
    saveDocx(`${d.ref}-record.docx`, kids).then(() => flash(`Full record exported as Word — ready for ${dpLaw.tribunal}`));
  };
  const newComplaint = async () => {
    if (!nf.title.trim()) return;
    if (backend) {
      try { await createDispute(buildingId, nf.title.trim(), byLabel, nf.category, nf.unit || null); await refresh(); }
      catch (e) { flash("Couldn't log the complaint — try again"); return; }
    } else {
      update((s) => { s.disputes = s.disputes || []; const ref = "DISP-" + String(s.disputes.length + 1).padStart(4, "0"); s.disputes.push({ id: "dp" + Math.random().toString(36).slice(2, 6), buildingId, ref, title: nf.title.trim(), category: nf.category, status: "complaint", openedAt: today(), events: [{ seq: 1, at: today(), type: "stage", by: byLabel, text: "Complaint received and logged." }] }); });
    }
    setNf({ title: "", category: DP_CATS[0], unit: "" }); setNewing(false); flash("Complaint logged — the record starts now");
  };
  if (open) {
    return (
      <div>
        <Head title={open.ref} sub={open.title} onBack={() => { setOpenId(null); setAddKind(null); }} backLabel="All records" action={<HeaderAction onClick={() => exportRecord(open)}><Download size={15} /> Export full record</HeaderAction>} />
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={SEMANTIC.ok}><Lock size={11} /> Append-only — entries can't be edited or deleted</Badge>
            {backend && chain === true && <Badge color={SEMANTIC.ok}><ShieldCheck size={11} /> Record verified — nothing altered</Badge>}
            {backend && chain === false && <Badge color={SEMANTIC.bad}><AlertTriangle size={11} /> Integrity check failed — contact support</Badge>}
            <Badge color={open.status === "formal" ? SEMANTIC.warn : T.accent}>{open.status === "formal" ? "Formal dispute" : open.status === "resolved" ? "Resolved" : "Complaint stage"}</Badge>
            {open.category && <Badge color={T.accent2}>{open.category}</Badge>}
            {(() => { const a = dpAge(open); return <Badge color={a.c}>Day {a.n + 1} · {a.label}</Badge>; })()}
            <span className="text-xs" style={{ color: T.textMuted }}>Opened {fmtAU(open.openedAt)}</span>
          </div>
        </Card>
        <Card style={{ padding: 18, marginBottom: 12 }}>
          <SectionTitle>Timeline</SectionTitle>
          {open.events.map((e) => { const M = DP_EVENT_META[e.type]; return (
            <div key={e.seq} className="flex gap-3 pb-4 relative">
              <div className="flex flex-col items-center"><span className="h-8 w-8 rounded-full grid place-items-center shrink-0" style={{ background: hexToRgba(T.accent, 0.14), color: T.accent }}><M.Icon size={14} /></span><span className="flex-1 w-px mt-1" style={{ background: T.border }} /></div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="text-xs mb-0.5" style={{ color: T.textMuted }}><b style={{ color: T.text }}>{M.label}{e.channel ? ` · ${e.channel}` : ""}</b> · {fmtAUT(e.at)} · {e.by}</div>
                <div className="text-sm leading-relaxed">{e.text}</div>
                {e.fileName && <div className="mt-1.5"><FileChip name={e.fileName} data={e.fileData} path={e.filePath} /></div>}
              </div>
            </div>
          ); })}
        </Card>
        {addKind === null ? (
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setAddKind("pick")} grad><Plus size={15} /> Add to this record</Btn>
            {open.status === "complaint" && <Btn kind="ghost" onClick={escalate}><ShieldAlert size={15} /> Escalate to formal dispute</Btn>}
          </div>
        ) : addKind === "pick" ? (
          <Card style={{ padding: 16 }}>
            <SectionTitle>What are you adding?</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-2">
              {[["update", "Update", Pencil, "A decision, phone call or progress note"], ["correspondence", "Email or message", Mail, "Log correspondence sent or received"], ["document", "Document", Paperclip, "A saved email file, PDF, photo or letter"], ["messages", "From in-app messages", MessageSquare, "Pull a message already in NaloHub straight into the record"]].map(([k, lab, Icon, hint]) => (
                <button key={k} onClick={() => setAddKind(k)} className="text-left rounded-xl px-3.5 py-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}><div className="flex items-center gap-2 font-semibold text-sm"><Icon size={15} style={{ color: T.accent }} /> {lab}</div><div className="text-xs mt-1" style={{ color: T.textMuted }}>{hint}</div></button>
              ))}
            </div>
            <div className="mt-3"><Btn kind="ghost" onClick={() => setAddKind(null)}>Cancel</Btn></div>
          </Card>
        ) : addKind === "messages" ? (
          <Card style={{ padding: 16 }}>
            <SectionTitle>Pick a message to log</SectionTitle>
            {(() => {
              const msgs = (store.messages || []).filter((m) => !m.buildingId || m.buildingId === buildingId).sort((a, z) => (a.date < z.date ? 1 : -1)).slice(0, 20);
              const logMsg = async (m) => {
                const ev = { type: "correspondence", channel: "In-app message", by: byLabel, text: `${m.from} → ${m.to} · ${fmtAU(m.date)} · [${m.category}] "${m.subject}" — ${m.body}` };
                if (backend) { try { await appendDisputeEvent(buildingId, open.id, ev); await refresh(); } catch (e) { flash("Couldn't add the message — try again"); return; } }
                else append(open, { type: "correspondence", channel: "In-app message", text: ev.text });
                setAddKind(null); flash("Message logged into the record — original stays in Messaging");
              };
              return msgs.length === 0 ? <div className="text-sm" style={{ color: T.textMuted }}>No in-app messages for this building yet.</div> : (
                <div className="space-y-2">{msgs.map((m) => (
                  <button key={m.id} onClick={() => logMsg(m)} className="w-full text-left rounded-xl px-3.5 py-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
                    <div className="flex items-center gap-2 text-sm"><Badge color={T.accent}>{m.category}</Badge><span className="font-semibold flex-1 truncate">{m.subject}</span><span className="text-xs shrink-0" style={{ color: T.textMuted }}>{fmtAU(m.date)}</span></div>
                    <div className="text-xs mt-1 truncate" style={{ color: T.textMuted }}>{m.from} → {m.to} · {m.body}</div>
                  </button>
                ))}</div>
              );
            })()}
            <div className="mt-3"><Btn kind="ghost" onClick={() => setAddKind(null)}>Cancel</Btn></div>
          </Card>
        ) : (
          <Card style={{ padding: 16 }}>
            <SectionTitle>{addKind === "update" ? "Add an update" : addKind === "correspondence" ? "Log an email or message" : "Attach a document or email file"}</SectionTitle>
            <div className="space-y-3">
              {addKind === "correspondence" && <Field label="Channel"><Select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{["Email", "In-app message", "Letter", "Phone call", "In person"].map((c) => <option key={c}>{c}</option>)}</Select></Field>}
              {addKind === "document" && <Field label="File"><label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-4 text-sm cursor-pointer" style={{ borderColor: T.border, color: f.fileName ? T.text : T.textMuted }}><Paperclip size={15} /> {f.fileName || "Choose a PDF, saved email (.eml), photo or letter"}<input type="file" className="hidden" onChange={(e) => { const file = e.target.files && e.target.files[0]; if (!file) return; if (backend) setF((p) => ({ ...p, fileName: file.name, fileObj: file })); else readUpload(file, (data) => setF((p) => ({ ...p, fileName: file.name, fileData: data })), flash); }} /></label></Field>}
              <Field label={addKind === "document" ? "Note (optional)" : "What happened?"}><TextArea rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder={addKind === "correspondence" ? "e.g. Emailed the occupier a copy of By-law 1 and asked for a response by Friday" : "e.g. 8:45pm Tue 7 Jul — spoke with occupier of 407 at their door about the noise; they agreed to end gatherings by 10pm"} /><div className="text-[11px] mt-1.5" style={{ color: T.textMuted }}>{DP_GUIDE_HINT}</div></Field>
              <div className="flex gap-2 justify-end"><Btn kind="ghost" onClick={() => setAddKind(null)}>Cancel</Btn><Btn onClick={addEvent} grad>Add to record</Btn></div>
            </div>
          </Card>
        )}
      </div>
    );
  }
  return (
    <div>
      <Head title="Dispute Records" sub="Complaints and disputes with a complete, defensible paper trail" action={<div className="flex gap-2 flex-wrap"><HeaderAction data-guide="g-dp-log" onClick={() => setNewing((v) => !v)}><Plus size={15} /> Log a complaint</HeaderAction>{list.length > 0 && <HeaderAction onClick={() => { const headers = ["ref", "title", "category", "status", "opened", "age_days", "age_band", "entries", "last_activity"]; const rows = list.map((d) => { const a = dpAge(d); return { ref: d.ref, title: d.title, category: d.category || "", status: d.status, opened: d.openedAt, age_days: a.n + 1, age_band: a.label, entries: d.events.length, last_activity: (d.events[d.events.length - 1] || {}).at || "" }; }); downloadCSV("dispute-register.csv", toCSV(headers, rows)); flash("CSV downloaded — opens straight into Excel or Google Sheets"); }}><BarChart3 size={15} /> Excel (CSV)</HeaderAction>}</div>} />
      <Card style={{ padding: 14, marginBottom: 12 }}>
        <button onClick={() => setGuide((v) => !v)} className="w-full flex items-center gap-2 text-left">
          <ShieldCheck size={16} style={{ color: SEMANTIC.ok }} />
          <span className="text-sm font-semibold flex-1">How to keep a defensible record</span>
          <ChevronRight size={15} style={{ color: T.textMuted, transform: guide ? "rotate(90deg)" : "none", transition: ".2s" }} />
        </button>
        {guide && <ul className="text-sm mt-3 space-y-1.5" style={{ color: T.textMuted }}>
          <li>• Log every contact <b>as it happens</b> — a record built later is a record challenged later.</li>
          <li>• Attach everything <b>here</b>, not in personal inboxes: emails, photos, letters, quotes.</li>
          <li>• Record decisions <b>with reasons</b> — "declined because…" beats "declined".</li>
          <li>• Never edit history. This record is append-only by design — that's what makes it credible.</li>
          <li>• Export the full record <b>before</b> lodging with {dpLaw.tribunal}.</li>
        </ul>}
      </Card>
      {newing && <Card style={{ padding: 16, marginBottom: 12 }}><SectionTitle>Log a new complaint</SectionTitle><div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2"><Input value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} placeholder="e.g. Noise complaint — Unit 12, weekend parties" onKeyDown={(e) => { if (e.key === "Enter") newComplaint(); }} /><Select value={nf.category} onChange={(e) => setNf({ ...nf, category: e.target.value })} style={{ minWidth: 170 }}>{DP_CATS.map((c) => <option key={c}>{c}</option>)}</Select><Select value={nf.unit} onChange={(e) => setNf({ ...nf, unit: e.target.value })} style={{ minWidth: 130 }} title="Linking the complaint to a lot makes it visible in that unit's history"><option value="">No unit</option>{dpUnits.map((u) => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}</Select><Btn onClick={newComplaint} grad>Start record</Btn></div><div className="text-[11px] mt-2" style={{ color: T.textMuted }}>Steer complaints here early — if one becomes a formal dispute, its whole history escalates with it. {DP_GUIDE_HINT}</div></Card>}
      {list.length === 0 ? <Empty icon={ShieldCheck} title="No complaints or disputes" hint="When one arrives, log it here so the record starts on day one." /> :
        list.map((d) => (
          <button key={d.id} onClick={() => setOpenId(d.id)} className="w-full text-left mb-2.5">
            <Card hover style={{ padding: 16 }}>
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: hexToRgba(d.status === "formal" ? SEMANTIC.warn : T.accent, 0.14), color: d.status === "formal" ? SEMANTIC.warn : T.accent }}><ShieldCheck size={18} /></span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px] truncate">{d.title}</div>
                  <div className="text-xs flex items-center gap-1.5 flex-wrap" style={{ color: T.textMuted }}><span className="h-2 w-2 rounded-full inline-block" style={{ background: dpAge(d).c }} title={dpAge(d).label} />{d.ref} · day {dpAge(d).n + 1} · {d.category || "Uncategorised"} · {d.events.length} entries</div>
                </div>
                <Badge color={d.status === "formal" ? SEMANTIC.warn : d.status === "resolved" ? SEMANTIC.ok : T.accent}>{d.status === "formal" ? "Formal dispute" : d.status === "resolved" ? "Resolved" : "Complaint"}</Badge>
                <ChevronRight size={16} style={{ color: T.textMuted }} />
              </div>
            </Card>
          </button>
        ))}
      <div className="text-[11px] mt-2 px-1" style={{ color: T.textMuted }}>{backend ? "Records are append-only — every entry is sealed into a SHA-256 tamper-evident chain the moment it's added. Open a record to see its integrity badge." : "Records are append-only. In production, every entry is sealed into a SHA-256 tamper-evident chain, and a per-dispute email address files forwarded correspondence automatically."}</div>
    </div>
  );
}
const fmtAU = (d) => (d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "");
