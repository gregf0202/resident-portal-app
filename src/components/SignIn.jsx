import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { T } from "../theme.js";
import AnimatedHeader from "./AnimatedHeader.jsx";
import { Btn, Input } from "./ui.jsx";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email.trim()) return;
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, borderRadius: 18, overflow: "hidden", background: T.surface, border: `1px solid ${T.border}` }}>
        <AnimatedHeader>
          <div style={{ padding: "30px 24px 26px" }}>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>Resident Portal</div>
            <h1 style={{ margin: "6px 0 0", fontSize: 24, color: "#fff" }}>Sign in</h1>
          </div>
        </AnimatedHeader>
        <div style={{ padding: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(52,211,153,0.14)", border: "1px solid rgba(52,211,153,0.34)", color: "#34d399", fontSize: 13, fontWeight: 700, padding: "9px 14px", borderRadius: 30, marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /><circle cx="12" cy="15.5" r="1.4" /></svg>
            A private, secure space just for your building
          </div>
          {sent ? (
            <div>
              <p style={{ color: T.text, marginTop: 0 }}>Check your email — we've sent a sign-in link to <b>{email}</b>. Open it on this device to continue.</p>
              <Btn kind="ghost" onClick={() => { setSent(false); setEmail(""); }} style={{ marginTop: 8 }}>Use a different email</Btn>
            </div>
          ) : (
            <div>
              <p style={{ color: T.textMuted, marginTop: 0 }}>Enter your email and we'll send a secure sign-in link. No password to remember.</p>
              <Input type="email" value={email} placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()} />
              {err && <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{err}</div>}
              <Btn onClick={send} disabled={busy} style={{ marginTop: 12, width: "100%" }}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </Btn>
              <div style={{ textAlign: "center", marginTop: 12, color: T.accent, fontWeight: 800, fontSize: 12, letterSpacing: 0.4 }}>Just Nalo it.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
