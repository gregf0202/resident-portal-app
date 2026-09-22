// ============================================================================
// send-announcement
// Outbound announcement email. An authenticated committee / strata / building
// manager posts a notice in NaloHub; this emails the residents it targets at
// their real email addresses (in addition to the in-app notice), via Resend.
//
// v7 (0.37.0): recipients come from the UNIT REGISTER (current owners and
// tenants) merged with app members, de-duplicated on email, via the SQL
// function broadcast_recipients(). The composer preview calls the same
// function, so the preview and the send cannot disagree. The client can never
// email arbitrary addresses: it names an audience, a saved list or register
// keys, and the server resolves them.
//   audience "all" | "residents" | "owners" | "tenants" | "offsite"
//   audience "list"     -> listId (a saved distribution list)
//   audience "specific" -> people: ["up:<unit_people.id>" | "m:<membership.id>"]
//                          (legacy recipientIds = membership ids still accepted)
// Addresses go in BCC, in batches (Resend allows 50 addresses per message).
// Every send writes an announcement_sends row: who it went to, and when.
// Replies route to the building's NaloHub inbox (reply_to) so they land in-app.
//
// v8 (0.38.0): the email is built by noticeEmail.js, the same file the app uses
// for its "See the email" preview (keep the two copies byte-identical). Building
// logo and notice photo arrive from the app already downscaled (logo 96px PNG,
// photo 720px JPEG) and are stored in the public email-assets bucket, because
// mail apps block data: URLs. The NaloHub mark is a 1.5 KB file on the portal.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { noticeHtml, noticeText } from "./noticeEmail.js";

// NaloHub wordmark, 107x36 PNG, 48 colours, about 1.5 KB, shown at 54x18 and dimmed.
// Served from the portal (public/email/nalohub-mark.png), deployed with the app.
const NALOHUB_MARK_URL = "https://portal.nalohub.com/email/nalohub-mark.png";
// The NaloHub wave along the bottom of the header, 1200x64 PNG on navy, about 1 KB (v9).
const NALOHUB_WAVE_URL = "https://portal.nalohub.com/email/nalohub-wave.png";
const ASSET_BUCKET = "email-assets";
const MAX_IMG = 300 * 1024;
const ROLE_LABEL: Record<string, string> = { bcc: "Committee", admin: "Admin", manager: "Building manager", strata: "Strata manager" };

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
// data:image/png|jpeg;base64,... -> { bytes, type, ext } or null. Anything else is refused.
function decodeImage(dataUrl: unknown) {
  const m = /^data:(image\/(png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const bytes = b64ToBytes(m[3]);
  if (!bytes.length || bytes.length > MAX_IMG) return null;
  return { bytes, type: m[1], ext: m[2] === "png" ? "png" : "jpg" };
}

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
  const { buildingId, subject, bodyText, audience, recipientIds, people, listId, announcementId, noticeType, images } = body || {};
  if (!buildingId) return json({ error: "buildingId required" }, 400);
  if (!subject) return json({ error: "subject required" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // --- Authorization: caller must be committee / strata / manager of building --
  const { data: mine } = await db.from("memberships")
    .select("role, status, full_name").eq("building_id", buildingId).eq("user_id", uid).maybeSingle();
  const posterRole = mine?.role;
  if (!mine || mine.status !== "active" || !["admin", "bcc", "strata", "manager"].includes(posterRole)) {
    return json({ error: "Not permitted for this building" }, 403);
  }

  // --- Resolve recipients server-side from the register + app members -------
  const aud = audience || "all";
  if (!["all", "residents", "owners", "tenants", "offsite", "list", "specific"].includes(aud)) return json({ error: "unknown audience" }, 400);
  const keys = Array.isArray(people) && people.length ? people
    : (Array.isArray(recipientIds) ? recipientIds.map((id: string) => "m:" + id) : []);
  const { data: resolved, error: rErr } = await db.rpc("broadcast_recipients", {
    p_building: buildingId, p_audience: aud, p_list: aud === "list" ? listId : null, p_people: keys,
  });
  if (rErr) return json({ error: "could not resolve recipients", detail: rErr.message }, 400);
  const folks: any[] = resolved?.people || [];
  const emails = Array.from(new Set(folks.map((p) => String(p.email || "").trim()).filter(Boolean)));
  const listName: string | null = resolved?.list_name || null;

  const record = async (emailed: number) => {
    await db.from("announcement_sends").insert({
      building_id: buildingId, announcement_id: announcementId || null, subject, audience: aud,
      list_id: aud === "list" ? listId : null, list_name: listName,
      recipients: folks.map((p) => ({ name: p.name, unit: p.unit, kind: p.kind, email: p.email || null })),
      people_count: folks.length, emailed_count: emailed, no_email_count: folks.length - emails.length, sent_by: uid,
    });
  };
  if (emails.length === 0) { await record(0); return json({ ok: true, sent: 0, people: folks.length, note: "no matching recipients with an email" }); }

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

  const audLabel = ({ all: "owners and tenants", residents: "residents", owners: "owners", tenants: "tenants", offsite: "owners who live elsewhere", specific: "selected people" } as Record<string, string>)[aud] || (listName ? `the ${listName} list` : "residents");

  // --- Low-res images, hosted so mail apps will show them ----------------------
  const store = db.storage.from(ASSET_BUCKET);
  const publicUrl = (path: string) => store.getPublicUrl(path).data.publicUrl;
  const put = async (path: string, bytes: Uint8Array, type: string) => {
    const { error } = await store.upload(path, bytes, { contentType: type, upsert: true, cacheControl: "31536000" });
    return error ? null : publicUrl(path);
  };
  let logoUrl: string | null = null, photoUrl: string | null = null;
  const logo = decodeImage(images?.logo);
  if (logo) logoUrl = await put(`${buildingId}/logo-${hex(await crypto.subtle.digest("SHA-256", logo.bytes)).slice(0, 16)}.${logo.ext}`, logo.bytes, logo.type);
  const photo = decodeImage(images?.photo);
  if (photo) photoUrl = await put(`${buildingId}/notice-${String(announcementId || crypto.randomUUID()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}-${hex(await crypto.subtle.digest("SHA-256", photo.bytes)).slice(0, 8)}.${photo.ext}`, photo.bytes, photo.type);

  const dateLabel = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", day: "numeric", month: "short", year: "numeric" }).format(new Date());
  const tpl = {
    buildingName, buildingInitials: b?.data?.logoText || "", logoUrl, title: subject, body: bodyText || "",
    noticeType: noticeType || "General", photoUrl, posterName, posterRole: ROLE_LABEL[posterRole] || "",
    replyAddress: replyTo || "", audienceLabel: audLabel, dateLabel, nalohubMarkUrl: NALOHUB_MARK_URL, waveUrl: NALOHUB_WAVE_URL,
  };
  const html = noticeHtml(tpl);
  const text = noticeText(tpl);

  // Resend accepts at most 50 addresses per message across to/cc/bcc, and `to`
  // takes one slot, so BCC goes out in batches of 45.
  const BATCH = 45;
  let sent = 0; const ids: string[] = []; const failures: string[] = [];
  for (let i = 0; i < emails.length; i += BATCH) {
    const chunk = emails.slice(i, i + BATCH);
    const payload: any = {
      from: `"${senderName}" <${senderAddress}>`,
      to: [senderAddress],
      bcc: chunk,
      subject,
      text,
      html,
    };
    if (replyTo) payload.reply_to = replyTo;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { const r = await res.json(); sent += chunk.length; if (r?.id) ids.push(r.id); }
      else failures.push(await res.text());
    } catch (e) { failures.push(String((e as Error).message || e)); }
  }
  await record(sent);
  if (sent === 0) return json({ ok: false, sent: 0, people: folks.length, error: "send failed", detail: failures[0] || null }, 200);
  return json({ ok: true, sent, people: folks.length, noEmail: folks.length - emails.length, ids, partial: failures.length > 0 });
});
