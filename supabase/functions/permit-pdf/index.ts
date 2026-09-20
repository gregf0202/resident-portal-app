// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";
import qrcode from "https://esm.sh/qrcode-generator@1.4.4";

// permit-pdf v9 (20 Sep 2026): the tent permit. A4, two identical A5 cards (top one rotated 180°),
// navy header with the building name, NaloHub mark, a QR that opens the public verify page,
// and the building's aerial photo. Replaces the black/yellow "Temporary Parking Permit" layout.
// Auth and data flow unchanged from v8: caller's JWT, RLS decides what they can print.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const VERIFY_BASE = "https://portal.nalohub.com/permit.html?id=";
const CURVE_ID = "ecd3d712-c949-4dec-b20c-9a5d36df0eb6";
// Artwork is served from the app's own public/ folder (same pattern as the printable wordmark).
// A fetch failure degrades to "no image" rather than failing the permit.
const ASSET_BASE = "https://portal.nalohub.com/";
const fetchPng = async (name: string): Promise<Uint8Array | null> => {
  try { const r = await fetch(ASSET_BASE + name, { signal: AbortSignal.timeout(4000) }); if (!r.ok) return null; return new Uint8Array(await r.arrayBuffer()); }
  catch { return null; }
};
const TZ = "Australia/Brisbane";
const fmtShort = (d: string | null) => d ? new Date(d + "T12:00:00+10:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: TZ }) : "";
const fmtLong = (d: string | null) => d ? new Date(d + "T12:00:00+10:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : "";
const todayBrisbane = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// Shared drawing for the NaloHub tent permit. Runs unchanged in Node (test) and Deno (edge).
// One A4 portrait page, two identical A5-landscape cards, the top one rotated 180°, fold line between.
async function buildPermitPdf({ PDFDocument, StandardFonts, rgb, degrees }, data, assets) {
  const { permitNo, buildingName, unit, vehicle, rego, dateFrom, dateTo, approved, status, kindLabel, verifyUrl, qrMatrix } = data;
  const doc = await PDFDocument.create();
  doc.setTitle(`${permitNo} · ${buildingName} · Parking permit`);
  const W = 595.28, H = 841.89;
  const page = doc.addPage([W, H]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
  const NAVY = rgb(0.043, 0.122, 0.227), TEAL = rgb(0.122, 0.651, 0.651), GREY = rgb(0.36, 0.4, 0.44), LIGHT = rgb(0.933, 0.957, 0.965), WHITE = rgb(1, 1, 1), MUTED = rgb(0.72, 0.77, 0.81);
  const logo = assets.logoPng ? await doc.embedPng(assets.logoPng) : null;
  const photo = assets.photoPng ? await doc.embedPng(assets.photoPng) : null;

  // Card design space is 900×560 units; card prints 178×110.7 mm. 1 unit = 0.1978 mm = 0.5607 pt.
  const S = 0.5607, CW = 900 * S, CH = 560 * S;
  const cardX = (W - CW) / 2, half = H / 2, cardYBottom = (half - CH) / 2;

  const drawCard = (ox, oy, rot) => {
    // helpers map design coords (x right, y down from card top-left) into page space, honouring rotation
    const pt = (x, y) => rot ? [ox + CW - x * S, oy + y * S] : [ox + x * S, oy + CH - y * S];
    const rect = (x, y, w, h, color, opts = {}) => {
      const [px, py] = pt(x, y + h);
      const [qx, qy] = pt(x + w, y);
      page.drawRectangle({ x: Math.min(px, qx), y: Math.min(py, qy), width: Math.abs(qx - px), height: Math.abs(qy - py), color, ...opts });
    };
    const text = (t, x, y, size, font, color) => {
      const s = size * S;
      if (rot) { const w = font.widthOfTextAtSize(t, s); const [px, py] = pt(x, y); page.drawText(t, { x: px, y: py, size: s, font, color, rotate: degrees(180) }); }
      else { const [px, py] = pt(x, y); page.drawText(t, { x: px, y: py, size: s, font, color }); }
    };
    const image = (img, x, y, w, h) => {
      if (!img) return;
      // pdf-lib rotates about the anchor; for the 180° card the anchor is the page top-right of the box,
      // which is the same design point (x, y+h) that is the bottom-left for the upright card.
      const [px, py] = pt(x, y + h);
      page.drawImage(img, { x: px, y: py, width: w * S, height: h * S, rotate: degrees(rot ? 180 : 0) });
    };

    // card body + header
    rect(0, 0, 900, 560, WHITE, { borderColor: LIGHT, borderWidth: 1 });
    rect(0, 0, 900, 130, NAVY);
    text(kindLabel.toUpperCase(), 40, 48, 22, bold, MUTED);
    text(buildingName, 40, 104, 52, bold, WHITE);
    image(logo, 690, 38, 170, 63);

    // QR (navy modules on white), 160 units at (700,155)
    const n = qrMatrix.length, cell = 160 / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qrMatrix[r][c]) rect(700 + c * cell, 155 + r * cell, cell + 0.15, cell + 0.15, NAVY);

    text('PERMIT No.', 40, 180, 20, bold, GREY);
    text(permitNo, 40, 240, 58, serif, TEAL);
    rect(40, 270, 620, 3, LIGHT);
    text('UNIT', 40, 305, 20, bold, GREY); text(unit, 40, 345, 34, bold, NAVY);
    text('VEHICLE', 200, 305, 20, bold, GREY); text(vehicle, 200, 345, 34, bold, NAVY);
    text('REGO', 40, 410, 20, bold, GREY); text(rego, 40, 450, 34, bold, NAVY);
    text('VALID', 200, 410, 20, bold, GREY); text(`${dateFrom} - ${dateTo}`, 200, 450, 34, bold, NAVY);
    image(photo, 640, 352, 256, 162);
    text(`Approved by the Committee · ${approved} · Display on dash · Scan to verify`, 40, 522, 20, reg, GREY);

    if (status !== 'active') {
      // diagonal watermark
      const [cx, cy] = pt(450, 300);
      page.drawText(status === 'revoked' ? 'REVOKED' : 'EXPIRED', { x: cx - 120, y: cy - 20, size: 72, font: bold, color: rgb(0.706, 0.325, 0.035), opacity: 0.22, rotate: degrees(rot ? 200 : 20) });
    }
  };

  drawCard(cardX, cardYBottom, false);                 // bottom half, upright
  drawCard(cardX, half + cardYBottom, true);           // top half, rotated 180°

  // fold line + footer
  page.drawLine({ start: { x: 28, y: half }, end: { x: W - 28, y: half }, thickness: 0.7, color: rgb(0.79, 0.84, 0.89), dashArray: [6, 4] });
  page.drawText('fold here', { x: W / 2 - 14, y: half + 4, size: 6.5, font: reg, color: rgb(0.6, 0.66, 0.72) });
  const foot = 'Fold along the line and stand on the dash or console. Both sides show the same permit.';
  page.drawText(foot, { x: (W - reg.widthOfTextAtSize(foot, 7.5)) / 2, y: 18, size: 7.5, font: reg, color: rgb(0.6, 0.66, 0.72) });
  page.drawText(verifyUrl, { x: (W - reg.widthOfTextAtSize(verifyUrl, 6)) / 2, y: 9, size: 6, font: reg, color: rgb(0.7, 0.75, 0.8) });
  return doc.save();
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const id = new URL(req.url).searchParams.get("id") || "";
  const jsonErr = (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (!id) return jsonErr("missing id", 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data: p, error } = await db.from("parking_permits").select("*").eq("id", id).maybeSingle();
  if (error) return jsonErr(error.message, 500);
  if (!p) return jsonErr("not found or not authorised", 404);

  let buildingName = "Body Corporate";
  const { data: b } = await db.from("buildings").select("data").eq("id", p.building_id).maybeSingle();
  if (b?.data?.name) buildingName = String(b.data.name);

  // status for the watermark: dates are Brisbane-local
  const today = todayBrisbane();
  let status = String(p.status || "active");
  if (status === "active" && p.date_to && today > p.date_to) status = "expired";

  const url = VERIFY_BASE + p.id;
  const q = qrcode(0, "M"); q.addData(url); q.make();
  const n = q.getModuleCount();
  const qrMatrix = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));

  const vehicle = [p.vehicle_colour, p.vehicle_make, p.vehicle_model].filter(Boolean).join(" ") || "—";
  const bytes = await buildPermitPdf({ PDFDocument, StandardFonts, rgb, degrees }, {
    permitNo: String(p.permit_no || "PERMIT"), buildingName,
    unit: String(p.unit_number || "—"), vehicle, rego: String(p.vehicle_rego || "").toUpperCase() || "—",
    dateFrom: fmtShort(p.date_from), dateTo: fmtLong(p.date_to), approved: fmtLong(p.approval_date) || "—",
    status, kindLabel: "Visitor parking permit", verifyUrl: url, qrMatrix,
  }, { logoPng: await fetchPng("permit-logo-light.png"), photoPng: p.building_id === CURVE_ID ? await fetchPng("permit-photo-curve.png") : null });

  return new Response(bytes, {
    headers: { ...cors, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${p.permit_no || "parking-permit"}.pdf"` },
  });
});
