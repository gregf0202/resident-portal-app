import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Inbound email capture into a dispute record. Accepts Postmark/Mailgun-style JSON and
// routes by a per-dispute alias (disp-0001@...) or a [DISP-0001] subject tag, filing the
// email into that dispute's append-only, hash-chained record.
//
// SECURITY (0.36.0, migration 0026): the webhook must send the shared secret in the
// `x-nalo-internal` header. The expected value lives only in Vault (inbound_email_token)
// and is read through the service-role-only RPC internal_secret(). The old hard-coded
// ?secret= value no longer works. Used once, as a test on 11 Jul 2026; the Correspondence
// Hub (receive-correspondence) is the live inbound path.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
let cachedToken: string | null = null;
async function isAuthorised(req: Request): Promise<boolean> {
  const provided = (req.headers.get("x-nalo-internal") || "").trim();
  if (!provided) return false;
  if (!cachedToken) {
    const { data, error } = await createClient(SUPABASE_URL, SERVICE_KEY).rpc("internal_secret", { p_name: "inbound_email_token" });
    if (error || !data) return false;
    cachedToken = String(data);
  }
  return safeEqual(provided, cachedToken);
}

const findRef = (to: string, subject: string): string | null => {
  const alias = /disp[-_]?(\d{3,5})@/i.exec(to || "");
  if (alias) return "DISP-" + alias[1].padStart(4, "0");
  const tag = /\[?DISP[-_](\d{3,5})\]?/i.exec(subject || "");
  if (tag) return "DISP-" + tag[1].padStart(4, "0");
  return null;
};

Deno.serve(async (req: Request) => {
  if (!(await isAuthorised(req))) return new Response("forbidden", { status: 403 });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: true, info: "POST email webhooks here" }), { headers: { "Content-Type": "application/json" } });
  let p: any = {};
  try { p = await req.json(); } catch (_e) { return new Response("bad json", { status: 400 }); }

  // Postmark: To/ToFull/Subject/TextBody/From. Mailgun: recipient/subject/body-plain/sender.
  const to = String(p.To || p.OriginalRecipient || p.recipient || (p.ToFull && p.ToFull[0] && p.ToFull[0].Email) || "");
  const subject = String(p.Subject || p.subject || "");
  const bodyText = String(p.TextBody || p["body-plain"] || p.text || "").slice(0, 4000);
  const from = String(p.From || p.sender || p.from || "unknown sender");
  const ref = findRef(to, subject);
  if (!ref) return new Response(JSON.stringify({ ok: false, reason: "no dispute reference found in recipient or subject" }), { status: 422, headers: { "Content-Type": "application/json" } });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: d } = await db.from("disputes").select("id, building_id").eq("ref", ref).maybeSingle();
  if (!d) return new Response(JSON.stringify({ ok: false, reason: `no dispute ${ref}` }), { status: 404, headers: { "Content-Type": "application/json" } });

  const { error } = await db.from("dispute_events").insert({
    dispute_id: d.id, building_id: d.building_id,
    data: { type: "correspondence", channel: "Email", by: `Inbound email: ${from}`, text: `Subject: ${subject}\n\n${bodyText}` },
  });
  if (error) return new Response(JSON.stringify({ ok: false, reason: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ ok: true, filed_to: ref }), { headers: { "Content-Type": "application/json" } });
});
