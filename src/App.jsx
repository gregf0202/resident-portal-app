import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import SignIn from "./components/SignIn.jsx";
import { AppCtx, BuildingApp, Toast, themeById } from "./ResidentPortal.jsx";
import { loadStore, persistChange } from "./db.js";

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

function Splash({ text }) {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#9fb2c8", background: "linear-gradient(165deg, #0a1019, #0c1320)", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>{text}</div>;
}

function NoBuilding({ email, onSignOut }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "linear-gradient(165deg, #0a1019, #0c1320)", color: "#e6edf5", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center", background: "#101d30", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>You're signed in</h2>
        <p style={{ color: "#9fb2c8" }}>{email} isn't linked to a building yet. Your committee adds residents by email — once you've been added, your building will appear here automatically.</p>
        <button onClick={onSignOut} style={{ background: "transparent", color: "#e6edf5", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px" }}>Sign out</button>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [store, setStore] = useState(null);
  const [buildingId, setBuildingId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setStore(null); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setErr("");
      try {
        const { store: st, buildingId: bid, currentUserId } = await loadStore(session.user);
        if (cancelled) return;
        setStore(st); setBuildingId(bid); setUserId(currentUserId);
      } catch (e) {
        if (!cancelled) setErr(e.message || String(e));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session]);

  const flash = (m) => { setToast(m); window.clearTimeout(window.__t); window.__t = window.setTimeout(() => setToast(null), 2600); };
  const update = (fn) => setStore((s) => {
    const n = structuredClone(s);
    fn(n);
    persistChange(s, n, buildingId).catch((e) => { console.error("Save failed:", e); flash("Couldn't save — check your connection"); });
    return n;
  });
  const signOut = () => supabase.auth.signOut();
  const openBuilding = (bid) => { setBuildingId(bid); setView("dashboard"); };

  if (session === undefined) return <Splash text="Loading…" />;
  if (!session) return <SignIn />;
  if (loading) return <Splash text="Loading your building…" />;
  if (err) return <Splash text={"Couldn't load: " + err} />;
  if (!store || !store.buildings.length) return <NoBuilding email={session.user.email} onSignOut={signOut} />;

  const building = store.buildings.find((b) => b.id === buildingId) || store.buildings[0];
  const user = store.users.find((u) => u.id === userId) || null;
  const T = themeById(building && building.themeId);

  const ctx = {
    store, update, T, building, buildingId, setBuildingId, user, userId, setUserId,
    view, setView, toast, flash, openBuilding, showGuide, setShowGuide,
    backend: true, signOut,
  };

  return (
    <AppCtx.Provider value={ctx}>
      <style>{KEYFRAMES}</style>
      <div style={{ background: `linear-gradient(165deg, ${T.appBg}, ${T.appBg2})`, color: T.text, minHeight: "100vh", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
        <BuildingApp />
        <Toast />
      </div>
    </AppCtx.Provider>
  );
}
