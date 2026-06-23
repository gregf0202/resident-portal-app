import { supabase } from "./supabaseClient.js";

export const CONTENT = [
  "announcements", "maintenance", "bookings", "events", "gallery", "marketplace",
  "messages", "documents", "meetings", "actions", "keyfobs", "businesses",
];

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
export async function addMember(bid, m) {
  const { error } = await supabase.from("memberships").insert({
    building_id: bid, email: m.email, full_name: m.full_name || m.email,
    role: m.role || "owner", unit: m.unit || null, status: "pending",
  });
  if (error) throw error;
}
export async function updateMemberRole(id, role) {
  const { error } = await supabase.from("memberships").update({ role }).eq("id", id);
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
  const jobs = [];
  for (const t of CONTENT) {
    const before = ix(prev[t]); const after = ix(next[t]);
    for (const rec of next[t] || []) {
      if (!before[rec.id] || diff(before[rec.id], rec)) {
        const { id, ...data } = rec;
        jobs.push(supabase.from(t).upsert({ id, building_id: bid, data }));
      }
    }
    for (const rec of prev[t] || []) if (!after[rec.id]) jobs.push(supabase.from(t).delete().eq("id", rec.id));
  }
  const pb = (prev.buildings || [])[0];
  const nb = (next.buildings || []).find((b) => pb && b.id === pb.id);
  if (pb && nb && diff(pb, nb)) { const { id, ...data } = nb; jobs.push(supabase.from("buildings").update({ data }).eq("id", id)); }

  const beforeU = ix(prev.users); const afterU = ix(next.users);
  for (const u of next.users || []) {
    const b = beforeU[u.id];
    const row = { full_name: u.name, role: u.role, unit: u.unit, phone: u.phone, show_phone: !!u.showPhone, show_email: !!u.showEmail, msc: !!u.msc, status: u.status || "pending", email: u.email };
    if (!b) jobs.push(supabase.from("memberships").insert({ building_id: bid, ...row }));
    else if (diff(b, u)) jobs.push(supabase.from("memberships").update(row).eq("id", u.id));
  }
  for (const u of prev.users || []) if (!afterU[u.id]) jobs.push(supabase.from("memberships").delete().eq("id", u.id));

  const results = await Promise.all(jobs);
  const failed = results.find((r) => r && r.error);
  if (failed) throw failed.error;
}
