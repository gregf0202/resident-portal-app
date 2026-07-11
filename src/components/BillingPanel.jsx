import React, { useEffect, useMemo, useState } from "react";
import { T } from "../theme.js";
import { Btn, Field, Input, Select, Badge, Textarea } from "./ui.jsx";
import { loadTiers, updateTier, loadBuildingBilling, saveBuildingBilling, loadInvoices, createInvoice, setInvoiceStatus, loadPlatformSettings, savePlatformSettings } from "../db.js";
import { computeBilling, money, iso } from "../billing.js";
import { downloadInvoicePdf } from "../invoicePdf.js";

const todayISO = () => new Date().toISOString().slice(0, 10);
const defaults = (tiers) => ({
  tier_id: (tiers[1] || tiers[0] || {}).id || null,
  cycle: "quarterly", term_months: 12,
  cycle_discount_pct: 2, term_discount_pct: 0,
  special_type: "none", special_value: 0, special_reason: "", special_expiry: null,
  referral_free_months: 0, referral_source: "",
  service_start: todayISO(), first_billing_date: null,
  payment_terms_days: 14, gst_mode: "plus", gst_rate: 10, currency: "AUD",
  reminder_days: 3, overdue_days: 7, status: "trial", notes: "",
});
const STATUS_COLOR = { draft: "#9fb2c8", sent: "#38bdf8", paid: "#34d399", overdue: "#f87171", void: "#6b7280" };

export default function BillingPanel({ bid, building }) {
  const [tiers, setTiers] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const loadAll = async () => {
    setLoading(true); setErr("");
    try {
      const ts = await loadTiers();
      const existing = await loadBuildingBilling(bid);
      setTiers(ts);
      setCfg(existing ? { ...defaults(ts), ...existing } : defaults(ts));
      setInvoices(await loadInvoices(bid));
      setSettings(await loadPlatformSettings());
    } catch (e) { setErr(e.message || String(e)); }
    setLoading(false);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [bid]);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const calc = useMemo(() => (cfg && tiers.length ? computeBilling(cfg, tiers) : null), [cfg, tiers]);

  const save = async () => {
    setErr(""); setMsg("");
    try { await saveBuildingBilling(bid, cfg); setMsg("Billing saved."); setTimeout(() => setMsg(""), 1800); }
    catch (e) { setErr(e.message || String(e)); }
  };
  const saveTierPrice = async (id, price) => {
    try { await updateTier(id, { annual_price: Number(price) || 0 }); setTiers(await loadTiers()); }
    catch (e) { setErr(e.message || String(e)); }
  };
  const issue = async (which) => {
    const inv = which === "first" ? calc.first : calc.recurring;
    try {
      const billTo = { name: (building && building.name) || "Building", address: (building && building.address) || "" };
      await createInvoice(bid, {
        number: `INV-${String(invoices.length + 1).padStart(4, "0")}`,
        period_start: iso(inv.periodStart), period_end: iso(inv.periodEnd),
        issue_date: iso(inv.issueDate), due_date: iso(inv.dueDate),
        lines: inv.lines, subtotal: inv.subtotal, discount_total: inv.discountTotal,
        gst: inv.gst, total: inv.total, currency: cfg.currency, status: "draft",
        meta: { issuer: settings || {}, billTo },
      });
      setInvoices(await loadInvoices(bid)); setMsg("Invoice created (draft)."); setTimeout(() => setMsg(""), 1800);
    } catch (e) { setErr(e.message || String(e)); }
  };
  const mark = async (id, status) => { try { await setInvoiceStatus(id, status); setInvoices(await loadInvoices(bid)); } catch (e) { setErr(e.message); } };
  const saveSettings = async () => { try { await savePlatformSettings(settings || {}); setMsg("Business details saved."); setTimeout(() => setMsg(""), 1800); } catch (e) { setErr(e.message); } };
  const billTo = () => ({ name: (building && building.name) || "Building", address: (building && building.address) || "" });
  const pdfStored = (v) => downloadInvoicePdf(v, (v.meta && v.meta.issuer) || settings || {}, (v.meta && v.meta.billTo) || billTo());
  const pdfPreview = (inv) => downloadInvoicePdf({ number: "PREVIEW", period_start: iso(inv.periodStart), period_end: iso(inv.periodEnd), issue_date: iso(inv.issueDate), due_date: iso(inv.dueDate), lines: inv.lines, subtotal: inv.subtotal, gst: inv.gst, total: inv.total, currency: cfg.currency }, settings || {}, billTo());

  if (loading || !cfg) return <div style={{ marginTop: 14, color: T.textMuted, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>Loading billing…</div>;

  const sect = { marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 14 };
  const head = { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textMuted, marginBottom: 8 };
  const InvoiceCard = ({ inv, label }) => (
    <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, flex: 1, minWidth: 260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 700 }}>{label}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn kind="ghost" onClick={() => pdfPreview(inv)} style={{ padding: "5px 9px", fontSize: 12 }}>PDF</Btn>
          <Btn onClick={() => issue(label === "First invoice" || inv.proRata < 1 ? "first" : "recurring")} style={{ padding: "5px 9px", fontSize: 12 }}>Issue</Btn>
        </div>
      </div>
      <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 8 }}>
        {iso(inv.periodStart)} → {iso(inv.periodEnd)} · due {iso(inv.dueDate)}
      </div>
      {inv.lines.map((l, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", borderBottom: `1px dashed ${T.border}` }}>
          <span style={{ color: l.amount < 0 ? "#34d399" : T.text }}>{l.label}</span>
          <span style={{ color: l.amount < 0 ? "#34d399" : T.text }}>{l.amount < 0 ? "−" : ""}{money(Math.abs(l.amount), cfg.currency)}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 8, fontSize: 16 }}>
        <span>Total</span><span>{money(inv.total, cfg.currency)}</span>
      </div>
    </div>
  );

  return (
    <div style={sect}>
      {err && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>{err}</div>}
      {msg && <div style={{ color: "#34d399", fontSize: 13, marginBottom: 8 }}>{msg}</div>}

      {/* business + payment details */}
      <div style={head}>Business &amp; payment details (shown on every invoice)</div>
      <Btn kind="ghost" onClick={() => setSettingsOpen((o) => !o)} style={{ marginBottom: 8 }}>{settingsOpen ? "Hide" : "Edit"} business details</Btn>
      {settingsOpen && settings && (
        <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Trading name"><Input value={settings.name || ""} onChange={(e) => setSettings({ ...settings, name: e.target.value })} /></Field>
            <Field label="ABN"><Input value={settings.abn || ""} onChange={(e) => setSettings({ ...settings, abn: e.target.value })} /></Field>
          </div>
          <Field label="Business address"><Input value={settings.address || ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Email"><Input value={settings.email || ""} onChange={(e) => setSettings({ ...settings, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={settings.phone || ""} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></Field>
          </div>
          <Field label="Payment instructions (bank / BPAY / pay link)"><Textarea rows={3} value={settings.payment || ""} onChange={(e) => setSettings({ ...settings, payment: e.target.value })} /></Field>
          <Field label="Default invoice note"><Input value={settings.notes || ""} onChange={(e) => setSettings({ ...settings, notes: e.target.value })} /></Field>
          <Btn onClick={saveSettings}>Save business details</Btn>
        </div>
      )}

      {/* tiers */}
      <div style={head}>Pricing tiers (annual, ex-GST · platform-wide)</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 6 }}>
        {tiers.map((t) => (
          <div key={t.id} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
            <Input type="number" defaultValue={t.annual_price} onBlur={(e) => saveTierPrice(t.id, e.target.value)} style={{ marginTop: 6 }} />
          </div>
        ))}
      </div>

      {/* config */}
      <div style={head}>Configuration for this building</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="Tier"><Select value={cfg.tier_id || ""} onChange={(e) => set("tier_id", e.target.value)}>{tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <Field label="Cycle"><Select value={cfg.cycle} onChange={(e) => set("cycle", e.target.value)}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></Select></Field>
        <Field label="Term (months)"><Select value={cfg.term_months} onChange={(e) => set("term_months", Number(e.target.value))}><option value={12}>12</option><option value={24}>24</option><option value={36}>36</option></Select></Field>
        <Field label="Cycle discount %"><Input type="number" value={cfg.cycle_discount_pct} onChange={(e) => set("cycle_discount_pct", e.target.value)} /></Field>
        <Field label="Term discount %"><Input type="number" value={cfg.term_discount_pct} onChange={(e) => set("term_discount_pct", e.target.value)} /></Field>
        <Field label="Status"><Select value={cfg.status} onChange={(e) => set("status", e.target.value)}><option value="trial">Trial</option><option value="active">Active</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></Select></Field>
        <Field label="Special type"><Select value={cfg.special_type} onChange={(e) => set("special_type", e.target.value)}><option value="none">None</option><option value="pct">Percent %</option><option value="fixed">Fixed $</option></Select></Field>
        <Field label="Special value"><Input type="number" value={cfg.special_value} onChange={(e) => set("special_value", e.target.value)} /></Field>
        <Field label="Special expiry"><Input type="date" value={cfg.special_expiry || ""} onChange={(e) => set("special_expiry", e.target.value || null)} /></Field>
        <Field label="Special reason"><Input value={cfg.special_reason || ""} onChange={(e) => set("special_reason", e.target.value)} /></Field>
        <Field label="Referral free months"><Input type="number" value={cfg.referral_free_months} onChange={(e) => set("referral_free_months", e.target.value)} /></Field>
        <Field label="Referral source"><Input value={cfg.referral_source || ""} onChange={(e) => set("referral_source", e.target.value)} /></Field>
        <Field label="Service start"><Input type="date" value={cfg.service_start || ""} onChange={(e) => set("service_start", e.target.value)} /></Field>
        <Field label="First billing date"><Input type="date" value={cfg.first_billing_date || ""} onChange={(e) => set("first_billing_date", e.target.value || null)} /></Field>
        <Field label="Payment terms (days)"><Input type="number" value={cfg.payment_terms_days} onChange={(e) => set("payment_terms_days", e.target.value)} /></Field>
        <Field label="GST mode"><Select value={cfg.gst_mode} onChange={(e) => set("gst_mode", e.target.value)}><option value="plus">Add GST</option><option value="incl">Includes GST</option><option value="none">No GST</option></Select></Field>
        <Field label="GST rate %"><Input type="number" value={cfg.gst_rate} onChange={(e) => set("gst_rate", e.target.value)} /></Field>
        <Field label="Currency"><Select value={cfg.currency} onChange={(e) => set("currency", e.target.value)}><option>AUD</option><option>NZD</option></Select></Field>
      </div>
      <div style={{ marginTop: 10 }}><Btn onClick={save}>Save billing config</Btn></div>

      {/* preview */}
      {calc && (
        <>
          <div style={{ ...head, marginTop: 16 }}>Transparent preview</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <InvoiceCard inv={calc.first} label="First invoice" />
            <InvoiceCard inv={calc.recurring} label="Recurring invoice" />
          </div>
          <div style={{ background: "#0f1b2d", borderRadius: 10, padding: 12, marginTop: 10, fontSize: 13, color: "#dce9f6" }}>
            Billed <b>{cfg.cycle}</b> on <b>{calc.tierName}</b>, {cfg.term_months}-month term. Effective annual <b>{money(calc.annualEffective, cfg.currency)}</b> ex-GST{calc.saving > 0 ? <> — saving <b>{money(calc.saving, cfg.currency)}</b> vs list.</> : "."}{calc.refCarry > 0 ? <> Referral credit carried over: <b>{money(calc.refCarry, cfg.currency)}</b>.</> : null}
          </div>
          <div style={{ color: T.textMuted, fontSize: 12, marginTop: 8 }}>GST shown for modelling — confirm tax treatment with your accountant before issuing tax invoices.</div>
        </>
      )}

      {/* invoices */}
      <div style={{ ...head, marginTop: 16 }}>Issued invoices</div>
      {invoices.length === 0 ? <div style={{ color: T.textMuted, fontSize: 13 }}>None yet. Use “Issue” on a preview above.</div> :
        invoices.map((v) => (
          <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px dashed ${T.border}`, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{v.number} · {money(v.total, v.currency)}</div>
              <div style={{ color: T.textMuted, fontSize: 12 }}>{v.period_start} → {v.period_end} · due {v.due_date}</div>
            </div>
            <Badge color={STATUS_COLOR[v.status] || T.accent}>{v.status}</Badge>
            <Btn kind="ghost" onClick={() => pdfStored(v)} style={{ padding: "5px 9px", fontSize: 12 }}>PDF</Btn>
            {v.status !== "void" && <>
              {v.status === "draft" && <Btn kind="ghost" onClick={() => mark(v.id, "sent")} style={{ padding: "5px 9px", fontSize: 12 }}>Mark sent</Btn>}
              {v.status !== "paid" && <Btn onClick={() => mark(v.id, "paid")} style={{ padding: "5px 9px", fontSize: 12 }}>Mark paid</Btn>}
              <Btn kind="danger" onClick={() => mark(v.id, "void")} style={{ padding: "5px 9px", fontSize: 12 }}>Void</Btn>
            </>}
          </div>
        ))}
    </div>
  );
}
