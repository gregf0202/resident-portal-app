// ============================================================================
// receive-correspondence
// Inbound side of the Correspondence Hub. Resend "email.received" webhook fires
// here (metadata only); we then pull the full body + attachments from Resend's
// receiving API. Durability-first: we persist the raw email to storage + an
// inbound_raw row BEFORE parsing, so mail is never lost. Then we thread it:
//   1) plus-address token  <slug>+<threadId>@domain   (deterministic)
//   2) else sender + subject match to an open thread
//   3) else leave it in the Unfiled tray (inbound_raw.status = 'unfiled')
//
// Sibling to `inbound-email` (which is dispute-specific) — kept separate on
// purpose. verify_jwt = false; requests are authenticated by the Resend/Svix
// webhook signature instead.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Reading received emails needs a FULL-ACCESS Resend key; the send-only key
// used for outbound is rejected. Prefer a dedicated receive key, fall back to
// the shared one if that's what's configured.
const RESEND_KEY = Deno.env.get("RESEND_RECEIVE_KEY") || Deno.env.get("RESEND_API_KEY");
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET"); // "whsec_..."
const MAIL_DOMAIN = Deno.env.get("CORR_MAIL_DOMAIN") || "send.nalohub.com";
const BUCKET = "correspondence";
const API = "https://api.resend.com";

const b64ToBytes = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const bytesToB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));

// --- Svix signature verification (Resend webhooks) --------------------------
async function verifySignature(secret: string, headers: Headers, payload: string): Promise<boolean> {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > 300) return false; // 5-min tolerance
  const secretBytes = b64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${payload}`));
  const expected = bytesToB64(new Uint8Array(sig));
  // header is space-separated "v1,<sig>" pairs
  return sigHeader.split(" ").map((p) => p.split(",")[1]).some((s) => s === expected);
}

const parseFrom = (raw: string): { name: string | null; email: string } => {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(raw || "");
  if (m) return { name: (m[1] || "").trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: (raw || "").trim().toLowerCase() };
};
const normSubject = (s: string) => (s || "").replace(/^\s*(re|fwd?)\s*:\s*/gi, "").trim().toLowerCase();
const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const bodyText = await req.text();

  // 1. Authenticate the webhook (Resend/Svix signature).
  if (!WEBHOOK_SECRET) return new Response("webhook secret not configured", { status: 500 });
  if (!(await verifySignature(WEBHOOK_SECRET, req.headers, bodyText))) {
    return new Response("invalid signature", { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(bodyText); } catch { return new Response("bad json", { status: 400 }); }
  if (event?.type !== "email.received") return ok({ ignored: event?.type || "unknown" });

  const d = event.data || {};
  const emailId: string = d.email_id;
  if (!emailId) return ok({ ignored: "no email_id" });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // 2. Idempotency — if we already stored this provider message, stop.
  const { data: dupe } = await db.from("correspondence_inbound_raw")
    .select("id, status").eq("provider_message_id", emailId).maybeSingle();
  if (dupe) return ok({ deduped: true, raw_id: dupe.id });

  // 3. Work out which mailbox/thread this was for (from the plus-address token).
  const recipients: string[] = [
    ...(Array.isArray(d.to) ? d.to : []),
    ...(Array.isArray(d.received_for) ? d.received_for : []),
    ...(Array.isArray(d.cc) ? d.cc : []),
  ];
  let slug: string | null = null;
  let tokenThreadId: string | null = null;
  for (const addr of recipients) {
    const m = /([a-z0-9-]+)\+([0-9a-fA-F-]{36})@/.exec(String(addr));
    if (m) { slug = m[1]; tokenThreadId = m[2]; break; }
    const m2 = /([a-z0-9-]+)@/.exec(String(addr)); // slug without token (new inbound to a mailbox)
    if (!slug && m2 && String(addr).includes(MAIL_DOMAIN)) slug = m2[1];
  }
  let buildingId: string | null = null;
  if (slug) {
    const { data: mb } = await db.from("building_mailboxes").select("building_id").eq("slug", slug).maybeSingle();
    buildingId = mb?.building_id || null;
  }

  // 4. DURABILITY FIRST — fetch full content, store raw, insert inbound_raw. --
  // Content can lag the webhook by a moment, so retry a few times.
  let full: any = {};
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`${API}/emails/receiving/${emailId}`, { headers: { Authorization: `Bearer ${RESEND_KEY}` } });
      if (r.ok) { const j = await r.json(); full = j; if (j && (j.text || j.html || j.raw?.download_url)) break; }
    } catch (_e) { /* retry */ }
    await new Promise((res) => setTimeout(res, 1500));
  }

  let rawPath: string | null = null;
  try {
    const dl = full?.raw?.download_url;
    if (dl) {
      const rawResp = await fetch(dl);
      if (rawResp.ok) {
        const bytes = new Uint8Array(await rawResp.arrayBuffer());
        rawPath = `_inbound/${emailId}.eml`;
        await db.storage.from(BUCKET).upload(rawPath, bytes, { contentType: "message/rfc822", upsert: true });
      }
    }
    // Always keep the parsed JSON too (belt and braces).
    const metaPath = `_inbound/${emailId}.json`;
    await db.storage.from(BUCKET).upload(metaPath, new TextEncoder().encode(JSON.stringify({ event, full })), { contentType: "application/json", upsert: true });
    if (!rawPath) rawPath = metaPath;
  } catch (_e) { /* storage best-effort; row still recorded below */ }

  const { data: rawRow, error: rawErr } = await db.from("correspondence_inbound_raw").insert({
    building_id: buildingId, provider_message_id: emailId, raw_mime_path: rawPath, status: "received",
  }).select("id").single();
  if (rawErr) return new Response("could not persist raw", { status: 500 }); // 500 → Resend retries; nothing lost
  const rawId = rawRow.id;

  // 5. Hygiene — ignore auto-responders / bulk mail (kept as raw, not threaded).
  const headers = full?.headers || {};
  const autoSubmitted = String(headers["auto-submitted"] || "").toLowerCase();
  const precedence = String(headers["precedence"] || "").toLowerCase();
  const subject: string = d.subject || full?.subject || "";
  const isAuto = (autoSubmitted && autoSubmitted !== "no") || ["bulk", "list", "junk"].includes(precedence) || /^\s*(auto(matic)?[- ]?reply|out of office)/i.test(subject);
  if (isAuto) {
    await db.from("correspondence_inbound_raw").update({ status: "ignored_auto", processed_at: new Date().toISOString() }).eq("id", rawId);
    return ok({ ignored: "auto-responder", raw_id: rawId });
  }

  const { name: fromName, email: fromEmail } = parseFrom(d.from || full?.from || "");

  // 6. Resolve the thread: token first, then sender+subject, else Unfiled. ----
  let threadId: string | null = null;
  if (tokenThreadId) {
    const q = db.from("correspondence_threads").select("id, building_id").eq("id", tokenThreadId);
    const { data: th } = await q.maybeSingle();
    if (th && (!buildingId || th.building_id === buildingId)) { threadId = th.id; buildingId = th.building_id; }
  }
  if (!threadId && buildingId && fromEmail) {
    // sender + subject fallback: newest non-closed thread for a contact with this email
    const { data: cands } = await db.from("correspondence_threads")
      .select("id, subject, contact_id, correspondence_contacts!inner(email)")
      .eq("building_id", buildingId).neq("status", "closed")
      .eq("correspondence_contacts.email", fromEmail)
      .order("last_activity_at", { ascending: false });
    const match = (cands || []).find((t: any) => normSubject(t.subject) === normSubject(subject)) || (cands || [])[0];
    if (match) threadId = match.id;
  }

  if (!threadId) {
    // 7. Unfiled — durably held for committee triage; never discarded.
    // Store display + content fields so the committee can see and file it.
    await db.from("correspondence_inbound_raw").update({
      status: "unfiled", building_id: buildingId,
      from_name: fromName, from_email: fromEmail, subject,
      body_text: full?.text || null, body_html: full?.html || null,
    }).eq("id", rawId);
    return ok({ unfiled: true, raw_id: rawId });
  }

  // 8. Insert the inbound message (append-only; content_hash set by trigger). -
  const { data: msg, error: mErr } = await db.from("correspondence_messages").insert({
    thread_id: threadId, direction: "inbound", from_name: fromName, from_email: fromEmail,
    to_email: (Array.isArray(d.to) ? d.to[0] : d.to) || null, cc: Array.isArray(d.cc) ? d.cc.join(", ") : (d.cc || null),
    subject: subject || null, body_text: full?.text || null, body_html: full?.html || null,
    external_message_id: d.message_id || full?.message_id || null, raw_id: rawId,
    delivery_status: "received",
  }).select("id").single();
  if (mErr) return new Response("could not insert message", { status: 500 });
  const messageId = msg.id;

  // 9. Attachments — pull each from Resend, store in our bucket, record it.
  try {
    const ar = await fetch(`${API}/emails/receiving/${emailId}/attachments`, { headers: { Authorization: `Bearer ${RESEND_KEY}` } });
    if (ar.ok) {
      const list = await ar.json();
      for (const a of (list?.data || [])) {
        if (!a?.download_url) continue;
        const fResp = await fetch(a.download_url);
        if (!fResp.ok) continue;
        const bytes = new Uint8Array(await fResp.arrayBuffer());
        const path = `${buildingId}/${threadId}/${messageId}/${a.filename || a.id}`;
        await db.storage.from(BUCKET).upload(path, bytes, { contentType: a.content_type || "application/octet-stream", upsert: true });
        await db.from("correspondence_attachments").insert({
          message_id: messageId, file_name: a.filename || a.id, mime: a.content_type || null, storage_path: path, size: a.size ?? bytes.length,
        });
      }
    }
  } catch (_e) { /* attachment fetch best-effort; message + raw already saved */ }

  // 10. Reopen the thread for committee attention + mark raw processed.
  await db.from("correspondence_threads").update({ last_activity_at: new Date().toISOString(), status: "open" }).eq("id", threadId);
  await db.from("correspondence_inbound_raw").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", rawId);

  return ok({ threaded: true, thread_id: threadId, message_id: messageId });
});
