import React, { useEffect, useState, useRef } from "react";
import { Smartphone, Share, Plus, MoreVertical, X, Check } from "lucide-react";

/*
  AddToHomeScreen
  ----------------
  Drop-in helper for the resident portal. It does three things:

  1. Gives the saved home-screen shortcut THIS building's own icon + name,
     by injecting <link rel="apple-touch-icon"> / icon / manifest at runtime
     from `building.logoImage` and `building.name`. (Baseline NaloHub icon in
     index.html is the fallback if a building has no logo, or on browsers that
     ignore data-URI icons.)
  2. Shows a friendly, dismissible first-visit card (remembered per device).
  3. Shows a step-by-step modal (iPhone vs Android) reachable any time from the
     floating "Add to Home Screen" button — and uses Chrome's native install
     prompt when available.

  Usage (in App.jsx, building mode):
      import AddToHomeScreen from "./components/AddToHomeScreen.jsx";
      ...
      <AddToHomeScreen building={building} />
*/

const BRAND = "#0e7490";

function detect() {
  const ua = navigator.userAgent || "";
  const iOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const standalone =
    window.matchMedia &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosInstalled = window.navigator.standalone === true;
  return { iOS, android, installed: standalone || iosInstalled };
}

export default function AddToHomeScreen({ building }) {
  const [open, setOpen] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [env] = useState(detect);
  const deferred = useRef(null);
  const name = (building && building.name) || "NaloHub";
  const logo = (building && building.logoImage) || "";

  // 1. Per-building home-screen icon, title and manifest
  useEffect(() => {
    if (!building) return;
    const head = document.head;

    const upsertLink = (rel) => {
      let el = head.querySelector(`link[data-nalo="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        el.setAttribute("data-nalo", rel);
        head.appendChild(el);
      }
      return el;
    };
    const upsertMeta = (n) => {
      let el = head.querySelector(`meta[name="${n}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", n);
        head.appendChild(el);
      }
      return el;
    };

    if (logo) {
      upsertLink("apple-touch-icon").setAttribute("href", logo);
      upsertLink("icon").setAttribute("href", logo);
    }
    upsertMeta("apple-mobile-web-app-title").setAttribute("content", name);
    upsertMeta("apple-mobile-web-app-capable").setAttribute("content", "yes");
    upsertMeta("mobile-web-app-capable").setAttribute("content", "yes");
    document.title = name + " — NaloHub";

    // Dynamic manifest (Android/Chrome) so the install carries the building name + icon
    try {
      const manifest = {
        name,
        short_name: name.slice(0, 12),
        display: "standalone",
        background_color: "#0a1422",
        theme_color: BRAND,
        start_url: ".",
        icons: logo
          ? [
              { src: logo, sizes: "192x192", type: "image/png", purpose: "any maskable" },
              { src: logo, sizes: "512x512", type: "image/png", purpose: "any maskable" },
            ]
          : [
              { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
              { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
            ],
      };
      const blob = new Blob([JSON.stringify(manifest)], {
        type: "application/manifest+json",
      });
      const url = URL.createObjectURL(blob);
      const ml = head.querySelector('link[rel="manifest"]') || (() => {
        const l = document.createElement("link");
        l.setAttribute("rel", "manifest");
        head.appendChild(l);
        return l;
      })();
      const prev = ml.getAttribute("href");
      ml.setAttribute("href", url);
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
    } catch (e) {
      /* manifest is best-effort */
    }
  }, [building, name, logo]);

  // 2. Capture Chrome's native install prompt
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      deferred.current = e;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // 3. First-visit card (once per device)
  useEffect(() => {
    if (env.installed) return;
    let seen = false;
    try {
      seen = localStorage.getItem("nalo_ath_seen") === "1";
    } catch (e) {}
    if (!seen) {
      const t = setTimeout(() => setShowCard(true), 1200);
      return () => clearTimeout(t);
    }
  }, [env.installed]);

  const dismissCard = () => {
    setShowCard(false);
    try {
      localStorage.setItem("nalo_ath_seen", "1");
    } catch (e) {}
  };
  const openHelp = () => {
    dismissCard();
    setOpen(true);
  };

  const nativeInstall = async () => {
    const e = deferred.current;
    if (!e) return;
    e.prompt();
    try {
      await e.userChoice;
    } catch (err) {}
    deferred.current = null;
    setOpen(false);
  };

  // Don't show anything when already running as an installed app
  if (env.installed) return null;

  const IconPreview = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 14px" }}>
      {logo ? (
        <img src={logo} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover" }} />
      ) : (
        <img src="/icon-192.png" alt="" style={{ width: 52, height: 52, borderRadius: 12 }} />
      )}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>Your building, one tap away</div>
      </div>
    </div>
  );

  const Step = ({ n, icon, children }) => (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", margin: "10px 0" }}>
      <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: BRAND, color: "#fff", fontWeight: 700, fontSize: 13, display: "grid", placeItems: "center" }}>{n}</span>
      <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.5, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{children} {icon}</div>
    </div>
  );

  const chip = { display: "inline-flex", alignItems: "center", gap: 4, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", fontWeight: 600 };

  return (
    <>
      {/* Floating, always-available launcher */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Add to Home Screen"
        style={{
          position: "fixed", right: 14, bottom: 14, zIndex: 80,
          display: "inline-flex", alignItems: "center", gap: 8,
          background: `linear-gradient(135deg, ${BRAND}, #22d3ee)`, color: "#04222e",
          border: "none", borderRadius: 999, padding: "10px 16px",
          fontWeight: 700, fontSize: 13, boxShadow: "0 6px 20px rgba(0,0,0,0.35)", cursor: "pointer",
        }}
      >
        <Smartphone size={16} /> Add to Home Screen
      </button>

      {/* First-visit card */}
      {showCard && (
        <div style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 81, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", width: "100%", maxWidth: 460, background: "#fff", color: "#1e293b", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.4)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Keep {name} one tap away</div>
              <button onClick={dismissCard} aria-label="Dismiss" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13.5, color: "#475569", margin: "6px 0 12px" }}>
              Add the portal to your phone's Home Screen for a one-tap, app-like shortcut with the building's own icon.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={openHelp} style={{ flex: 1, background: `linear-gradient(135deg, ${BRAND}, #22d3ee)`, color: "#04222e", border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}>Show me how</button>
              <button onClick={dismissCard} style={{ background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 14px", fontWeight: 600, cursor: "pointer" }}>Not now</button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions modal */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90, display: "grid", placeItems: "center", padding: 16, background: "rgba(0,0,0,0.6)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", color: "#1e293b", borderRadius: 18, overflow: "hidden", maxHeight: "88dvh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700 }}>Add to Home Screen</div>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 16, overflowY: "auto" }}>
              <IconPreview />

              {env.iOS && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>On iPhone / iPad (Safari)</div>
                  <Step n={1} icon={<Share size={16} color={BRAND} />}>Tap the <b>Share</b> button</Step>
                  <Step n={2} icon={<span style={chip}><Plus size={13} /> Add to Home Screen</span>}>Scroll down and tap <b>Add to Home Screen</b></Step>
                  <Step n={3} icon={<Check size={16} color={BRAND} />}>Tap <b>Add</b> — done</Step>
                </>
              )}

              {!env.iOS && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>On Android (Chrome)</div>
                  {deferred.current ? (
                    <>
                      <p style={{ fontSize: 14, color: "#475569" }}>Tap the button below and confirm <b>Install</b>.</p>
                      <button onClick={nativeInstall} style={{ width: "100%", background: `linear-gradient(135deg, ${BRAND}, #22d3ee)`, color: "#04222e", border: "none", borderRadius: 10, padding: "11px 14px", fontWeight: 700, cursor: "pointer" }}>Install app</button>
                    </>
                  ) : (
                    <>
                      <Step n={1} icon={<MoreVertical size={16} color={BRAND} />}>Tap the <b>⋮</b> menu (top-right of Chrome)</Step>
                      <Step n={2} icon={<span style={chip}><Plus size={13} /> Add to Home screen</span>}>Tap <b>Add to Home screen</b> (or <b>Install app</b>)</Step>
                      <Step n={3} icon={<Check size={16} color={BRAND} />}>Tap <b>Add</b> — done</Step>
                    </>
                  )}
                  <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 12 }}>
                    On a computer? Open this page on your phone's browser to add it there, or use your desktop browser's install icon in the address bar.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
