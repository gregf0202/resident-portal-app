// Supabase Edge Function: maintenance-reminders
// ---------------------------------------------------------------------------
// Two ways to run:
//   1. Scheduled sweep (pg_cron, daily): no body, or {"mode":"sweep"}.
//      Finds every unresolved maintenance issue whose follow-up interval is due
//      and emails that building's Maintenance Sub-Committee + Building Manager.
//   2. On demand from the app ("Remind team now"): {"issueId":"...","buildingId":"..."}.
//
// Requires two Edge Function secrets (Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY   — your Resend sending key (re_...)
//   REMINDER_FROM    — e.g. "NaloHub <noreply@send.nalohub.com>"  (verified domain)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ---------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DAY = 86400000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("REMINDER_FROM") || "NaloHub <noreply@send.nalohub.com>";

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { /* cron sends no body */ }
  const singleIssue = body.issueId as string | undefined;
  const singleBuilding = body.buildingId as string | undefined;

  // Pull candidate issues.
  let q = supabase.from("maintenance").select("id, building_id, data");
  if (singleBuilding) q = q.eq("building_id", singleBuilding);
  const { data: rows, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const now = Date.now();
  const due = (rows || []).filter((r) => {
    const d = r.data || {};
    if (d.status === "resolved") return false;
    if (singleIssue) return r.id === singleIssue;
    const days = Number(d.reminderDays) || 0;
    if (days <= 0) return false;
    const last = new Date(d.lastRemindedAt || d.reportedAt || d.date || now).getTime();
    return now - last >= days * DAY;
  });
  if (due.length === 0) return json({ ok: true, reminded: 0 });

  // Group by building and email each building's MSC + manager.
  const byBuilding: Record<string, typeof due> = {};
  for (const r of due) (byBuilding[r.building_id] ||= []).push(r);

  let reminded = 0;
  for (const [bid, issues] of Object.entries(byBuilding)) {
    const { data: members } = await supabase
      .from("memberships").select("email, full_name, role, msc")
      .eq("building_id", bid).eq("status", "active");
    const recipients = (members || [])
      .filter((m) => m.email && (m.msc || m.role === "manager" || m.role === "bcc"))
      .map((m) => m.email);
    if (recipients.length === 0) continue;

    const lines = issues.map((r) => {
      const d = r.data || {};
      const opened = Math.floor((now - new Date(d.reportedAt || d.date || now).getTime()) / DAY);
      return `• ${d.title || "Issue"} — ${d.category || "General"} — ${d.status || "open"} — open ${opened} day(s)`;
    }).join("\n");
    const html = `<p>The following maintenance ${issues.length === 1 ? "issue is" : "issues are"} due for follow-up:</p>`
      + `<pre style="font-family:inherit">${lines}</pre>`
      + `<p>Open the portal to update status or record works.</p><p style="color:#5a6b7b">— NaloHub</p>`;

    if (RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: recipients, subject: `Maintenance follow-up — ${issues.length} issue(s)`, html }),
      });
      if (!res.ok) continue; // best-effort; leave lastRemindedAt so it retries next run
    }

    // Stamp lastRemindedAt so the interval restarts.
    for (const r of issues) {
      const data = { ...(r.data || {}), lastRemindedAt: new Date().toISOString() };
      await supabase.from("maintenance").update({ data }).eq("id", r.id);
      reminded++;
    }
  }
  return json({ ok: true, reminded, emailConfigured: !!RESEND_API_KEY });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
