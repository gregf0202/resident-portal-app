import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { T, SEM } from "./theme.js";
import AnimatedHeader from "./components/AnimatedHeader.jsx";
import SignIn from "./components/SignIn.jsx";
import { Card, Btn, Badge, Empty, Splash } from "./components/ui.jsx";
import Announcements from "./modules/Announcements.jsx";
import Maintenance from "./modules/Maintenance.jsx";

const ROLE_LABEL = { admin: "Administrator", bcc: "Committee", manager: "Building manager", strata: "Strata manager", owner: "Owner", tenant: "Tenant" };

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [view, setView] = useState("dashboard");
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMemberships([]); setProfile(null); return; }
    (async () => {
      setLoadingData(true);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setProfile(prof);
      const { data: mems } = await supabase
        .from("memberships")
        .select("building_id, role, msc, status, buildings(*)")
        .eq("user_id", session.user.id)
        .eq("status", "active");
      setMemberships(mems || []);
      if (mems && mems.length) setActiveId((prev) => prev || mems[0].building_id);
      setLoadingData(false);
    })();
  }, [session]);

  const signOut = () => supabase.auth.signOut();

  if (session === undefined) return <Splash text="Loading…" />;
  if (!session) return <SignIn />;
  if (loadingData) return <Splash text="Loading your building…" />;
  if (!memberships.length) return <NoBuilding email={session.user.email} onSignOut={signOut} />;

  const active = memberships.find((m) => m.building_id === activeId) || memberships[0];
  const building = active.buildings;
  const role = active.role;
  const msc = active.msc;
  const profileName = profile?.full_name || session.user.email;

  const NAV = [
    { key: "dashboard", label: "Dashboard" },
    { key: "announcements", label: "Announcements" },
    { key: "maintenance", label: "Maintenance" },
  ];

  return (
    <div>
      <AnimatedHeader>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "22px 16px 60px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>{ROLE_LABEL[role] || role}</div>
              <h1 style={{ margin: "4px 0 0", fontSize: 24, color: "#fff" }}>{building.name}</h1>
              {building.tower_desc && <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{building.tower_desc}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              {memberships.length > 1 && (
                <select value={activeId} onChange={(e) => setActiveId(e.target.value)}
                  style={{ background: "rgba(0,0,0,0.25)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "6px 8px", marginBottom: 8 }}>
                  {memberships.map((m) => <option key={m.building_id} value={m.building_id} style={{ color: "#000" }}>{m.buildings.name}</option>)}
                </select>
              )}
              <div><button onClick={signOut} style={{ background: "transparent", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "6px 10px" }}>Sign out</button></div>
            </div>
          </div>
        </div>
      </AnimatedHeader>

      <div style={{ position: "sticky", top: 0, zIndex: 20, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px", display: "flex", gap: 4 }}>
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setView(n.key)}
              style={{ background: "transparent", color: view === n.key ? T.accent : T.textMuted, fontWeight: view === n.key ? 700 : 500, border: "none", borderBottom: `2px solid ${view === n.key ? T.accent : "transparent"}`, padding: "12px 10px" }}>
              {n.label}
            </button>
          ))}
        </div>
      </div>

      {view === "dashboard" && <Dashboard building={building} role={role} name={profileName} go={setView} />}
      {view === "announcements" && <Announcements building={building} role={role} profileName={profileName} />}
      {view === "maintenance" && <Maintenance building={building} role={role} msc={msc} profileName={profileName} />}
    </div>
  );
}

function Dashboard({ building, role, name, go }) {
  const first = (name || "").split(/[ @]/)[0];
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>
      <h2 style={{ marginTop: 0 }}>Welcome back, {first}.</h2>
      <p style={{ color: T.textMuted, marginTop: -6 }}>You're signed in to {building.name}. Live data, secured to this building.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ fontWeight: 700 }}>Announcements</div>
          <div style={{ color: T.textMuted, fontSize: 14, margin: "6px 0 12px" }}>Notices for the building.</div>
          <Btn onClick={() => go("announcements")}>Open</Btn>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontWeight: 700 }}>Maintenance</div>
          <div style={{ color: T.textMuted, fontSize: 14, margin: "6px 0 12px" }}>Report and track issues.</div>
          <Btn onClick={() => go("maintenance")}>Open</Btn>
        </Card>
      </div>
    </div>
  );
}

function NoBuilding({ email, onSignOut }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <Card style={{ padding: 24, maxWidth: 420, textAlign: "center" }}>
        <h2 style={{ marginTop: 0 }}>You're signed in</h2>
        <p style={{ color: T.textMuted }}>{email} isn't linked to a building yet. Your committee adds residents by email — once you've been added, this page will show your building automatically.</p>
        <Btn kind="ghost" onClick={onSignOut}>Sign out</Btn>
      </Card>
    </div>
  );
}
