import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import SignIn from "./components/SignIn.jsx";
import PlatformConsole from "./components/PlatformConsole.jsx";
import { AppCtx, BuildingApp, Toast, themeById } from "./ResidentPortal.jsx";
import AddToHomeScreen from "./components/AddToHomeScreen.jsx";
import { loadProfile, loadMyMemberships, loadBuildingStore, persistChange, loadInvoices, loadPlatformSettings } from "./db.js";
import { downloadInvoicePdf } from "./invoicePdf.js";

const KEYFRAMES = `
  @keyframes rpsun { 0%,100% { opacity:.75; transform:scale(1) } 50% { opacity:1; transform:scale(1.06) } }
  @keyframes rpcloud { from { transform:translateX(-15%) } to { transform:translateX(115%) } }
  @keyframes rpwave { from { transform:translateX(0) } to { transform:translateX(-50%) } }
  @keyframes rptwinkle { 0%,100% { opacity:.1; transform:scale(.6) } 50% { opacity:1; transform:scale(1.25) } }
  @keyframes rpfade { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
  .rp-twinkle { animation: rptwinkle 3s ease-in-out infinite; }
  .rp-fade { animation: rpfade .5s ease both; }
  .rp-hover { transition: transform .15s ease, box-shadow .15s ease; }
  .rp-hover:hover { transform: translateY(-2px); }
  @media (prefers-reduced-motion: reduce) { .rp-anim, .rp-twinkle, .rp-fade { animation: none !important; } }
`;

const SBG = "linear-gradient(165deg, #0a1019, #0c1320)";
function Splash({ text }) { return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#9fb2c8", background: SBG, padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>{text}</div>; }
function NoBuilding({ email, onSignOut }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: SBG, color: "#e6edf5", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center", background: "#101d30", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>You're signed in</h2>
        <p style={{ color: "#9fb2c8" }}>{email} isn't linked to a building yet. Once your committee adds you by email, your building appears here automatically.</p>
        <button onClick={onSignOut} style={{ background: "transparent", color: "#e6edf5", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px" }}>Sign out</button>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [issuer, setIssuer] = useState(null);
  const [myMems, setMyMems] = useState([]);
  const [mode, setMode] = useState("boot"); // boot | console | building | nobuilding
  const [store, setStore] = useState(null);
  const [buildingId, setBuildingId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMode("boot"); setStore(null); setProfile(null); return; }
    let cancelled = false;
    (async () => {
      setMode("boot"); setErr("");
      try {
        const prof = await loadProfile(session.user);
        const mems = await loadMyMemberships(session.user);
        if (cancelled) return;
        setProfile(prof); setMyMems(mems);
        if (prof.is_platform_admin) { setMode("console"); return; }
        if (mems.length) { await enterBuilding(mems[0].building_id); return; }
        setMode("nobuilding");
      } catch (e) { if (!cancelled) { setErr(e.message || String(e)); setMode("nobuilding"); } }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [session]);

  const enterBuilding = async (bid) => {
    setMode("boot"); setErr("");
    try {
      const { store: st, buildingId: id, currentUserId } = await loadBuildingStore(bid, session.user);
      setStore(st); setBuildingId(id); setUserId(currentUserId); setView("dashboard"); setMode("building");
      loadPlatformSettings().then(setIssuer).catch(() => {});
    } catch (e) { setErr(e.message || String(e)); setMode(profile?.is_platform_admin ? "console" : "nobuilding"); }
  };

  const flash = (m) => { setToast(m); window.clearTimeout(window.__t); window.__t = window.setTimeout(() => setToast(null), 2600); };
  const update = (fn) => setStore((s) => { const n = structuredClone(s); fn(n); persistChange(s, n, buildingId).catch((e) => { console.error("Save failed:", e); flash("Couldn't save — check your connection"); }); return n; });
  const signOut = () => supabase.auth.signOut();
  const exitToConsole = () => { setStore(null); setMode("console"); };
  const openBuilding = (bid) => enterBuilding(bid);

  if (session === undefined) return <Splash text="Loading…" />;
  if (!session) return <SignIn />;
  if (mode === "boot") return <Splash text="Loading…" />;
  if (mode === "nobuilding") return <NoBuilding email={session.user.email} onSignOut={signOut} />;
  if (mode === "console") {
    return <PlatformConsole authUser={session.user} profileName={profile?.full_name || session.user.email} onOpen={openBuilding} onSignOut={signOut} />;
  }

  // building mode
  if (!store || !store.buildings.length) return <Splash text={err ? "Couldn't load: " + err : "Loading…"} />;
  const building = store.buildings.find((b) => b.id === buildingId) || store.buildings[0];
  const user = store.users.find((u) => u.id === userId) || null;
  const T = themeById(building && building.themeId);
  const platformAdmin = !!(profile && profile.is_platform_admin);

  const ctx = {
    store, update, T, building, buildingId, setBuildingId, user, userId, setUserId,
    view, setView, toast, flash, openBuilding, showGuide, setShowGuide,
    backend: true, signOut, platformAdmin, exitToConsole,
    billing: {
      list: () => loadInvoices(buildingId),
      download: (inv) => {
        const chair = store.users.find((u2) => u2.buildingId === buildingId && u2.role === "bcc" && u2.status === "active") || store.users.find((u2) => u2.buildingId === buildingId && u2.role === "admin" && u2.status === "active");
        downloadInvoicePdf(inv, (inv.meta && inv.meta.issuer) || issuer || {}, (inv.meta && inv.meta.billTo) || { name: building.name, address: building.address, contact: chair ? chair.name : "", email: (chair && chair.email) || building.bccEmail || "" });
      },
    },
  };

  return (
    <AppCtx.Provider value={ctx}>
      <style>{KEYFRAMES}</style>
      <div style={{ background: `linear-gradient(165deg, ${T.appBg}, ${T.appBg2})`, color: T.text, minHeight: "100vh", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
        <BuildingApp />
        <Toast />
        <AddToHomeScreen building={building} />
      </div>
    </AppCtx.Provider>
  );
}
