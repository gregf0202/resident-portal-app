import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { T } from "../theme.js";
import AnimatedHeader from "./AnimatedHeader.jsx";
import { Btn, Input } from "./ui.jsx";
import { friendlyError } from "../friendlyError.js";

// Running from the Home Screen (iPhone or Android). This matters at sign-in:
// the Sign in button in the email always opens the phone's browser, never the
// Home Screen app, and the two keep separate sign-ins. So a resident who taps
// the link signs the browser in, taps the NaloHub icon, and is asked for their
// email again. The code is the only way to sign the Home Screen app itself in,
// so in that mode we say so, and lead with the code.
const isStandalone = () => {
  try {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
      || window.navigator.standalone === true;
  } catch (e) { return false; }
};

// "Waiting for the code" survives the app being reloaded. Switching to Mail to
// read the code often makes iOS reload a Home Screen app when the person comes
// back, which used to drop them on the empty email screen with the code in
// hand. Kept for the life of a code (30 min, Supabase OTP expiry), per device.
const PENDING_KEY = "nalo_signin_pending";
const PENDING_MS = 30 * 60 * 1000;
const readPending = () => {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    if (v && v.email && Date.now() - v.at < PENDING_MS) return v;
    localStorage.removeItem(PENDING_KEY);
  } catch (e) {}
  return null;
};
const savePending = (email) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify({ email, at: Date.now() })); } catch (e) {} };
const clearPending = () => { try { localStorage.removeItem(PENDING_KEY); } catch (e) {} };

// A sign-in or invite link that has expired (or was already used, often by a work
// mail scanner) comes back with #error_code=otp_expired. Say so, instead of showing a
// blank email form as if nothing had happened, then tidy the address bar.
const readLinkError = () => {
  try {
    const h = new URLSearchParams((window.location.hash || "").replace(/^#/, "") + "&" + (window.location.search || "").replace(/^\?/, ""));
    const code = h.get("error_code") || h.get("error");
    if (!code) return "";
    window.history.replaceState(null, "", window.location.pathname);
    return /expired|otp|access_denied/i.test(code + " " + (h.get("error_description") || ""))
      ? "That sign-in link has expired or has already been used. Enter your email below and we'll send a fresh one, with a code you can type instead."
      : "That sign-in link didn't work. Enter your email below and we'll send a fresh one.";
  } catch (e) { return ""; }
};

export default function SignIn() {
  const [standalone] = useState(isStandalone);
  const [linkNote] = useState(readLinkError);
  const [pending] = useState(readPending);
  const [email, setEmail] = useState(pending ? pending.email : "");
  const [sent, setSent] = useState(!!pending);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [usePw, setUsePw] = useState(false);
  const [pw, setPw] = useState("");
  // Six-digit code alternative to the link (same email, same one-time token).
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const [resent, setResent] = useState(false);

  const signInPw = async () => {
    if (!email.trim() || !pw) { setErr("Enter your email and password first."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pw,
    });
    setBusy(false);
    if (error) setErr(friendlyError(error));
  };

  const send = async () => {
    if (!email.trim()) { setErr("Enter your email address first."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setErr(friendlyError(error)); else { savePending(email.trim()); setSent(true); }
  };

  // Verify the numeric code printed in the sign-in email. Works on whichever
  // device the person types it on, so the phone/laptop mix-up goes away.
  //
  // Deliberately NOT hardcoded to six digits: GoTrue's OTP length is a project
  // setting (Authentication > Email), commonly 6 but 8 on some projects, and it
  // can be changed later. A length check here that disagrees with the email is
  // the worst kind of bug — it rejects a perfectly valid credential at our own
  // front door and tells the person the wrong thing. Accept anything in the
  // range GoTrue can emit and let Supabase be the judge.
  const CODE_MIN = 6, CODE_MAX = 10;
  const digits = (v) => (v || "").replace(/\D/g, "");

  const signInCode = async () => {
    const token = digits(code);
    if (token.length < CODE_MIN) { setCodeErr("Type all the digits shown in the email."); return; }
    setBusy(true); setCodeErr("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    setBusy(false);
    if (error) {
      const m = /expired|invalid/i.test(error.message)
        ? "That code didn't work. Check the digits, and make sure it's from the newest email. Codes expire, so if in doubt tap Send a fresh email."
        : friendlyError(error);
      setCodeErr(m);
    } else clearPending();
    // On success onAuthStateChange in App.jsx takes over; nothing to do here.
  };

  // Send another link + code. Supabase enforces a 60 second gap between sends,
  // and returns a raw message ("For security purposes, you can only request
  // this after N seconds") that reads as a fault rather than a wait. Someone
  // who cannot get in is already anxious, so say plainly that it is a pause.
  const resend = async () => {
    setBusy(true); setCodeErr(""); setResent(false);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (!error) { savePending(email.trim()); setResent(true); setCode(""); return; }
    const wait = /security purposes|rate limit|only request this after/i.test(error.message);
    const secs = (error.message.match(/(\d+)\s*seconds?/i) || [])[1];
    setCodeErr(wait
      ? "Just a moment. We limit how often a sign-in email can be sent" + (secs ? `, so try again in about ${secs} seconds.` : ". Try again in about a minute.") + " The email already sent still works."
      : friendlyError(error));
  };

  const google = async () => {
    setErr("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setErr(friendlyError(error));
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
              {standalone ? (
                <>
                  <p style={{ color: T.text, marginTop: 0 }}>Check your email. We've sent a sign-in code to <b>{email}</b>.</p>
                  <p style={{ color: T.text, marginTop: 6, fontSize: 15, fontWeight: 700 }}>Type the code from that email here.</p>
                  <p style={{ color: T.textMuted, marginTop: 4, fontSize: 13 }}>
                    The Sign in button in the email opens your web browser, not this app, so this app would still ask for your email. The code signs this app in, and it stays signed in.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ color: T.text, marginTop: 0 }}>Check your email. We've sent a sign-in link to <b>{email}</b>.</p>
                  <p style={{ color: T.textMuted, marginTop: 6, fontSize: 14 }}>
                    <b style={{ color: T.text }}>Two ways in:</b> tap <b>Sign in</b> in that email on this device, or type the code from the email here. The code works on any device.
                  </p>
                </>
              )}
              <Input
                autoFocus={standalone}
                type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={CODE_MAX + 2}
                value={code} placeholder="Code from your email"
                onChange={(e) => { setCode(e.target.value.replace(/[^0-9 ]/g, "")); setCodeErr(""); }}
                onKeyDown={(e) => e.key === "Enter" && signInCode()}
                style={{ marginTop: 6, letterSpacing: 4, fontSize: 20, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
              />
              {codeErr && <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{codeErr}</div>}
              {resent && !codeErr && <div style={{ color: "#34d399", fontSize: 13, marginTop: 8 }}>A fresh email is on its way. Use the newest one; earlier links and codes no longer work.</div>}
              <Btn onClick={signInCode} disabled={busy || digits(code).length < CODE_MIN} style={{ marginTop: 12, width: "100%" }}>
                {busy ? "Checking…" : "Sign in with code"}
              </Btn>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
                <button onClick={resend} disabled={busy}
                  style={{ background: "none", border: "none", color: T.textMuted, fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                  Send a fresh email
                </button>
                <button onClick={() => { clearPending(); setSent(false); setEmail(""); setCode(""); setCodeErr(""); setResent(false); }}
                  style={{ background: "none", border: "none", color: T.textMuted, fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                  Use a different email
                </button>
              </div>
              <p style={{ color: T.textMuted, fontSize: 12, marginTop: 14, marginBottom: 0 }}>
                Can't see it? Check Junk, and in Outlook the <b>Other</b> tab. The email is from <b>Just Nalo It!</b> (noreply@send.nalohub.com).
              </p>
            </div>
          ) : (
            <div>
              {linkNote && <div style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)", color: T.text, fontSize: 13, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>{linkNote}</div>}
              {/* Google sign-in finishes in the browser, never in the Home Screen app, so
                  it would leave the app signed out. Hidden there; the code works instead. */}
              {!standalone && (<>
              <button onClick={google} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "#fff", color: "#1f1f1f", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 10, padding: "11px 14px", fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 14 }}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Continue with Google
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 14px", color: T.textMuted, fontSize: 12 }}>
                <span style={{ flex: 1, height: 1, background: T.border }} /> or <span style={{ flex: 1, height: 1, background: T.border }} />
              </div>
              </>)}
              {usePw ? (
                <>
                  <p style={{ color: T.textMuted, marginTop: 0 }}>Sign in with your email and password.</p>
                  <Input type="email" value={email} placeholder="you@example.com"
                    onChange={(e) => setEmail(e.target.value)} />
                  <Input type="password" value={pw} placeholder="Password" autoComplete="current-password"
                    onChange={(e) => setPw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && signInPw()}
                    style={{ marginTop: 10 }} />
                  {err && <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{err}</div>}
                  <Btn onClick={signInPw} disabled={busy} style={{ marginTop: 12, width: "100%" }}>
                    {busy ? "Signing in…" : "Sign in"}
                  </Btn>
                </>
              ) : (
                <>
                  <p style={{ color: T.textMuted, marginTop: 0 }}>{standalone
                    ? "Enter your email and we'll send you a sign-in code to type in here. No password to remember."
                    : "Enter your email and we'll send a secure sign-in link. No password to remember."}</p>
                  <Input type="email" value={email} placeholder="you@example.com"
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()} />
                  {err && <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{err}</div>}
                  <Btn onClick={send} disabled={busy} style={{ marginTop: 12, width: "100%" }}>
                    {busy ? "Sending…" : standalone ? "Email me a sign-in code" : "Email me a sign-in link"}
                  </Btn>
                </>
              )}
              <button onClick={() => { setUsePw((v) => !v); setErr(""); }}
                style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: T.textMuted, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                {usePw ? "Email me a sign-in link instead" : "Admin? Sign in with a password"}
              </button>
              <div style={{ textAlign: "center", marginTop: 12, color: T.accent, fontWeight: 800, fontSize: 12, letterSpacing: 0.4 }}>Just Nalo it.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
