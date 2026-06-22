import React from "react";
import { T, SEM } from "../theme.js";

export function Card({ children, style }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, ...style }}>{children}</div>;
}

export function Btn({ children, onClick, kind = "solid", disabled, style, type }) {
  const kinds = {
    solid: { background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: "#04222e" },
    ghost: { background: "transparent", color: T.text, border: `1px solid ${T.border}` },
    danger: { background: "transparent", color: SEM.bad, border: `1px solid ${SEM.bad}` },
  };
  return (
    <button type={type || "button"} onClick={onClick} disabled={disabled}
      style={{ borderRadius: 12, padding: "9px 14px", fontWeight: 600, fontSize: 14, border: "1px solid transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.55 : 1, ...kinds[kind], ...style }}>
      {children}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 12, color: T.textMuted, marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}

const ctrl = { width: "100%", background: T.surfaceAlt, color: T.text, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 11px", outline: "none" };
export function Input({ style, ...props }) { return <input {...props} style={{ ...ctrl, ...style }} />; }
export function Textarea({ style, ...props }) { return <textarea {...props} style={{ ...ctrl, resize: "vertical", ...style }} />; }
export function Select({ children, style, ...props }) { return <select {...props} style={{ ...ctrl, ...style }}>{children}</select>; }

export function Badge({ children, color }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, color: color || T.textMuted, background: "rgba(255,255,255,0.06)", border: `1px solid ${color || T.border}` }}>{children}</span>;
}

export function Empty({ title, hint }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 20px", color: T.textMuted }}>
      <div style={{ fontWeight: 600, color: T.text }}>{title}</div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{hint}</div>
    </div>
  );
}

export function Splash({ text }) {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: T.textMuted }}>{text}</div>;
}
