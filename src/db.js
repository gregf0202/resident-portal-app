import { supabase } from "./supabaseClient.js";

export const CONTENT = [
  "announcements", "maintenance", "assets", "bookings", "events", "gallery", "marketplace",
  "messages", "documents", "meetings", "actions", "keyfobs", "businesses",
  "bylaws", "compliance",
];

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
    const { data, error } = await supabase.from(t).select("id, data").eq("building_id", bid);
    if (error) throw error;
    store[t] = (data || []).map((r) => ({ id: r.id, ...(r.data || {}) }));
  }
  store.disputes = await loadDisputes(bid);
  const me2 = users.find((u) => u.authId === authUser.id) || users[0];
  return { store, buildingId: bid, currentUserId: me2 ? me2.id : null };
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
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createBuilding(fields, authUser) {
  const data = defaultBuildingData(fields.name, fields.address, fields);
  const { data: ins, error } = await supabase.from("buildings").insert({ data }).select("id").single();
  if (error) throw error;
  const bid = ins.id;
  const { error: e2 } = await supabase.from("memberships").insert({
    building_id: bid, user_id: authUser.id, email: authUser.email,
    full_name: "Platform Admin", role: "admin", status: "active",
  });
  if (e2) throw e2;
  audit(bid, "building.created", fields.name);
  return bid;
}

export async function joinAsAdmin(bid, authUser) {
  const { error } = await supabase.from("memberships").insert({
    building_id: bid, user_id: authUser.id, email: authUser.email,
    full_name: "Platform Admin", role: "admin", status: "active",
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
  return ds.map((d) => ({ id: d.id, buildingId: bid, ref: d.ref, openedAt: (d.created_at || "").slice(0, 10), ...(d.data || {}), events: byDispute[d.id] || [] }));
}

export async function createDispute(bid, title, byLabel, category) {
  const { count } = await supabase.from("disputes").select("id", { count: "exact", head: true }).eq("building_id", bid);
  const ref = "DISP-" + String((count || 0) + 1).padStart(4, "0");
  const { data: ins, error } = await supabase.from("disputes").insert({ building_id: bid, ref, data: { title, status: "complaint", category: category || "Other" } }).select("id").single();
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
export async function updateAccessItemStatus(id, status) {
  const patch = { status };
  if (status === "returned") patch.returned_at = new Date().toISOString().slice(0, 10);
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
