import React, { useEffect, useState } from "react";
import { T } from "../theme.js";
import AnimatedHeader from "./AnimatedHeader.jsx";
import { Card, Btn, Field, Input, Select, Badge, Empty } from "./ui.jsx";
import BillingPanel from "./BillingPanel.jsx";
import { loadAllBuildings, createBuilding, joinAsAdmin, listMembers, addMember, addMembersBulk, updateMember, removeMember, sendInvite, sendInvites } from "../db.js";
import { parseCSV, toCSV, downloadCSV, readFileText } from "../csv.js";

const ROLES = [["bcc", "Committee"], ["admin", "Administrator"], ["manager", "Building manager"], ["strata", "Strata manager"], ["owner", "Owner"], ["tenant", "Tenant"]];

export default function PlatformConsole({ authUser, profileName, onOpen, onSignOut }) {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ name: "", address: "", units: "", floors: "", towers: "1", themeId: "midnight" });
  const [managing, setManaging] = useState(null); // building id whose members panel is open
  const [billingFor, setBillingFor] = useState(null); // building id whose billing panel is open

  const refresh = async () => {
    setLoading(true); setErr("");
    try { setBuildings(await loadAllBuildings(authUser)); }
    catch (e) { setErr(e.message || String(e)); }
    setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const create = async () => {
    if (!nf.name.trim()) return;
    try { const bid = await createBuilding(nf, authUser); setShowNew(false); setNf({ name: "", address: "", units: "", floors: "", towers: "1", themeId: "midnight" }); await refresh(); onOpen(bid); }
    catch (e) { setErr(e.message || String(e)); }
  };
  const open = async (b) => {
    try { if (!b.isMember) await joinAsAdmin(b.id, authUser); onOpen(b.id); }
    catch (e) { setErr(e.message || String(e)); }
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(165deg, ${T.bg}, #0c1320)`, color: T.text }}>
      <AnimatedHeader>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "26px 18px 64px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>Platform console</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 26, color: "#fff" }}>Your buildings</h1>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>Signed in as {profileName}</div>
          </div>
          <button onClick={onSignOut} style={{ background: "transparent", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "6px 10px" }}>Sign out</button>
        </div>
      </AnimatedHeader>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "20px 18px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ color: T.textMuted, fontSize: 14 }}>{buildings.length} building{buildings.length === 1 ? "" : "s"}</div>
          <Btn onClick={() => setShowNew((v) => !v)}>{showNew ? "Close" : "+ New building"}</Btn>
        </div>

        {err && <Card style={{ padding: 12, marginBottom: 12, borderColor: "#f87171", color: "#f87171" }}>{err}</Card>}

        {showNew && (
          <Card style={{ padding: 18, marginBottom: 16 }}>
            <Field label="Building name"><Input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="e.g. Sunset Towers" /></Field>
            <Field label="Address"><Input value={nf.address} onChange={(e) => setNf({ ...nf, address: e.target.value })} placeholder="e.g. 5 Bay St, Hamilton QLD" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="Units"><Input type="number" value={nf.units} onChange={(e) => setNf({ ...nf, units: e.target.value })} /></Field>
              <Field label="Floors"><Input type="number" value={nf.floors} onChange={(e) => setNf({ ...nf, floors: e.target.value })} /></Field>
              <Field label="Towers"><Input type="number" value={nf.towers} onChange={(e) => setNf({ ...nf, towers: e.target.value })} /></Field>
            </div>
            <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 10 }}>You'll be added as Administrator and taken straight in. You can edit everything else in Settings.</div>
            <Btn onClick={create}>Create building</Btn>
          </Card>
        )}

        {loading ? <Empty title="Loading…" hint="Fetching your buildings." />
          : buildings.length === 0 ? <Empty title="No buildings yet" hint="Create your first building above." />
          : buildings.map((b) => (
            <Card key={b.id} style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{b.name}</div>
                  <div style={{ color: T.textMuted, fontSize: 13 }}>{b.address || "No address set"}</div>
                </div>
                <Badge color={T.accent}>{b.members} member{b.members === 1 ? "" : "s"}</Badge>
                <Btn kind="ghost" onClick={() => setManaging(managing === b.id ? null : b.id)}>Members</Btn>
                <Btn kind="ghost" onClick={() => setBillingFor(billingFor === b.id ? null : b.id)}>Billing</Btn>
                <Btn onClick={() => open(b)}>{b.isMember ? "Open" : "Join & open"}</Btn>
              </div>
              {managing === b.id && <MembersPanel bid={b.id} onChanged={refresh} />}
              {billingFor === b.id && <BillingPanel bid={b.id} building={{ name: b.name, address: b.address }} />}
            </Card>
          ))}
      </div>
    </div>
  );
}

const USER_CSV_HEADERS = ["email", "full_name", "unit", "role"];

// Derive a friendly access state from a member row.
function memberState(u) {
  if (u.status === "active") return { key: "access", label: "User has access", color: "#34d399" };
  if (u.invited_at) return { key: "invited", label: "Invite sent", color: "#fbbf24" };
  return { key: "new", label: "Not invited", color: "#9fb2c8" };
}

function MembersPanel({ bid, onChanged }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState({ email: "", full_name: "", role: "owner", unit: "" });
  const [editId, setEditId] = useState(null);          // member being edited
  const [ed, setEd] = useState({ email: "", full_name: "", role: "owner", unit: "" });

  const load = async () => { setLoading(true); try { setMembers(await listMembers(bid)); } catch (e) { setErr(e.message); } setLoading(false); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bid]);

  const flash = (msg) => { setNote(msg); setErr(""); window.clearTimeout(window.__mp); window.__mp = window.setTimeout(() => setNote(""), 4000); };

  const add = async () => {
    if (!m.email.trim()) return;
    setBusy(true); setErr("");
    try {
      await addMember(bid, m);
      setM({ email: "", full_name: "", role: "owner", unit: "" });
      await load(); onChanged && onChanged();
      flash("Member added (no email sent). Use Send invite when you're ready.");
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const startEdit = (u) => { setEditId(u.id); setEd({ email: u.email || "", full_name: u.full_name || "", role: u.role || "owner", unit: u.unit || "" }); };
  const cancelEdit = () => { setEditId(null); };
  const saveEdit = async (id) => {
    setBusy(true); setErr("");
    try { await updateMember(id, ed); setEditId(null); await load(); onChanged && onChanged(); flash("Member updated"); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const invite = async (u) => {
    setBusy(true); setErr("");
    const res = await sendInvite(u);
    await load();
    setBusy(false);
    flash(res.ok ? `Invite sent to ${u.email}` : `Couldn't send: ${res.reason}`);
  };
  const inviteAll = async () => {
    const pending = members.filter((u) => u.status !== "active");
    if (!pending.length) { flash("Everyone already has access."); return; }
    setBusy(true); setErr("");
    const { sent, failures } = await sendInvites(pending);
    await load();
    setBusy(false);
    flash(`${sent} invite(s) sent${failures.length ? ` · ${failures.length} failed` : ""}.`);
  };
  const remove = async (id) => { try { await removeMember(id); await load(); onChanged && onChanged(); } catch (e) { setErr(e.message); } };

  const downloadTemplate = () => {
    const sample = [
      { email: "owner@example.com", full_name: "Jane Owner", unit: "12", role: "owner" },
      { email: "tenant@example.com", full_name: "Sam Tenant", unit: "12", role: "tenant" },
    ];
    downloadCSV("nalohub-users-template.csv", toCSV(USER_CSV_HEADERS, sample));
  };
  const onUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-selecting same file
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const rows = parseCSV(await readFileText(file));
      const valid = ROLES.map(([v]) => v);
      const cleaned = rows.map((r) => ({
        email: r.email || "",
        full_name: r.full_name || r.name || "",
        unit: r.unit || "",
        role: valid.includes((r.role || "").toLowerCase()) ? r.role.toLowerCase() : "owner",
      })).filter((r) => r.email.trim());
      if (!cleaned.length) { setErr("No rows with an email found. Check the file matches the template."); setBusy(false); return; }
      const { added, skipped } = await addMembersBulk(bid, cleaned);
      await load(); onChanged && onChanged();
      flash(`${added} added${skipped ? `, ${skipped} skipped (duplicates/blank)` : ""}. No emails sent — send invites when ready.`);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };

  const labelBtn = { display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 13, fontWeight: 600 };

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
      {err && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 8 }}>{err}</div>}
      {note && <div style={{ color: "#34d399", fontSize: 13, marginBottom: 8 }}>{note}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 120, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textMuted }}>Members & invites</div>
        <button type="button" onClick={downloadTemplate} style={labelBtn}>Download CSV template</button>
        <label style={labelBtn}>Upload CSV<input type="file" accept=".csv,text/csv" onChange={onUpload} style={{ display: "none" }} /></label>
        <Btn onClick={inviteAll} disabled={busy}>Send all invites</Btn>
      </div>

      {loading ? <div style={{ color: T.textMuted }}>Loading…</div> : members.map((u) => {
        const st = memberState(u);
        return editId === u.id ? (
          <div key={u.id} style={{ padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Input placeholder="Email" value={ed.email} onChange={(e) => setEd({ ...ed, email: e.target.value })} />
              <Input placeholder="Name" value={ed.full_name} onChange={(e) => setEd({ ...ed, full_name: e.target.value })} />
              <Input placeholder="Unit (optional)" value={ed.unit} onChange={(e) => setEd({ ...ed, unit: e.target.value })} />
              <Select value={ed.role} onChange={(e) => setEd({ ...ed, role: e.target.value })}>
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Btn onClick={() => saveEdit(u.id)} disabled={busy}>Save</Btn>
              <Btn kind="ghost" onClick={cancelEdit}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 14 }}>{u.full_name || u.email}{u.unit ? ` · Unit ${u.unit}` : ""}</div>
              <div style={{ color: T.textMuted, fontSize: 12 }}>{u.email} · {ROLE_LABEL(u.role)}</div>
            </div>
            <Badge color={st.color}>{st.label}</Badge>
            {st.key !== "access" && <Btn kind="ghost" onClick={() => invite(u)} disabled={busy} style={{ padding: "6px 10px" }}>{st.key === "invited" ? "Resend" : "Send invite"}</Btn>}
            <Btn kind="ghost" onClick={() => startEdit(u)} style={{ padding: "6px 10px" }}>Edit</Btn>
            <Btn kind="danger" onClick={() => remove(u.id)} style={{ padding: "6px 10px" }}>Remove</Btn>
          </div>
        );
      })}

      <div style={{ marginTop: 12, padding: 12, background: T.surfaceAlt, borderRadius: 12, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Add one member</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Input placeholder="Email" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} />
          <Input placeholder="Name" value={m.full_name} onChange={(e) => setM({ ...m, full_name: e.target.value })} />
          <Input placeholder="Unit (optional)" value={m.unit} onChange={(e) => setM({ ...m, unit: e.target.value })} />
          <Select value={m.role} onChange={(e) => setM({ ...m, role: e.target.value })}>
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div style={{ color: T.textMuted, fontSize: 12, margin: "8px 0" }}>Added members get no email until you press Send invite — so you can prepare the whole building first, then release access.</div>
        <Btn onClick={add} disabled={busy}>Add member</Btn>
      </div>
    </div>
  );
}

const ROLE_LABEL = (r) => (ROLES.find(([v]) => v === r) || [r, r])[1];
