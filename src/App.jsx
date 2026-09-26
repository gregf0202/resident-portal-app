import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import SignIn from "./components/SignIn.jsx";
import PlatformConsole from "./components/PlatformConsole.jsx";
import { AppCtx, BuildingApp, Toast, themeById, UpdateBanner } from "./ResidentPortal.jsx";
import AddToHomeScreen from "./components/AddToHomeScreen.jsx";
import { loadProfile, loadMyMemberships, loadBuildingStore, persistChange, loadInvoices, loadPlatformSettings, logActivity } from "./db.js";
import { downloadInvoicePdf } from "./invoicePdf.js";
import { syncHandoff, tryHandoff } from "./handoff.js";
import { friendlyError, isPermissionError } from "./friendlyError.js";

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
// Shown when the signed-in person has no building, when their building could not be
// loaded, or when they no longer have access to it. Every version offers a way forward:
// try again, and sign out to use a different email.
function NoBuilding({ email, onSignOut, onRetry, kind }) {
  const btn = { background: "#64A5B7", color: "#0B2545", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, cursor: "pointer" };
  const ghost = { background: "transparent", color: "#e6edf5", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 14px", cursor: "pointer" };
  const copy = kind === "offline"
    ? { h: "We couldn't reach NaloHub", p: "Your building didn't load, usually because the connection dropped. Check you're online, then try again." }
    : kind === "noaccess"
    ? { h: "You no longer have access here", p: `${email} isn't an active member of this building any more. If that's a mistake, ask your committee to add you again, or sign out and use the email your committee has on file.` }
    : { h: "You're signed in", p: `${email} isn't linked to a building yet. If your committee has just added you, tap Check again. If they used a different email address, sign out and sign in with that one.` };
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: SBG, color: "#e6edf5", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center", background: "#101d30", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>{copy.h}</h2>
        <p style={{ color: "#9fb2c8" }}>{copy.p}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {onRetry && <button onClick={onRetry} style={btn}>{kind === "offline" ? "Try again" : "Check again"}</button>}
          <button onClick={onSignOut} style={ghost}>Sign out</button>
        </div>
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
  const [failKind, setFailKind] = useState(""); // "" | "offline" | "noaccess" (what NoBuilding explains)
  const [bootTick, setBootTick] = useState(0); // bumped by Try again / Check again to re-run the load
  // The signed-in person's id. The load effect keys on this, not on the session object:
  // Supabase hands over a NEW session object every time it refreshes the token (about
  // hourly), and keying on the object restarted the whole app and threw away whatever
  // the person was typing.
  const authUid = session && session.user ? session.user.id : null;

  useEffect(() => {
    // A Home Screen app opened for the first time has no session of its own; if iOS copied the
    // browser's hand-off cookie across, trade it for one before showing the sign-in screen.
    // session stays undefined (Splash) while that runs. See src/handoff.js.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session && await tryHandoff()) return; // onAuthStateChange delivers the new session
      setSession(data.session);
      syncHandoff(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "INITIAL_SESSION") return; // getSession above owns the first answer, so a hand-off is not pre-empted by a flash of the sign-in screen
      setSession(s); syncHandoff(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMode("boot"); setStore(null); setProfile(null); return; }
    let cancelled = false;
    (async () => {
      setMode("boot"); setErr(""); setFailKind("");
      try {
        const prof = await loadProfile(session.user);
        const mems = await loadMyMemberships(session.user);
        if (cancelled) return;
        setProfile(prof); setMyMems(mems);
        if (prof.is_platform_admin) { setMode("console"); return; }
        if (mems.length) { await enterBuilding(mems[0].building_id); return; }
        setMode("nobuilding");
      } catch (e) { if (!cancelled) { setErr(friendlyError(e)); setFailKind("offline"); setMode("nobuilding"); } }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [authUid, bootTick]);

  // Usage analytics Layer 1: one row per person, per building, per Brisbane day.
  // Must live up here with the other hooks, above the early returns below, so it
  // runs on every render path. `store.users` carries the role; logActivity itself
  // reads auth.uid() and de-duplicates, so this is safe to fire on every open.
  useEffect(() => {
    if (!buildingId || !userId) return;
    const me = store && store.users ? store.users.find((u2) => u2.id === userId) : null;
    logActivity(buildingId, me ? me.role : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId, userId]);

  const enterBuilding = async (bid) => {
    setMode("boot"); setErr("");
    try {
      const { store: st, buildingId: id, currentUserId } = await loadBuildingStore(bid, session.user);
      // loadBuildingStore falls back to the first member when the person's own row is
      // missing (for example, removed between two queries). Only a platform admin may be
      // let in that way; anyone else is told plainly rather than shown as someone else.
      const me = (st.users || []).find((u) => u.id === currentUserId);
      const isAdmin = !!(profile && profile.is_platform_admin);
      if (!isAdmin && (!me || me.authId !== session.user.id)) { setFailKind("noaccess"); setMode("nobuilding"); return; }
      setStore(st); setBuildingId(id); setUserId(currentUserId); setView("dashboard"); setMode("building");
      loadPlatformSettings().then(setIssuer).catch(() => {});
    } catch (e) { setErr(friendlyError(e)); setFailKind(profile?.is_platform_admin ? "" : "offline"); setMode(profile?.is_platform_admin ? "console" : "nobuilding"); }
  };

  const flash = (m) => { setToast(m); window.clearTimeout(window.__t); window.__t = window.setTimeout(() => setToast(null), 2600); };
  // Apply a change on screen at once, then save it. If the save fails, the change is
  // taken back off the screen (unless something newer has happened since) and the
  // person is told why in plain words: a permission refusal is not a connection fault.
  const update = (fn) => setStore((s) => {
    const n = structuredClone(s); fn(n);
    persistChange(s, n, buildingId).catch((e) => {
      console.error("Save failed:", e);
      setStore((cur) => (cur === n ? s : cur));
      flash(isPermissionError(e) ? "Only the committee can change that, so it wasn't saved." : "That didn't save, so it's been undone. Check your connection and try again.");
    });
    return n;
  });
  // Sign out of this device only. The default signs out every device, including the
  // Home Screen app, and offline it fails silently and leaves the person signed in.
  const signOut = async () => {
    try { await supabase.auth.signOut({ scope: "local" }); } catch (e) { /* still clear below */ }
    try { Object.keys(localStorage).filter((k) => /^sb-.*-auth-token$/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    syncHandoff(null);
    setStore(null); setProfile(null); setSession(null); setMode("boot");
  };
  const exitToConsole = () => { setStore(null); setMode("console"); };
  const openBuilding = (bid) => enterBuilding(bid);

  if (session === undefined) return <Splash text="Loading…" />;
  if (!session) return <SignIn />;
  if (mode === "boot") return <Splash text="Loading…" />;
  if (mode === "nobuilding") return <NoBuilding email={session.user.email} onSignOut={signOut} kind={failKind} onRetry={() => setBootTick((t) => t + 1)} />;
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
        {/* Offers a Refresh when the server reports a newer build. Lives here, not
            in ResidentPortal's default export, because that root is the demo app
            only — production mounts BuildingApp directly and would never see it. */}
        <UpdateBanner />
        <AddToHomeScreen building={building} />
      </div>
    </AppCtx.Provider>
  );
}
