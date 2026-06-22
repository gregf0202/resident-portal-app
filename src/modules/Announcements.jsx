import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { T, SEM, fmtDate } from "../theme.js";
import { Card, Btn, Field, Input, Textarea, Select, Badge, Empty } from "../components/ui.jsx";

const NOTICE = ["General", "Notice of Meeting", "Special General Meeting", "AGM", "Meeting Minutes"];

export default function Announcements({ building, role, profileName }) {
  const canCommittee = ["bcc", "admin"].includes(role);
  const isStrata = role === "strata";
  const canPost = canCommittee || isStrata;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ title: "", body: "", notice_type: "General", audience: "all" });

  const load = async () => {
    setLoading(true); setErr("");
    const { data, error } = await supabase
      .from("announcements").select("*")
      .eq("building_id", building.id)
      .order("created_at", { ascending: false });
    if (error) setErr(error.message); else setList(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [building.id]);

  const post = async () => {
    if (!f.title.trim()) return;
    const payload = {
      building_id: building.id,
      title: f.title.trim(),
      body: f.body,
      author: profileName,
      notice_type: isStrata ? (f.notice_type === "General" ? "Notice of Meeting" : f.notice_type) : f.notice_type,
      audience: isStrata ? "owners" : f.audience,
    };
    const { error } = await supabase.from("announcements").insert(payload);
    if (error) { setErr(error.message); return; }
    setF({ title: "", body: "", notice_type: "General", audience: "all" });
    setShow(false); load();
  };

  const noticeOptions = isStrata ? NOTICE.filter((n) => n !== "General") : NOTICE;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Announcements</h2>
        {canPost && <Btn onClick={() => setShow((v) => !v)}>{show ? "Close" : "Post a notice"}</Btn>}
      </div>

      {err && <Card style={{ padding: 12, marginBottom: 12, borderColor: SEM.bad, color: SEM.bad }}>{err}</Card>}

      {show && canPost && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Lift maintenance this Friday" /></Field>
          <Field label="Details"><Textarea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Type">
              <Select value={f.notice_type} onChange={(e) => setF({ ...f, notice_type: e.target.value })}>
                {noticeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Audience">
              <Select value={isStrata ? "owners" : f.audience} disabled={isStrata} onChange={(e) => setF({ ...f, audience: e.target.value })}>
                <option value="all">Everyone</option>
                <option value="owners">Owners only</option>
              </Select>
            </Field>
          </div>
          {isStrata && <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>Strata managers post formal notices to owners.</div>}
          <Btn onClick={post}>Post notice</Btn>
        </Card>
      )}

      {loading ? <Empty title="Loading…" hint="Fetching announcements." />
        : list.length === 0 ? <Empty title="No announcements yet" hint={canPost ? "Post the first notice above." : "Check back soon."} />
        : list.map((a) => (
          <Card key={a.id} style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              {a.notice_type && a.notice_type !== "General" && <Badge color={T.accent}>{a.notice_type}</Badge>}
              {a.audience === "owners" && <Badge color={SEM.warn}>Owners</Badge>}
              <span style={{ fontSize: 12, color: T.textMuted, marginLeft: "auto" }}>{fmtDate(a.created_at)}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{a.title}</div>
            {a.body && <div style={{ color: T.textMuted, marginTop: 6, whiteSpace: "pre-wrap" }}>{a.body}</div>}
            {a.author && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>— {a.author}</div>}
          </Card>
        ))}
    </div>
  );
}
