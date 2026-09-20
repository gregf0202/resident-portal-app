import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// permit-verify — public, read-only check of a parking permit by its id.
// Shows only what a person in the car park needs: number, building, validity, status.
// Never exposes unit, vehicle or rego. Looked up by uuid so numbers cannot be enumerated.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TZ = "Australia/Brisbane";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const fmt = (d: string) => new Date(d + "T12:00:00+10:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const brisbaneDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const CSS = `body{margin:0;background:#0B1F3A;font-family:Calibri,Carlito,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;color:#1A2733}
.wrap{max-width:440px;margin:0 auto;padding:28px 16px 40px}
.card{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35)}
.head{background:#0B1F3A;color:#fff;padding:18px 22px 16px}
.head small{display:block;letter-spacing:.12em;font-size:11px;color:#B8C4CE;font-weight:700}
.head h1{margin:6px 0 0;font-size:26px}
.body{padding:20px 22px 22px}
.no{font:700 40px/1 Cambria,Caladea,Georgia,serif;color:#1FA6A6;margin:2px 0 14px}
.badge{display:inline-block;padding:6px 12px;border-radius:999px;font-weight:700;font-size:13px}
.ok{background:#E8F5EE;color:#1F7A4C}.warn{background:#FDF3E7;color:#B45309}.bad{background:#FDECEC;color:#B42318}
.row{display:flex;gap:16px;margin-top:14px}.row div{flex:1}
label{display:block;font-size:11px;letter-spacing:.08em;color:#5C6670;font-weight:700}
.v{font-size:17px;font-weight:700;margin-top:3px}
.foot{margin-top:18px;padding-top:14px;border-top:1px solid #EEF4F6;color:#5C6670;font-size:12px}
.brand{text-align:center;color:#B8C4CE;font-size:12px;margin-top:18px}.brand b{color:#fff}`;

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} &middot; NaloHub</title><style>${CSS}</style></head><body><div class="wrap"><div class="card">${body}</div><div class="brand"><b>NaloHub</b> &middot; Your Building, Your Records &middot; nalohub.com</div></div></body></html>`;

const html = (s: string, status = 200) => new Response(s, { status, headers: { ...cors, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const wantJson = url.searchParams.get("fmt") === "json";

  if (!UUID.test(id)) {
    if (wantJson) return json({ error: "invalid id" }, 400);
    return html(page("Permit check", `<div class="head"><small>PARKING PERMIT</small><h1>Permit check</h1></div><div class="body"><span class="badge bad">Not a valid permit link</span><div class="foot">Scan the QR code on the permit itself. If you think this is an error, contact the building's committee.</div></div>`), 400);
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: p } = await sb.from("parking_permits").select("id, building_id, permit_no, date_from, date_to, approval_date, status").eq("id", id).maybeSingle();
  if (!p) {
    if (wantJson) return json({ error: "not found" }, 404);
    return html(page("Permit check", `<div class="head"><small>PARKING PERMIT</small><h1>Permit check</h1></div><div class="body"><span class="badge bad">No permit found</span><div class="foot">This code does not match a permit on record. Contact the building's committee.</div></div>`), 404);
  }
  const { data: b } = await sb.from("buildings").select("data").eq("id", p.building_id).maybeSingle();
  const building = String((b?.data as Record<string, unknown> | null)?.name ?? "");

  const today = brisbaneDate();
  let tone = "ok", label = "Current";
  if (p.status !== "active") { tone = "bad"; label = p.status === "revoked" ? "Revoked" : "Not active"; }
  else if (today < p.date_from) { tone = "warn"; label = "Not yet started"; }
  else if (today > p.date_to) { tone = "bad"; label = "Expired"; }
  const checked = new Date().toLocaleString("en-AU", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });

  if (wantJson) return json({ permit_no: p.permit_no, building, status: label, valid_from: p.date_from, valid_to: p.date_to, approved: p.approval_date, checked });

  const body = `<div class="head"><small>VISITOR PARKING PERMIT</small><h1>${esc(building)}</h1></div>
  <div class="body"><div class="no">${esc(p.permit_no)}</div><span class="badge ${tone}">${label}</span>
  <div class="row"><div><label>VALID FROM</label><div class="v">${fmt(p.date_from)}</div></div><div><label>VALID TO</label><div class="v">${fmt(p.date_to)}</div></div></div>
  <div class="row"><div><label>APPROVED</label><div class="v">${p.approval_date ? fmt(p.approval_date) : "&mdash;"} by the Committee</div></div></div>
  <div class="foot">Checked ${esc(checked)} AEST. This page shows validity only; the unit and vehicle are on the printed permit.</div></div>`;
  return html(page(`${p.permit_no} · ${building}`, body));
});
