import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { T, SEM, fmtDate } from "../theme.js";
import { Card, Btn, Field, Input, Textarea, Select, Badge, Empty } from "../components/ui.jsx";

const STATUS = {
  open: { label: "Open", color: SEM.warn },
  in_progress: { label: "In progress", color: T.accent },
  resolved: { label: "Resolved", color: SEM.ok },
};
const TYPES = ["General", "Electrical", "Plumbing", "Lifts", "Security", "Cleaning", "Grounds", "Structural"];

export default function Maintenance({ building, role, msc, profileName }) {
  const canMaint = ["bcc", "admin", "manager"].includes(role) || msc;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: "", description: "", type: "General" });
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true); setErr("");
    const { data, error } = await supabase
      .from("maintenance").select("*")
      .eq("building_id", building.id)
      .order("created_at", { ascending: false });
    if (error) setErr(error.message); else setList(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [building.id]);

  const raise = async () => {
    if (!f.title.trim()) return;
    const { error } = await supabase.from("maintenance").insert({
      building_id: building.id, title: f.title.trim(), description: f.description,
      type: f.type, status: "open", raised_by: profileName,
    });
    if (error) { setErr(error.message); return; }
    setF({ title: "", description: "", type: "General" }); setShow(false); load();
  };

  const setStatus = async (item, status) => {
    const { error } = await supabase.from("maintenance").update({ status }).eq("id", item.id);
    if (error) setErr(error.message); else load();
  };

  const addUpdate = async (item) => {
    if (!note.trim()) return;
    const updates = Array.isArray(item.updates) ? item.updates : [];
    const next = [...updates, { by: profileName, at: new Date().toISOString(), text: note.trim() }];
    const { error } = await supabase.from("maintenance").update({ updates: next }).eq("id", item.id);
    if (error) setErr(error.message); else { setNote(""); load(); }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Maintenance</h2>
        <Btn onClick={() => setShow((v) => !v)}>{show ? "Close" : "Report an issue"}</Btn>
      </div>

      {err && <Card style={{ padding: 12, marginBottom: 12, borderColor: SEM.bad, color: SEM.bad }}>{err}</Card>}

      {show && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <Field label="What's the issue?"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Foyer light flickering" /></Field>
          <Field label="Details (where, when)"><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Btn onClick={raise}>Submit report</Btn>
        </Card>
      )}

      {loading ? <Empty title="Loading…" hint="Fetching maintenance items." />
        : list.length === 0 ? <Empty title="Nothing reported" hint="Report the first issue above." />
        : list.map((m) => {
          const st = STATUS[m.status] || STATUS.open;
          const updates = Array.isArray(m.updates) ? m.updates : [];
          const isOpen = openId === m.id;
          return (
            <Card key={m.id} style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <Badge color={st.color}>{st.label}</Badge>
                {m.type && <Badge>{m.type}</Badge>}
                <span style={{ fontSize: 12, color: T.textMuted, marginLeft: "auto" }}>{fmtDate(m.created_at)}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{m.title}</div>
              {m.description && <div style={{ color: T.textMuted, marginTop: 6, whiteSpace: "pre-wrap" }}>{m.description}</div>}
              {m.raised_by && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>Raised by {m.raised_by}</div>}

              {updates.length > 0 && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: T.textMuted, marginBottom: 6 }}>Progress</div>
                  {updates.map((u, i) => (
                    <div key={i} style={{ fontSize: 14, marginBottom: 6 }}>
                      <span style={{ color: T.text }}>{u.text}</span>
                      <span style={{ color: T.textMuted, fontSize: 12 }}> — {u.by}, {fmtDate(u.at)}</span>
                    </div>
                  ))}
                </div>
              )}

              {canMaint && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                  {!isOpen ? (
                    <Btn kind="ghost" onClick={() => { setOpenId(m.id); setNote(""); }}>Update / triage</Btn>
                  ) : (
                    <div>
                      <Field label="Status">
                        <Select value={m.status} onChange={(e) => setStatus(m, e.target.value)}>
                          {Object.keys(STATUS).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                        </Select>
                      </Field>
                      <Field label="Add a progress update"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Electrician booked for Thursday." /></Field>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn onClick={() => addUpdate(m)}>Save update</Btn>
                        <Btn kind="ghost" onClick={() => setOpenId(null)}>Done</Btn>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
    </div>
  );
}
