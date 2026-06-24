import { jsPDF } from "jspdf";

const NAVY = [14, 42, 74];
const HARBOUR = [20, 80, 126];
const CYAN = [56, 189, 248];
const INK = [31, 45, 61];
const MUTED = [91, 113, 134];

const fmt = (n, cur) => new Intl.NumberFormat("en-AU", { style: "currency", currency: cur || "AUD" }).format(n || 0);
const dstr = (v) => {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v + (v.length === 10 ? "T00:00:00" : "")) : v;
  return isNaN(d) ? String(v) : d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
};

export function downloadInvoicePdf(invoice, issuer, billTo) {
  const cur = invoice.currency || "AUD";
  const iss = issuer || {};
  const bt = billTo || {};
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 15;
  let y = 0;

  // header band
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(...CYAN); doc.roundedRect(M, 7, 12, 12, 2.5, 2.5, "F");
  doc.setTextColor(6, 32, 50); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("N", M + 6, 15.5, { align: "center" });
  doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.text("NaloHub", M + 16, 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(207, 224, 242);
  doc.text("Community for every building", M + 16, 18.5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
  doc.text("TAX INVOICE", W - M, 14, { align: "right" });

  y = 36;
  // issuer (from)
  doc.setTextColor(...MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("FROM", M, y);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(iss.name || "NaloHub", M, y + 5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
  let iy = y + 10;
  if (iss.abn) { doc.text(`ABN ${iss.abn}`, M, iy); iy += 4.5; }
  if (iss.address) doc.splitTextToSize(iss.address, 80).forEach((ln) => { doc.text(ln, M, iy); iy += 4.5; });
  if (iss.email) { doc.text(iss.email, M, iy); iy += 4.5; }
  if (iss.phone) { doc.text(iss.phone, M, iy); iy += 4.5; }

  // bill to
  doc.setTextColor(...MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("BILL TO", W / 2, y);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(bt.name || "Building", W / 2, y + 5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
  let by = y + 10;
  if (bt.address) doc.splitTextToSize(bt.address, 80).forEach((ln) => { doc.text(ln, W / 2, by); by += 4.5; });

  // meta box
  y = Math.max(iy, by) + 6;
  doc.setDrawColor(228, 235, 243); doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y); y += 6;
  const meta = [["Invoice #", invoice.number || "—"], ["Issued", dstr(invoice.issue_date)], ["Due", dstr(invoice.due_date)], ["Period", `${dstr(invoice.period_start)} – ${dstr(invoice.period_end)}`]];
  doc.setFontSize(9);
  let mx = M;
  meta.forEach(([k, v]) => {
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.text(k, mx, y);
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.text(String(v), mx, y + 5);
    mx += (W - 2 * M) / meta.length;
  });
  y += 14;

  // line items header
  doc.setFillColor(...HARBOUR); doc.rect(M, y, W - 2 * M, 8, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Description", M + 3, y + 5.4);
  doc.text("Amount", W - M - 3, y + 5.4, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  (invoice.lines || []).forEach((l, i) => {
    if (i % 2 === 1) { doc.setFillColor(244, 247, 251); doc.rect(M, y, W - 2 * M, 7.5, "F"); }
    const neg = l.amount < 0;
    doc.setTextColor(neg ? 21 : INK[0], neg ? 128 : INK[1], neg ? 61 : INK[2]);
    doc.text(String(l.label), M + 3, y + 5);
    doc.text(fmt(l.amount, cur), W - M - 3, y + 5, { align: "right" });
    y += 7.5;
  });

  // totals
  y += 3; doc.setDrawColor(228, 235, 243); doc.line(W / 2, y, W - M, y); y += 6;
  const totalRow = (label, val, bold, big) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(big ? 13 : 10);
    doc.setTextColor(...(big ? NAVY : MUTED)); doc.text(label, W / 2 + 4, y);
    doc.setTextColor(...(big ? NAVY : INK)); doc.text(fmt(val, cur), W - M - 3, y, { align: "right" });
    y += big ? 9 : 6;
  };
  totalRow("Subtotal (ex GST)", invoice.subtotal, false, false);
  if (invoice.gst) totalRow("GST", invoice.gst, false, false);
  totalRow("Total due", invoice.total, true, true);

  // payment details
  y += 6;
  doc.setDrawColor(228, 235, 243); doc.line(M, y, W - M, y); y += 7;
  doc.setTextColor(...HARBOUR); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Payment details", M, y); y += 6;
  doc.setTextColor(...INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  const pay = iss.payment || "Payment instructions not set. Add them in Billing settings.";
  doc.splitTextToSize(pay, W - 2 * M).forEach((ln) => { doc.text(ln, M, y); y += 5; });

  if (iss.notes || invoice.notes) {
    y += 4; doc.setTextColor(...MUTED); doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.splitTextToSize(invoice.notes || iss.notes, W - 2 * M).forEach((ln) => { doc.text(ln, M, y); y += 4.5; });
  }

  // footer
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text("nalohub.com · info@nalohub.com", W / 2, 288, { align: "center" });

  doc.save(`Invoice-${invoice.number || "draft"}.pdf`);
}
