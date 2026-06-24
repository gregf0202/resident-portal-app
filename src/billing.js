// Pure billing math — shared by the Billing panel. Mirrors the Billing Designer.
export const CYCLE_MONTHS = { monthly: 1, quarterly: 3, annual: 12 };

const round = (n) => Math.round(((n || 0) + Number.EPSILON) * 100) / 100;
const addMonths = (d, n) => { const x = new Date(d); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < day) x.setDate(0); return x; };
const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const parseD = (v) => { if (!v) return null; const d = new Date(typeof v === "string" ? v + "T00:00:00" : v); return isNaN(d) ? null : d; };
export const iso = (d) => d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null;
export const money = (n, cur = "AUD") => new Intl.NumberFormat("en-AU", { style: "currency", currency: cur }).format(isFinite(n) ? n : 0);

const tierAnnual = (cfg, tiers) => { const t = (tiers || []).find((x) => x.id === cfg.tier_id); return t ? Number(t.annual_price) : 0; };
const tierName = (cfg, tiers) => { const t = (tiers || []).find((x) => x.id === cfg.tier_id); return t ? t.name : "—"; };

export function periodBreakdown(cfg, tiers) {
  const cm = CYCLE_MONTHS[cfg.cycle] || 3;
  const base = tierAnnual(cfg, tiers) * (cm / 12);
  const cd = Number(cfg.cycle_discount_pct) || 0, td = Number(cfg.term_discount_pct) || 0;
  const afterCycle = base * (1 - cd / 100);
  const afterTerm = afterCycle * (1 - td / 100);
  let special = 0, spLabel = "";
  const start = parseD(cfg.service_start) || new Date();
  const exp = cfg.special_expiry ? parseD(cfg.special_expiry) : null;
  const expired = exp && exp < start;
  const spVal = Number(cfg.special_value) || 0;
  if (cfg.special_type && cfg.special_type !== "none" && spVal > 0 && !expired) {
    if (cfg.special_type === "pct") { special = afterTerm * (spVal / 100); spLabel = `${spVal}% special${cfg.special_reason ? ` — ${cfg.special_reason}` : ""}`; }
    else { special = Math.min(spVal, afterTerm); spLabel = `Special${cfg.special_reason ? ` — ${cfg.special_reason}` : ""}`; }
  }
  const net = Math.max(0, afterTerm - special);
  return { cm, base, cd, td, cdAmt: base - afterCycle, tdAmt: afterCycle - afterTerm, special, spLabel, net, expired: (cfg.special_type !== "none" && spVal > 0 && !!expired) };
}

export function gstWrap(subtotal, cfg) {
  const rate = (Number(cfg.gst_rate) || 0) / 100, mode = cfg.gst_mode;
  if (mode === "none") return { gst: 0, total: subtotal, exgst: subtotal, note: "No GST" };
  if (mode === "incl") { const ex = subtotal / (1 + rate); return { gst: subtotal - ex, total: subtotal, exgst: ex, note: "GST included" }; }
  return { gst: subtotal * rate, total: subtotal * (1 + rate), exgst: subtotal, note: "plus GST" };
}

function buildInvoice(cfg, tiers, pb, periodStart, periodEnd, issue, terms, proRata, referralCredit) {
  const sub = pb.net * proRata;
  const afterRef = Math.max(0, sub - referralCredit);
  const g = gstWrap(afterRef, cfg);
  const lines = [];
  lines.push({ label: `${tierName(cfg, tiers)} — ${cfg.cycle} base`, amount: round(pb.base) });
  if (pb.cdAmt > 0) lines.push({ label: `Prepay/cycle discount (${pb.cd}%)`, amount: -round(pb.cdAmt) });
  if (pb.tdAmt > 0) lines.push({ label: `Commitment discount (${pb.td}%)`, amount: -round(pb.tdAmt) });
  if (pb.special > 0) lines.push({ label: pb.spLabel, amount: -round(pb.special) });
  if (proRata < 1) lines.push({ label: `Pro-rata for part period (${Math.round(proRata * 1000) / 10}%)`, amount: -round(pb.net - sub) });
  if (referralCredit > 0) lines.push({ label: "Referral bonus credit", amount: -round(referralCredit) });
  if (g.gst > 0) lines.push({ label: `GST (${cfg.gst_rate}%, ${g.note})`, amount: round(g.gst) });
  const discountTotal = round(pb.cdAmt + pb.tdAmt + pb.special + (proRata < 1 ? (pb.net - sub) : 0) + referralCredit);
  const due = new Date(issue.getTime() + (Number(terms) || 0) * 86400000);
  return { periodStart, periodEnd, issueDate: issue, dueDate: due, lines, subtotal: round(afterRef), gst: round(g.gst), total: round(g.total), discountTotal, proRata };
}

export function computeBilling(cfg, tiers) {
  const pb = periodBreakdown(cfg, tiers);
  const cm = pb.cm;
  const start = parseD(cfg.service_start) || new Date();
  let firstBill = parseD(cfg.first_billing_date);
  const terms = Number(cfg.payment_terms_days) || 0;
  let proRata = 1, firstStart = start, firstEnd = addMonths(start, cm);
  if (firstBill && firstBill > start) {
    const fullRef = daysBetween(addMonths(firstBill, -cm), firstBill);
    proRata = Math.min(1, Math.max(0, daysBetween(start, firstBill) / fullRef));
    firstStart = start; firstEnd = firstBill;
  } else { firstBill = addMonths(start, cm); }
  const refMonths = Number(cfg.referral_free_months) || 0;
  const perMonthNet = pb.net * (1 / cm);
  let refCredit = 0, refCarry = 0;
  if (refMonths > 0) { const want = perMonthNet * refMonths; const firstSub = pb.net * proRata; refCredit = Math.min(want, firstSub); refCarry = want - refCredit; }
  const first = buildInvoice(cfg, tiers, pb, firstStart, firstEnd, firstStart, terms, proRata, refCredit);
  const recurring = buildInvoice(cfg, tiers, pb, firstBill, addMonths(firstBill, cm), firstBill, terms, 1, 0);
  const periodsPerYear = 12 / cm;
  const annualEffective = pb.net * periodsPerYear;
  const listAnnual = tierAnnual(cfg, tiers);
  return { tierName: tierName(cfg, tiers), pb, first, recurring, refCarry: round(refCarry), annualEffective: round(annualEffective), listAnnual: round(listAnnual), saving: round(listAnnual - annualEffective) };
}
