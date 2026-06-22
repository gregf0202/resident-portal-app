import { supabase } from "./supabaseClient.js";

// Content tables stored as { id, building_id, data } — data holds the whole record,
// so your app's objects map 1:1 with no field translation.
export const CONTENT = [
  "announcements", "maintenance", "bookings", "events", "gallery", "marketplace",
  "messages", "documents", "meetings", "actions", "keyfobs", "businesses",
];

const memberToUser = (m) => ({
  id: m.id, authId: m.user_id, buildingId: m.building_id,
  name: m.full_name || m.email || "Resident", unit: m.unit || "",
  role: m.role, status: m.status, email: m.email || "", phone: m.phone || "",
  showPhone: !!m.show_phone, showEmail: !!m.show_email, msc: !!m.msc,
  directoryOptIn: true, lastSeenGallery: m.last_seen_gallery || null,
});

export async function loadStore(authUser) {
  const { data: myMems, error: e1 } = await supabase
    .from("memberships").select("*, buildings(*)")
    .eq("user_id", authUser.id).eq("status", "active");
  if (e1) throw e1;
  const memberships = myMems || [];
  if (!memberships.length) return { store: null, buildingId: null, currentUserId: null, memberships: [] };

  const bid = memberships[0].building_id;
  const buildingRow = memberships[0].buildings;
  const building = { id: buildingRow.id, ...(buildingRow.data || {}) };

  const { data: allMems, error: e2 } = await supabase.from("memberships").select("*").eq("building_id", bid);
  if (e2) throw e2;
  const users = (allMems || []).map(memberToUser);

  const store = { buildings: [building], users };
  for (const t of CONTENT) {
    const { data, error } = await supabase.from(t).select("id, data").eq("building_id", bid);
    if (error) throw error;
    store[t] = (data || []).map((r) => ({ id: r.id, ...(r.data || {}) }));
  }

  const me = users.find((u) => u.authId === authUser.id) || users[0];
  return { store, buildingId: bid, currentUserId: me ? me.id : null, memberships };
}

const ix = (arr) => Object.fromEntries((arr || []).map((r) => [r.id, r]));
const diff = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

// Compare previous vs next store and sync only what changed.
export async function persistChange(prev, next, bid) {
  if (!prev || !next) return;
  const jobs = [];

  for (const t of CONTENT) {
    const before = ix(prev[t]);
    const after = ix(next[t]);
    for (const rec of next[t] || []) {
      if (!before[rec.id] || diff(before[rec.id], rec)) {
        const { id, ...data } = rec;
        jobs.push(supabase.from(t).upsert({ id, building_id: bid, data }));
      }
    }
    for (const rec of prev[t] || []) {
      if (!after[rec.id]) jobs.push(supabase.from(t).delete().eq("id", rec.id));
    }
  }

  // building (single record)
  const pb = (prev.buildings || [])[0];
  const nb = (next.buildings || []).find((b) => pb && b.id === pb.id);
  if (pb && nb && diff(pb, nb)) {
    const { id, ...data } = nb;
    jobs.push(supabase.from("buildings").update({ data }).eq("id", id));
  }

  // users -> memberships (typed)
  const beforeU = ix(prev.users);
  const afterU = ix(next.users);
  for (const u of next.users || []) {
    const b = beforeU[u.id];
    const row = {
      full_name: u.name, role: u.role, unit: u.unit, phone: u.phone,
      show_phone: !!u.showPhone, show_email: !!u.showEmail, msc: !!u.msc,
      status: u.status || "pending", email: u.email,
    };
    if (!b) jobs.push(supabase.from("memberships").insert({ building_id: bid, ...row }));
    else if (diff(b, u)) jobs.push(supabase.from("memberships").update(row).eq("id", u.id));
  }
  for (const u of prev.users || []) if (!afterU[u.id]) jobs.push(supabase.from("memberships").delete().eq("id", u.id));

  const results = await Promise.all(jobs);
  const failed = results.find((r) => r && r.error);
  if (failed) throw failed.error;
}
