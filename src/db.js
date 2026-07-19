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
  return data; // { ok, sent, id? }
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
  const { data, error } = await supabase.from("walkthroughs").insert({ building_id: bid, attendees: attendees || null }).select("id").single();
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
    const rows = (await all(supabase.from(t).select("id, data, created_at").eq("building_id", bid))).map((r) => ({ id: r.id, created_at: r.created_at, ...(r.data || {}) }));
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
  downloadWorkbook(`nalohub-export-${safe}-${new Date().toISOString().slice(0, 10)}.xls`, sheets);
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
  const dAhead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const files = {}; // fake storage: path -> object URL

  const u12 = { id: "unit-12", unit_number: "12", lot_number: "Lot 12", parking_spaces: 2, agent_business: "Coastal Property Management", agent_contact: "Mia Chen", agent_phone: "07 5444 1200", agent_email: "mia@coastalpm.com.au", agent_note: "Lease ends 31 March. Contact agent for any entry or maintenance access.", notes: null };
  const u5 = { id: "unit-5", unit_number: "5", lot_number: "Lot 5", parking_spaces: 1, agent_business: "", agent_contact: "", agent_phone: "", agent_email: "" };
  const DS = {
    units: [u12, u5, { id: "unit-22", unit_number: "22", lot_number: "Lot 22", parking_spaces: 1 }],
    people: [
      { id: id(), unit_id: "unit-12", person_type: "owner", full_name: "Owen Chandler", email: "owen@example.com", phone: "0400 111 222", is_current: true },
      { id: id(), unit_id: "unit-12", person_type: "tenant", full_name: "Tina Marsh", email: "tina@example.com", phone: "0400 333 444", is_current: true },
      { id: id(), unit_id: "unit-5", person_type: "owner", full_name: "Betty Nguyen", email: "betty@example.com", phone: "0400 555 666", is_current: true },
    ],
    pets: [{ id: id(), unit_id: "unit-12", pet_type: "dog", name: "Rex", breed: "Cavoodle", approval_status: "approved" }],
    vehicles: [{ id: id(), unit_id: "unit-12", make: "Toyota", model: "RAV4", colour: "White", registration: "123ABC", parking_bay: "B2-14" }],
    access: [
      { id: id(), unit_id: "unit-12", item_type: "fob", identifier: "F-9981", label: "Lobby & garage", status: "issued", issued_to: "Tina Marsh", ack_at: daysAgo(3) },
      { id: id(), unit_id: "unit-12", item_type: "key", identifier: "K-012", label: "Front door", status: "issued", issued_to: "Owen Chandler", issued_to_user_id: "x", ack_at: null },
      { id: id(), unit_id: "unit-5", item_type: "swipe_card", identifier: "SC-445", label: "Gym level", status: "issued", issued_to: "Betty Nguyen" },
    ],
    breaches: [{ id: id(), unit_id: "unit-12", bylaw_ref: "By-law 12 (Noise)", description: "Late-night noise complaint — resolved after friendly chat.", status: "remedied", occurred_at: dAhead(-40).slice(0, 10) }],
    applications: [
      { id: "app-1", unit_id: "unit-12", kind: "application", category: "pet", title: "Pet approval — Luna (ragdoll cat)", details: { pet_type: "cat", name: "Luna", breed: "Ragdoll", unit: "12", description: "Indoor cat, desexed and microchipped." }, status: "submitted", submitted_by: "u-owner", submitted_at: daysAgo(1), decision_note: null },
      { id: "app-2", unit_id: "unit-12", kind: "application", category: "parking_permit", title: "Parking permit — Mazda CX-5 (456XYZ)", details: { vehicle_make: "Mazda", vehicle_model: "CX-5", vehicle_colour: "Blue", vehicle_rego: "456XYZ", date_from: dAhead(-20), date_to: dAhead(345), unit: "12" }, status: "approved", submitted_by: DEMO_UID, submitted_at: daysAgo(20), decided_at: daysAgo(19), decision_note: "Approved for 12 months" },
      { id: "app-3", unit_id: "unit-5", kind: "application", category: "lot_improvement", title: "Bathroom renovation — Unit 5", details: { unit: "5", description: "Full bathroom renovation incl. waterproofing. Two quotes attached.", conditions: ["All work must be carried out by licensed and insured contractors.", "Work is permitted Monday–Friday 7am–5pm and Saturday 8am–4pm only.", "Common property must be protected during works and left clean and undamaged."] }, status: "approved", submitted_by: "u-betty", submitted_at: daysAgo(9), decided_at: daysAgo(3), decision_note: "Decided by BCC vote: 5 yes / 1 no / 0 abstained of 6 members — approval subject to the attached conditions" },
    ],
    appAtts: [{ id: id(), application_id: "app-3", file_name: "bathroom-quote-AquaBuild.pdf", file_kind: "document", storage_path: "demo/quote1" }],
    permits: [{ id: "permit-1", application_id: "app-2", permit_no: "PP-0007", unit_number: "12", vehicle_make: "Mazda", vehicle_model: "CX-5", vehicle_colour: "Blue", vehicle_rego: "456XYZ", date_from: dAhead(-20), date_to: dAhead(345), approval_date: dAhead(-19), status: "active" }],
    motions: [
      { id: "mo-1", title: "Approve: Pet approval — Luna (ragdoll cat)", description: "Indoor cat, desexed and microchipped.", context_type: "application", context_id: "app-1", details: { category: "pet", unit: "12", conditions: ["The animal must be kept within the lot and under control on common property at all times.", "The animal must not cause nuisance, noise or interference with other residents.", "All animal waste must be removed and disposed of appropriately.", "Approval is specific to the animal named in the application and is not transferable."] }, eligible_count: 6, threshold: 4, status: "open", opened_by: "u-owner", opened_at: daysAgo(1), outcome_note: null },
      { id: "mo-2", title: "Accept Bright Spark quote $2,350 — Car park gate motor", description: "Gate sticks halfway with grinding noise. Sub-committee recommends preferred electrician.", context_type: "maintenance", context_id: "m-demo", details: { quote_id: "q-1", attachments: [{ name: "Bright-Spark-quote.txt", type: "text/plain", data: "data:text/plain;charset=utf-8," + encodeURIComponent("QUOTE — Bright Spark Electrical\nCar park gate motor replacement (supply + install)\nTotal: $2,350 incl GST\nValid 30 days · Licence QLD-EL-12345") }], trail: ["triage: High priority — gate could fail closed. Owen coordinating quotes.", "quote added: Quote from Bright Spark Electrical: $2350", "quote added: Quote from GateWorks QLD: $3100", "recommendation: Sub-committee recommends Bright Spark (preferred, 5-star)."] }, eligible_count: 6, threshold: 4, status: "passed", opened_by: DEMO_UID, opened_at: daysAgo(6), decided_at: daysAgo(4), outcome_note: "4 yes / 1 no / 1 abstained of 6 members" },
    ],
    votes: [
      { id: id(), motion_id: "mo-1", voter_user_id: "u-bcc2", vote: "yes", comment: "Lovely quiet breed.", created_at: daysAgo(1) },
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
      { id: id(), kind: "motion_opened", ref_table: "motions", ref_id: "mo-1", title: "Vote required: Approve: Pet approval — Luna", body: "Majority needed: 4 of 6 BCC members.", read_at: null, created_at: daysAgo(1) },
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
    if (!u) return { unit: null, residents_directory: [], people: [], pets: [], vehicles: [], access_items: [], breaches: [], disputes: [], applications: [] };
    const by = (arr) => arr.filter((r) => r.unit_id === u.id);
    return { unit: u, people: by(DS.people), residents_directory: [], pets: by(DS.pets), vehicles: by(DS.vehicles), access_items: by(DS.access), breaches: by(DS.breaches), disputes: [], applications: DS.applications.filter((a) => a.unit_id === u.id) };
  };
  listUnits = async () => DS.units;
  createUnit = async (_b, unit_number, lot_number, parking_spaces) => { DS.units.push({ id: id(), unit_number, lot_number, parking_spaces: Number(parking_spaces) || 0 }); };
  addUnitPerson = async (_b, unitId, row) => { DS.people.push({ id: id(), unit_id: unitId, is_current: true, ...row }); };
  addUnitPet = async (_b, unitId, row) => { DS.pets.push({ id: id(), unit_id: unitId, ...row }); };
  addUnitVehicle = async (_b, unitId, row) => { DS.vehicles.push({ id: id(), unit_id: unitId, ...row }); };
  addAccessItem = async (_b, unitId, row) => { DS.access.push({ id: id(), unit_id: unitId, ...row }); };
  updateAccessItemStatus = async (iid, status) => { const x = DS.access.find((a) => a.id === iid); if (x) x.status = status; };
  acknowledgeAccessItem = async () => ({ ok: true });
  addUnitBreach = async (_b, unitId, row) => { DS.breaches.push({ id: id(), unit_id: unitId, status: "open", ...row }); };
  updateUnitAgent = async (_b, unitId, agent) => { const u = DS.units.find((x) => x.id === unitId); if (u) { u.agent_business = agent.business; u.agent_contact = agent.contact; u.agent_phone = agent.phone; u.agent_email = agent.email; u.agent_note = agent.note; } };
  // Correspondence Hub — demo dataset (sample threads; sending & replies simulated, no real email)
  listCorrThreads = async () => [...DS.corr.threads].sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1)).map((t) => ({ id: t.id, subject: t.subject, status: t.status, visibility: t.visibility, contextType: t.contextType, contextId: t.contextId, lastActivityAt: t.lastActivityAt, createdAt: t.createdAt, contact: t.contact ? { name: t.contact.name, email: t.contact.email, org: t.contact.org, partyType: t.contact.partyType } : null }));
  getCorrThread = async (tid) => { const t = DS.corr.threads.find((x) => x.id === tid); if (!t) return { thread: null, messages: [] }; return { thread: { id: t.id, buildingId: t.buildingId, subject: t.subject, status: t.status, visibility: t.visibility, contextType: t.contextType, contextId: t.contextId, createdBy: t.createdBy, createdAt: t.createdAt, lastActivityAt: t.lastActivityAt, contact: t.contact }, messages: [...t.messages].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)) }; };
  listCorrContacts = async () => [...DS.corr.contacts].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, org: c.org, email: c.email, phone: c.phone, partyType: c.partyType, notes: c.notes || "" }));
  saveCorrContact = async (_b, c) => { if (c && c.id) { const x = DS.corr.contacts.find((y) => y.id === c.id); if (x) Object.assign(x, { name: c.name, org: c.org, email: c.email, phone: c.phone, partyType: c.partyType, party_type: c.partyType, notes: c.notes }); return c.id; } const nc = { id: id(), name: c.name, org: c.org || "", email: c.email || "", phone: c.phone || "", partyType: c.partyType || "other", party_type: c.partyType || "other", notes: c.notes || "" }; DS.corr.contacts.push(nc); return nc.id; };
  sendAnnouncementEmail = async () => ({ ok: true, sent: 0 });
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
  fileCorrUnfiled = async (rawId, tid) => { const i = DS.corr.unfiled.findIndex((u) => u.id === rawId); const u = i >= 0 ? DS.corr.unfiled[i] : null; if (i >= 0) DS.corr.unfiled.splice(i, 1); const t = DS.corr.threads.find((x) => x.id === tid); if (t && u) { t.messages.push({ id: id(), direction: "inbound", fromName: u.fromName, fromEmail: u.fromEmail, toEmail: corrMB, cc: null, subject: u.subject, bodyText: u.body || "(Filed from the Unfiled tray.)", bodyHtml: null, deliveryStatus: null, deletedAt: null, createdAt: now(), attachments: [] }); t.lastActivityAt = now(); } return "demo-msg"; };
  listApplications = async () => [...DS.applications].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
  createApplication = async (_b, _uid, unitId, kind, category, title, details) => {
    const aid = id();
    DS.applications.unshift({ id: aid, unit_id: unitId, kind, category, title, details, status: "submitted", submitted_by: DEMO_UID, submitted_at: now() });
    if (kind === "application" && ["pet", "lot_improvement", "keys_access", "other"].includes(category)) {
      DS.motions.unshift({ id: id(), title: "Approve: " + (title || category), description: details.description || "", context_type: "application", context_id: aid, details: { category, unit: details.unit, conditions: ["Approval is subject to compliance with the scheme's by-laws.", "The committee may attach further reasonable conditions before final sign-off."] }, eligible_count: 6, threshold: 4, status: "open", opened_by: DEMO_UID, opened_at: now() });
      DS.notifications.unshift({ id: id(), kind: "motion_opened", ref_table: "motions", ref_id: aid, title: "Vote required: Approve: " + (title || category), body: "Majority needed: 4 of 6 BCC members.", read_at: null, created_at: now() });
    } else {
      DS.notifications.unshift({ id: id(), kind: "application_submitted", ref_table: "applications", ref_id: aid, title: (kind === "booking" ? "Booking" : "Application") + " awaiting review", body: (title || category) + " requires a decision", read_at: null, created_at: now() });
    }
    return aid;
  };
  decideApplication = async (_b, aid, approve, note) => {
    const a = DS.applications.find((x) => x.id === aid);
    if (a) { a.status = approve ? "approved" : "declined"; a.decided_at = now(); a.decision_note = note || null;
      if (approve && a.category === "parking_permit") DS.permits.unshift({ id: id(), application_id: aid, permit_no: "PP-" + String(DS.permits.length + 8).padStart(4, "0"), unit_number: a.details.unit, vehicle_make: a.details.vehicle_make, vehicle_model: a.details.vehicle_model, vehicle_colour: a.details.vehicle_colour, vehicle_rego: a.details.vehicle_rego, date_from: a.details.date_from, date_to: a.details.date_to, approval_date: now().slice(0, 10), status: "active" });
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
  createMotion = async (_b, _u, m) => { const mid = id(); DS.motions.unshift({ id: mid, eligible_count: 6, threshold: 4, status: "open", opened_at: now(), opened_by: DEMO_UID, outcome_note: null, ...m }); return mid; };
  castVote = async (mid, uid, vote, comment, proxy) => {
    DS.votes.push({ id: id(), motion_id: mid, voter_user_id: uid || DEMO_UID, vote, comment: comment || null, proxy_for_user_id: proxy ? proxy.principal_user_id : null, proxy_appointment_id: proxy ? proxy.id : null, created_at: now() });
    const m = DS.motions.find((x) => x.id === mid);
    if (m && m.status === "open") {
      const vs = DS.votes.filter((v) => v.motion_id === mid);
      const yes = vs.filter((v) => v.vote === "yes").length, no = vs.filter((v) => v.vote === "no").length;
      if (yes >= m.threshold) { m.status = "passed"; m.decided_at = now(); m.outcome_note = `${yes} yes / ${no} no / ${vs.length - yes - no} abstained of ${m.eligible_count} members`;
        if (m.context_type === "application") decideApplication(null, m.context_id, true, "Decided by BCC vote: " + m.outcome_note + (m.details && m.details.conditions ? " — approval subject to the attached conditions" : ""));
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
  setQuoteStatus = async (qid, status) => { Object.values(DS.quotes).forEach((arr) => { const q = arr.find((x) => x.id === qid); if (q) q.status = status; }); };
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
  createWalk = async (_b, attendees) => { const wid = id(); DS.walks.unshift({ id: wid, walk_date: now().slice(0, 10), attendees, status: "in_progress", summary: null }); DS.walkResults[wid] = []; return wid; };
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
    downloadWorkbook(`nalohub-export-demo-${now().slice(0, 10)}.xls`, sheets);
    return { sheets: sheets.length, files: 0 };
  };
}
