import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Play, Pause, Check } from "lucide-react";

/*
  GuidedTour — spotlight walkthrough engine.
  Steps are supplied by the app (role- & module-filtered). Each step may:
    - target: a [data-tour="..."] element to spotlight (falls back to "main-content", then a centered card)
    - view:   a view key to navigate to before highlighting (via onNavigate)
    - centered: force a centered card with full dim (welcome / finale)
  When a step navigates to a view, BOTH the nav item and the main content are
  revealed (dual spotlight via SVG mask) so users see the page being talked
  about. Auto-advances at a gentle pace with a prominent Pause, Back / Next,
  progress dots and Esc-to-skip. Fully themed via T.
*/

const ADVANCE_MS = 12000; // gentle pace — readable for non-technical users
const PAD = 8;
const CARD_W = 344;
const DIM = "rgba(4,10,20,0.66)";
const rgba = (hex, a) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const clampRect = (r, vw, vh) => { const left = Math.max(r.left, 4), top = Math.max(r.top, 4); return { left, top, width: Math.min(r.right, vw - 4) - left, height: Math.min(r.bottom, vh - 4) - top }; };

export default function GuidedTour({ steps, T, onNavigate, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);      // primary target (e.g. nav item)
  const [rect2, setRect2] = useState(null);    // main content, when the step opens a view
  const [playing, setPlaying] = useState(true);
  const elRef = useRef(null);
  const el2Ref = useRef(null);
  const n = steps.length;
  const step = steps[Math.min(i, n - 1)] || { centered: true, title: "", body: "" };
  const last = i >= n - 1;

  const finish = useCallback(() => onClose(), [onClose]);
  const next = useCallback(() => setI((x) => Math.min(x + 1, n - 1)), [n]);
  const back = () => { setPlaying(false); setI((x) => Math.max(x - 1, 0)); };

  // Locate + measure targets after navigating; retry while the view mounts.
  useEffect(() => {
    setRect(null); setRect2(null); elRef.current = null; el2Ref.current = null;
    if (step.view) onNavigate(step.view);
    if (step.centered) return;
    let tries = 0, t;
    const find = () => {
      let el = step.target && document.querySelector(`[data-tour="${step.target}"]`);
      if (!(el && el.getBoundingClientRect().width > 0)) el = step.view ? document.querySelector('[data-tour="main-content"]') : null;
      if (el && el.getBoundingClientRect().width > 0) {
        elRef.current = el;
        // also reveal the page the step opened, so users see what's being described
        const c = step.view ? document.querySelector('[data-tour="main-content"]') : null;
        el2Ref.current = c && c !== el ? c : null;
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        t = setTimeout(() => { if (elRef.current) { setRect(elRef.current.getBoundingClientRect()); setRect2(el2Ref.current ? el2Ref.current.getBoundingClientRect() : null); } }, 360);
      } else if (tries++ < 14) t = setTimeout(find, 90);
    };
    t = setTimeout(find, 60);
    return () => clearTimeout(t);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the spotlights glued to their targets on resize / scroll.
  useEffect(() => {
    const re = () => { if (elRef.current) setRect(elRef.current.getBoundingClientRect()); if (el2Ref.current) setRect2(el2Ref.current.getBoundingClientRect()); };
    window.addEventListener("resize", re); window.addEventListener("scroll", re, true);
    return () => { window.removeEventListener("resize", re); window.removeEventListener("scroll", re, true); };
  }, []);

  // Auto-advance (pauses on the final card).
  useEffect(() => {
    if (!playing || last) return;
    const t = setTimeout(next, ADVANCE_MS);
    return () => clearTimeout(t);
  }, [i, playing, last, next]);

  // Keyboard: arrows navigate, space pauses, Esc closes.
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") finish(); if (e.key === "ArrowRight") { setPlaying(false); next(); } if (e.key === "ArrowLeft") back(); if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [finish, next]); // eslint-disable-line react-hooks/exhaustive-deps

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = Math.min(CARD_W, vw - 24);
  const holes = [];
  if (rect && !step.centered) holes.push(clampRect({ left: rect.left - PAD, top: rect.top - PAD, right: rect.right + PAD, bottom: rect.bottom + PAD }, vw, vh));
  if (rect2 && !step.centered) holes.push(clampRect({ left: rect2.left - 4, top: rect2.top - 4, right: rect2.right + 4, bottom: rect2.bottom + 4 }, vw, vh));

  // Callout placement: beside the target when it hugs the left edge (nav items),
  // otherwise below/above; centered when there's no target.
  let cardPos;
  if (rect && !step.centered) {
    if (rect.right + w + 28 < vw && rect.left < vw / 3) {
      cardPos = { top: Math.min(Math.max(12, rect.top - 12), vh - 300), left: rect.right + 20 };
    } else {
      const below = rect.bottom + PAD + 16;
      const top = below + 260 < vh ? below : Math.max(12, rect.top - PAD - 270);
      const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), vw - w - 12);
      cardPos = { top, left };
    }
  } else {
    cardPos = { top: Math.max(12, vh / 2 - 180), left: vw / 2 - w / 2 };
  }
  const Icon = step.icon;
  const trans = "all 520ms cubic-bezier(.4,0,.2,1)";

  return (
    <div className="fixed inset-0" style={{ zIndex: 96 }}>
      <style>{`
        @keyframes nalo-tour-bar { from { width: 0% } to { width: 100% } }
        @keyframes nalo-tour-pulse { 0% { box-shadow: 0 0 0 0 ${rgba(T.accent, 0.55)} } 70% { box-shadow: 0 0 0 12px ${rgba(T.accent, 0)} } 100% { box-shadow: 0 0 0 0 ${rgba(T.accent, 0)} } }
        @keyframes nalo-tour-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      {/* click-catcher: blocks the app while touring; a click pauses so people can read */}
      <div className="absolute inset-0" onClick={() => setPlaying(false)} />
      {/* dim layer with spotlight holes cut out via SVG mask */}
      <svg width="100%" height="100%" className="absolute inset-0" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="nalo-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            {holes.map((h, k) => (
              <rect key={k} x={h.left} y={h.top} width={Math.max(h.width, 0)} height={Math.max(h.height, 0)} rx="14" fill="#000" style={{ transition: trans }} />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill={DIM} mask="url(#nalo-tour-mask)" style={{ transition: "opacity 400ms" }} />
      </svg>
      {/* accent rings over the holes: pulsing on the primary target, quiet on the content */}
      {holes[0] && <div style={{ position: "fixed", ...holes[0], borderRadius: 14, pointerEvents: "none", border: `2px solid ${T.accent}`, transition: trans, animation: "nalo-tour-pulse 2s ease-out infinite" }} />}
      {holes[1] && <div style={{ position: "fixed", ...holes[1], borderRadius: 14, pointerEvents: "none", border: `1.5px solid ${rgba(T.accent, 0.5)}`, transition: trans }} />}
      {/* callout card */}
      <div key={i} style={{ position: "fixed", width: w, ...cardPos, transition: "top 520ms cubic-bezier(.4,0,.2,1), left 520ms cubic-bezier(.4,0,.2,1)", animation: "nalo-tour-in 340ms ease-out", background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.5)", overflow: "hidden" }}>
        {/* auto-advance progress */}
        <div style={{ height: 3, background: T.surfaceAlt }}>
          {playing && !last && <div key={`bar-${i}`} style={{ height: "100%", background: `linear-gradient(90deg, ${T.accent}, ${T.accent2})`, animation: `nalo-tour-bar ${ADVANCE_MS}ms linear forwards` }} />}
        </div>
        <div className="px-4 pt-3.5 pb-4">
          <div className="flex items-center gap-3">
            {Icon && <span className="h-9 w-9 rounded-xl grid place-items-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, boxShadow: `0 6px 16px ${rgba(T.accent2, 0.35)}` }}><Icon size={18} /></span>}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: T.textMuted }}>{step.chip || `Step ${i + 1} of ${n}`}</div>
              <div className="font-bold text-[15px] leading-snug">{step.title}</div>
            </div>
            <button onClick={finish} title="Skip tour" className="p-1.5 rounded-lg shrink-0" style={{ color: T.textMuted }}><X size={16} /></button>
          </div>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: T.textMuted }}>{step.body}</p>
          {step.list && (
            <ul className="mt-2.5 space-y-1.5">
              {step.list.map((it, k) => (
                <li key={k} className="flex items-start gap-2 text-sm"><Check size={14} className="mt-0.5 shrink-0" style={{ color: T.accent }} /><span style={{ color: T.text }}>{it}</span></li>
              ))}
            </ul>
          )}
          {/* progress dots */}
          <div className="flex items-center gap-1 mt-3.5">
            {steps.map((_, k) => (
              <button key={k} onClick={() => { setPlaying(false); setI(k); }} className="rounded-full" style={{ height: 6, width: k === i ? 16 : 6, background: k === i ? T.accent : rgba(T.accent, 0.25), transition: "all 250ms" }} />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            {!last && (
              <button onClick={() => setPlaying((p) => !p)} className="flex-1 px-3 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2" style={playing ? { background: rgba(T.accent, 0.14), border: `1.5px solid ${T.accent}`, color: T.text } : { background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, border: "1.5px solid transparent", color: "#fff" }}>
                {playing ? <><Pause size={16} style={{ color: T.accent }} /> Pause &amp; look around</> : <><Play size={16} /> Resume tour</>}
              </button>
            )}
            <button onClick={back} disabled={i === 0} className="p-2.5 rounded-xl" style={{ border: `1px solid ${T.border}`, color: T.text, opacity: i === 0 ? 0.4 : 1 }} title="Back"><ChevronLeft size={16} /></button>
            <button onClick={last ? finish : () => { setPlaying(false); next(); }} className={`px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-1 ${last ? "flex-1 justify-center" : ""}`} style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})` }}>
              {last ? "Let's go" : "Next"} {!last && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
