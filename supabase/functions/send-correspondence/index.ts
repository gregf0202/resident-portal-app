// ============================================================================
// send-correspondence
// Outbound Correspondence Hub email. An authenticated committee/MSC/BM member
// sends an email to an external party via Resend; the message is logged
// (append-only) in NaloHub. Attachments are stored in the private
// `correspondence` bucket. Replies route back via a plus-addressed Reply-To.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const MAIL_DOMAIN = Deno.env.get("CORR_MAIL_DOMAIN") || "send.nalohub.com";
const BUCKET = "correspondence";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function slugify(s: string) {
  return (s || "building").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "building";
}

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
  const {
    buildingId, threadId, contact, subject, bodyText, bodyHtml,
    contextType, contextId, visibility, restrictedMemberIds, attachments,
  } = body || {};
  if (!buildingId) return json({ error: "buildingId required" }, 400);
  const toEmail = contact?.email;
  if (!threadId && !toEmail) return json({ error: "recipient email required for a new thread" }, 400);

  // --- Authorization: caller must be committee/MSC/BM of this building ---------
  const { data: isCommittee, error: ccErr } = await userClient.rpc("corr_is_committee", { bid: buildingId });
  if (ccErr) return json({ error: "authorization check failed", detail: ccErr.message }, 500);
  if (!isCommittee) return json({ error: "Not permitted for this building" }, 403);

  // --- All writes use the service-role client (RLS bypassed; we gated above) ---
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Ensure the building has a mailbox slug, and resolve its display name.
  const { data: b } = await db.from("buildings").select("data").eq("id", buildingId).maybeSingle();
  const buildingName = b?.data?.name || "your building";
  let slug: string;
  const { data: mb } = await db.from("building_mailboxes").select("slug").eq("building_id", buildingId).maybeSingle();
  if (mb?.slug) {
    slug = mb.slug;
  } else {
    const base = slugify(buildingName);
    slug = `${base}-${String(buildingId).slice(0, 6)}`;
    await db.from("building_mailboxes").insert({
      building_id: buildingId, slug, inbound_address: `${slug}@${MAIL_DOMAIN}`,
      from_name: buildingName,
    });
  }
  // Sender the recipient sees: "<Building> via NaloHub" (quoted for RFC-5322 safety).
  const senderName = `${buildingName} via NaloHub`.replace(/"/g, "");

  // 2. Resolve or create the contact.
  let contactId = contact?.id || null;
  if (!contactId && toEmail) {
    const { data: existing } = await db.from("correspondence_contacts")
      .select("id").eq("building_id", buildingId).eq("email", toEmail).maybeSingle();
    if (existing?.id) contactId = existing.id;
    else {
      const { data: nc } = await db.from("correspondence_contacts").insert({
        building_id: buildingId, name: contact?.name || toEmail, org: contact?.org || null,
        email: toEmail, party_type: contact?.party_type || "other",
      }).select("id").single();
      contactId = nc?.id || null;
    }
  }

  // 3. Resolve or create the thread.
  let tId = threadId || null;
  let recipient = toEmail;
  if (!tId) {
    const { data: th, error: te } = await db.from("correspondence_threads").insert({
      building_id: buildingId, subject: subject || "(no subject)", contact_id: contactId,
      context_type: contextType || "general", context_id: contextId || null,
      visibility: visibility === "restricted" ? "restricted" : "committee", created_by: uid,
    }).select("id").single();
    if (te) return json({ error: "could not create thread", detail: te.message }, 500);
    tId = th.id;
    if (visibility === "restricted" && Array.isArray(restrictedMemberIds)) {
      const rows = [uid, ...restrictedMemberIds].filter(Boolean).map((u: string) => ({ thread_id: tId, user_id: u }));
      if (rows.length) await db.from("correspondence_thread_members").upsert(rows);
    }
  } else if (!recipient) {
    const { data: th } = await db.from("correspondence_threads").select("contact_id").eq("id", tId).maybeSingle();
    if (th?.contact_id) {
      const { data: c } = await db.from("correspondence_contacts").select("email").eq("id", th.contact_id).maybeSingle();
      recipient = c?.email;
    }
  }
  if (!recipient) return json({ error: "no recipient email" }, 400);

  // 4. Insert the outbound message (append-only; content_hash set by DB trigger).
  const replyTo = `${slug}+${tId}@${MAIL_DOMAIN}`;
  const { data: msg, error: me } = await db.from("correspondence_messages").insert({
    thread_id: tId, direction: "outbound", from_email: `${slug}@${MAIL_DOMAIN}`, to_email: recipient,
    subject: subject || null, body_text: bodyText || null, body_html: bodyHtml || null,
    sent_by: uid, delivery_status: "queued",
  }).select("id").single();
  if (me) return json({ error: "could not log message", detail: me.message }, 500);
  const messageId = msg.id;

  // 5. Store attachments in our bucket + prepare them for Resend.
  const resendAttachments: any[] = [];
  if (Array.isArray(attachments)) {
    for (const a of attachments) {
      if (!a?.filename || !a?.contentBase64) continue;
      const path = `${buildingId}/${tId}/${messageId}/${a.filename}`;
      const bytes = Uint8Array.from(atob(a.contentBase64), (c) => c.charCodeAt(0));
      await db.storage.from(BUCKET).upload(path, bytes, { contentType: a.mime || "application/octet-stream", upsert: true });
      await db.from("correspondence_attachments").insert({
        message_id: messageId, file_name: a.filename, mime: a.mime || null, storage_path: path, size: bytes.length,
      });
      resendAttachments.push({ filename: a.filename, content: a.contentBase64 });
    }
  }

  // 6. Send via Resend.
  let deliveryStatus = "no_provider";
  let externalId: string | null = null;
  if (RESEND_API_KEY) {
    const footer = "\n\n—\nSent via NaloHub on behalf of your building committee. Replies to this email are recorded in NaloHub.";
    const payload: any = {
      from: `"${senderName}" <${slug}@${MAIL_DOMAIN}>`,
      to: [recipient],
      reply_to: replyTo,
      subject: subject || "(no subject)",
      text: (bodyText || "") + footer,
    };
    if (bodyHtml) payload.html = bodyHtml;
    if (resendAttachments.length) payload.attachments = resendAttachments;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { const r = await res.json(); externalId = r?.id || null; deliveryStatus = "sent"; }
      else { deliveryStatus = "failed"; }
    } catch (_e) {
      deliveryStatus = "failed";
    }
  }

  // 7. Update delivery status (append-only trigger permits status/external_id updates).
  await db.from("correspondence_messages")
    .update({ delivery_status: deliveryStatus, external_message_id: externalId }).eq("id", messageId);
  await db.from("correspondence_threads")
    .update({ last_activity_at: new Date().toISOString(), status: "awaiting_reply" }).eq("id", tId);

  return json({ ok: deliveryStatus !== "failed", threadId: tId, messageId, deliveryStatus });
});
