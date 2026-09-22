import { supabase } from "./supabaseClient.js";

// Local calendar dates. toISOString() is UTC, which in Queensland is the previous day
// until 10am, so it must never be used for a date a person will read (0.35.3, 0.35.4).
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localDay = (v) => { if (!v) return ""; const t = String(v); if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; const d = new Date(t.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")); return isNaN(d.getTime()) ? t.substring(0, 10) : ymdLocal(d); };
const localDate = () => ymdLocal(new Date());

export const CONTENT = [
  "announcements", "maintenance", "assets", "bookings", "events", "gallery", "marketplace",
  "messages", "documents", "meetings", "actions", "keyfobs", "businesses",
  "bylaws", "compliance",
];

// Content tables whose `data` JSONB can hold multi-MB base64 payloads.
// Opening a building must NEVER download file bytes: we read a metadata-only
// view (`data - 'fileData'`) instead of the table, and fetch the bytes for a
// single record on demand when someone actually asks for the file.
//
// Why this exists: Curve Birtinya held 43 MB of base64 PDFs in documents.data,
// so `documents?select=id,data` added ~20 s to every building open and the app
// silently fell back to Your Buildings on slower connections.
// See supabase/migrations/0005_documents_lazy_files.sql and
// INCIDENT_2026-08-01_CURVE_LOAD.md.
const HEAVY_TABLES = {
  documents: { view: "documents_meta", fileKey: "fileData" },
  gallery: { view: "gallery_meta", fileKey: "image" },
};

// ---- audit trail --------------------------------------------------------
// Insert-only activity log. The DB stamps actor (auth.uid()) and created_at
// itself, so callers only say what happened. Fire-and-forget: an audit
// failure must never block or break the action being logged. In demo mode
// (no Supabase env) this is a silent no-op.
export function audit(buildingId, action, target = "", detail = null) {
  try {
    if (!import.meta.env.VITE_SUPABASE_URL || !buildingId) return;
    supabase.from("audit_log").insert({ building_id: buildingId, action, target: String(target || "").slice(0, 200), detail }).then(() => {}, () => {});
  } catch (e) { /* never block the UI on audit */ }
}

const initials = (name) => (name || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "RP";

const memberToUser = (m) => ({
  id: m.id, authId: m.user_id, buildingId: m.building_id,
  name: m.full_name || m.email || "Resident", unit: m.unit || "",
  role: m.role, status: m.status, email: m.email || "", phone: m.phone || "",
  showPhone: !!m.show_phone, showEmail: !!m.show_email, msc: !!m.msc,
  directoryOptIn: true, lastSeenGallery: m.last_seen_gallery || null,
});

// Default building shape (everything the app expects present)
export const defaultBuildingData = (name, address, x = {}) => ({
  name, type: "Residential apartments", address: address || "",
  logoText: initials(name), logoImage: "",
  units: Number(x.units) || 0, floors: Number(x.floors) || 0, towers: Number(x.towers) || 1,
  strataManager: "", buildingManager: "", towerDesc: x.towerDesc || "", bccEmail: "",
  strataContactName: "", strataContactPhone: "", strataContactEmail: "",
  facilities: { bbq: true, visitor: true, lift: true, common: true, gym: false },
  modules: { events: true, gallery: true, marketplace: true, messaging: true, directory: true, business: true, documents: true, meetings: true, keyfobs: true, firesafety: true, whatsapp: false },
  themeId: x.themeId || "midnight", whatsappLink: "", whatsappName: "",
  emergency: [], fireNotes: "",
});

// ---- profile / memberships ----
export async function loadProfile(authUser) {
  const { data } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  return data || { id: authUser.id, is_platform_admin: false };
}

export async function loadMyMemberships(authUser) {
  const { data, error } = await supabase.from("memberships")
    .select("building_id, role, status, buildings(*)")
    .eq("user_id", authUser.id).eq("status", "active");
  if (error) throw error;
  return data || [];
}

// ---- load a building's full store ----
export async function loadBuildingStore(bid, authUser) {
  const { data: bRow, error: be } = await supabase.from("buildings").select("id, data").eq("id", bid).single();
  if (be) throw be;
  const building = { id: bRow.id, ...(bRow.data || {}) };

  const { data: allMems, error: me } = await supabase.from("memberships").select("*").eq("building_id", bid);
  if (me) throw me;
  const users = (allMems || []).map(memberToUser);

  const store = { buildings: [building], users };
  for (const t of CONTENT) {
    // Heavy tables are read through their metadata view so file bytes stay on
    // the server until requested (see HEAVY_TABLES above).
    const source = HEAVY_TABLES[t] ? HEAVY_TABLES[t].view : t;
    const { data, error } = await supabase.from(source).select("id, data").eq("building_id", bid);
    if (error) throw error;
    store[t] = (data || []).map((r) => ({ id: r.id, ...(r.data || {}) }));
  }
  store.disputes = await loadDisputes(bid);
  const me2 = users.find((u) => u.authId === authUser.id) || users[0];
  return { store, buildingId: bid, currentUserId: me2 ? me2.id : null };
}

// Fetch one document's file bytes on demand (the base64 data-URL kept out of
// the building load). Reads the real `documents` table, so the row's RLS
// policy decides whether the caller may have it — the visibility/released
// rules the Documents screen applies are unchanged and still enforced
// server-side. Returns null when the document has no file attached.
export async function getDocumentFile(docId) {
  if (!docId) return null;
  const { data, error } = await supabase.from("documents")
    .select("fileData:data->>fileData").eq("id", docId).maybeSingle();
  if (error) throw error;
  return (data && data.fileData) || null;
}

// Gallery photos, same deal: the building load carries captions/categories
// only, and the Gallery screen asks for the actual images when it opens.
// One request for the building rather than one per tile — a gallery is
// browsed all at once, so per-tile fetching would just be chattier.
// Returns { [galleryId]: dataUrl }. RLS on `gallery` still applies.
export async function getGalleryImages(bid) {
  if (!bid) return {};
  const { data, error } = await supabase.from("gallery")
    .select("id, image:data->>image").eq("building_id", bid);
  if (error) throw error;
  const out = {};
  (data || []).forEach((r) => { if (r.image) out[r.id] = r.image; });
  return out;
}

// ---- platform admin: list every building ----
export async function loadAllBuildings(authUser) {
  const { data: bs, error } = await supabase.from("buildings").select("id, data");
  if (error) throw error;
  const { data: mems } = await supabase.from("memberships").select("building_id, user_id");
  const counts = {}; const mine = {};
  (mems || []).forEach((m) => { counts[m.building_id] = (counts[m.building_id] || 0) + 1; if (m.user_id === authUser.id) mine[m.building_id] = true; });
  return (bs || []).map((b) => ({
    id: b.id, name: (b.data && b.data.name) || "(unnamed)",
    address: (b.data && b.data.address) || "", members: counts[b.id] || 0, isMember: !!mine[b.id],
    reference: !!(b.data && b.data.reference), // internal / state-reference building — never billed
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// Platform console: billing state per building, for the live/pilot/reference cues.
export async function loadBillingStatuses() {
  const { data, error } = await supabase.from("building_billing")
    .select("building_id, status, billing_model, trial_end, payment_method_label, pa_discount_pct");
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.building_id] = r; });
  return map;
}

// Flag/unflag a building as a reference/internal build (stored on buildings.data).
export async function setBuildingReference(bid, on) {
  const { data: row, error } = await supabase.from("buildings").select("id, data").eq("id", bid).single();
  if (error) throw error;
  const { error: e2 } = await supabase.from("buildings").update({ data: { ...(row.data || {}), reference: !!on } }).eq("id", bid);
  if (e2) throw e2;
}

export async function createBuilding(fields, authUser) {
  const data = defaultBuildingData(fields.name, fields.address, fields);
  const { data: ins, error } = await supabase.from("buildings").insert({ data }).select("id").single();
  if (error) throw error;
  const bid = ins.id;
  // The founder's admin row deliberately carries no email address. A platform admin is
  // how NaloHub reaches a building, not a person who lives in it, and their personal
  // contact details should never land in a building's member list. Who established the
  // building is recorded separately, on the building record itself.
  const { error: e2 } = await supabase.from("memberships").insert({
    building_id: bid, user_id: authUser.id, email: null,
    full_name: "Admin", role: "admin", status: "active",
  });
  if (e2) throw e2;
  audit(bid, "building.created", fields.name);
  return bid;
}

export async function joinAsAdmin(bid, authUser) {
  // Opening a building from the Platform Console used to mint a membership carrying the
  // admin's own email, so every admin who ever looked at a building left their personal
  // address in it. The row now carries no email. Because UNIQUE (building_id, email)
  // does not constrain NULLs, the duplicate check has to be explicit rather than left
  // to the database, or every visit would add another Admin row.
  const { data: existing, error: qe } = await supabase.from("memberships")
    .select("id").eq("building_id", bid).eq("user_id", authUser.id).limit(1);
  if (qe) throw qe;
  if (existing && existing.length) return;
  const { error } = await supabase.from("memberships").insert({
    building_id: bid, user_id: authUser.id, email: null,
    full_name: "Admin", role: "admin", status: "active",
  });
  if (error && !String(error.message || "").includes("duplicate")) throw error;
}

export async function listMembers(bid) {
  const { data, error } = await supabase.from("memberships").select("*").eq("building_id", bid);
  if (error) throw error;
  return data || [];
}
// Manually send the branded magic-link "invite" email to one member, then
// stamp invited_at so the UI can show "Invite sent". Non-fatal: returns
// { ok:false, reason } if the email couldn't be sent.
export async function sendInvite(member) {
  const email = (member && member.email ? member.email : "").trim();
  if (!email) return { ok: false, reason: "No email on this member" };
  const redirect = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: redirect },
  });
  if (error) return { ok: false, reason: error.message };
  if (member.id) {
    await supabase.from("memberships").update({ invited_at: new Date().toISOString() }).eq("id", member.id);
  }
  audit(member.building_id, "member.invite_sent", email);
  return { ok: true };
}

// Send invites to a list of members (controlled release). Returns counts.
export async function sendInvites(members) {
  let sent = 0; const failures = [];
  for (const m of members || []) {
    const res = await sendInvite(m);
    if (res.ok) sent++; else failures.push(`${m.email}: ${res.reason}`);
  }
  return { sent, failures };
}

// Add a member WITHOUT sending any email (prepare the building first).
export async function addMember(bid, m) {
  const email = (m.email || "").trim();
  const { error } = await supabase.from("memberships").insert({
    building_id: bid, email, full_name: m.full_name || email,
    role: m.role || "owner", unit: m.unit || null, status: "pending",
  });
  if (error) throw error;
  audit(bid, "member.added", email);
}

// Bulk add members from an uploaded list. No emails are sent.
// Returns { added, skipped } — skips rows already present (same email in building).
export async function addMembersBulk(bid, rows) {
  const existing = await listMembers(bid);
  const have = new Set(existing.map((u) => (u.email || "").trim().toLowerCase()));
  const seen = new Set();
  const toInsert = [];
  for (const r of rows || []) {
    const email = (r.email || "").trim();
    const key = email.toLowerCase();
    if (!email || have.has(key) || seen.has(key)) continue;
    seen.add(key);
    toInsert.push({
      building_id: bid, email, full_name: (r.full_name || "").trim() || email,
      role: (r.role || "owner").trim().toLowerCase(), unit: (r.unit || "").trim() || null, status: "pending",
    });
  }
  if (toInsert.length) {
    const { error } = await supabase.from("memberships").insert(toInsert);
    if (error) throw error;
    audit(bid, "member.bulk_added", toInsert.length + " members");
  }
  return { added: toInsert.length, skipped: (rows || []).length - toInsert.length };
}
export async function updateMemberRole(id, role) {
  const { error } = await supabase.from("memberships").update({ role }).eq("id", id);
  if (error) throw error;
}
// Edit a member's editable fields (name, email, unit, role).
export async function updateMember(id, fields) {
  const patch = {};
  if (fields.full_name !== undefined) patch.full_name = fields.full_name;
  if (fields.email !== undefined) patch.email = (fields.email || "").trim();
  if (fields.unit !== undefined) patch.unit = fields.unit || null;
  if (fields.role !== undefined) patch.role = fields.role;
  const { error } = await supabase.from("memberships").update(patch).eq("id", id);
  if (error) throw error;
}
export async function removeMember(id) {
  const { error } = await supabase.from("memberships").delete().eq("id", id);
  if (error) throw error;
}

// ---- save: diff prev vs next, sync changes ----
const ix = (arr) => Object.fromEntries((arr || []).map((r) => [r.id, r]));
const diff = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

export async function persistChange(prev, next, bid) {
  if (!prev || !next) return;
  const jobs = []; const audits = [];
  for (const t of CONTENT) {
    const before = ix(prev[t]); const after = ix(next[t]);
    for (const rec of next[t] || []) {
      if (!before[rec.id] || diff(before[rec.id], rec)) {
        const { id, ...data } = rec;
        // NOTE: records from HEAVY_TABLES arrive here without their file bytes
        // (the store only ever held metadata), so this upsert writes `data`
        // with no `fileData` key. A BEFORE UPDATE trigger on `documents`
        // re-attaches the existing payload, so editing a document — e.g.
        // Release — can never blank the file. Migration 0005.
        jobs.push(supabase.from(t).upsert({ id, building_id: bid, data }));
        audits.push([t + (before[rec.id] ? ".updated" : ".created"), rec.title || rec.name || rec.id]);
      }
    }
    for (const rec of prev[t] || []) if (!after[rec.id]) { jobs.push(supabase.from(t).delete().eq("id", rec.id)); audits.push([t + ".deleted", rec.title || rec.name || rec.id]); }
  }
  const pb = (prev.buildings || [])[0];
  const nb = (next.buildings || []).find((b) => pb && b.id === pb.id);
  if (pb && nb && diff(pb, nb)) { const { id, ...data } = nb; jobs.push(supabase.from("buildings").update({ data }).eq("id", id)); audits.push(["building.settings_updated", nb.name || id]); }

  const beforeU = ix(prev.users); const afterU = ix(next.users);
  for (const u of next.users || []) {
    const b = beforeU[u.id];
    const row = { full_name: u.name, role: u.role, unit: u.unit, phone: u.phone, show_phone: !!u.showPhone, show_email: !!u.showEmail, msc: !!u.msc, status: u.status || "pending", email: u.email };
    if (!b) { jobs.push(supabase.from("memberships").insert({ building_id: bid, ...row })); audits.push(["member.added", u.email || u.name]); }
    else if (diff(b, u)) { jobs.push(supabase.from("memberships").update(row).eq("id", u.id)); audits.push(["member.updated", u.email || u.name]); }
  }
  for (const u of prev.users || []) if (!afterU[u.id]) { jobs.push(supabase.from("memberships").delete().eq("id", u.id)); audits.push(["member.removed", u.email || u.name]); }

  const results = await Promise.all(jobs);
  const failed = results.find((r) => r && r.error);
  if (failed) throw failed.error;
  audits.forEach(([action, target]) => audit(bid, action, target));
}

// ---- Nalo premium suite -------------------------------------------------
// Disputes are NOT in CONTENT: their events live in a hash-chained,
// append-only table and must never be diff-synced or rewritten.
const disputeEventToApp = (e) => ({ seq: e.seq, at: e.created_at || "", ...(e.data || {}) });

export async function loadDisputes(bid) {
  const { data: ds, error } = await supabase.from("disputes").select("id, ref, data, created_at").eq("building_id", bid);
  if (error) return []; // owners/tenants: RLS filters everything out
  if (!ds || !ds.length) return [];
  const { data: evs } = await supabase.from("dispute_events").select("dispute_id, seq, data, created_at").eq("building_id", bid).order("seq");
  const byDispute = {};
  (evs || []).forEach((e) => { (byDispute[e.dispute_id] = byDispute[e.dispute_id] || []).push(disputeEventToApp(e)); });
  return ds.map((d) => ({ id: d.id, buildingId: bid, ref: d.ref, openedAt: localDay(d.created_at), ...(d.data || {}), events: byDispute[d.id] || [] }));
}

export async function createDispute(bid, title, byLabel, category, unitId) {
  const { count } = await supabase.from("disputes").select("id", { count: "exact", head: true }).eq("building_id", bid);
  const ref = "DISP-" + String((count || 0) + 1).padStart(4, "0");
  const { data: ins, error } = await supabase.from("disputes").insert({ building_id: bid, ref, unit_id: unitId || null, data: { title, status: "complaint", category: category || "Other" } }).select("id").single();
  if (error) throw error;
  const { error: e2 } = await supabase.from("dispute_events").insert({ dispute_id: ins.id, building_id: bid, data: { type: "stage", by: byLabel, text: "Complaint received and logged." } });
  if (e2) throw e2;
  audit(bid, "dispute.created", ref);
  return ins.id;
}

export async function appendDisputeEvent(bid, disputeId, eventData) {
  const { error } = await supabase.from("dispute_events").insert({ dispute_id: disputeId, building_id: bid, data: eventData });
  if (error) throw error;
  audit(bid, "dispute.event_added", eventData.type || "update");
}

export async function setDisputeStatus(disputeId, data) {
  const { error } = await supabase.from("disputes").update({ data }).eq("id", disputeId);
  if (error) throw error;
}

export async function verifyDisputeChain(disputeId) {
  const { data, error } = await supabase.rpc("verify_dispute_chain", { p_dispute_id: disputeId });
  if (error) return null;
  return data;
}

// Legislation search: state-locked full-text search over the ingested Acts.
export async function searchLegislation(query, jurisdiction, limit = 6) {
  const { data, error } = await supabase.rpc("search_legislation", { p_query: query, p_jurisdiction: jurisdiction, p_limit: limit });
  if (error) throw error;
  return (data || []).map((r) => ({ ref: r.ref, title: r.heading, text: r.content, source: r.source_title }));
}

// Attachments: private bucket, paths scoped {buildingId}/{area}/{file}
export async function uploadAttachment(bid, area, file) {
  const safe = (file.name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = `${bid}/${area}/${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))}-${safe}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: false });
  if (error) throw error;
  audit(bid, "attachment.uploaded", safe);
  return { name: file.name, path };
}

export async function attachmentUrl(path) {
  const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// ---- billing ----
export async function loadTiers() {
  const { data, error } = await supabase.from("billing_tiers").select("*").order("sort");
  if (error) throw error;
  return data || [];
}
export async function updateTier(id, fields) {
  const { error } = await supabase.from("billing_tiers").update(fields).eq("id", id);
  if (error) throw error;
}
export async function loadBuildingBilling(bid) {
  const { data, error } = await supabase.from("building_billing").select("*").eq("building_id", bid).maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveBuildingBilling(bid, cfg) {
  const row = { ...cfg, building_id: bid, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("building_billing").upsert(row);
  if (error) throw error;
}
export async function loadInvoices(bid) {
  const { data, error } = await supabase.from("invoices").select("*").eq("building_id", bid).order("issue_date", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createInvoice(bid, inv) {
  const { error } = await supabase.from("invoices").insert({ building_id: bid, ...inv });
  if (error) throw error;
}
export async function setInvoiceStatus(id, status) {
  const patch = { status };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  if (status === "paid") patch.paid_at = new Date().toISOString();
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw error;
}

// ---- Unit Search / unit registry (committee) ---------------------------
// One call returns everything captured for a unit: people, pets, vehicles,
// keys & fobs, breaches, disputes and applications. RLS keeps it committee-only.
export async function unitHealthCheck(bid, unitNumber) {
  const { data, error } = await supabase.rpc("unit_health_check", { p_building: bid, p_unit: unitNumber });
  if (error) throw error;
  return data;
}
export async function listUnits(bid) {
  const { data, error } = await supabase.from("units").select("*").eq("building_id", bid).order("unit_number");
  if (error) throw error;
  return data || [];
}
// One browsable view of the whole building: every unit with who lives there and
// what is on record. Unit Search previously demanded you already knew a unit
// number, which is fine for a manager and useless for anyone discovering it.
export async function listUnitsOverview(bid) {
  const { data: units, error } = await supabase.from("units")
    .select("id, unit_number, lot_number, parking_spaces, agent_business, notes")
    .eq("building_id", bid).order("unit_number");
  if (error) throw error;
  const ids = (units || []).map((u) => u.id);
  if (!ids.length) return [];
  const [ppl, pets, veh, keys] = await Promise.all([
    supabase.from("unit_people").select("unit_id, person_type, full_name, is_current").in("unit_id", ids),
    supabase.from("unit_pets").select("unit_id").in("unit_id", ids),
    supabase.from("unit_vehicles").select("unit_id").in("unit_id", ids),
    supabase.from("unit_access_items").select("unit_id").eq("building_id", bid),
  ]);
  const count = (rows) => (rows.data || []).reduce((m, r) => { m[r.unit_id] = (m[r.unit_id] || 0) + 1; return m; }, {});
  const nPets = count(pets), nVeh = count(veh), nKeys = count(keys);
  const byUnit = {};
  (ppl.data || []).forEach((r) => { if (r.is_current === false) return; (byUnit[r.unit_id] = byUnit[r.unit_id] || []).push(r); });
  return units.map((u) => {
    const people = byUnit[u.id] || [];
    const pick = (t) => people.filter((p) => p.person_type === t).map((p) => p.full_name);
    return { ...u, owners: pick("owner"), tenants: pick("tenant"), others: pick("property_manager").concat(pick("emergency_contact")),
      pets: nPets[u.id] || 0, vehicles: nVeh[u.id] || 0, keys: nKeys[u.id] || 0 };
  });
}
export async function createUnit(bid, unit_number, lot_number, parking_spaces) {
  const { error } = await supabase.from("units").insert({ building_id: bid, unit_number, lot_number: lot_number || null, parking_spaces: Number(parking_spaces) || 0 });
  if (error) throw error;
  audit(bid, "unit.created", unit_number);
}
export async function addUnitPerson(bid, unitId, row) {
  const { error } = await supabase.from("unit_people").insert({ unit_id: unitId, ...row });
  if (error) throw error;
  audit(bid, "unit.person_added", row.full_name);
}
export async function addUnitPet(bid, unitId, row) {
  const { error } = await supabase.from("unit_pets").insert({ unit_id: unitId, ...row });
  if (error) throw error;
  audit(bid, "unit.pet_added", row.name || row.pet_type);
}
export async function addUnitVehicle(bid, unitId, row) {
  const { error } = await supabase.from("unit_vehicles").insert({ unit_id: unitId, ...row });
  if (error) throw error;
  audit(bid, "unit.vehicle_added", row.registration);
}
// Keys/fobs/remotes/cards. If issuedToUserId is set the recipient gets an
// in-app "confirm receipt" prompt (they must have app access to acknowledge).
export async function addAccessItem(bid, unitId, row) {
  const { error } = await supabase.from("unit_access_items").insert({ building_id: bid, unit_id: unitId, ...row });
  if (error) throw error;
  audit(bid, "unit.access_item_issued", `${row.item_type} ${row.identifier || ""}`.trim());
}
// Every access device in the building, for the Key & Fob Register.
//
// Why this exists: the register screen read the legacy `keyfobs` JSONB store
// while Unit Search read `unit_access_items`. Curve Birtinya's 230 imported
// keys landed in the latter, so the register showed an empty list. This is the
// building-wide read of the real table.
//
// Three queries rather than one embed: `occupants` needs unit_people filtered
// to current residents, which is cleaner stitched here (same shape as
// listUnitsOverview). `occupants` exists ONLY so the register can be searched
// by resident name. An item with no `issued_to` has NO recorded holder, and
// the UI must never present an occupant as one -- most BM registers record a
// key against a lot, not a person.
export async function listAccessItems(bid) {
  const { data: items, error } = await supabase.from("unit_access_items")
    .select("*, access_descriptors(id, name, item_type, purpose, sort, stock_tracked)")
    .eq("building_id", bid);
  if (error) throw error;
  if (!items || !items.length) return [];

  const { data: units, error: ue } = await supabase.from("units")
    .select("id, unit_number").eq("building_id", bid);
  if (ue) throw ue;
  const unitNo = {};
  (units || []).forEach((u) => { unitNo[u.id] = u.unit_number; });

  const unitIds = (units || []).map((u) => u.id);
  let people = [];
  if (unitIds.length) {
    const { data: pp, error: pe } = await supabase.from("unit_people")
      .select("unit_id, full_name, is_current").in("unit_id", unitIds);
    if (pe) throw pe;
    people = pp || [];
  }
  // De-duplicated by name: one person can legitimately hold two unit_people rows
  // for the same lot (Curve unit 606 has Debbie Ferguson as both owner and
  // emergency contact), which listed her twice in the register.
  const occ = {};
  people.forEach((p) => {
    if (p.is_current === false) return;
    const n = (p.full_name || "").trim();
    if (!n) return;
    const list = (occ[p.unit_id] = occ[p.unit_id] || []);
    if (!list.some((x) => x.toLowerCase() === n.toLowerCase())) list.push(n);
  });

  return items.map((a) => ({
    ...a,
    unit_number: unitNo[a.unit_id] || "",
    occupants: occ[a.unit_id] || [],
    descriptor: a.access_descriptors ? a.access_descriptors.name : "",
    descriptor_sort: a.access_descriptors ? a.access_descriptors.sort : 9999,
  }));
}

// ---- access descriptors: the building's own key/fob catalogue ---------------
// Per building, not a fixed list, because the list IS building-specific: Curve
// Birtinya names seven fire-stair levels, the next building has twelve or two
// towers. Each descriptor carries its classification so filters and any
// cross-building reporting still work. See migration 0019.
export async function listAccessDescriptors(bid) {
  const { data, error } = await supabase.from("access_descriptors")
    .select("*").eq("building_id", bid).order("sort").order("name");
  if (error) throw error;
  return data || [];
}
export async function saveAccessDescriptor(bid, d) {
  const row = {
    building_id: bid, name: String(d.name || "").trim(),
    item_type: d.item_type || "key", purpose: d.purpose || "resident",
    stock_tracked: !!d.stock_tracked, sort: Number(d.sort) || 0,
    active: d.active === undefined ? true : !!d.active,
  };
  const { error } = d.id
    ? await supabase.from("access_descriptors").update(row).eq("id", d.id)
    : await supabase.from("access_descriptors").insert(row);
  if (error) throw error;
  audit(bid, d.id ? "access.descriptor_updated" : "access.descriptor_added", row.name);
}
// Deactivate rather than delete: descriptor_id on an item is ON DELETE SET NULL,
// so a hard delete would silently unclassify every device that used it.
export async function setAccessDescriptorActive(bid, id, active) {
  const { error } = await supabase.from("access_descriptors").update({ active: !!active }).eq("id", id);
  if (error) throw error;
  audit(bid, active ? "access.descriptor_reactivated" : "access.descriptor_retired", id);
}

// ---- entitlements: what a unit is entitled to hold, per descriptor ----------
export async function listAccessEntitlements(bid) {
  const { data, error } = await supabase.from("unit_access_entitlements")
    .select("*").eq("building_id", bid);
  if (error) throw error;
  return data || [];
}
export async function setAccessEntitlement(bid, unitId, descriptorId, entitlement) {
  const n = Math.max(0, Number(entitlement) || 0);
  const { error } = await supabase.from("unit_access_entitlements")
    .upsert({ building_id: bid, unit_id: unitId, descriptor_id: descriptorId, entitlement: n, updated_at: new Date().toISOString() },
            { onConflict: "unit_id,descriptor_id" });
  if (error) throw error;
}
// Bulk load from the BCC's own sheet: [{ unit, descriptor, entitlement }].
// Returns what matched and what did not, because a silent skip on a 56-unit
// import is how a register quietly goes wrong.
export async function bulkSetAccessEntitlements(bid, rows) {
  const [units, descs] = await Promise.all([listUnits(bid), listAccessDescriptors(bid)]);
  const uBy = {}; units.forEach((u) => { uBy[String(u.unit_number).trim().toLowerCase()] = u.id; });
  const dBy = {}; descs.forEach((d) => { dBy[String(d.name).trim().toLowerCase()] = d.id; });
  const payload = []; const skipped = [];
  (rows || []).forEach((r) => {
    const uid = uBy[String(r.unit || "").trim().toLowerCase()];
    const did = dBy[String(r.descriptor || "").trim().toLowerCase()];
    if (!uid) { skipped.push(`unit "${r.unit}" not found`); return; }
    if (!did) { skipped.push(`descriptor "${r.descriptor}" not found`); return; }
    payload.push({ building_id: bid, unit_id: uid, descriptor_id: did,
      entitlement: Math.max(0, Number(r.entitlement) || 0), updated_at: new Date().toISOString() });
  });
  if (payload.length) {
    const { error } = await supabase.from("unit_access_entitlements")
      .upsert(payload, { onConflict: "unit_id,descriptor_id" });
    if (error) throw error;
    audit(bid, "access.entitlements_bulk_set", payload.length + " rows");
  }
  return { set: payload.length, skipped };
}

// Classify existing devices in bulk: [{ identifier, descriptor }]. The 230 rows
// imported from the BM register in Aug 2026 all arrived as one undifferentiated
// "Key or fob", and entitlement vs issued means nothing until they are sorted.
export async function bulkClassifyAccessItems(bid, rows) {
  const descs = await listAccessDescriptors(bid);
  const dBy = {}; descs.forEach((d) => { dBy[String(d.name).trim().toLowerCase()] = d.id; });
  let done = 0; const skipped = [];
  for (const r of rows || []) {
    const ident = String(r.identifier || "").trim();
    const did = dBy[String(r.descriptor || "").trim().toLowerCase()];
    if (!ident) { skipped.push("row with no key number"); continue; }
    if (!did) { skipped.push(`descriptor "${r.descriptor}" not found`); continue; }
    const patch = { descriptor_id: did };
    if (r.status) patch.status = r.status;
    const { error, count } = await supabase.from("unit_access_items")
      .update(patch, { count: "exact" }).eq("building_id", bid).eq("identifier", ident);
    if (error) { skipped.push(`${ident}: ${error.message}`); continue; }
    if (!count) { skipped.push(`key number "${ident}" not in the register`); continue; }
    done += count;
  }
  if (done) audit(bid, "access.items_classified", done + " devices");
  return { classified: done, skipped };
}

// ---- the Caretaker's annual audit ------------------------------------------
export async function runAccessAudit(bid) {
  const { data, error } = await supabase.rpc("access_audit", { p_building: bid });
  if (error) throw error;
  return data || [];
}

// ---- signed receipts --------------------------------------------------------
// Every key, fob and remote is signed for; the signed copy lives in the private
// attachments bucket and is linked to the device it belongs to.
export async function uploadAccessReceipt(bid, itemId, file) {
  const up = await uploadAttachment(bid, "key-receipts", file);
  const { error } = await supabase.from("unit_access_items")
    .update({ receipt_path: up.path, receipt_uploaded_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) throw error;
  audit(bid, "access.receipt_uploaded", up.name);
  return up;
}
export async function accessReceiptUrl(path) {
  return attachmentUrl(path);
}

// Lost or withdrawn devices are SUSPENDED, never deleted, and stay recorded
// against the unit or against stock. The BCC was explicit about that.
export async function suspendAccessItem(bid, id, reason) {
  const { error } = await supabase.from("unit_access_items")
    .update({ status: "suspended", suspended_at: new Date().toISOString(), suspended_reason: reason || null })
    .eq("id", id);
  if (error) throw error;
  audit(bid, "access.item_suspended", reason || id);
}
export async function updateAccessItemStatus(id, status) {
  const patch = { status };
  if (status === "returned") patch.returned_at = localDate();
  const { error } = await supabase.from("unit_access_items").update(patch).eq("id", id);
  if (error) throw error;
}
export async function acknowledgeAccessItem(itemId) {
  const { data, error } = await supabase.rpc("acknowledge_access_item", { p_item: itemId });
  if (error) throw error;
  return data;
}
export async function addUnitBreach(bid, unitId, row) {
  const { error } = await supabase.from("unit_breaches").insert({ building_id: bid, unit_id: unitId, ...row });
  if (error) throw error;
  audit(bid, "unit.breach_recorded", row.bylaw_ref || "");
}

// ---- Unit registry: corrections, move-outs and removals -------------------
// People are archived, never deleted: an owner or tenant who leaves keeps their
// place in the unit's history (is_current false + a move_out date), so the
// building can still answer "who lived here in 2024?". Only an archived record
// can be deleted outright, and only to clean up a genuine mis-entry.
export async function updateUnit(bid, unitId, patch) {
  const { error } = await supabase.from("units").update(patch).eq("id", unitId);
  if (error) throw error;
  audit(bid, "unit.updated", unitId);
}
export async function updateUnitPerson(bid, id, patch) {
  const { error } = await supabase.from("unit_people").update(patch).eq("id", id);
  if (error) throw error;
  audit(bid, "unit.person_updated", patch.full_name || id);
}
export async function moveOutUnitPerson(bid, id, moveOut) {
  const { error } = await supabase.from("unit_people").update({ is_current: false, move_out: moveOut || localDate() }).eq("id", id);
  if (error) throw error;
  audit(bid, "unit.person_moved_out", id);
}
export async function restoreUnitPerson(bid, id) {
  const { error } = await supabase.from("unit_people").update({ is_current: true, move_out: null }).eq("id", id);
  if (error) throw error;
  audit(bid, "unit.person_restored", id);
}
// Archives every current person of a given type on a unit. Used when a new
// owner or tenant replaces the last one rather than joining them.
export async function moveOutUnitPeopleOfType(bid, unitId, personType, moveOut) {
  const { data, error } = await supabase.from("unit_people")
    .update({ is_current: false, move_out: moveOut || localDate() })
    .eq("unit_id", unitId).eq("person_type", personType).eq("is_current", true).select("id");
  if (error) throw error;
  const n = (data || []).length;
  if (n) audit(bid, "unit.people_moved_out", `${n} ${personType}${n === 1 ? "" : "s"}`);
  return n;
}
export async function deleteUnitPerson(bid, id) {
  const { error } = await supabase.from("unit_people").delete().eq("id", id);
  if (error) throw error;
  audit(bid, "unit.person_deleted", id);
}
export async function updateUnitPet(bid, id, patch) {
  const { error } = await supabase.from("unit_pets").update(patch).eq("id", id);
  if (error) throw error;
  audit(bid, "unit.pet_updated", patch.name || patch.pet_type || id);
}
export async function deleteUnitPet(bid, id) {
  const { error } = await supabase.from("unit_pets").delete().eq("id", id);
  if (error) throw error;
  audit(bid, "unit.pet_removed", id);
}
export async function updateUnitVehicle(bid, id, patch) {
  const { error } = await supabase.from("unit_vehicles").update(patch).eq("id", id);
  if (error) throw error;
  audit(bid, "unit.vehicle_updated", patch.registration || id);
}
export async function deleteUnitVehicle(bid, id) {
  const { error } = await supabase.from("unit_vehicles").delete().eq("id", id);
  if (error) throw error;
  audit(bid, "unit.vehicle_removed", id);
}
export async function updateAccessItem(bid, id, patch) {
  const { error } = await supabase.from("unit_access_items").update(patch).eq("id", id);
  if (error) throw error;
  audit(bid, "unit.access_item_updated", patch.identifier || id);
}
export async function deleteAccessItem(bid, id) {
  const { error } = await supabase.from("unit_access_items").delete().eq("id", id);
  if (error) throw error;
  audit(bid, "unit.access_item_removed", id);
}
export async function updateUnitBreach(bid, id, patch) {
  const { error } = await supabase.from("unit_breaches").update(patch).eq("id", id);
  if (error) throw error;
  audit(bid, "unit.breach_updated", patch.bylaw_ref || id);
}
export async function deleteUnitBreach(bid, id) {
  const { error } = await supabase.from("unit_breaches").delete().eq("id", id);
  if (error) throw error;
  audit(bid, "unit.breach_removed", id);
}

// ---- Applications & Bookings --------------------------------------------
// Unified table: kind 'application' | 'booking', category-specific fields in
// details jsonb. Submission alerts the committee; decisions alert the
// applicant; approved parking applications auto-issue a permit (DB triggers).
export async function listApplications(bid) {
  const { data, error } = await supabase.from("applications").select("*").eq("building_id", bid).order("submitted_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createApplication(bid, authUserId, unitId, kind, category, title, details) {
  const { data, error } = await supabase.from("applications").insert({
    building_id: bid, unit_id: unitId || null, kind, category,
    title: title || null, details: details || {}, status: "submitted", submitted_by: authUserId,
  }).select("id").single();
  if (error) throw error;
  audit(bid, "application.submitted", title || category);
  return data.id;
}
export async function decideApplication(bid, id, approve, note, authUserId) {
  const { error } = await supabase.from("applications").update({
    status: approve ? "approved" : "declined",
    decided_by: authUserId, decided_at: new Date().toISOString(), decision_note: note || null,
  }).eq("id", id);
  if (error) throw error;
  audit(bid, approve ? "application.approved" : "application.declined", id);
}
export async function withdrawApplication(bid, id) {
  const { error } = await supabase.from("applications").update({ status: "withdrawn" }).eq("id", id);
  if (error) throw error;
  audit(bid, "application.withdrawn", id);
}
export async function listApplicationAttachments(applicationIds) {
  if (!applicationIds.length) return [];
  const { data, error } = await supabase.from("application_attachments").select("*").in("application_id", applicationIds);
  if (error) throw error;
  return data || [];
}
// Media bucket: images, video and documents (quotes etc.), member-scoped paths.
export async function uploadMedia(bid, area, file) {
  const safe = (file.name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const path = `${bid}/${area}/${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))}-${safe}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false });
  if (error) throw error;
  const kind = /^image\//.test(file.type) ? "image" : /^video\//.test(file.type) ? "video" : "document";
  return { name: file.name, path, kind };
}
export async function mediaUrl(path) {
  const { data, error } = await supabase.storage.from("media").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function addApplicationAttachment(applicationId, up) {
  const { error } = await supabase.from("application_attachments").insert({
    application_id: applicationId, file_name: up.name, file_kind: up.kind, storage_path: up.path,
  });
  if (error) throw error;
}
// Parking permits (auto-issued on approval). PDF is generated on demand by
// the permit-pdf edge function, fetched with the caller's session token.
export async function listPermits(bid) {
  const { data, error } = await supabase.from("parking_permits").select("*").eq("building_id", bid).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function openPermitPdf(permitId) {
  const { data: s } = await supabase.auth.getSession();
  const token = s && s.session ? s.session.access_token : "";
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/permit-pdf?id=${permitId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } });
  if (!res.ok) throw new Error("Couldn't generate the permit PDF");
  const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  window.open(obj, "_blank");
  setTimeout(() => URL.revokeObjectURL(obj), 60000);
}

// ---- BCC voting: motions, votes, proxies ---------------------------------
// Majority is snapshot at opening: floor(BCC members / 2) + 1. Votes are
// immutable (audit trail); the DB tallies and decides automatically.
export async function listMotions(bid) {
  const { data, error } = await supabase.from("motions").select("*").eq("building_id", bid).order("opened_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function listMotionVotes(motionIds) {
  if (!motionIds.length) return [];
  const { data, error } = await supabase.from("motion_votes").select("*").in("motion_id", motionIds);
  if (error) throw error;
  return data || [];
}
export async function createMotion(bid, authUserId, m) {
  const { data, error } = await supabase.from("motions").insert({
    building_id: bid, title: m.title, description: m.description || null,
    context_type: m.context_type || "general", context_id: m.context_id || null,
    details: m.details || {}, opened_by: authUserId,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}
export async function castVote(motionId, authUserId, vote, comment, proxy) {
  const row = { motion_id: motionId, voter_user_id: authUserId, vote, comment: comment || null };
  if (proxy) { row.proxy_for_user_id = proxy.principal_user_id; row.proxy_appointment_id = proxy.id; }
  const { error } = await supabase.from("motion_votes").insert(row);
  if (error) throw error;
}
export async function updateMotionConditions(motionId, conditions) {
  const { data: m, error: ge } = await supabase.from("motions").select("details").eq("id", motionId).single();
  if (ge) throw ge;
  const { error } = await supabase.from("motions").update({ details: { ...(m.details || {}), conditions } }).eq("id", motionId).eq("status", "open");
  if (error) throw error;
}
// Conditions of Approval are versioned. Amending an open motion snapshots the previous
// conditions plus every vote cast against them into motion.details.history, bumps
// motion.version, sets the live votes aside (so members vote again on what they can now
// see) and alerts the BCC. Any BCC member may amend; a reason is mandatory. Runs as one
// server-side RPC so a half-applied amendment is impossible.
export async function amendMotionConditions(motionId, conditions, reason, authorName) {
  const { data, error } = await supabase.rpc("amend_motion_conditions", { p_motion_id: motionId, p_conditions: conditions, p_reason: reason, p_author_name: authorName || null });
  if (error) throw error;
  return data;
}
export async function withdrawMotion(id) {
  const { error } = await supabase.from("motions").update({ status: "withdrawn", decided_at: new Date().toISOString() }).eq("id", id).eq("status", "open");
  if (error) throw error;
}
export async function listProxies(bid) {
  const { data, error } = await supabase.from("proxy_appointments").select("*").eq("building_id", bid).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createProxy(bid, p) {
  const { error } = await supabase.from("proxy_appointments").insert({ building_id: bid, ...p });
  if (error) throw error;
  audit(bid, "proxy.appointed", `${p.principal_name} -> ${p.proxy_name}`);
}
export async function revokeProxy(bid, id) {
  const { error } = await supabase.from("proxy_appointments").update({ status: "revoked" }).eq("id", id);
  if (error) throw error;
  audit(bid, "proxy.revoked", id);
}
export async function openProxyFormPdf(id) {
  const { data: s } = await supabase.auth.getSession();
  const token = s && s.session ? s.session.access_token : "";
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-form-pdf?id=${id}`, { headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } });
  if (!res.ok) throw new Error("Couldn't generate the proxy form");
  const obj = URL.createObjectURL(await res.blob());
  window.open(obj, "_blank");
  setTimeout(() => URL.revokeObjectURL(obj), 60000);
}

// ---- maintenance workflow: activity trail + quotes -------------------------
export async function listMaintActivity(bid, maintenanceId) {
  const { data, error } = await supabase.from("maintenance_activity").select("*").eq("building_id", bid).eq("maintenance_id", maintenanceId).order("created_at");
  if (error) throw error;
  return data || [];
}
export async function addMaintActivity(bid, maintenanceId, kind, body, extra) {
  const { error } = await supabase.from("maintenance_activity").insert({ building_id: bid, maintenance_id: maintenanceId, kind, body: body || null, data: extra || {} });
  if (error) throw error;
}
export async function listMaintQuotes(bid, maintenanceId) {
  const { data, error } = await supabase.from("maintenance_quotes").select("*").eq("building_id", bid).eq("maintenance_id", maintenanceId).order("created_at");
  if (error) throw error;
  return data || [];
}
export async function addMaintQuote(bid, maintenanceId, q) {
  const { error } = await supabase.from("maintenance_quotes").insert({ building_id: bid, maintenance_id: maintenanceId, ...q });
  if (error) throw error;
}
export async function setQuoteStatus(id, status) {
  const { error } = await supabase.from("maintenance_quotes").update({ status }).eq("id", id);
  if (error) throw error;
  // Exactly one ACCEPTED quote per item: accepting one closes its siblings.
  if (status === "accepted") {
    const { data: q } = await supabase.from("maintenance_quotes").select("maintenance_id").eq("id", id).maybeSingle();
    if (q && q.maintenance_id) {
      const { error: e2 } = await supabase.from("maintenance_quotes").update({ status: "rejected" }).eq("maintenance_id", q.maintenance_id).neq("id", id).eq("status", "accepted");
      if (e2) throw e2;
    }
  }
}

// ---- contracts & contractors registers ------------------------------------
export async function listContracts(bid) {
  const { data, error } = await supabase.from("contracts").select("*").eq("building_id", bid).order("end_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}
export async function saveContract(bid, c) {
  const row = { ...c, building_id: bid };
  const { error } = row.id ? await supabase.from("contracts").update(row).eq("id", row.id) : await supabase.from("contracts").insert(row);
  if (error) throw error;
  audit(bid, c.id ? "contract.updated" : "contract.added", c.party_name);
}
export async function deleteContract(bid, id) {
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) throw error;
  audit(bid, "contract.deleted", id);
}
export async function listContractors(bid) {
  const { data, error } = await supabase.from("contractors").select("*").eq("building_id", bid).order("trade").order("company_name");
  if (error) throw error;
  return data || [];
}
export async function saveContractor(bid, c) {
  const row = { ...c, building_id: bid };
  const { error } = row.id ? await supabase.from("contractors").update(row).eq("id", row.id) : await supabase.from("contractors").insert(row);
  if (error) throw error;
  audit(bid, c.id ? "contractor.updated" : "contractor.added", c.company_name);
}
export async function deleteContractor(bid, id) {
  const { error } = await supabase.from("contractors").delete().eq("id", id);
  if (error) throw error;
  audit(bid, "contractor.deleted", id);
}

// ---- Correspondence Hub -----------------------------------------------------
// Committee / MSC / BM two-way email record. Reads come straight from the
// RLS-protected tables; SENDING routes through the `send-correspondence` edge
// function (which holds the Resend key + service role and enforces the same
// committee check). Messages are append-only at the database level.

// Thread list for a building, newest activity first, with the party on each.
export async function listCorrThreads(bid) {
  const { data, error } = await supabase
    .from("correspondence_threads")
    .select("id, subject, status, visibility, context_type, context_id, last_activity_at, created_at, correspondence_contacts(name, email, org, party_type)")
    .eq("building_id", bid)
    .order("last_activity_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((t) => ({
    id: t.id, subject: t.subject, status: t.status, visibility: t.visibility,
    contextType: t.context_type, contextId: t.context_id,
    lastActivityAt: t.last_activity_at, createdAt: t.created_at,
    contact: t.correspondence_contacts
      ? { name: t.correspondence_contacts.name, email: t.correspondence_contacts.email, org: t.correspondence_contacts.org, partyType: t.correspondence_contacts.party_type }
      : null,
  }));
}

// One thread with its full message trail + attachments.
export async function getCorrThread(threadId) {
  const { data: thread, error: te } = await supabase
    .from("correspondence_threads")
    .select("id, building_id, subject, status, visibility, context_type, context_id, created_by, created_at, last_activity_at, correspondence_contacts(name, email, org, phone, party_type)")
    .eq("id", threadId).single();
  if (te) throw te;
  const { data: messages, error: me } = await supabase
    .from("correspondence_messages")
    .select("id, direction, from_name, from_email, to_email, cc, subject, body_text, body_html, delivery_status, deleted_at, created_at, correspondence_attachments(id, file_name, mime, storage_path, size)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (me) throw me;
  return {
    thread: {
      id: thread.id, buildingId: thread.building_id, subject: thread.subject, status: thread.status,
      visibility: thread.visibility, contextType: thread.context_type, contextId: thread.context_id,
      createdBy: thread.created_by, createdAt: thread.created_at, lastActivityAt: thread.last_activity_at,
      contact: thread.correspondence_contacts || null,
    },
    messages: (messages || []).map((m) => ({
      id: m.id, direction: m.direction, fromName: m.from_name, fromEmail: m.from_email, toEmail: m.to_email,
      cc: m.cc, subject: m.subject, bodyText: m.body_text, bodyHtml: m.body_html,
      deliveryStatus: m.delivery_status, deletedAt: m.deleted_at, createdAt: m.created_at,
      attachments: (m.correspondence_attachments || []).map((a) => ({ id: a.id, fileName: a.file_name, mime: a.mime, storagePath: a.storage_path, size: a.size })),
    })),
  };
}

// External parties (strata manager, insurer, contractor, …) for a building.
export async function listCorrContacts(bid) {
  const { data, error } = await supabase
    .from("correspondence_contacts")
    .select("id, name, org, email, phone, party_type, notes")
    .eq("building_id", bid).order("name");
  if (error) throw error;
  return (data || []).map((c) => ({ id: c.id, name: c.name, org: c.org, email: c.email, phone: c.phone, partyType: c.party_type, notes: c.notes }));
}

export async function saveCorrContact(bid, c) {
  const row = { building_id: bid, name: c.name, org: c.org || null, email: c.email || null, phone: c.phone || null, party_type: c.partyType || "other", notes: c.notes || null };
  const { data, error } = c.id
    ? await supabase.from("correspondence_contacts").update(row).eq("id", c.id).select("id").single()
    : await supabase.from("correspondence_contacts").insert(row).select("id").single();
  if (error) throw error;
  audit(bid, c.id ? "correspondence.contact_updated" : "correspondence.contact_added", c.name);
  return data.id;
}

// Send a new message or reply on an existing thread. `payload` shape:
// { buildingId, threadId?, contact:{id?|name,email,org,party_type}, subject,
//   bodyText, bodyHtml?, contextType?, contextId?, visibility?,
//   restrictedMemberIds?, attachments?:[{filename,contentBase64,mime}] }
export async function sendCorrespondence(payload) {
  const { data, error } = await supabase.functions.invoke("send-correspondence", { body: payload });
  if (error) throw error;
  if (data && data.error) throw new Error(data.error);
  return data; // { ok, threadId, messageId, deliveryStatus }
}

// Email an announcement to the residents it targets (in addition to the in-app
// notice). Recipients are resolved server-side from memberships.
export async function sendAnnouncementEmail(payload) {
  const { data, error } = await supabase.functions.invoke("send-announcement", { body: payload });
  if (error) throw error;
  if (data && data.error) throw new Error(data.error);
  return data; // { ok, sent, people, noEmail, ids, partial }
}

// ---- Broadcast audiences and saved distribution lists (0.37.0) -------------
// Who a notice reaches is resolved by broadcast_recipients() in the database,
// from the unit register (current owners and tenants) merged with app members
// and de-duplicated on email. The composer preview and send-announcement both
// call it, so what the committee is shown is exactly what gets sent.
//   audience: all | residents | owners | tenants | offsite | list | specific
//   people:   ["up:<unit_people.id>" | "m:<membership.id>"] for "specific"
export async function previewBroadcast(bid, audience, listId, people) {
  const { data, error } = await supabase.rpc("broadcast_recipients", {
    p_building: bid, p_audience: audience || "all", p_list: listId || null, p_people: people || [],
  });
  if (error) throw error;
  return data; // { people:[{key,name,email,unit,kind,lives_here,membership_id,level,pet}], count, emailable, no_email, units, list_name }
}
export async function listDistributionLists(bid) {
  const { data, error } = await supabase.from("distribution_lists").select("*").eq("building_id", bid).order("name");
  if (error) throw error;
  return data || [];
}
export async function saveDistributionList(bid, l) {
  const row = { name: String(l.name || "").trim(), kind: l.kind === "rule" ? "rule" : "manual",
    members: l.kind === "rule" ? [] : (l.members || []), rule: l.kind === "rule" ? (l.rule || {}) : {} };
  if (l.id) {
    const { data, error } = await supabase.from("distribution_lists").update({ ...row, updated_at: new Date().toISOString() }).eq("id", l.id).select().single();
    if (error) throw error;
    audit(bid, "dlist.updated", row.name);
    return data;
  }
  const { data, error } = await supabase.from("distribution_lists").insert({ building_id: bid, ...row }).select().single();
  if (error) throw error;
  audit(bid, "dlist.created", row.name);
  return data;
}
export async function deleteDistributionList(bid, id, name) {
  const { error } = await supabase.from("distribution_lists").delete().eq("id", id);
  if (error) throw error;
  audit(bid, "dlist.deleted", name || id);
}
// The committee-side record of who a notice was actually sent to.
export async function listAnnouncementSends(bid, announcementId) {
  const { data, error } = await supabase.from("announcement_sends").select("*")
    .eq("building_id", bid).eq("announcement_id", announcementId).order("sent_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Ensure (and return) this building's single public inbound address, e.g.
// "seahaven@send.nalohub.com". Committee-only; provisions a clean slug on first call.
export async function ensureBuildingMailbox(buildingId) {
  const { data, error } = await supabase.functions.invoke("ensure-mailbox", { body: { buildingId } });
  if (error) throw error;
  if (data && data.error) throw new Error(data.error);
  return data; // { slug, address, existing }
}

// Update a thread's status / visibility / subject.
export async function updateCorrThread(threadId, patch) {
  const row = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.visibility !== undefined) row.visibility = patch.visibility;
  if (patch.subject !== undefined) row.subject = patch.subject;
  const { error } = await supabase.from("correspondence_threads").update(row).eq("id", threadId);
  if (error) throw error;
}

// Whitelist for a restricted thread (replaces the current set).
export async function setCorrThreadMembers(threadId, userIds) {
  await supabase.from("correspondence_thread_members").delete().eq("thread_id", threadId);
  const rows = (userIds || []).filter(Boolean).map((u) => ({ thread_id: threadId, user_id: u }));
  if (rows.length) { const { error } = await supabase.from("correspondence_thread_members").insert(rows); if (error) throw error; }
}

// Time-limited signed URL for a private-bucket attachment.
export async function corrAttachmentUrl(storagePath) {
  const { data, error } = await supabase.storage.from("correspondence").createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data?.signedUrl || "";
}

// Inbound mail that couldn't be auto-matched, for committee triage (RPC-gated).
export async function listCorrUnfiled(bid) {
  const { data, error } = await supabase.rpc("corr_unfiled", { bid });
  if (error) throw error;
  return (data || []).map((r) => ({ id: r.id, fromName: r.from_name, fromEmail: r.from_email, subject: r.subject, receivedAt: r.received_at }));
}

// File an unfiled item onto a thread; creates the inbound message, returns its id.
export async function fileCorrUnfiled(rawId, threadId) {
  const { data, error } = await supabase.rpc("corr_file_unfiled", { p_raw: rawId, p_thread: threadId });
  if (error) throw error;
  return data;
}

// File an unfiled item as a BRAND NEW thread. No email is sent.
//
// Why this exists: corr_file_unfiled requires an existing thread, and the only
// way to create one was sendCorrespondence, which sends a real email. So the
// first inbound email for any building could never be filed. Curve Birtinya had
// 0 threads, 0 contacts and 7 unfiled items with nowhere to put them, and the
// File button sat permanently disabled because its thread picker was empty.
// The RPC matches the sender to an existing contact or creates one, so filing
// two emails from the same person does not produce two contacts.
export async function fileCorrUnfiledNewThread(rawId, opts) {
  const o = opts || {};
  const { data, error } = await supabase.rpc("corr_file_unfiled_new_thread", {
    p_raw: rawId,
    p_subject: o.subject || null,
    p_contact_name: o.contactName || null,
    p_party_type: o.partyType || null,
    p_org: o.org || null,
  });
  if (error) throw error;
  return data; // new thread id
}

// Search the building's correspondence: message bodies and subjects via the
// generated tsvector, plus thread subject and contact name/email/org. The RPC is
// SECURITY INVOKER, so the existing RLS decides what comes back and restricted
// threads stay hidden from the BM and MSC without a second copy of that rule.
export async function searchCorrespondence(bid, q) {
  const term = String(q || "").trim();
  if (!term) return [];
  const { data, error } = await supabase.rpc("corr_search", { p_building: bid, p_q: term });
  if (error) throw error;
  return (data || []).map((r) => ({
    threadId: r.thread_id, threadSubject: r.thread_subject,
    contactName: r.contact_name, contactEmail: r.contact_email, threadStatus: r.thread_status,
    messageId: r.message_id, direction: r.direction,
    matchedIn: r.matched_in, snippet: r.snippet, occurredAt: r.occurred_at,
  }));
}

// ---- monthly walk-through checklist ----------------------------------------
export async function listWalkItems(bid) {
  const { data, error } = await supabase.from("walkthrough_items").select("*").eq("building_id", bid).eq("active", true).order("sort");
  if (error) throw error;
  return data || [];
}
export async function seedWalkDefaults(bid) {
  const { data, error } = await supabase.rpc("seed_walkthrough_defaults", { p_building: bid });
  if (error) throw error;
  return data;
}
export async function listWalks(bid) {
  const { data, error } = await supabase.from("walkthroughs").select("*").eq("building_id", bid).order("walk_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createWalk(bid, attendees) {
  const { data, error } = await supabase.from("walkthroughs").insert({ building_id: bid, attendees: attendees || null, walk_date: localDate() }).select("id").single();
  if (error) throw error;
  audit(bid, "walkthrough.started", attendees || "");
  return data.id;
}
export async function listWalkResults(walkId) {
  const { data, error } = await supabase.from("walkthrough_results").select("*").eq("walkthrough_id", walkId);
  if (error) throw error;
  return data || [];
}
export async function setWalkResult(walkId, itemId, result, note) {
  const { error } = await supabase.from("walkthrough_results").upsert(
    { walkthrough_id: walkId, item_id: itemId, result, note: note || null },
    { onConflict: "walkthrough_id,item_id" });
  if (error) throw error;
}
export async function completeWalk(bid, walkId, summary) {
  const { error } = await supabase.from("walkthroughs").update({ status: "completed", summary: summary || null }).eq("id", walkId);
  if (error) throw error;
  audit(bid, "walkthrough.completed", walkId);
}

// ---- walk-through register (migrations 0021-0023) ---------------------------
// The checklist answers a question on one walk; a FINDING is the thing that is
// wrong, and it persists across walks until it is closed and verified. Closure
// is the committee's act, enforced by walkthrough_findings_guard in the database.

export async function listWalkSections(bid) {
  const { data, error } = await supabase.from("walkthrough_sections")
    .select("*").eq("building_id", bid).eq("active", true).order("sort");
  if (error) throw error;
  return data || [];
}

export async function listFindings(bid) {
  const { data, error } = await supabase.from("walkthrough_findings_expanded")
    .select("*").eq("building_id", bid).order("ref");
  if (error) throw error;
  return data || [];
}

export async function listFindingEvents(bid) {
  const { data, error } = await supabase.from("walkthrough_finding_events")
    .select("*, walkthrough_findings!inner(building_id, ref)")
    .eq("walkthrough_findings.building_id", bid)
    .order("occurred_at");
  if (error) throw error;
  return data || [];
}

// ref is assigned by the database trigger; never pass one from the client.
export async function raiseFinding(bid, f) {
  const row = {
    building_id: bid,
    class: f.cls,
    section_id: f.sectionId || null,
    item_id: f.itemId || null,
    location: f.location || null,
    observation: f.observation,
    standard_snapshot: f.standard || null,
    standard_is_general: !!f.general,
    required_outcome: f.outcome || null,
    owner: f.owner || null,
    due_date: f.due || null,
    frequency: f.frequency || null,
    risk_rating: f.cls === "H" ? (f.risk || "medium") : null,
    first_raised_walk_id: f.walkId || null,
    first_raised_on: localDate(),
  };
  const { data, error } = await supabase.from("walkthrough_findings").insert(row).select("*").single();
  if (error) throw error;
  // The 'raised' event is created by trigger; attach the evidence photo to it.
  // photo_path and note are the only fields the append-only guard lets us set later.
  if (f.photoPath) {
    await supabase.from("walkthrough_finding_events")
      .update({ photo_path: f.photoPath }).eq("finding_id", data.id).eq("event", "raised");
  }
  audit(bid, "walkthrough.finding_raised", data.ref, { class: f.cls });
  return data;
}

export async function updateFinding(bid, id, patch) {
  const { error } = await supabase.from("walkthrough_findings").update(patch).eq("id", id);
  if (error) throw error;
  audit(bid, "walkthrough.finding_updated", id);
}

// Committee only. The database refuses this for anyone else and says so.
export async function closeFinding(bid, id, walkId, note, photoPath) {
  const { error } = await supabase.from("walkthrough_findings")
    .update({ status: "closed", closed_walk_id: walkId || null }).eq("id", id);
  if (error) throw error;
  await supabase.from("walkthrough_finding_events")
    .insert({ finding_id: id, walkthrough_id: walkId || null, event: "closed",
              note: note || null, photo_path: photoPath || null });
  audit(bid, "walkthrough.finding_closed", id);
}

export async function reopenFinding(bid, id, walkId, note) {
  const { error } = await supabase.from("walkthrough_findings")
    .update({ status: "open" }).eq("id", id);
  if (error) throw error;
  await supabase.from("walkthrough_finding_events")
    .insert({ finding_id: id, walkthrough_id: walkId || null, event: "reopened", note: note || null });
  audit(bid, "walkthrough.finding_reopened", id);
}

// Still present at this walk. This is what makes walks_open, and the recurrence
// schedule, count for anything.
export async function observeFindingAgain(findingId, walkId, note, photoPath) {
  const { error } = await supabase.from("walkthrough_finding_events")
    .insert({ finding_id: findingId, walkthrough_id: walkId || null, event: "observed_again",
              note: note || null, photo_path: photoPath || null });
  if (error) throw error;
}

// A walk that was opened and never walked is noise in the record, so it can be
// discarded, but only while it is genuinely empty: nothing raised against it, no
// questions answered, no events pointing at it. Anything else stays.
export async function discardWalk(bid, walkId) {
  const [f, r, e] = await Promise.all([
    supabase.from("walkthrough_findings").select("id", { count: "exact", head: true })
      .or(`first_raised_walk_id.eq.${walkId},closed_walk_id.eq.${walkId}`),
    supabase.from("walkthrough_results").select("id", { count: "exact", head: true }).eq("walkthrough_id", walkId),
    supabase.from("walkthrough_finding_events").select("id", { count: "exact", head: true }).eq("walkthrough_id", walkId),
  ]);
  const total = (f.count || 0) + (r.count || 0) + (e.count || 0);
  if (total > 0) throw new Error(`This walk has ${total} record${total === 1 ? "" : "s"} against it, so it cannot be discarded. Issue it instead.`);
  const { error } = await supabase.from("walkthroughs").delete().eq("id", walkId);
  if (error) throw error;
  audit(bid, "walkthrough.discarded", walkId);
}

// Amend an open finding. The database refuses any change to class, place, observation,
// outcome, owner, due date or risk without a reason, records every field's before and
// after as an 'updated' event, and refuses it on a closed finding (migration 0028).
export async function amendFinding(bid, id, patch, reason) {
  const { error } = await supabase.rpc("amend_walk_finding", { p_id: id, p_patch: patch, p_reason: reason });
  if (error) throw error;
  audit(bid, "walkthrough.finding_amended", id);
}

// One-tap nil return: answer every question not yet answered in a group. The upsert names
// only the result column, so a photo already taken against a question is kept.
export async function setWalkResultsBulk(walkId, itemIds, result) {
  if (!itemIds.length) return;
  const rows = itemIds.map((iid) => ({ walkthrough_id: walkId, item_id: iid, result }));
  const { error } = await supabase.from("walkthrough_results").upsert(rows, { onConflict: "walkthrough_id,item_id" });
  if (error) throw error;
}

export async function setWalkMeta(walkId, patch) {
  const { error } = await supabase.from("walkthroughs").update(patch).eq("id", walkId);
  if (error) throw error;
}

// Issuing fixes the walk as a point in time. Findings keep moving afterwards;
// the issued walk does not.
export async function issueWalk(bid, walkId, summary) {
  const { error } = await supabase.from("walkthroughs")
    .update({ status: "completed", summary: summary || null, issued_at: new Date().toISOString() })
    .eq("id", walkId);
  if (error) throw error;
  audit(bid, "walkthrough.issued", walkId);
}

// ---- in-app alerts ----------------------------------------------------------
export async function listNotifications(bid) {
  const { data, error } = await supabase.from("app_notifications").select("*").eq("building_id", bid).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}
export async function markNotificationRead(id) {
  const { error } = await supabase.from("app_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function markAllNotificationsRead(bid) {
  const { error } = await supabase.from("app_notifications").update({ read_at: new Date().toISOString() }).eq("building_id", bid).is("read_at", null);
  if (error) throw error;
}

// ---- motion clarifications (ask before you vote) ---------------------------
export async function listMotionComments(motionIds) {
  if (!motionIds.length) return [];
  const { data, error } = await supabase.from("motion_comments").select("*").in("motion_id", motionIds).order("created_at");
  if (error) throw error;
  return data || [];
}
export async function addMotionComment(motionId, body, authorName) {
  const { error } = await supabase.from("motion_comments").insert({ motion_id: motionId, body, author_name: authorName || null });
  if (error) throw error;
}

// ---- walkthrough checklist editing + photo evidence -------------------------
export async function addWalkItem(bid, area, item) {
  const { error } = await supabase.from("walkthrough_items").insert({ building_id: bid, area, item, sort: 999 });
  if (error) throw error;
  audit(bid, "walkthrough.item_added", item);
}
export async function removeWalkItem(bid, id) {
  const { error } = await supabase.from("walkthrough_items").update({ active: false }).eq("id", id);
  if (error) throw error;
  audit(bid, "walkthrough.item_removed", id);
}
export async function setWalkResultPhoto(walkId, itemId, result, note, photoPath) {
  const { error } = await supabase.from("walkthrough_results").upsert(
    { walkthrough_id: walkId, item_id: itemId, result: result || null, note: note || null, photo_path: photoPath || null },
    { onConflict: "walkthrough_id,item_id" });
  if (error) throw error;
}
export async function setWalkResultMaint(walkId, itemId, maintenanceId) {
  const { error } = await supabase.from("walkthrough_results").upsert(
    { walkthrough_id: walkId, item_id: itemId, maintenance_id: maintenanceId },
    { onConflict: "walkthrough_id,item_id" });
  if (error) throw error;
}
export async function mediaBlob(path) {
  const { data, error } = await supabase.storage.from("media").download(path);
  if (error) throw error;
  return data;
}
export async function updateUnitAgent(bid, unitId, agent) {
  const { error } = await supabase.from("units").update({
    agent_business: agent.business || null, agent_contact: agent.contact || null,
    agent_phone: agent.phone || null, agent_email: agent.email || null,
    agent_note: agent.note || null,
  }).eq("id", unitId);
  if (error) throw error;
  audit(bid, "unit.agent_updated", agent.business || "");
}

// ---- Stripe billing (payment method setup, refunds, admin summary) ---------
export async function loadMyBuildingBilling(bid) {
  const { data } = await supabase.from("building_billing").select("status, trial_end, payment_method_label, preferred_payment_day, admin_monthly, per_unit_monthly, unit_count, gst_rate, gst_mode").eq("building_id", bid).maybeSingle();
  return data;
}
export async function startPaymentSetup(bid) {
  const { data: s2 } = await supabase.auth.getSession();
  const token = s2 && s2.session ? s2.session.access_token : "";
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-billing`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setup", building_id: bid, return_url: window.location.origin }),
  });
  const j = await res.json();
  if (!res.ok || !j.url) throw new Error(j.error || "Couldn't start payment setup");
  window.location.href = j.url;
}
export async function createAdhocInvoice(bid, kind, description, amount) {
  const { data, error } = await supabase.rpc("create_adhoc_invoice", { p_bid: bid, p_kind: kind, p_description: description, p_amount: Number(amount) });
  if (error) throw error;
  return data;
}
export async function stripeRefund(invoiceId, amount, description) {
  const { data: s2 } = await supabase.auth.getSession();
  const token = s2 && s2.session ? s2.session.access_token : "";
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-billing`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "refund", invoice_id: invoiceId, amount: Number(amount), description }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "Refund failed");
  return j;
}
export async function loadBillingSummary() {
  const { data, error } = await supabase.rpc("billing_summary");
  if (error) throw error;
  return data || [];
}

// ---- Export Building Data ---------------------------------------------------
// Clause 4 of the Services Agreement, as a button: everything the building
// owns, exported to a single multi-sheet Excel workbook (SpreadsheetML — no
// extra dependencies), including a manifest of every stored file with signed
// download links. Data out is as easy as data in — by design, from day one.
const xmlEsc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sheetXml = (name, rows) => {
  const cols = rows.length ? [...new Set(rows.flatMap((r) => Object.keys(r)))] : ["(empty)"];
  const cell = (v) => {
    if (v != null && typeof v === "object") v = JSON.stringify(v);
    const isNum = typeof v === "number" && isFinite(v);
    return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${xmlEsc(v)}</Data></Cell>`;
  };
  const head = `<Row>${cols.map((c) => `<Cell><Data ss:Type="String">${xmlEsc(c)}</Data></Cell>`).join("")}</Row>`;
  const body = rows.map((r) => `<Row>${cols.map((c) => cell(r[c])).join("")}</Row>`).join("");
  return `<Worksheet ss:Name="${xmlEsc(name.slice(0, 31))}"><Table>${head}${body}</Table></Worksheet>`;
};
const workbook = (sheets) => `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets.map(([n, rows]) => sheetXml(n, rows)).join("\n")}
</Workbook>`;
const downloadWorkbook = (filename, sheets) => {
  const blob = new Blob([workbook(sheets)], { type: "application/vnd.ms-excel" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
};
const CONTENT_EXPORT = CONTENT; // jsonb content tables exported with data spread into columns

export async function exportBuildingData(bid, buildingName, onProgress) {
  const say = (m) => { try { onProgress && onProgress(m); } catch (e) {} };
  const all = async (q) => { const { data, error } = await q; if (error) throw error; return data || []; };
  const byB = (t) => all(supabase.from(t).select("*").eq("building_id", bid));
  const sheets = [];

  say("Registers…");
  const units = await byB("units");
  const unitIds = units.map((u) => u.id);
  const child = async (t) => unitIds.length ? all(supabase.from(t).select("*").in("unit_id", unitIds)) : [];
  sheets.push(["Units", units], ["Unit People", await child("unit_people")], ["Unit Pets", await child("unit_pets")],
    ["Unit Vehicles", await child("unit_vehicles")], ["Keys & Fobs", await byB("unit_access_items")], ["Breaches", await byB("unit_breaches")]);

  say("Applications & permits…");
  const apps = await byB("applications");
  sheets.push(["Applications", apps],
    ["Application Files", apps.length ? await all(supabase.from("application_attachments").select("*").in("application_id", apps.map((a) => a.id))) : []],
    ["Parking Permits", await byB("parking_permits")]);

  say("Governance…");
  const motions = await byB("motions");
  const mids = motions.map((m) => m.id);
  sheets.push(["Motions", motions],
    ["Votes", mids.length ? await all(supabase.from("motion_votes").select("*").in("motion_id", mids)) : []],
    ["Motion Questions", mids.length ? await all(supabase.from("motion_comments").select("*").in("motion_id", mids)) : []],
    ["Proxies", await byB("proxy_appointments")]);

  say("Maintenance & registers…");
  const walks = await byB("walkthroughs");
  sheets.push(["Maintenance Activity", await byB("maintenance_activity")], ["Quotes", await byB("maintenance_quotes")],
    ["Contracts", await byB("contracts")], ["Contractors", await byB("contractors")],
    ["Walkthrough Items", await byB("walkthrough_items")], ["Walkthroughs", walks],
    ["Walkthrough Results", walks.length ? await all(supabase.from("walkthrough_results").select("*").in("walkthrough_id", walks.map((w) => w.id))) : []]);

  say("Community & records…");
  const groups = await byB("groups");
  const threads = await byB("threads");
  sheets.push(["Groups", groups],
    ["Group Members", groups.length ? await all(supabase.from("group_members").select("*").in("group_id", groups.map((g) => g.id))) : []],
    ["Threads", threads],
    ["Thread Messages", threads.length ? await all(supabase.from("thread_messages").select("*").in("thread_id", threads.map((t) => t.id))) : []],
    ["Members", await byB("memberships")], ["Alerts", await byB("app_notifications")],
    ["Disputes", await byB("disputes")], ["Dispute Events", await byB("dispute_events")],
    ["Audit Trail", await all(supabase.from("audit_log").select("*").eq("building_id", bid).order("created_at"))]);

  say("Notices, bookings, documents…");
  for (const t of CONTENT_EXPORT) {
    // Heavy tables (documents, gallery) are read through their *_meta views so
    // file payloads never land inside the workbook; the files themselves are
    // listed with download links in the Stored Files sheet and the Documents
    // Files sheet below.
    const source = HEAVY_TABLES[t] ? HEAVY_TABLES[t].view : t;
    const rows = (await all(supabase.from(source).select("id, data, created_at").eq("building_id", bid))).map((r) => ({ id: r.id, created_at: r.created_at, ...(r.data || {}) }));
    sheets.push([t.charAt(0).toUpperCase() + t.slice(1), rows]);
  }

  say("Stored files…");
  const fileRows = [];
  for (const bucket of ["attachments", "media", "building-files"]) {
    try {
      const tops = await supabase.storage.from(bucket).list(bid, { limit: 1000 });
      for (const entry of tops.data || []) {
        const isFolder = !entry.id;
        const paths = isFolder
          ? ((await supabase.storage.from(bucket).list(`${bid}/${entry.name}`, { limit: 1000 })).data || []).map((f) => `${bid}/${entry.name}/${f.name}`)
          : [`${bid}/${entry.name}`];
        for (const path of paths.slice(0, 400)) {
          let url = "";
          try { const su = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7); url = (su.data && su.data.signedUrl) || ""; } catch (e) {}
          fileRows.push({ bucket, path, download_link_7_days: url });
        }
      }
    } catch (e) { /* bucket not accessible for this role — skip */ }
  }
  sheets.unshift(
    ["About This Export", [
      { field: "Building", value: buildingName },
      { field: "Exported", value: new Date().toISOString() },
      { field: "Ownership", value: "All data in this workbook is the property of the Building's Body Corporate (NaloHub Services Agreement, clause 4)." },
      { field: "Contents", value: "One sheet per register, all records for this building only. The Stored Files sheet lists every uploaded document/photo/video with a 7-day download link." },
      { field: "Contact", value: "info@nalohub.com" },
    ]],
  );
  sheets.push(["Stored Files", fileRows]);

  const safe = (buildingName || "building").replace(/[^\w-]+/g, "-").toLowerCase();
  downloadWorkbook(`nalohub-export-${safe}-${localDate()}.xls`, sheets);
  audit(bid, "building.data_exported", `${sheets.length} sheets`);
  return { sheets: sheets.length, files: fileRows.length };
}

// ---- platform settings (invoice issuer + payment details) ----
export async function loadPlatformSettings() {
  const { data, error } = await supabase.from("platform_settings").select("data").eq("id", "singleton").maybeSingle();
  if (error) throw error;
  return (data && data.data) || {};
}
export async function savePlatformSettings(d) {
  const { error } = await supabase.from("platform_settings").upsert({ id: "singleton", data: d, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---- usage analytics (Layer 1) -----------------------------------------
// One row per person, per building, per Brisbane-local day, when they OPEN a
// building. We measure opens rather than sign-ins because Supabase sessions
// persist for weeks, so a single login can hide a month of daily use.
//
// The DB stamps `day` itself and a unique index on
// (building_id, user_id, kind, day) makes the second call of the day a no-op:
// it fails with a duplicate-key error, which we swallow. `user_id` must be
// auth.uid() to satisfy the insert policy, so we read it from the session
// rather than from the app's store id. Reads are platform-admin only, by
// policy: committees never see individual login times.
//
// Fire-and-forget, exactly like audit() — analytics must never block, slow or
// break a building open. Silent no-op in demo mode.
const _loggedThisSession = new Set();

export async function logActivity(buildingId, role = null) {
  try {
    if (!import.meta.env.VITE_SUPABASE_URL || !buildingId) return;
    if (String(import.meta.env.VITE_DEMO_MODE || "").toLowerCase() === "true") return;
    const { data } = await supabase.auth.getSession();
    const uid = data && data.session && data.session.user ? data.session.user.id : null;
    if (!uid) return;
    const key = buildingId + "|" + uid;
    if (_loggedThisSession.has(key)) return;
    _loggedThisSession.add(key);
    // Coarse device hint only: tells us whether someone has ever opened their
    // building on a phone, which is the signal behind most onboarding help.
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const device = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "desktop";
    supabase.from("activity_events")
      .insert({ building_id: buildingId, user_id: uid, role: role || null, kind: "building.open", device })
      .then(() => {}, () => {});
  } catch (e) { /* never block the UI on analytics */ }
}

// ============================================================================
// DEMO MODE — demo.nalohub.com runs this same file with VITE_DEMO_MODE=true.
// Every new-feature function below is re-bound to an in-memory dummy dataset,
// so the demo mirrors the production app screen-for-screen with sample data.
// ============================================================================
const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE || "").toLowerCase() === "true" || !import.meta.env.VITE_SUPABASE_URL;
export const DEMO_UID = "00000000-demo-user-0000-000000000001";

if (DEMO_MODE) {
  const id = () => "d" + Math.random().toString(36).slice(2, 10);
  const now = () => new Date().toISOString();
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
  const dAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymdLocal(d); };
  const files = {}; // fake storage: path -> object URL

  const u12 = { id: "unit-12", unit_number: "12", lot_number: "Lot 12", parking_spaces: 2, agent_business: "Coastal Property Management", agent_contact: "Mia Chen", agent_phone: "07 5444 1200", agent_email: "mia@coastalpm.com.au", agent_note: "Lease ends 31 March. Contact agent for any entry or maintenance access.", notes: null };
  const u5 = { id: "unit-5", unit_number: "5", lot_number: "Lot 5", parking_spaces: 1, agent_business: "", agent_contact: "", agent_phone: "", agent_email: "" };
  // ---- Demo residents: sixteen further units so Unit Search shows a building,
  // not a sample. Every person, pet, vehicle, key and note below is invented.
  const DEMO_UNITS = [
    { n: "1",  lot: "Lot 1",  bays: 1 },
    { n: "2",  lot: "Lot 2",  bays: 1, agent: ["Beachline Realty", "Hannah Okafor", "07 5443 8890", "rentals@beachlinerealty.com.au"] },
    { n: "3",  lot: "Lot 3",  bays: 2 },
    { n: "7",  lot: "Lot 7",  bays: 1, notes: "Owner overseas until March. All correspondence via the managing agent." },
    { n: "8",  lot: "Lot 8",  bays: 2, agent: ["Coastal Property Management", "Mia Chen", "07 5444 1200", "mia@coastalpm.com.au"] },
    { n: "9",  lot: "Lot 9",  bays: 1 },
    { n: "14", lot: "Lot 14", bays: 2 },
    { n: "15", lot: "Lot 15", bays: 1, agent: ["Beachline Realty", "Hannah Okafor", "07 5443 8890", "rentals@beachlinerealty.com.au"], notes: "Balcony tiles replaced Aug 2025 under the building's works programme." },
    { n: "16", lot: "Lot 16", bays: 1 },
    { n: "18", lot: "Lot 18", bays: 2, notes: "Two spaces, both in the basement. Second space leased informally to Unit 9 — committee aware." },
    { n: "19", lot: "Lot 19", bays: 1 },
    { n: "24", lot: "Lot 24", bays: 2 },
    { n: "25", lot: "Lot 25", bays: 1, agent: ["Hinterland Property Co", "Dev Raman", "07 5476 2200", "dev@hinterlandproperty.com.au"] },
    { n: "27", lot: "Lot 27", bays: 1 },
    { n: "30", lot: "Lot 30", bays: 2, notes: "Accessible parking bay allocated. Do not reassign without committee approval." },
    { n: "31", lot: "Lot 31", bays: 1 },
  ].map((u) => ({ id: "unit-" + u.n, unit_number: u.n, lot_number: u.lot, parking_spaces: u.bays,
    agent_business: u.agent ? u.agent[0] : "", agent_contact: u.agent ? u.agent[1] : "",
    agent_phone: u.agent ? u.agent[2] : "", agent_email: u.agent ? u.agent[3] : "", notes: u.notes || null }));

  // [unit, type, name, email, phone, extras]
  const DEMO_PEOPLE = [
    ["1",  "owner",  "Aroha Whitiora",   "aroha.whitiora@example.com",  "0401 220 118", { moved: "2019-08-14" }],
    ["1",  "owner",  "Daniel Whitiora",  "d.whitiora@example.com",      "0401 220 119", {}],
    ["1",  "emergency_contact", "Mere Whitiora", "",                    "0401 887 004", {}],
    ["2",  "owner",  "Priyanka Raghavan","p.raghavan@example.com",      "0402 551 340", { away: true }],
    ["2",  "tenant", "Callum Fitzgerald","callum.fitz@example.com",     "0403 118 776", { moved: "2025-03-01", note: "Primary tenant contact" }],
    ["2",  "tenant", "Sinead Fitzgerald","sinead.fitz@example.com",     "0403 118 777", { moved: "2025-03-01" }],
    ["3",  "owner",  "Marcus Oyelaran",  "m.oyelaran@example.com",      "0404 662 019", { app: "email" }],
    ["3",  "owner",  "Justine Oyelaran", "j.oyelaran@example.com",      "0404 662 020", {}],
    ["7",  "owner",  "Wei Lin Tan",      "weilin.tan@example.com",      "0405 330 921", { note: "Contact by email only — different time zone" }],
    ["7",  "tenant", "Bridget Halloran", "b.halloran@example.com",      "0405 774 118", { moved: "2024-11-18" }],
    ["8",  "owner",  "Grant Petrakis",   "g.petrakis@example.com",      "0406 200 553", {}],
    ["8",  "tenant", "Amara Nwosu",      "amara.nwosu@example.com",     "0406 918 224", { moved: "2026-01-12", note: "Works night shift — no calls before 11am" }],
    ["8",  "emergency_contact", "Chidi Nwosu", "",                      "0406 918 225", {}],
    ["9",  "owner",  "Rosemary Ashcroft","r.ashcroft@example.com",      "0407 445 662", { moved: "2016-02-02", app: "name" }],
    ["14", "owner",  "Toby Vandenberg",  "toby.v@example.com",          "0408 771 903", {}],
    ["14", "owner",  "Eleni Vandenberg", "eleni.v@example.com",         "0408 771 904", {}],
    ["14", "tenant", "Harper Okonkwo",   "harper.ok@example.com",       "0408 226 551", { moved: "2025-09-30" }],
    ["15", "owner",  "Sanjay Mehta",     "s.mehta@example.com",         "0409 330 447", {}],
    ["15", "tenant", "Freya Lindqvist",  "freya.l@example.com",         "0409 118 662", { moved: "2026-02-14", note: "Primary tenant contact" }],
    ["15", "tenant", "Otto Lindqvist",   "otto.l@example.com",          "0409 118 663", { moved: "2026-02-14" }],
    ["16", "owner",  "Josephine Barrett","jo.barrett@example.com",      "0410 552 118", { moved: "2021-06-11" }],
    ["16", "emergency_contact", "Alan Barrett", "",                     "0410 552 119", {}],
    ["18", "owner",  "Hamish Cullen",    "h.cullen@example.com",        "0411 447 220", { app: "email" }],
    ["18", "owner",  "Niamh Cullen",     "n.cullen@example.com",        "0411 447 221", {}],
    ["19", "owner",  "Tessa Blackwood",  "t.blackwood@example.com",     "0412 990 331", {}],
    ["19", "tenant", "Dmitri Volkov",    "d.volkov@example.com",        "0412 118 447", { moved: "2025-07-01" }],
    ["24", "owner",  "Lachlan Pereira",  "l.pereira@example.com",       "0413 662 118", {}],
    ["24", "owner",  "Camila Pereira",   "c.pereira@example.com",       "0413 662 119", { app: "email" }],
    ["25", "owner",  "Yusuf Demirel",    "y.demirel@example.com",       "0414 330 992", { away: true }],
    ["25", "tenant", "Georgia Hollis",   "g.hollis@example.com",        "0414 771 118", { moved: "2024-05-20", note: "Renewed 12 months from May 2026" }],
    ["27", "owner",  "Beatrice Nkemdi",  "b.nkemdi@example.com",        "0415 226 774", { moved: "2018-10-03" }],
    ["30", "owner",  "Duncan Fairweather","d.fairweather@example.com",  "0416 118 553", { note: "Accessible bay allocated" }],
    ["30", "emergency_contact", "Kate Fairweather", "",                 "0416 118 554", {}],
    ["31", "owner",  "Anushka Kapoor",   "a.kapoor@example.com",        "0417 445 006", {}],
    ["31", "tenant", "Marco Bianchi",    "m.bianchi@example.com",       "0417 990 118", { moved: "2026-04-08" }],
  ];
  const DEMO_PAST = [
    ["2",  "tenant", "Rhys Donnelly",   "r.donnelly@example.com", "0403 001 442", "2022-02-01", "2025-02-10"],
    ["8",  "tenant", "Kirra Mullane",   "k.mullane@example.com",  "0406 552 118", "2023-06-01", "2025-12-19"],
    ["15", "tenant", "Peta Suarez",     "p.suarez@example.com",   "0409 776 220", "2021-01-15", "2026-01-31"],
    ["19", "owner",  "Gordon Whitely",  "g.whitely@example.com",  "0412 118 000", "2009-03-01", "2024-08-22"],
    ["25", "tenant", "Ines Cardoso",    "i.cardoso@example.com",  "0414 337 118", "2022-09-01", "2024-05-01"],
  ];
  const DEMO_PETS = [
    ["1",  "dog", "Biscuit", "Border Collie"], ["3", "cat", "Miso", "Burmese"],
    ["8",  "dog", "Frankie", "Staffordshire Terrier"], ["14", "cat", "Olive", "Domestic short hair"],
    ["18", "dog", "Rudy", "Groodle"], ["24", "bird", "Kiwi", "Cockatiel"],
    ["30", "dog", "Bramble", "Labrador (assistance dog)"],
  ];
  const DEMO_VEHICLES = [
    ["1", "Subaru", "Outback", "Silver", "482 QRT", "B1-04"], ["1", "Honda", "Jazz", "Blue", "119 KLM", "B1-05"],
    ["2", "Mazda", "CX-5", "Grey", "770 HDS", "B1-11"],
    ["3", "Tesla", "Model 3", "White", "902 NVE", "B2-02"], ["3", "Ford", "Ranger", "Blue", "551 TWJ", "B2-03"],
    ["7", "Hyundai", "i30", "Red", "338 PLQ", "B1-19"],
    ["8", "Toyota", "Corolla", "Black", "624 MZB", "B2-08"],
    ["9", "Kia", "Sportage", "White", "417 DGN", "B1-22"],
    ["14", "Volkswagen", "Golf", "Silver", "285 RHC", "B2-15"], ["14", "Nissan", "X-Trail", "Bronze", "930 FTA", "B2-16"],
    ["15", "Mitsubishi", "Outlander", "Grey", "146 SVE", "B1-27"],
    ["16", "Toyota", "Yaris", "Yellow", "703 BKQ", "B1-31"],
    ["18", "BMW", "X3", "Black", "558 JWR", "B2-21"], ["18", "Holden", "Astra", "White", "212 CNP", "B2-22"],
    ["19", "Suzuki", "Swift", "Green", "864 LDM", "B1-35"],
    ["24", "Isuzu", "D-Max", "Grey", "377 VQT", "B2-29"], ["24", "Audi", "A4", "Navy", "509 HBX", "B2-30"],
    ["25", "Renault", "Captur", "Orange", "631 WFK", "B1-40"],
    ["27", "Toyota", "Camry", "White", "748 MRD", "B1-42"],
    ["30", "Kia", "Carnival", "Silver", "195 ZTH", "B2-01 (accessible)"],
    ["31", "Mazda", "2", "Red", "422 GQL", "B1-47"],
  ];
  const DEMO_ACCESS = [
    ["1", "fob", "F-1001", "Lobby & garage", "issued", "Aroha Whitiora"], ["1", "fob", "F-1002", "Lobby & garage", "issued", "Daniel Whitiora"],
    ["2", "fob", "F-1014", "Lobby & garage", "issued", "Callum Fitzgerald"], ["2", "key", "K-002", "Front door", "issued", "Callum Fitzgerald"],
    ["3", "fob", "F-1021", "Lobby & garage", "issued", "Marcus Oyelaran"], ["3", "swipe_card", "SC-118", "Gym level", "issued", "Justine Oyelaran"],
    ["7", "fob", "F-1033", "Lobby & garage", "issued", "Bridget Halloran"],
    ["8", "fob", "F-1040", "Lobby & garage", "issued", "Amara Nwosu"], ["8", "fob", "F-1041", "Lobby & garage", "lost", "Kirra Mullane"],
    ["9", "fob", "F-1052", "Lobby & garage", "issued", "Rosemary Ashcroft"],
    ["14", "fob", "F-1060", "Lobby & garage", "issued", "Toby Vandenberg"], ["14", "remote", "R-208", "Garage roller door", "issued", "Eleni Vandenberg"],
    ["15", "fob", "F-1071", "Lobby & garage", "issued", "Freya Lindqvist"], ["15", "fob", "F-1072", "Lobby & garage", "returned", "Peta Suarez"],
    ["16", "fob", "F-1080", "Lobby & garage", "issued", "Josephine Barrett"],
    ["18", "fob", "F-1090", "Lobby & garage", "issued", "Hamish Cullen"], ["18", "swipe_card", "SC-140", "Gym level", "issued", "Niamh Cullen"],
    ["19", "fob", "F-1101", "Lobby & garage", "issued", "Dmitri Volkov"],
    ["24", "fob", "F-1112", "Lobby & garage", "issued", "Lachlan Pereira"], ["24", "remote", "R-221", "Garage roller door", "issued", "Camila Pereira"],
    ["25", "fob", "F-1120", "Lobby & garage", "issued", "Georgia Hollis"],
    ["27", "fob", "F-1131", "Lobby & garage", "issued", "Beatrice Nkemdi"],
    ["30", "fob", "F-1140", "Lobby & garage", "issued", "Duncan Fairweather"], ["30", "key", "K-030", "Accessible entry", "issued", "Duncan Fairweather"],
    ["31", "fob", "F-1150", "Lobby & garage", "issued", "Marco Bianchi"],
  ];
  const DEMO_BREACHES = [
    ["9",  "By-law 8 (Parking)", "Visitor bay used by a resident vehicle over three consecutive nights.", "open", 12],
    ["18", "By-law 12 (Noise)",  "Rooftop gathering after 11pm. Owner contacted, apologised, no repeat.", "remedied", 64],
    ["25", "By-law 5 (Common property)", "Bicycles stored in the corridor outside the lot. Removed after notice.", "remedied", 130],
  ];
  const demoResidents = () => {
    const people = [], past = [], pets = [], vehicles = [], access = [], breaches = [];
    DEMO_PEOPLE.forEach(([u, t, name, email, phone, x]) => {
      const rec = { id: id(), unit_id: "unit-" + u, person_type: t, full_name: name, email: email || null, phone, is_current: true };
      if (x.moved) rec.move_in = x.moved;
      if (x.note) rec.notes = x.note;
      if (x.away) rec.notes = "Non-resident owner — investment lot";
      if (x.app === "email") rec.app_match = { match: "email", role: t, status: "active", full_name: name, email };
      if (x.app === "name") rec.app_match = { match: "name", role: t, status: "active", full_name: name, email: "r.ashcroft@oldmail.example.com" };
      people.push(rec);
    });
    DEMO_PAST.forEach(([u, t, name, email, phone, mi, mo]) => past.push({ id: id(), unit_id: "unit-" + u, person_type: t, full_name: name, email, phone, is_current: false, move_in: mi, move_out: mo }));
    DEMO_PETS.forEach(([u, t, name, breed]) => pets.push({ id: id(), unit_id: "unit-" + u, pet_type: t, name, breed, approval_status: "approved" }));
    DEMO_VEHICLES.forEach(([u, mk, md, col, reg, bay]) => vehicles.push({ id: id(), unit_id: "unit-" + u, make: mk, model: md, colour: col, registration: reg, parking_bay: bay }));
    DEMO_ACCESS.forEach(([u, t, ident, label, status, holder]) => access.push({ id: id(), unit_id: "unit-" + u, item_type: t, identifier: ident, label, status, issued_to: holder }));
    DEMO_BREACHES.forEach(([u, ref, desc, status, ago]) => breaches.push({ id: id(), unit_id: "unit-" + u, bylaw_ref: ref, description: desc, status, occurred_at: dAhead(-ago).slice(0, 10) }));
    return { people: people.concat(past), pets, vehicles, access, breaches };
  };
  const DR = demoResidents();
  const DS = {
    units: [u12, u5, { id: "unit-22", unit_number: "22", lot_number: "Lot 22", parking_spaces: 1 }, ...DEMO_UNITS],
    people: [
      { id: id(), unit_id: "unit-12", person_type: "owner", full_name: "Owen Chandler", email: "owen@example.com", phone: "0400 111 222", is_current: true, app_match: { match: "email", role: "owner", status: "active", full_name: "Owen Chandler", email: "owen@example.com" } },
      { id: id(), unit_id: "unit-12", person_type: "tenant", full_name: "Tina Marsh", email: "tina@example.com", phone: "0400 333 444", is_current: true, move_in: "2025-02-01" },
      { id: id(), unit_id: "unit-12", person_type: "emergency_contact", full_name: "Ray Marsh", phone: "0400 777 888", is_current: true },
      { id: id(), unit_id: "unit-12", person_type: "tenant", full_name: "Jonah Pryce", email: "jonah@example.com", phone: "0400 999 000", is_current: false, move_in: "2023-03-01", move_out: "2025-01-20" },
      { id: id(), unit_id: "unit-5", person_type: "owner", full_name: "Betty Nguyen", email: "betty@example.com", phone: "0400 555 666", is_current: true },
      ...DR.people,
    ],
    pets: [{ id: id(), unit_id: "unit-12", pet_type: "dog", name: "Rex", breed: "Cavoodle", approval_status: "approved" }, ...DR.pets],
    vehicles: [{ id: id(), unit_id: "unit-12", make: "Toyota", model: "RAV4", colour: "White", registration: "123ABC", parking_bay: "B2-14" }, ...DR.vehicles],
    access: [
      { id: id(), unit_id: "unit-12", item_type: "fob", identifier: "F-9981", label: "Lobby & garage", status: "issued", issued_to: "Tina Marsh", ack_at: daysAgo(3) },
      { id: id(), unit_id: "unit-12", item_type: "key", identifier: "K-012", label: "Front door", status: "issued", issued_to: "Owen Chandler", issued_to_user_id: "x", ack_at: null },
      { id: id(), unit_id: "unit-5", item_type: "swipe_card", identifier: "SC-445", label: "Gym level", status: "issued", issued_to: "Betty Nguyen" },
      // Building-level devices: unit_id null (migration 0014). These are what
      // the Purpose field exists for -- they belong to common property, not a lot.
      { id: id(), unit_id: null, item_type: "fob", purpose: "master", identifier: "M-01", label: "Master - all common areas", status: "issued", issued_to: "Marcus Hale (building manager)" },
      { id: id(), unit_id: null, item_type: "key", purpose: "master", identifier: "M-02", label: "Master - plant and switch rooms", status: "issued", issued_to: null },
      { id: id(), unit_id: null, item_type: "key", purpose: "service", identifier: "SVC-07", label: "Lift motor room - Sunshine Lifts", status: "issued", issued_to: "Sunshine Lifts Pty Ltd" },
      { id: id(), unit_id: null, item_type: "other", purpose: "other", identifier: "LB-01", label: "Emergency access lock box", status: "issued", issued_to: null, notes: "Combination held by the committee chair and the building manager." },
      ...DR.access,
    ],
    breaches: [{ id: id(), unit_id: "unit-12", bylaw_ref: "By-law 12 (Noise)", description: "Late-night noise complaint — resolved after friendly chat.", status: "remedied", occurred_at: dAhead(-40).slice(0, 10) }, ...DR.breaches],
    applications: [
      { id: "app-1", unit_id: "unit-12", kind: "application", category: "pet", title: "Pet approval — Luna (ragdoll cat)", details: { pet_type: "cat", name: "Luna", breed: "Ragdoll", unit: "12", description: "Indoor cat, desexed and microchipped." }, status: "submitted", submitted_by: "u-owner", submitted_at: daysAgo(1), decision_note: null },
      { id: "app-2", unit_id: "unit-12", kind: "application", category: "parking_permit", title: "Parking permit — Mazda CX-5 (456XYZ)", details: { vehicle_make: "Mazda", vehicle_model: "CX-5", vehicle_colour: "Blue", vehicle_rego: "456XYZ", date_from: dAhead(-20), date_to: dAhead(345), unit: "12" }, status: "approved", submitted_by: DEMO_UID, submitted_at: daysAgo(20), decided_at: daysAgo(19), decision_note: "Approved for 12 months" },
      { id: "app-3", unit_id: "unit-5", kind: "application", category: "lot_improvement", title: "Bathroom renovation — Unit 5", details: { unit: "5", description: "Full bathroom renovation incl. waterproofing. Two quotes attached.", conditions: ["All work must be carried out by licensed and insured contractors.", "Work is permitted Monday–Friday 7am–5pm and Saturday 8am–4pm only.", "Common property must be protected during works and left clean and undamaged."] }, status: "approved", submitted_by: "u-betty", submitted_at: daysAgo(9), decided_at: daysAgo(3), decision_note: "Decided by BCC vote: 5 yes / 1 no / 0 abstained of 6 members — approval subject to the attached conditions" },
    ],
    appAtts: [{ id: id(), application_id: "app-3", file_name: "bathroom-quote-AquaBuild.pdf", file_kind: "document", storage_path: "demo/quote1" }],
    permits: [{ id: "permit-1", application_id: "app-2", permit_no: "PP-0007", unit_number: "12", vehicle_make: "Mazda", vehicle_model: "CX-5", vehicle_colour: "Blue", vehicle_rego: "456XYZ", date_from: dAhead(-20), date_to: dAhead(345), approval_date: dAhead(-19), status: "active" }],
    motions: [
      { id: "mo-1", title: "Approve: Pet approval — Luna (ragdoll cat)", description: "Indoor cat, desexed and microchipped.", context_type: "application", context_id: "app-1", details: { category: "pet", unit: "12", conditions: ["The animal must be kept within the lot and under control on common property at all times.", "The animal must not cause nuisance, noise or interference with other residents.", "All animal waste must be removed and disposed of appropriately.", "Approval is specific to the animal named in the application and is not transferable.", "The animal must be registered with council where registration is required."],
        history: [{ version_from: 1, version_to: 2, conditions_before: ["The animal must be kept within the lot and under control on common property at all times.", "The animal must not cause nuisance, noise or interference with other residents.", "All animal waste must be removed and disposed of appropriately.", "Approval is specific to the animal named in the application and is not transferable."], conditions_after: ["The animal must be kept within the lot and under control on common property at all times.", "The animal must not cause nuisance, noise or interference with other residents.", "All animal waste must be removed and disposed of appropriately.", "Approval is specific to the animal named in the application and is not transferable.", "The animal must be registered with council where registration is required."], reason: "Priya asked whether the cat is council-registered. The owner confirmed it is, so the approval should say so.", by: "Marcus Chen (Chair)", by_user_id: "u-bcc2", at: daysAgo(1), superseded_votes: [{ id: "sv-1", motion_id: "mo-1", voter_user_id: "u-bcc2", vote: "yes", comment: "Lovely quiet breed.", version: 1, created_at: daysAgo(2) }] }] },
        version: 2, eligible_count: 6, threshold: 4, status: "open", opened_by: "u-owner", opened_at: daysAgo(2), outcome_note: null },
      { id: "mo-2", title: "Accept Bright Spark quote $2,350 — Car park gate motor", description: "Gate sticks halfway with grinding noise. Sub-committee recommends preferred electrician.", context_type: "maintenance", context_id: "m-demo", details: { quote_id: "q-1", attachments: [{ name: "Bright-Spark-quote.txt", type: "text/plain", data: "data:text/plain;charset=utf-8," + encodeURIComponent("QUOTE — Bright Spark Electrical\nCar park gate motor replacement (supply + install)\nTotal: $2,350 incl GST\nValid 30 days · Licence QLD-EL-12345") }], trail: ["triage: High priority — gate could fail closed. Owen coordinating quotes.", "quote added: Quote from Bright Spark Electrical: $2350", "quote added: Quote from GateWorks QLD: $3100", "recommendation: Sub-committee recommends Bright Spark (preferred, 5-star)."] }, eligible_count: 6, threshold: 4, status: "passed", opened_by: DEMO_UID, opened_at: daysAgo(6), decided_at: daysAgo(4), outcome_note: "4 yes / 1 no / 1 abstained of 6 members" },
    ],
    votes: [
      { id: id(), motion_id: "mo-1", voter_user_id: "u-bcc3", vote: "yes", comment: null, created_at: daysAgo(0) },
      { id: id(), motion_id: "mo-2", voter_user_id: "u-bcc2", vote: "yes", comment: "Preferred contractor, fair price.", created_at: daysAgo(5) },
      { id: id(), motion_id: "mo-2", voter_user_id: "u-bcc3", vote: "yes", comment: null, created_at: daysAgo(5) },
      { id: id(), motion_id: "mo-2", voter_user_id: "u-bcc4", vote: "yes", comment: null, created_at: daysAgo(5) },
      { id: id(), motion_id: "mo-2", voter_user_id: "u-bcc5", vote: "yes", comment: null, proxy_for_user_id: "u-bcc6", proxy_appointment_id: "px-1", created_at: daysAgo(4) },
      { id: id(), motion_id: "mo-2", voter_user_id: "u-bcc5", vote: "no", comment: "Wanted a third quote.", created_at: daysAgo(4) },
    ],
    mcomments: [{ id: id(), motion_id: "mo-1", body: "Is the cat registered with council?", author_name: "Priya (Treasurer)", created_at: daysAgo(0) }],
    proxies: [{ id: "px-1", principal_user_id: "u-bcc6", principal_name: "Harold West", proxy_user_id: "u-bcc5", proxy_name: "Priya Sharma", scope: "committee", date_from: dAhead(-10), date_to: dAhead(4), status: "active", created_at: daysAgo(10) }],
    mact: {}, quotes: {},
    contracts: [
      { id: id(), party_name: "Sunshine Lifts Pty Ltd", party_abn: "11 222 333 444", purpose: "Quarterly lift maintenance and 24hr breakdown response", category: "lift maintenance", start_date: dAhead(-190), end_date: dAhead(40), term_months: 36, auto_renew: true, value_annual: 8400, status: "active", contact_name: "Sam Nguyen", contact_phone: "1300 555 111" },
      { id: id(), party_name: "CoastClean Services", party_abn: "55 666 777 888", purpose: "Common area cleaning three times weekly", category: "cleaning", start_date: dAhead(-120), end_date: dAhead(245), term_months: 12, auto_renew: false, value_annual: 15600, status: "active", contact_name: "Dana Reid", contact_phone: "0400 777 888" },
    ],
    contractors: [
      { id: "ctr-1", company_name: "Bright Spark Electrical", trade: "electrical", contact_name: "Sam Sparks", phone: "0400 111 222", licence_no: "QLD-EL-12345", insurance_expiry: dAhead(250), status: "preferred", rating: 5 },
      { id: id(), company_name: "AquaBuild Bathrooms", trade: "plumbing", contact_name: "Jo Pipes", phone: "0400 999 000", licence_no: "QBCC-88123", insurance_expiry: dAhead(35), status: "approved", rating: 4 },
      { id: id(), company_name: "Fresh Coat Painting", trade: "painting", contact_name: "Pat Roller", phone: "0400 555 666", licence_no: "QBCC-55555", insurance_expiry: dAhead(400), status: "approved", rating: null },
    ],
    walkItems: [], walks: [{ id: "walk-1", walk_date: dAhead(-31), attendees: "B Manager (BM), Betty Nguyen (Chair)", status: "completed", summary: "22/22 checked · 1 issue" }], walkResults: { "walk-1": [] },
    notifications: [
      { id: id(), kind: "motion_amended", ref_table: "motions", ref_id: "mo-1", title: "Conditions amended, please vote again: Approve: Pet approval — Luna", body: "Now v2. 1 earlier vote set aside. Reason: council registration condition added after Priya's question.", read_at: null, created_at: daysAgo(1) },
      { id: id(), kind: "motion_opened", ref_table: "motions", ref_id: "mo-1", title: "Vote required: Approve: Pet approval — Luna", body: "Majority needed: 4 of 6 BCC members.", read_at: daysAgo(1), created_at: daysAgo(2) },
      { id: id(), kind: "application_submitted", ref_table: "applications", ref_id: "app-1", title: "Application awaiting review", body: "Pet approval — Luna (ragdoll cat) requires a decision", read_at: null, created_at: daysAgo(1) },
      { id: id(), kind: "motion_decided", ref_table: "motions", ref_id: "mo-2", title: "Motion passed: Accept Bright Spark quote $2,350", body: "4 yes / 1 no / 1 abstained of 6 members", read_at: daysAgo(3), created_at: daysAgo(4) },
      { id: id(), kind: "maintenance_reported", ref_table: "maintenance", ref_id: "m-demo", title: "New issue: Car park gate motor failing", body: "Gate sticks halfway, grinding noise.", read_at: daysAgo(5), created_at: daysAgo(6) },
      { id: id(), kind: "access_item_issued", ref_table: "unit_access_items", ref_id: "k1", title: "Confirm receipt: key K-012", body: "Please acknowledge receipt of Front door key in the app.", read_at: null, created_at: daysAgo(2) },
    ],
  };
  const seedTrail = (mid) => ([
    { id: id(), maintenance_id: mid, kind: "triage", body: "Sub-committee triaged: high priority. Coordinating quotes.", created_at: daysAgo(6) },
    { id: id(), maintenance_id: mid, kind: "quote_added", body: "Quote from Bright Spark Electrical: $2350", created_at: daysAgo(5) },
    { id: id(), maintenance_id: mid, kind: "recommendation", body: "Sub-committee recommends Bright Spark Electrical (preferred contractor).", created_at: daysAgo(5) },
    { id: id(), maintenance_id: mid, kind: "decision", body: "Motion passed: Accept Bright Spark quote $2,350 (4 yes / 1 no of 6 members)", created_at: daysAgo(4) },
  ]);
  const seedQuotes = (mid) => ([
    { id: "q-1", maintenance_id: mid, supplier_name: "Bright Spark Electrical", amount: 2350, contractor_id: "ctr-1", status: "accepted", created_at: daysAgo(5) },
    { id: id(), maintenance_id: mid, supplier_name: "GateWorks QLD", amount: 3100, status: "rejected", created_at: daysAgo(5) },
  ]);

  // ---- Correspondence Hub demo dataset --------------------------------------
  // Sample external correspondence so the demo mirrors the live feature. Sending
  // and replies are simulated in-memory (no email leaves the browser).
  const corrMB = "seahaven@send.nalohub.com";
  const cStrata = { id: "cc-strata", name: "Jordan Lee", org: "Definitive Strata Management", email: "jordan.lee@definitivestrata.com.au", phone: "07 5333 1000", partyType: "strata_manager", party_type: "strata_manager", notes: "Our strata manager — levies, insurance and AGM paperwork." };
  const cIns = { id: "cc-ins", name: "CoastCover Claims", org: "CoastCover Insurance", email: "claims@coastcover.com.au", phone: "1300 720 720", partyType: "insurer", party_type: "insurer", notes: "Building insurer — policy 88-CC-40192." };
  const cElec = { id: "cc-elec", name: "Sam Sparks", org: "Bright Spark Electrical", email: "sam@brightspark.com.au", phone: "0400 111 222", partyType: "contractor", party_type: "contractor", notes: "Preferred electrician." };
  const cCouncil = { id: "cc-council", name: "Development Compliance", org: "Sunshine Coast Council", email: "mail@sunshinecoast.qld.gov.au", phone: "07 5475 7272", partyType: "council", party_type: "council", notes: null };
  const cLegal = { id: "cc-legal", name: "Amelia Ward", org: "Harbour Legal", email: "award@harbourlegal.com.au", phone: "07 5000 2020", partyType: "solicitor", party_type: "solicitor", notes: "Engaged re: Lot 5 water ingress." };
  const om = (o) => ({ direction: "outbound", fromName: null, fromEmail: corrMB, cc: null, bodyHtml: null, deliveryStatus: "delivered", deletedAt: null, attachments: [], ...o });
  const im = (c, o) => ({ direction: "inbound", fromName: c.name, fromEmail: c.email, toEmail: corrMB, cc: null, bodyHtml: null, deliveryStatus: null, deletedAt: null, attachments: [], ...o });
  DS.corr = {
    contacts: [cStrata, cIns, cElec, cCouncil, cLegal],
    threads: [
      { id: "ct-tree", buildingId: "b-demo", subject: "Overhanging tree — boundary with 14 Marine Pde", status: "awaiting_reply", visibility: "committee", contextType: "compliance", contextId: null, createdBy: DEMO_UID, createdAt: daysAgo(6), lastActivityAt: daysAgo(1), contact: cCouncil, messages: [
        im(cCouncil, { id: id(), subject: "Overhanging tree — boundary with 14 Marine Pde", bodyText: "Good morning,\n\nWe have received a request regarding vegetation on the common boundary. Please arrange an inspection and advise your intended action within 28 days.\n\nDevelopment Compliance\nSunshine Coast Council", createdAt: daysAgo(6) }),
        om({ id: id(), toEmail: cCouncil.email, subject: "Overhanging tree — boundary with 14 Marine Pde", bodyText: "Hello,\n\nThank you for the notice. The committee has engaged an arborist and works are booked for the week of the 20th. We will confirm once complete.\n\nSeaHaven Committee via NaloHub", createdAt: daysAgo(1) }),
      ] },
      { id: "ct-ins", buildingId: "b-demo", subject: "Certificate of currency — 2026/27 renewal", status: "open", visibility: "committee", contextType: "compliance", contextId: null, createdBy: DEMO_UID, createdAt: daysAgo(9), lastActivityAt: daysAgo(2), contact: cIns, messages: [
        om({ id: id(), toEmail: cIns.email, subject: "Certificate of currency — 2026/27 renewal", bodyText: "Hi,\n\nCould you please send the current certificate of currency for SeaHaven? Our lender has requested it for the annual review.\n\nThanks,\nSeaHaven Committee via NaloHub", createdAt: daysAgo(4) }),
        im(cIns, { id: id(), subject: "Certificate of currency — 2026/27 renewal", bodyText: "Hi team,\n\nCertificate of currency attached for the 2026/27 period. Let us know if you need anything further.\n\nCoastCover Claims", createdAt: daysAgo(2), attachments: [{ id: id(), fileName: "Certificate-of-Currency-2026-27.pdf", mime: "application/pdf", storagePath: "demo/corr/coc", size: 184320 }] }),
      ] },
      { id: "ct-lift", buildingId: "b-demo", subject: "Lift maintenance agreement — renewal terms", status: "open", visibility: "committee", contextType: "contract", contextId: null, createdBy: DEMO_UID, createdAt: daysAgo(12), lastActivityAt: daysAgo(5), contact: cStrata, messages: [
        om({ id: id(), toEmail: cStrata.email, subject: "Lift maintenance agreement — renewal terms", bodyText: "Hi Jordan,\n\nThe Sunshine Lifts agreement is up for renewal in a couple of months. Could you confirm the proposed term and annual figure so the committee can review before the next meeting?\n\nThanks,\nSeaHaven Committee via NaloHub", createdAt: daysAgo(6) }),
        im(cStrata, { id: id(), subject: "Lift maintenance agreement — renewal terms", bodyText: "Hi,\n\nProposed renewal is a 36-month term at $8,400 p.a. (CPI adjusted annually), same scope as current. I can circulate the draft for signing once the committee is comfortable.\n\nRegards,\nJordan Lee\nDefinitive Strata Management", createdAt: daysAgo(5) }),
      ] },
      { id: "ct-gate", buildingId: "b-demo", subject: "Car park gate motor — accept quote & schedule", status: "closed", visibility: "committee", contextType: "maintenance", contextId: "m-demo", createdBy: DEMO_UID, createdAt: daysAgo(5), lastActivityAt: daysAgo(4), contact: cElec, messages: [
        om({ id: id(), toEmail: cElec.email, subject: "Car park gate motor — accept quote & schedule", bodyText: "Hi Sam,\n\nThe committee has approved your quote of $2,350 for the car park gate motor. Please go ahead and let us know your earliest install date.\n\nThanks,\nSeaHaven Committee via NaloHub", createdAt: daysAgo(5) }),
        im(cElec, { id: id(), subject: "Car park gate motor — accept quote & schedule", bodyText: "No worries — booked in for Thursday morning. I will need the garage on hold-open for about two hours; I will message the building manager on arrival.\n\nCheers,\nSam\nBright Spark Electrical", createdAt: daysAgo(4) }),
      ] },
      { id: "ct-legal", buildingId: "b-demo", subject: "Lot 5 water ingress — legal position", status: "open", visibility: "restricted", contextType: "dispute", contextId: null, createdBy: DEMO_UID, createdAt: daysAgo(8), lastActivityAt: daysAgo(6), contact: cLegal, messages: [
        om({ id: id(), toEmail: cLegal.email, subject: "Lot 5 water ingress — legal position", bodyText: "Dear Amelia,\n\nFollowing the water ingress affecting Lot 5, could you advise the committee on the owners corporation position and next steps? Reports are being compiled and can be forwarded.\n\nIn confidence,\nSeaHaven Committee via NaloHub", createdAt: daysAgo(7) }),
        im(cLegal, { id: id(), subject: "Lot 5 water ingress — legal position", bodyText: "Thank you. On the information provided this appears to be common property. Please preserve all records and avoid admissions of liability while I review. I will provide a short advice this week.\n\nAmelia Ward\nHarbour Legal", createdAt: daysAgo(6) }),
      ] },
    ],
    unfiled: [
      { id: "cu-1", fromName: "Priya Sharma", fromEmail: "priya.personal@gmail.com", subject: "Fwd: Certificate of currency — 2026/27 renewal", receivedAt: daysAgo(1), body: "Forwarding the insurer reply for the record.\n\nPriya" },
      { id: "cu-2", fromName: "GateWorks QLD", fromEmail: "info@gateworksqld.com.au", subject: "Quote follow-up — gate motor", receivedAt: daysAgo(3), body: "Just following up on our quote for the gate motor — happy to match a competitor." },
    ],
  };

  // ---- re-bind the new-feature API to the demo dataset ----
  unitHealthCheck = async (_b, unitNo) => {
    const q = String(unitNo || "").trim().toLowerCase();
    const u = DS.units.find((x) => x.unit_number.toLowerCase() === q);
    if (!u) return { unit: null, residents_directory: [], people: [], past_people: [], pets: [], vehicles: [], access_items: [], breaches: [], disputes: [], applications: [] };
    const by = (arr) => arr.filter((r) => r.unit_id === u.id);
    return { unit: u,
      people: by(DS.people).filter((p) => p.is_current !== false),
      past_people: by(DS.people).filter((p) => p.is_current === false),
      residents_directory: [], pets: by(DS.pets), vehicles: by(DS.vehicles), access_items: by(DS.access), breaches: by(DS.breaches), disputes: [], applications: DS.applications.filter((a) => a.unit_id === u.id) };
  };
  // Demo documents carry their (tiny) fileData inline in the seeded store, so
  // the lazy path is never needed — returning null makes the UI fall back to
  // the data it already has.
  getDocumentFile = async () => null;
  getGalleryImages = async () => ({});
  // sorted the way the live query orders them, so the chip row reads naturally
  listUnitsOverview = async () => {
    const n = (arr, uid) => arr.filter((x) => x.unit_id === uid).length;
    return [...DS.units]
      .sort((a, b) => String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true }))
      .map((u) => {
        const people = DS.people.filter((p) => p.unit_id === u.id && p.is_current !== false);
        const pick = (t) => people.filter((p) => p.person_type === t).map((p) => p.full_name);
        return { ...u, owners: pick("owner"), tenants: pick("tenant"), others: pick("property_manager").concat(pick("emergency_contact")),
          pets: n(DS.pets, u.id), vehicles: n(DS.vehicles, u.id), keys: n(DS.access, u.id) };
      });
  };
  listUnits = async () => [...DS.units].sort((a, b) => String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true }));
  createUnit = async (_b, unit_number, lot_number, parking_spaces) => { DS.units.push({ id: id(), unit_number, lot_number, parking_spaces: Number(parking_spaces) || 0 }); };
  addUnitPerson = async (_b, unitId, row) => { DS.people.push({ id: id(), unit_id: unitId, is_current: true, ...row }); };
  addUnitPet = async (_b, unitId, row) => { DS.pets.push({ id: id(), unit_id: unitId, ...row }); };
  addUnitVehicle = async (_b, unitId, row) => { DS.vehicles.push({ id: id(), unit_id: unitId, ...row }); };
  addAccessItem = async (_b, unitId, row) => { DS.access.push({ id: id(), unit_id: unitId, ...row }); };
  updateAccessItemStatus = async (iid, status) => { const x = DS.access.find((a) => a.id === iid); if (x) x.status = status; };
  // A demo catalogue in the same shape as a real building's, small enough to
  // read at a glance but including a master, a service key and two stock-tracked
  // devices so the audit has something to reconcile.
  DS.descriptors = [
    { id: "d-master", building_id: "b-demo", name: "Building Key - Master", item_type: "key", purpose: "master", stock_tracked: false, sort: 10, active: true },
    { id: "d-service", building_id: "b-demo", name: "Building Key - Service", item_type: "key", purpose: "service", stock_tracked: false, sort: 20, active: true },
    { id: "d-stairs-g", building_id: "b-demo", name: "Building and Fire Stairs Key - Ground Floor", item_type: "key", purpose: "resident", stock_tracked: false, sort: 30, active: true },
    { id: "d-stairs-1", building_id: "b-demo", name: "Building and Fire Stairs Key - Level 1", item_type: "key", purpose: "resident", stock_tracked: false, sort: 40, active: true },
    { id: "d-fob", building_id: "b-demo", name: "Fob", item_type: "fob", purpose: "resident", stock_tracked: true, sort: 110, active: true },
    { id: "d-remote", building_id: "b-demo", name: "Remote", item_type: "remote", purpose: "resident", stock_tracked: true, sort: 120, active: true },
    { id: "d-unitdoor", building_id: "b-demo", name: "Unit door metal lock key", item_type: "key", purpose: "resident", stock_tracked: false, sort: 130, active: true },
  ];
  DS.entitlements = [
    { id: "e1", building_id: "b-demo", unit_id: "unit-12", descriptor_id: "d-fob", entitlement: 2 },
    { id: "e2", building_id: "b-demo", unit_id: "unit-12", descriptor_id: "d-remote", entitlement: 2 },
    { id: "e3", building_id: "b-demo", unit_id: "unit-12", descriptor_id: "d-unitdoor", entitlement: 2 },
    { id: "e4", building_id: "b-demo", unit_id: "unit-5", descriptor_id: "d-fob", entitlement: 1 },
    { id: "e5", building_id: "b-demo", unit_id: "unit-5", descriptor_id: "d-remote", entitlement: 1 },
  ];
  // Give the seeded demo devices a descriptor so the audit is not all unclassified.
  DS.access.forEach((a) => {
    if (a.descriptor_id) return;
    a.descriptor_id = a.item_type === "fob" ? "d-fob" : a.item_type === "remote" ? "d-remote"
      : a.purpose === "master" ? "d-master" : a.purpose === "service" ? "d-service" : "d-unitdoor";
  });

  listAccessDescriptors = async () => [...DS.descriptors].filter((d) => d.active).sort((a, b) => a.sort - b.sort);
  saveAccessDescriptor = async (_b, d) => {
    if (d.id) { const x = DS.descriptors.find((y) => y.id === d.id); if (x) Object.assign(x, d); return; }
    DS.descriptors.push({ id: id(), building_id: "b-demo", active: true, stock_tracked: !!d.stock_tracked,
      sort: Number(d.sort) || 0, name: d.name, item_type: d.item_type || "key", purpose: d.purpose || "resident" });
  };
  setAccessDescriptorActive = async (_b, did, active) => { const x = DS.descriptors.find((y) => y.id === did); if (x) x.active = !!active; };
  listAccessEntitlements = async () => [...DS.entitlements];
  setAccessEntitlement = async (_b, unitId, descriptorId, ent) => {
    const x = DS.entitlements.find((e) => e.unit_id === unitId && e.descriptor_id === descriptorId);
    if (x) x.entitlement = Math.max(0, Number(ent) || 0);
    else DS.entitlements.push({ id: id(), building_id: "b-demo", unit_id: unitId, descriptor_id: descriptorId, entitlement: Math.max(0, Number(ent) || 0) });
  };
  bulkSetAccessEntitlements = async (_b, rows) => {
    let set = 0; const skipped = [];
    (rows || []).forEach((r) => {
      const u = DS.units.find((x) => String(x.unit_number).toLowerCase() === String(r.unit || "").trim().toLowerCase());
      const d = DS.descriptors.find((x) => x.name.toLowerCase() === String(r.descriptor || "").trim().toLowerCase());
      if (!u) { skipped.push(`unit "${r.unit}" not found`); return; }
      if (!d) { skipped.push(`descriptor "${r.descriptor}" not found`); return; }
      setAccessEntitlement(null, u.id, d.id, r.entitlement); set++;
    });
    return { set, skipped };
  };
  bulkClassifyAccessItems = async (_b, rows) => {
    let classified = 0; const skipped = [];
    (rows || []).forEach((r) => {
      const d = DS.descriptors.find((x) => x.name.toLowerCase() === String(r.descriptor || "").trim().toLowerCase());
      if (!d) { skipped.push(`descriptor "${r.descriptor}" not found`); return; }
      const hit = DS.access.filter((a) => String(a.identifier || "").trim() === String(r.identifier || "").trim());
      if (!hit.length) { skipped.push(`key number "${r.identifier}" not in the register`); return; }
      hit.forEach((a) => { a.descriptor_id = d.id; if (r.status) a.status = r.status; classified++; });
    });
    return { classified, skipped };
  };
  runAccessAudit = async () => {
    const out = [];
    const nm = (did) => DS.descriptors.find((d) => d.id === did) || {};
    const cnt = (arr, st) => arr.filter((a) => (st === "suspended" ? (a.status === "suspended" || a.status === "lost") : a.status === st)).length;
    // unit x descriptor pairs that have an entitlement or a device
    DS.units.forEach((u) => DS.descriptors.forEach((d) => {
      const ent = (DS.entitlements.find((e) => e.unit_id === u.id && e.descriptor_id === d.id) || {}).entitlement || 0;
      const items = DS.access.filter((a) => a.unit_id === u.id && a.descriptor_id === d.id);
      if (!ent && !items.length) return;
      const issued = cnt(items, "issued"), on_hand = cnt(items, "on_hand");
      out.push({ scope: "unit", unit_id: u.id, unit_number: u.unit_number, descriptor_id: d.id, descriptor: d.name,
        item_type: d.item_type, purpose: d.purpose, stock_tracked: d.stock_tracked, sort: d.sort,
        entitlement: ent, issued, on_hand, suspended: cnt(items, "suspended"), returned: cnt(items, "returned"),
        held: issued + on_hand, variance: issued + on_hand - ent });
    }));
    DS.descriptors.forEach((d) => {
      const items = DS.access.filter((a) => !a.unit_id && a.descriptor_id === d.id);
      if (!d.stock_tracked && !items.length) return;
      const issued = cnt(items, "issued"), on_hand = cnt(items, "on_hand");
      out.push({ scope: "stock", unit_id: null, unit_number: null, descriptor_id: d.id, descriptor: d.name,
        item_type: d.item_type, purpose: d.purpose, stock_tracked: d.stock_tracked, sort: d.sort,
        entitlement: 0, issued, on_hand, suspended: cnt(items, "suspended"), returned: cnt(items, "returned"),
        held: issued + on_hand, variance: 0 });
    });
    const uncl = DS.access.filter((a) => !a.descriptor_id);
    const byUnit = {};
    uncl.forEach((a) => { (byUnit[a.unit_id || ""] = byUnit[a.unit_id || ""] || []).push(a); });
    Object.keys(byUnit).forEach((uid) => {
      const items = byUnit[uid];
      const u = DS.units.find((x) => x.id === uid);
      const issued = cnt(items, "issued"), on_hand = cnt(items, "on_hand");
      out.push({ scope: "unclassified", unit_id: uid || null, unit_number: u ? u.unit_number : null,
        descriptor_id: null, descriptor: "Not yet classified", item_type: items[0].item_type, purpose: items[0].purpose,
        stock_tracked: false, sort: 9999, entitlement: 0, issued, on_hand,
        suspended: cnt(items, "suspended"), returned: cnt(items, "returned"), held: issued + on_hand, variance: 0 });
    });
    return out.sort((a, b) => (a.sort - b.sort) || String(a.unit_number || "").localeCompare(String(b.unit_number || "")));
  };
  uploadAccessReceipt = async (_b, itemId, file) => {
    const path = "demo/receipt-" + id(); files[path] = URL.createObjectURL(file);
    const x = DS.access.find((a) => a.id === itemId);
    if (x) { x.receipt_path = path; x.receipt_uploaded_at = now(); }
    return { name: file.name, path, kind: "document" };
  };
  accessReceiptUrl = async (path) => files[path] || "about:blank";
  suspendAccessItem = async (_b, iid, reason) => {
    const x = DS.access.find((a) => a.id === iid);
    if (x) { x.status = "suspended"; x.suspended_at = now(); x.suspended_reason = reason || null; }
  };
  listAccessItems = async () => DS.access.map((a) => {
    const u = DS.units.find((x) => x.id === a.unit_id);
    const d = DS.descriptors.find((x) => x.id === a.descriptor_id);
    return { ...a, building_id: "b-demo", purpose: a.purpose || "resident",
      descriptor: d ? d.name : "", descriptor_sort: d ? d.sort : 9999,
      unit_number: u ? u.unit_number : "",
      occupants: DS.people.filter((p) => p.unit_id === a.unit_id && p.is_current !== false).map((p) => p.full_name) };
  });
  acknowledgeAccessItem = async () => ({ ok: true });
  addUnitBreach = async (_b, unitId, row) => { DS.breaches.push({ id: id(), unit_id: unitId, status: "open", ...row }); };
  updateUnitAgent = async (_b, unitId, agent) => { const u = DS.units.find((x) => x.id === unitId); if (u) { u.agent_business = agent.business; u.agent_contact = agent.contact; u.agent_phone = agent.phone; u.agent_email = agent.email; u.agent_note = agent.note; } };
  // registry corrections, move-outs and removals — demo dataset
  updateUnit = async (_b, unitId, patch) => { const u = DS.units.find((x) => x.id === unitId); if (u) Object.assign(u, patch); };
  updateUnitPerson = async (_b, pid, patch) => { const x = DS.people.find((p) => p.id === pid); if (x) Object.assign(x, patch); };
  moveOutUnitPerson = async (_b, pid, moveOut) => { const x = DS.people.find((p) => p.id === pid); if (x) { x.is_current = false; x.move_out = moveOut || localDate(); } };
  restoreUnitPerson = async (_b, pid) => { const x = DS.people.find((p) => p.id === pid); if (x) { x.is_current = true; x.move_out = null; } };
  moveOutUnitPeopleOfType = async (_b, unitId, personType, moveOut) => {
    const hit = DS.people.filter((p) => p.unit_id === unitId && p.person_type === personType && p.is_current !== false);
    hit.forEach((p) => { p.is_current = false; p.move_out = moveOut || localDate(); });
    return hit.length;
  };
  deleteUnitPerson = async (_b, pid) => { const i = DS.people.findIndex((p) => p.id === pid); if (i > -1) DS.people.splice(i, 1); };
  updateUnitPet = async (_b, pid, patch) => { const x = DS.pets.find((p) => p.id === pid); if (x) Object.assign(x, patch); };
  deleteUnitPet = async (_b, pid) => { const i = DS.pets.findIndex((p) => p.id === pid); if (i > -1) DS.pets.splice(i, 1); };
  updateUnitVehicle = async (_b, vid, patch) => { const x = DS.vehicles.find((v) => v.id === vid); if (x) Object.assign(x, patch); };
  deleteUnitVehicle = async (_b, vid) => { const i = DS.vehicles.findIndex((v) => v.id === vid); if (i > -1) DS.vehicles.splice(i, 1); };
  updateAccessItem = async (_b, aid, patch) => { const x = DS.access.find((a) => a.id === aid); if (x) Object.assign(x, patch); };
  deleteAccessItem = async (_b, aid) => { const i = DS.access.findIndex((a) => a.id === aid); if (i > -1) DS.access.splice(i, 1); };
  updateUnitBreach = async (_b, bid2, patch) => { const x = DS.breaches.find((b) => b.id === bid2); if (x) Object.assign(x, patch); };
  deleteUnitBreach = async (_b, bid2) => { const i = DS.breaches.findIndex((b) => b.id === bid2); if (i > -1) DS.breaches.splice(i, 1); };
  // Correspondence Hub — demo dataset (sample threads; sending & replies simulated, no real email)
  listCorrThreads = async () => [...DS.corr.threads].sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1)).map((t) => ({ id: t.id, subject: t.subject, status: t.status, visibility: t.visibility, contextType: t.contextType, contextId: t.contextId, lastActivityAt: t.lastActivityAt, createdAt: t.createdAt, contact: t.contact ? { name: t.contact.name, email: t.contact.email, org: t.contact.org, partyType: t.contact.partyType } : null }));
  getCorrThread = async (tid) => { const t = DS.corr.threads.find((x) => x.id === tid); if (!t) return { thread: null, messages: [] }; return { thread: { id: t.id, buildingId: t.buildingId, subject: t.subject, status: t.status, visibility: t.visibility, contextType: t.contextType, contextId: t.contextId, createdBy: t.createdBy, createdAt: t.createdAt, lastActivityAt: t.lastActivityAt, contact: t.contact }, messages: [...t.messages].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)) }; };
  listCorrContacts = async () => [...DS.corr.contacts].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, org: c.org, email: c.email, phone: c.phone, partyType: c.partyType, notes: c.notes || "" }));
  saveCorrContact = async (_b, c) => { if (c && c.id) { const x = DS.corr.contacts.find((y) => y.id === c.id); if (x) Object.assign(x, { name: c.name, org: c.org, email: c.email, phone: c.phone, partyType: c.partyType, party_type: c.partyType, notes: c.notes }); return c.id; } const nc = { id: id(), name: c.name, org: c.org || "", email: c.email || "", phone: c.phone || "", partyType: c.partyType || "other", party_type: c.partyType || "other", notes: c.notes || "" }; DS.corr.contacts.push(nc); return nc.id; };
  // Broadcast audiences: the same rules as broadcast_recipients(), over DS.
  const demoLevel = (n) => { const m = /^([A-Za-z]|[0-9]+)[0-9]{2}$/.exec(String(n || "")); return m ? m[1].toUpperCase() : null; };
  const demoAudienceOk = (p, aud, keys) => ({ all: true, owners: p.kind === "owner", tenants: p.kind === "tenant", residents: !!p.lives_here,
    offsite: p.kind === "owner" && !p.lives_here, specific: (keys || []).includes(p.key) })[aud] || false;
  previewBroadcast = async (_b, audience, listId, people) => {
    let aud = audience || "all", rule = {}, keys = people || [], listName = null;
    if (aud === "list") {
      const l = (await listDistributionLists()).find((x) => x.id === listId);
      if (!l) throw new Error("list not found");
      listName = l.name;
      if (l.kind === "rule") { rule = l.rule || {}; aud = rule.audience || "all"; } else { keys = l.members || []; aud = "specific"; }
    }
    const unitOf = Object.fromEntries(DS.units.map((u) => [u.id, u]));
    const cur = DS.people.filter((p) => p.is_current !== false && (p.person_type === "owner" || p.person_type === "tenant"));
    const tenanted = new Set(cur.filter((p) => p.person_type === "tenant").map((p) => p.unit_id));
    const pets = new Set(DS.pets.map((p) => p.unit_id));
    const rows = cur.map((p) => { const u = unitOf[p.unit_id] || {}; return { key: "up:" + p.id, name: p.full_name, email: String(p.email || "").trim() || null,
      unit: u.unit_number || "", kind: p.person_type, level: demoLevel(u.unit_number), pet: pets.has(p.unit_id), membership_id: null,
      lives_here: p.person_type === "tenant" ? true : (p.lives_here ?? !tenanted.has(p.unit_id)) }; });
    const keep = (p) => demoAudienceOk(p, aud, keys) && (!(rule.levels || []).length || (rule.levels || []).includes(p.level))
      && (!(rule.units || []).length || (rule.units || []).includes(p.unit)) && (!rule.pets || p.pet);
    const seen = new Set(), out = [];
    rows.filter(keep).sort((a, b) => (parseInt(a.unit, 10) || 0) - (parseInt(b.unit, 10) || 0) || a.name.localeCompare(b.name))
      .forEach((p) => { const k = p.email ? p.email.toLowerCase() : p.key; if (seen.has(k)) return; seen.add(k); out.push(p); });
    const emailable = out.filter((p) => p.email).length;
    return { audience, list_name: listName, people: out, count: out.length, emailable, no_email: out.length - emailable, units: new Set(out.map((p) => p.unit)).size };
  };
  listDistributionLists = async () => {
    if (!DS.dlists) {
      const owners = DS.people.filter((p) => p.is_current !== false && p.person_type === "owner").slice(0, 5).map((p) => "up:" + p.id);
      DS.dlists = [
        { id: "dl-pool", name: "Pool working group", kind: "manual", members: owners, rule: {} },
        { id: "dl-pets", name: "Pet owners and their tenants", kind: "rule", members: [], rule: { audience: "all", pets: true } },
      ];
    }
    return [...DS.dlists].sort((a, b) => a.name.localeCompare(b.name));
  };
  saveDistributionList = async (_b, l) => {
    await listDistributionLists();
    const row = { name: String(l.name || "").trim(), kind: l.kind === "rule" ? "rule" : "manual", members: l.kind === "rule" ? [] : (l.members || []), rule: l.kind === "rule" ? (l.rule || {}) : {} };
    if (l.id) { const x = DS.dlists.find((y) => y.id === l.id); if (x) Object.assign(x, row); return x; }
    const n = { id: id(), ...row }; DS.dlists.push(n); return n;
  };
  deleteDistributionList = async (_b, did) => { await listDistributionLists(); DS.dlists = DS.dlists.filter((x) => x.id !== did); };
  sendAnnouncementEmail = async (x) => {
    const r = await previewBroadcast(x.buildingId, x.audience, x.listId, x.people);
    (DS.sends = DS.sends || []).unshift({ id: id(), announcement_id: x.announcementId, subject: x.subject, audience: x.audience, list_name: r.list_name,
      recipients: r.people.map((p) => ({ name: p.name, unit: p.unit, kind: p.kind, email: p.email })), people_count: r.count, emailed_count: r.emailable, no_email_count: r.no_email, sent_at: now() });
    return { ok: true, sent: r.emailable, people: r.count, noEmail: r.no_email };
  };
  listAnnouncementSends = async (_b, aid) => (DS.sends || []).filter((s) => s.announcement_id === aid);
  ensureBuildingMailbox = async () => ({ slug: null, address: null, existing: false });
  sendCorrespondence = async (payload) => {
    const p = payload || {};
    let t = p.threadId ? DS.corr.threads.find((x) => x.id === p.threadId) : null;
    if (!t) {
      const pc = p.contact || {};
      let contact = pc.id ? DS.corr.contacts.find((x) => x.id === pc.id) : null;
      if (!contact) { contact = { id: id(), name: pc.name || pc.email || "New recipient", org: pc.org || "", email: pc.email || "", phone: "", partyType: pc.party_type || "other", party_type: pc.party_type || "other", notes: "" }; if (pc.name || pc.email) DS.corr.contacts.push(contact); }
      t = { id: id(), buildingId: "b-demo", subject: p.subject || "(no subject)", status: "awaiting_reply", visibility: p.visibility || "committee", contextType: p.contextType || "general", contextId: p.contextId || null, createdBy: DEMO_UID, createdAt: now(), lastActivityAt: now(), contact, messages: [] };
      DS.corr.threads.unshift(t);
    }
    const msg = { id: id(), direction: "outbound", fromName: null, fromEmail: corrMB, toEmail: t.contact.email, cc: null, subject: p.subject || t.subject, bodyText: p.bodyText || "", bodyHtml: null, deliveryStatus: "delivered", deletedAt: null, createdAt: now(), attachments: (p.attachments || []).map((a) => ({ id: id(), fileName: a.filename, mime: a.mime, storagePath: "demo/corr/" + id(), size: a.contentBase64 ? Math.round(a.contentBase64.length * 0.75) : 0 })) };
    t.messages.push(msg); t.lastActivityAt = now();
    setTimeout(() => { t.messages.push({ id: id(), direction: "inbound", fromName: t.contact.name, fromEmail: t.contact.email, toEmail: corrMB, cc: null, subject: msg.subject, bodyText: "Thanks — got your email, I will follow up shortly.\n\n" + t.contact.name + (t.contact.org ? "\n" + t.contact.org : ""), bodyHtml: null, deliveryStatus: null, deletedAt: null, createdAt: now(), attachments: [] }); t.status = "open"; t.lastActivityAt = now(); }, 1800);
    return { ok: true, threadId: t.id, messageId: msg.id, deliveryStatus: "sent", demo: true };
  };
  updateCorrThread = async (tid, patch) => { const t = DS.corr.threads.find((x) => x.id === tid); if (t && patch) { if (patch.status !== undefined) t.status = patch.status; if (patch.visibility !== undefined) t.visibility = patch.visibility; if (patch.subject !== undefined) t.subject = patch.subject; } };
  setCorrThreadMembers = async () => {};
  corrAttachmentUrl = async () => "";
  listCorrUnfiled = async () => [...DS.corr.unfiled];
  fileCorrUnfiledNewThread = async (rawId, opts) => {
    const o = opts || {};
    const i = DS.corr.unfiled.findIndex((u) => u.id === rawId);
    const u = i >= 0 ? DS.corr.unfiled[i] : null;
    if (!u) throw new Error("unfiled item not found");
    DS.corr.unfiled.splice(i, 1);
    let contact = DS.corr.contacts.find((c) => (c.email || "").toLowerCase() === (u.fromEmail || "").toLowerCase());
    if (!contact) {
      contact = { id: id(), name: o.contactName || u.fromName || u.fromEmail || "Unknown sender",
        org: o.org || "", email: u.fromEmail || "", phone: "",
        partyType: o.partyType || "other", party_type: o.partyType || "other", notes: "" };
      DS.corr.contacts.push(contact);
    }
    const t = { id: id(), buildingId: "b-demo", subject: o.subject || u.subject || "(no subject)",
      status: "open", visibility: "committee", contextType: "general", contextId: null,
      createdBy: DEMO_UID, createdAt: now(), lastActivityAt: now(), contact,
      messages: [{ id: id(), direction: "inbound", fromName: u.fromName, fromEmail: u.fromEmail,
        toEmail: corrMB, cc: null, subject: u.subject, bodyText: u.body || "", bodyHtml: null,
        deliveryStatus: null, deletedAt: null, createdAt: now(), attachments: [] }] };
    DS.corr.threads.unshift(t);
    return t.id;
  };
  searchCorrespondence = async (_b, q) => {
    const needle = String(q || "").trim().toLowerCase();
    if (!needle) return [];
    const out = [];
    DS.corr.threads.forEach((t) => {
      const c = t.contact || {};
      if ([t.subject, c.name, c.email, c.org].filter(Boolean).join(" ").toLowerCase().includes(needle)) {
        out.push({ threadId: t.id, threadSubject: t.subject, contactName: c.name, contactEmail: c.email,
          threadStatus: t.status, messageId: null, direction: null, matchedIn: "thread", snippet: null,
          occurredAt: t.lastActivityAt });
      }
      (t.messages || []).forEach((m) => {
        const body = String(m.bodyText || "");
        if ([m.subject, m.fromName, m.fromEmail, body].filter(Boolean).join(" ").toLowerCase().includes(needle)) {
          const at = body.toLowerCase().indexOf(needle);
          out.push({ threadId: t.id, threadSubject: t.subject, contactName: c.name, contactEmail: c.email,
            threadStatus: t.status, messageId: m.id, direction: m.direction, matchedIn: "message",
            snippet: at >= 0 ? body.slice(Math.max(0, at - 60), at + 120).replace(/\s+/g, " ") : (m.subject || ""),
            occurredAt: m.createdAt });
        }
      });
    });
    return out.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)).slice(0, 100);
  };
  fileCorrUnfiled = async (rawId, tid) => { const i = DS.corr.unfiled.findIndex((u) => u.id === rawId); const u = i >= 0 ? DS.corr.unfiled[i] : null; if (i >= 0) DS.corr.unfiled.splice(i, 1); const t = DS.corr.threads.find((x) => x.id === tid); if (t && u) { t.messages.push({ id: id(), direction: "inbound", fromName: u.fromName, fromEmail: u.fromEmail, toEmail: corrMB, cc: null, subject: u.subject, bodyText: u.body || "(Filed from the Unfiled tray.)", bodyHtml: null, deliveryStatus: null, deletedAt: null, createdAt: now(), attachments: [] }); t.lastActivityAt = now(); } return "demo-msg"; };
  listApplications = async () => [...DS.applications].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
  createApplication = async (_b, _uid, unitId, kind, category, title, details) => {
    const aid = id();
    DS.applications.unshift({ id: aid, unit_id: unitId, kind, category, title, details, status: "submitted", submitted_by: DEMO_UID, submitted_at: now() });
    if (kind === "application" && ["pet", "lot_improvement", "keys_access", "other"].includes(category)) {
      DS.motions.unshift({ id: id(), title: "Approve: " + (title || category), description: details.description || "", context_type: "application", context_id: aid, details: { category, unit: details.unit, conditions: ["Approval is subject to compliance with the scheme's by-laws.", "The committee may attach further reasonable conditions before final sign-off."] }, version: 1, eligible_count: 6, threshold: 4, status: "open", opened_by: DEMO_UID, opened_at: now() });
      DS.notifications.unshift({ id: id(), kind: "motion_opened", ref_table: "motions", ref_id: aid, title: "Vote required: Approve: " + (title || category), body: "Majority needed: 4 of 6 BCC members.", read_at: null, created_at: now() });
    } else {
      DS.notifications.unshift({ id: id(), kind: "application_submitted", ref_table: "applications", ref_id: aid, title: (kind === "booking" ? "Booking" : "Application") + " awaiting review", body: (title || category) + " requires a decision", read_at: null, created_at: now() });
    }
    return aid;
  };
  decideApplication = async (_b, aid, approve, note) => {
    const a = DS.applications.find((x) => x.id === aid);
    if (a) { a.status = approve ? "approved" : "declined"; a.decided_at = now(); a.decision_note = note || null;
      if (approve && a.category === "parking_permit") DS.permits.unshift({ id: id(), application_id: aid, permit_no: "PP-" + String(DS.permits.length + 8).padStart(4, "0"), unit_number: a.details.unit, vehicle_make: a.details.vehicle_make, vehicle_model: a.details.vehicle_model, vehicle_colour: a.details.vehicle_colour, vehicle_rego: a.details.vehicle_rego, date_from: a.details.date_from, date_to: a.details.date_to, approval_date: localDate(), status: "active" });
    }
  };
  withdrawApplication = async (_b, aid) => { const a = DS.applications.find((x) => x.id === aid); if (a) a.status = "withdrawn"; };
  listApplicationAttachments = async (ids) => DS.appAtts.filter((a) => ids.includes(a.application_id));
  addApplicationAttachment = async (aid, up) => { DS.appAtts.push({ id: id(), application_id: aid, file_name: up.name, file_kind: up.kind, storage_path: up.path }); };
  uploadMedia = async (_b, _area, file) => { const path = "demo/" + id(); files[path] = URL.createObjectURL(file); return { name: file.name, path, kind: /^image\//.test(file.type) ? "image" : /^video\//.test(file.type) ? "video" : "document" }; };
  mediaUrl = async (path) => files[path] || "about:blank";
  mediaBlob = async (path) => (await fetch(files[path])).blob();
  listPermits = async () => DS.permits;
  openPermitPdf = async () => { window.alert("In the live app this opens the pre-filled fold-for-dash permit PDF."); };
  openProxyFormPdf = async () => { window.alert("In the live app this opens the signable proxy appointment form PDF."); };
  listMotions = async () => [...DS.motions];
  listMotionVotes = async () => [...DS.votes];
  listMotionComments = async () => [...DS.mcomments];
  addMotionComment = async (mid, body, authorName) => { DS.mcomments.push({ id: id(), motion_id: mid, body, author_name: authorName, created_at: now() }); };
  updateMotionConditions = async (mid, conditions) => { const m = DS.motions.find((x) => x.id === mid); if (m) m.details = { ...(m.details || {}), conditions }; };
  amendMotionConditions = async (mid, conditions, reason, authorName) => {
    const m = DS.motions.find((x) => x.id === mid);
    if (!m || m.status !== "open") throw new Error("Only an open motion can be amended");
    if (!reason || !String(reason).trim()) throw new Error("A reason for the amendment is required");
    const before = (m.details && m.details.conditions) || [];
    const fromV = m.version || 1, toV = fromV + 1;
    const superseded = DS.votes.filter((v) => v.motion_id === mid).map((v) => ({ ...v, version: fromV }));
    DS.votes = DS.votes.filter((v) => v.motion_id !== mid);
    const entry = { version_from: fromV, version_to: toV, conditions_before: before, conditions_after: conditions, reason: String(reason).trim(), by: authorName || "Committee member", by_user_id: DEMO_UID, at: now(), superseded_votes: superseded };
    m.version = toV;
    m.details = { ...(m.details || {}), conditions, history: [...((m.details && m.details.history) || []), entry] };
    DS.notifications.unshift({ id: id(), kind: "motion_amended", ref_table: "motions", ref_id: mid, title: "Conditions amended, please vote again: " + m.title, body: `Now v${toV}. ${superseded.length} earlier vote${superseded.length === 1 ? "" : "s"} set aside. Reason: ${entry.reason}`, read_at: null, created_at: now() });
    return { version: toV, superseded: superseded.length };
  };
  createMotion = async (_b, _u, m) => { const mid = id(); DS.motions.unshift({ id: mid, eligible_count: 6, threshold: 4, status: "open", opened_at: now(), opened_by: DEMO_UID, outcome_note: null, ...m }); return mid; };
  castVote = async (mid, uid, vote, comment, proxy) => {
    DS.votes.push({ id: id(), motion_id: mid, voter_user_id: uid || DEMO_UID, vote, comment: comment || null, proxy_for_user_id: proxy ? proxy.principal_user_id : null, proxy_appointment_id: proxy ? proxy.id : null, created_at: now() });
    const m = DS.motions.find((x) => x.id === mid);
    if (m && m.status === "open") {
      const vs = DS.votes.filter((v) => v.motion_id === mid);
      const yes = vs.filter((v) => v.vote === "yes").length, no = vs.filter((v) => v.vote === "no").length;
      if (yes >= m.threshold) { m.status = "passed"; m.decided_at = now(); m.outcome_note = `${yes} yes / ${no} no / ${vs.length - yes - no} abstained of ${m.eligible_count} members`;
        if (m.context_type === "application") decideApplication(null, m.context_id, true, "Decided by BCC vote: " + m.outcome_note + (m.details && m.details.conditions ? ` — approval subject to the attached conditions (v${m.version || 1})` : ""));
        if (m.context_type === "application") { const a = DS.applications.find((x) => x.id === m.context_id); if (a && m.details && m.details.conditions) a.details = { ...a.details, conditions: m.details.conditions }; }
      } else if (yes + (m.eligible_count - vs.length) < m.threshold) { m.status = "failed"; m.decided_at = now(); m.outcome_note = `${yes} yes / ${no} no of ${m.eligible_count} members — majority not achievable`; if (m.context_type === "application") decideApplication(null, m.context_id, false, "Decided by BCC vote: " + m.outcome_note); }
    }
  };
  withdrawMotion = async (mid) => { const m = DS.motions.find((x) => x.id === mid); if (m) { m.status = "withdrawn"; m.decided_at = now(); } };
  listProxies = async () => [...DS.proxies];
  createProxy = async (_b, p) => { DS.proxies.unshift({ id: id(), status: "active", created_at: now(), ...p }); };
  revokeProxy = async (_b, pid) => { const p = DS.proxies.find((x) => x.id === pid); if (p) p.status = "revoked"; };
  listMaintActivity = async (_b, mid) => { if (!DS.mact[mid]) DS.mact[mid] = seedTrail(mid); return [...DS.mact[mid]]; };
  addMaintActivity = async (_b, mid, kind, body, extra) => { if (!DS.mact[mid]) DS.mact[mid] = seedTrail(mid); DS.mact[mid].push({ id: id(), maintenance_id: mid, kind, body, data: extra || {}, created_at: now() }); };
  listMaintQuotes = async (_b, mid) => { if (!DS.quotes[mid]) DS.quotes[mid] = seedQuotes(mid); return [...DS.quotes[mid]]; };
  addMaintQuote = async (_b, mid, q) => { if (!DS.quotes[mid]) DS.quotes[mid] = seedQuotes(mid); DS.quotes[mid].push({ id: id(), maintenance_id: mid, status: "received", created_at: now(), ...q }); };
  setQuoteStatus = async (qid, status) => { Object.values(DS.quotes).forEach((arr) => { const q = arr.find((x) => x.id === qid); if (q) { q.status = status; if (status === "accepted") arr.forEach((o) => { if (o.id !== qid && o.status === "accepted") o.status = "rejected"; }); } }); };
  listContracts = async () => [...DS.contracts];
  saveContract = async (_b, c) => { if (c.id) { const x = DS.contracts.find((y) => y.id === c.id); Object.assign(x, c); } else DS.contracts.push({ id: id(), status: "active", ...c }); };
  deleteContract = async (_b, cid) => { DS.contracts = DS.contracts.filter((c) => c.id !== cid); };
  listContractors = async () => [...DS.contractors];
  saveContractor = async (_b, c) => { if (c.id) { const x = DS.contractors.find((y) => y.id === c.id); Object.assign(x, c); } else DS.contractors.push({ id: id(), status: "approved", ...c }); };
  deleteContractor = async (_b, cid) => { DS.contractors = DS.contractors.filter((c) => c.id !== cid); };
  listWalkItems = async () => [...DS.walkItems];
  seedWalkDefaults = async () => {
    if (DS.walkItems.length) return 0;
    const rows = [["Fire Safety", "Fire exits clear and doors close/latch properly"], ["Fire Safety", "Extinguishers & hose reels in place, tags current"], ["Fire Safety", "Exit & emergency lighting working"], ["Access & Security", "Entry doors, intercom and fob readers working"], ["Access & Security", "Garage/gate doors operating and closing fully"], ["Access & Security", "CCTV cameras operational"], ["Lifts", "Lift operating normally, no unusual noise"], ["Common Areas", "Lobby, corridors & stairwells clean and lit"], ["Common Areas", "Bin rooms clean, no pests"], ["Common Areas", "Trip hazards: paths, mats, handrails secure"], ["Amenities", "Pool area: water clarity, gates self-close"], ["Building Fabric", "Balustrades and railings secure"], ["Building Fabric", "Signs of water leaks, damp or mould"], ["Services", "Common area lighting: globes out, sensors working"], ["Grounds", "Gardens, irrigation and drainage condition"]];
    rows.forEach(([area, item], i) => DS.walkItems.push({ id: id(), area, item, sort: i * 10, active: true }));
    return rows.length;
  };
  addWalkItem = async (_b, area, item) => { DS.walkItems.push({ id: id(), area, item, sort: 999, active: true }); };
  removeWalkItem = async (_b, iid) => { DS.walkItems = DS.walkItems.filter((i) => i.id !== iid); };
  listWalks = async () => [...DS.walks];
  createWalk = async (_b, attendees) => { const wid = id(); DS.walks.unshift({ id: wid, walk_date: localDate(), attendees, status: "in_progress", summary: null }); DS.walkResults[wid] = []; return wid; };
  listWalkResults = async (wid) => [...(DS.walkResults[wid] || [])];
  setWalkResult = async (wid, iid, result, note) => setWalkResultPhoto(wid, iid, result, note, null);
  setWalkResultPhoto = async (wid, iid, result, note, photoPath) => {
    const arr = DS.walkResults[wid] = DS.walkResults[wid] || [];
    const ex = arr.find((r) => r.item_id === iid);
    if (ex) { if (result) ex.result = result; if (note !== undefined) ex.note = note; if (photoPath) ex.photo_path = photoPath; }
    else arr.push({ id: id(), walkthrough_id: wid, item_id: iid, result, note, photo_path: photoPath });
  };
  setWalkResultMaint = async (wid, iid, maintId) => {
    const arr = DS.walkResults[wid] = DS.walkResults[wid] || [];
    const ex = arr.find((r) => r.item_id === iid);
    if (ex) ex.maintenance_id = maintId; else arr.push({ id: id(), walkthrough_id: wid, item_id: iid, maintenance_id: maintId });
  };
  completeWalk = async (_b, wid, summary) => { const w = DS.walks.find((x) => x.id === wid); if (w) { w.status = "completed"; w.summary = summary; } };
  listWalkSections = async () => [...(DS.walkSections || [])];
  listFindings = async () => [...(DS.findings || [])];
  listFindingEvents = async () => [...(DS.findingEvents || [])];
  raiseFinding = async (_b, f) => {
    DS.findings = DS.findings || [];
    const n = DS.findings.length + 1;
    const row = { id: id(), ref: "DEMO-" + String(n).padStart(4, "0"), class: f.cls, section_id: f.sectionId || null,
      item_id: f.itemId || null, location: f.location || null, observation: f.observation,
      standard_snapshot: f.standard || null, standard_is_general: !!f.general, required_outcome: f.outcome || null,
      owner: f.owner || null, due_date: f.due || null, risk_rating: f.cls === "H" ? (f.risk || "medium") : null,
      status: "open", first_raised_on: localDate(), first_raised_walk_id: f.walkId || null,
      walks_open: 1, overdue: false, section_name: f.sectionName || null };
    DS.findings.unshift(row);
    (DS.findingEvents = DS.findingEvents || []).push({ id: id(), finding_id: row.id, walkthrough_id: f.walkId || null, event: "raised", note: f.observation, photo_path: f.photoPath || null, occurred_at: now() });
    return row;
  };
  updateFinding = async (_b, fid, patch) => { const f = (DS.findings || []).find((x) => x.id === fid); if (f) Object.assign(f, patch); };
  closeFinding = async (_b, fid, wid, note, photoPath) => { const f = (DS.findings || []).find((x) => x.id === fid); if (f) { f.status = "closed"; f.closed_walk_id = wid || null; f.closed_at = now(); } (DS.findingEvents = DS.findingEvents || []).push({ id: id(), finding_id: fid, walkthrough_id: wid || null, event: "closed", note: note || null, photo_path: photoPath || null, occurred_at: now() }); };
  reopenFinding = async (_b, fid, wid) => { const f = (DS.findings || []).find((x) => x.id === fid); if (f) { f.status = "open"; f.closed_at = null; f.closed_walk_id = null; } (DS.findingEvents = DS.findingEvents || []).push({ id: id(), finding_id: fid, walkthrough_id: wid || null, event: "reopened", occurred_at: now() }); };
  observeFindingAgain = async (fid, wid, note, photoPath) => {
    const f = (DS.findings || []).find((x) => x.id === fid); if (f) f.walks_open = (f.walks_open || 1) + 1;
    (DS.findingEvents = DS.findingEvents || []).push({ id: id(), finding_id: fid, walkthrough_id: wid || null, event: "observed_again", note: note || null, photo_path: photoPath || null, occurred_at: now() });
  };
  discardWalk = async (_b, wid) => { const i = DS.walks.findIndex((x) => x.id === wid); if (i >= 0) DS.walks.splice(i, 1); };
  setWalkMeta = async (wid, patch) => { const w = DS.walks.find((x) => x.id === wid); if (w) Object.assign(w, patch); };
  amendFinding = async (_b, fid, patch, reason) => {
    const f = (DS.findings || []).find((x) => x.id === fid); if (!f) return;
    if (f.status !== "open") throw new Error("only an open finding can be amended; a closed finding is a fixed record");
    const changes = {};
    ["class", "location", "observation", "required_outcome", "owner", "due_date", "risk_rating"].forEach((k) => {
      if (k in patch && (f[k] || null) !== (patch[k] || null)) { changes[k] = { from: f[k] || null, to: patch[k] || null }; f[k] = patch[k] || null; }
    });
    (DS.findingEvents = DS.findingEvents || []).push({ id: id(), finding_id: fid, event: "updated", note: reason, changes, occurred_at: now() });
  };
  setWalkResultsBulk = async (wid, iids, result) => { for (const iid of iids) await setWalkResultPhoto(wid, iid, result, undefined, null); };
  issueWalk = async (_b, wid, summary) => { const w = DS.walks.find((x) => x.id === wid); if (w) { w.status = "completed"; w.summary = summary; w.issued_at = now(); } };
  listNotifications = async () => [...DS.notifications];
  markNotificationRead = async (nid) => { const n = DS.notifications.find((x) => x.id === nid); if (n) n.read_at = now(); };
  markAllNotificationsRead = async () => { DS.notifications.forEach((n) => { if (!n.read_at) n.read_at = now(); }); };
  loadMyBuildingBilling = async () => ({ status: "trial", trial_end: dAhead(21), payment_method_label: null, preferred_payment_day: 15, admin_monthly: 12, per_unit_monthly: 2.75, unit_count: 40, gst_rate: 10, gst_mode: "plus" });
  startPaymentSetup = async () => { window.alert("In the live app this opens Stripe to save a card or BECS direct debit for automatic payment."); };
  createAdhocInvoice = async () => { window.alert("Demo: one-off invoices are raised in the live Admin console."); };
  stripeRefund = async () => { window.alert("Demo: refunds are processed in the live Admin console."); };
  loadBillingSummary = async () => ([{ building_name: "SeaHaven", month: "07/2026", invoices: 2, billed: 147.43, paid: 134.20, outstanding: 13.23, refunded: 0 }]);
  exportBuildingData = async (_b, buildingName) => {
    const sheets = [
      ["About This Export", [{ field: "Building", value: buildingName }, { field: "Exported", value: now() }, { field: "Note", value: "Demo export — in the live app this includes every register, record and stored file for your building." }]],
      ["Units", DS.units], ["Unit People", DS.people], ["Unit Pets", DS.pets], ["Unit Vehicles", DS.vehicles],
      ["Keys & Fobs", DS.access], ["Breaches", DS.breaches], ["Applications", DS.applications], ["Parking Permits", DS.permits],
      ["Motions", DS.motions], ["Votes", DS.votes], ["Proxies", DS.proxies], ["Contracts", DS.contracts], ["Contractors", DS.contractors],
      ["Walkthroughs", DS.walks], ["Alerts", DS.notifications],
    ];
    downloadWorkbook(`nalohub-export-demo-${localDate()}.xls`, sheets);
    return { sheets: sheets.length, files: 0 };
  };
}
