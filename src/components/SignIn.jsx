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

  const google = async () => {
    setErr("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setErr(error.message);
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
              <button onClick={google} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "#fff", color: "#1f1f1f", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, padding: "11px 14px", fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 14 }}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Continue with Google
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 14px", color: T.textMuted, fontSize: 12 }}>
                <span style={{ flex: 1, height: 1, background: T.border }} /> or <span style={{ flex: 1, height: 1, background: T.border }} />
              </div>
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
