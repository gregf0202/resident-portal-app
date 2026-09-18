// ============================================================================
// send-announcement
// Outbound announcement email. An authenticated committee / strata / building
// manager posts a notice in NaloHub; this emails the residents it targets at
// their real email addresses (in addition to the in-app notice), via Resend.
//
// Recipients are resolved SERVER-SIDE from memberships so the client can never
// email arbitrary addresses:
//   audience "all"      -> every active owner + tenant with an email
//   audience "owners"   -> active owners with an email
//   audience "specific" -> the memberships whose id is in recipientIds
// Addresses are placed in BCC so residents never see each other's email.
// Replies route to the building's NaloHub inbox (reply_to) so they land in-app.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_DOMAIN = Deno.env.get("CORR_MAIL_DOMAIN") || "send.nalohub.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // --- Auth: identify the caller from their JWT --------------------------------
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return json({ error: "Not authenticated" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Not authenticated" }, 401);
  const uid = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { buildingId, subject, bodyText, audience, recipientIds } = body || {};
  if (!buildingId) return json({ error: "buildingId required" }, 400);
  if (!subject) return json({ error: "subject required" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // --- Authorization: caller must be committee / strata / manager of building --
  const { data: mine } = await db.from("memberships")
    .select("role, status").eq("building_id", buildingId).eq("user_id", uid).maybeSingle();
  const posterRole = mine?.role;
  if (!mine || mine.status !== "active" || !["admin", "bcc", "strata", "manager"].includes(posterRole)) {
    return json({ error: "Not permitted for this building" }, 403);
  }

  // --- Resolve recipient emails server-side ------------------------------------
  const { data: mems, error: mErr } = await db.from("memberships")
    .select("id, full_name, email, role, status").eq("building_id", buildingId).eq("status", "active");
  if (mErr) return json({ error: "could not load members", detail: mErr.message }, 500);

  const aud = audience || "all";
  const ids = new Set(Array.isArray(recipientIds) ? recipientIds : []);
  const targets = (mems || []).filter((m: any) => {
    if (!m.email) return false;
    if (aud === "specific") return ids.has(m.id);
    if (aud === "owners") return m.role === "owner";
    // "all" -> the resident body (owners + tenants)
    return m.role === "owner" || m.role === "tenant";
  });
  const emails = Array.from(new Set(targets.map((m: any) => String(m.email).trim()).filter(Boolean)));
  if (emails.length === 0) return json({ ok: true, sent: 0, note: "no matching recipients with an email" });

  // --- Sender + reply-to -------------------------------------------------------
  const { data: b } = await db.from("buildings").select("data").eq("id", buildingId).maybeSingle();
  const buildingName = b?.data?.name || "your building";
  const bccEmail = b?.data?.bccEmail || null;
  const senderName = `${buildingName} via NaloHub`.replace(/"/g, "");
  const posterName = mine?.full_name || (posterRole === "strata" ? "Strata manager" : "Your committee");

  // Route replies INTO the app: reply-to the building's NaloHub inbox so a
  // resident's reply lands in Correspondence, not a personal mailbox. Falls back
  // to the committee email only if no mailbox exists yet.
  const { data: mbx } = await db.from("building_mailboxes").select("slug, inbound_address").eq("building_id", buildingId).maybeSingle();
  const inboxAddress = mbx ? (mbx.inbound_address || `${mbx.slug}@${MAIL_DOMAIN}`) : null;
  const replyTo = inboxAddress || bccEmail;

  // Send FROM the building's own inbound address, never a no-reply placeholder.
  //
  // Why this matters more than it looks: Resend requires `to` even when every
  // real recipient sits in BCC, and whatever is in `from`/`to` is what a
  // resident's REPLY ALL targets. With no-reply@<domain> in both, a Reply All
  // went to reply_to AND to no-reply@, and because Receiving is enabled for the
  // whole domain that produced TWO inbound webhooks: one filed to the building,
  // the other resolved the slug "no-reply", found no mailbox, and became an
  // orphan row with building_id null, invisible in every Unfiled tray. Putting
  // the building's address in all three slots collapses that to one delivery.
  // It also stops the header contradicting the footer: a message whose From
  // says no-reply while its footer invites a reply teaches residents not to.
  const senderAddress = inboxAddress || `no-reply@${MAIL_DOMAIN}`;

  if (!RESEND_API_KEY) return json({ ok: false, sent: 0, error: "email provider not configured" }, 200);

  const audLabel = aud === "owners" ? "owners" : aud === "specific" ? "selected residents" : "residents";
  const footer =
    `\n\nThis notice was posted in NaloHub for ${buildingName} and emailed to ${audLabel}.` +
    `${replyTo ? ` Reply to this email and it lands with your committee in NaloHub.` : ""}\nBe In The Nalo 👋`;
  const html =
    `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:560px">` +
    `<h2 style="margin:0 0 8px">${esc(subject)}</h2>` +
    `<div style="white-space:pre-wrap;font-size:15px;line-height:1.5">${esc(bodyText || "")}</div>` +
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0"/>` +
    `<div style="font-size:12px;color:#6b7280">Posted by ${esc(posterName)} · ${esc(buildingName)} via NaloHub` +
    `${replyTo ? ` · reply and it lands in your building's NaloHub` : ""}</div></div>`;

  const payload: any = {
    from: `"${senderName}" <${senderAddress}>`,
    to: [senderAddress],
    bcc: emails,
    subject,
    text: (bodyText || "") + footer,
    html,
  };
  if (replyTo) payload.reply_to = replyTo;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) { const r = await res.json(); return json({ ok: true, sent: emails.length, id: r?.id || null }); }
    const detail = await res.text();
    return json({ ok: false, sent: 0, error: "send failed", detail }, 200);
  } catch (e) {
    return json({ ok: false, sent: 0, error: String((e as Error).message || e) }, 200);
  }
});
