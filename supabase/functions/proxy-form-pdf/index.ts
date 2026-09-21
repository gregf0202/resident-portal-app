import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

// Committee proxy appointment form. Generic for all Australian jurisdictions,
// drafted to satisfy the QLD BCCM Standard Module s 123 form requirements.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
// Dates are anchored to Brisbane noon and formatted in Brisbane, so the printed day can
// never shift with the runtime's timezone (the edge runtime is UTC).
const TZ = "Australia/Brisbane";
const fmt = (d: string | null) => d ? new Date(d + "T12:00:00+10:00").toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric", timeZone: TZ }) : "____________________";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return new Response(JSON.stringify({ error: "missing id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data: p, error } = await db.from("proxy_appointments").select("*").eq("id", id).maybeSingle();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  if (!p) return new Response(JSON.stringify({ error: "not found or not authorised" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });

  let buildingName = "";
  const { data: b } = await db.from("buildings").select("data").eq("id", p.building_id).maybeSingle();
  if (b?.data?.name) buildingName = String(b.data.name);

  const doc = await PDFDocument.create();
  const W = 595.28, H = 841.89;
  const page = doc.addPage([W, H]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const navy = rgb(0.102, 0.169, 0.29);
  const grey = rgb(0.4, 0.43, 0.48);
  const m = 60;
  let y = 770;

  const center = (t: string, f: any, size: number, colour: any, yy: number) => {
    const w = f.widthOfTextAtSize(t, size);
    page.drawText(t, { x: (W - w) / 2, y: yy, size, font: f, color: colour });
  };
  const field = (label: string, value: string) => {
    page.drawText(label, { x: m, y, size: 10, font, color: grey });
    page.drawText(value, { x: m + 190, y, size: 11, font: bold, color: navy });
    page.drawLine({ start: { x: m + 185, y: y - 4 }, end: { x: W - m, y: y - 4 }, thickness: 0.5, color: grey });
    y -= 30;
  };
  const para = (t: string, size = 9.5) => {
    const words = t.split(" ");
    let line = "";
    for (const w2 of words) {
      if (font.widthOfTextAtSize(line + " " + w2, size) > W - m * 2) {
        page.drawText(line, { x: m, y, size, font, color: grey }); y -= 14; line = w2;
      } else line = line ? line + " " + w2 : w2;
    }
    if (line) { page.drawText(line, { x: m, y, size, font, color: grey }); y -= 14; }
    y -= 6;
  };

  center("APPOINTMENT OF PROXY", bold, 20, navy, y); y -= 22;
  center("Committee of the Body Corporate" + (buildingName ? " — " + buildingName : ""), font, 12, grey, y); y -= 16;
  page.drawLine({ start: { x: m, y }, end: { x: W - m, y }, thickness: 1.5, color: navy }); y -= 36;

  field("Scheme / Building", buildingName || "");
  field("Appointor (voting member)", p.principal_name || "");
  field("Appointed proxy (named individual)", p.proxy_name || "");
  field("Effective from", fmt(p.date_from));
  field("Effective to", fmt(p.date_to));
  field("Scope", p.scope === "committee" ? "Committee meeting decisions and votes" : "General meeting");
  y -= 8;

  page.drawText("Terms of appointment", { x: m, y, size: 11, font: bold, color: navy }); y -= 20;
  para("1. I, the appointor named above, being a voting member of the committee, appoint the named individual above as my proxy to attend, and vote on my behalf in respect of, decisions of the committee during the period stated.");
  para("2. This appointment is written in English, is contained in a document separate from any contract, and appoints a named individual.");
  para("3. This appointment is revocable at any time by written notice to the secretary, and cannot be transferred by the proxy to any other person.");
  para("4. This proxy must not be exercised on any matter where I vote personally or attend the relevant meeting in person or by electronic means.");
  para("5. This appointment lapses on the 'Effective to' date above, or earlier if revoked, or as otherwise limited by the legislation applying to the scheme.");
  y -= 14;

  page.drawText("Signed (appointor)", { x: m, y, size: 10, font, color: grey });
  page.drawLine({ start: { x: m + 110, y: y - 3 }, end: { x: m + 300, y: y - 3 }, thickness: 0.7, color: navy });
  page.drawText("Date", { x: m + 320, y, size: 10, font, color: grey });
  page.drawLine({ start: { x: m + 355, y: y - 3 }, end: { x: W - m, y: y - 3 }, thickness: 0.7, color: navy });
  y -= 40;
  page.drawText("Received by secretary", { x: m, y, size: 10, font, color: grey });
  page.drawLine({ start: { x: m + 130, y: y - 3 }, end: { x: m + 300, y: y - 3 }, thickness: 0.7, color: navy });
  page.drawText("Date", { x: m + 320, y, size: 10, font, color: grey });
  page.drawLine({ start: { x: m + 355, y: y - 3 }, end: { x: W - m, y: y - 3 }, thickness: 0.7, color: navy });
  y -= 44;

  page.drawRectangle({ x: m, y: y - 58, width: W - m * 2, height: 66, color: rgb(0.95, 0.97, 0.98) });
  page.drawText("Jurisdiction note", { x: m + 10, y: y - 8, size: 9, font: bold, color: navy });
  const note = "Queensland schemes: committee proxies are governed by the BCCM Standard Module 2020 ss 121-125 (or the module applying to your scheme). The proxy must be another voting member of the committee, may hold only one proxy, the form must reach the secretary before the meeting, it has effect for no more than one meeting, and a member may be represented by proxy at no more than two committee meetings per year. Check your jurisdiction's approved form requirements before relying on this document.";
  let ny = y - 22; let line = "";
  for (const w2 of note.split(" ")) {
    if (font.widthOfTextAtSize(line + " " + w2, 8) > W - m * 2 - 20) {
      page.drawText(line, { x: m + 10, y: ny, size: 8, font, color: grey }); ny -= 11; line = w2;
    } else line = line ? line + " " + w2 : w2;
  }
  if (line) page.drawText(line, { x: m + 10, y: ny, size: 8, font, color: grey });

  page.drawText("Generated by NaloHub", { x: m, y: 50, size: 8, font, color: grey });
  page.drawText(new Date().toLocaleDateString("en-AU", { timeZone: TZ }), { x: W - m - 55, y: 50, size: 8, font, color: grey });

  const bytes = await doc.save();
  return new Response(bytes, {
    headers: { ...cors, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="proxy-form.pdf"` },
  });
});
