import React from "react";
import { T } from "../theme.js";

const waves = [
  { h: 70, o: 0.16, dur: 19, dir: "normal", d: "M0,34 C240,104 480,-8 720,44 C960,100 1200,-4 1440,40 L1440,120 L0,120 Z" },
  { h: 92, o: 0.11, dur: 29, dir: "reverse", d: "M0,52 C300,6 600,112 900,48 C1180,4 1320,96 1440,42 L1440,120 L0,120 Z" },
  { h: 66, o: 0.07, dur: 41, dir: "normal", d: "M0,70 C220,40 540,104 760,64 C1020,32 1260,96 1440,58 L1440,120 L0,120 Z" },
];

export default function AnimatedHeader({ children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${T.headerFrom}, ${T.headerVia}, ${T.headerTo})` }}>
      <div className="rp-anim" style={{ position: "absolute", top: -120, right: -120, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,250,232,0.18), transparent 70%)", animation: "rpsun 7s ease-in-out infinite", pointerEvents: "none" }} />
      <div className="rp-anim" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, overflow: "hidden", pointerEvents: "none" }}>
        {waves.map((w, i) => (
          <div key={i} className="rp-anim" style={{ position: "absolute", bottom: 0, left: 0, width: "200%", display: "flex", height: w.h, animation: `rpwave ${w.dur}s linear infinite ${w.dir}` }}>
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: "50%", height: "100%" }}><path d={w.d} fill="#ffffff" fillOpacity={w.o} /></svg>
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: "50%", height: "100%" }}><path d={w.d} fill="#ffffff" fillOpacity={w.o} /></svg>
          </div>
        ))}
      </div>
      <div style={{ position: "relative", zIndex: 10 }}>{children}</div>
    </div>
  );
}
