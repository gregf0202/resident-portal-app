// ============================================================================
// ensure-mailbox
// Returns (creating if needed) a building's single public inbound address, e.g.
// "seahaven@send.nalohub.com". A committee member calls this; we provision one
// clean, human-friendly slug per building (disambiguated only on a real clash)
// so the building can advertise ONE address that lands in its Correspondence.
//
// Existing mailboxes are returned as-is (never renamed) so any reply-to tokens
// already in the wild keep working.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MAIL_DOMAIN = Deno.env.get("CORR_MAIL_DOMAIN") || "send.nalohub.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const slugify = (s: string) =>
  (s || "building").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "building";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return json({ error: "Not authenticated" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Not authenticated" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { buildingId } = body || {};
  if (!buildingId) return json({ error: "buildingId required" }, 400);

  // Authorization: caller must be committee of this building (mirrors mailbox RLS).
  const { data: isCommittee, error: ccErr } = await userClient.rpc("corr_is_committee", { bid: buildingId });
  if (ccErr) return json({ error: "authorization check failed", detail: ccErr.message }, 500);
  if (!isCommittee) return json({ error: "Not permitted for this building" }, 403);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Existing mailbox → return unchanged.
  const { data: mb } = await db.from("building_mailboxes")
    .select("slug, inbound_address").eq("building_id", buildingId).maybeSingle();
  if (mb?.slug) {
    return json({ slug: mb.slug, address: mb.inbound_address || `${mb.slug}@${MAIL_DOMAIN}`, existing: true });
  }

  // New mailbox → clean slug from the building name, unique across all buildings.
  const { data: b } = await db.from("buildings").select("data").eq("id", buildingId).maybeSingle();
  const buildingName = b?.data?.name || "building";
  const base = slugify(buildingName);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await db.from("building_mailboxes").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${base}-${i}`;
  }
  const address = `${slug}@${MAIL_DOMAIN}`;
  const { error: insErr } = await db.from("building_mailboxes").insert({
    building_id: buildingId, slug, inbound_address: address, from_name: buildingName,
  });
  if (insErr) {
    // Race: someone created it first — return whatever now exists.
    const { data: again } = await db.from("building_mailboxes").select("slug, inbound_address").eq("building_id", buildingId).maybeSingle();
    if (again?.slug) return json({ slug: again.slug, address: again.inbound_address || `${again.slug}@${MAIL_DOMAIN}`, existing: true });
    return json({ error: "could not create mailbox", detail: insErr.message }, 500);
  }
  return json({ slug, address, existing: false });
});
