// Home Screen hand-off. See supabase/functions/session-handoff/index.ts for the why.
//
// Safari (not the Home Screen app) keeps its current access token in a first-party cookie that
// lives no longer than the token itself (an hour at most). iOS 17.2+ copies cookies into a Home
// Screen app at the moment it is added. The Home Screen app, on first launch with no session,
// trades that token for a brand-new session of its own via the session-handoff function, then
// deletes the cookie. If the cookie has expired, the person signs in with the emailed code.
import { supabase } from "./supabaseClient.js";

const NAME = "nh_handoff";

export const isStandalone = () => {
  try {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
      || window.navigator.standalone === true;
  } catch (e) { return false; }
};

const write = (value, maxAge) => {
  try { document.cookie = `${NAME}=${value}; Max-Age=${maxAge}; Path=/; Secure; SameSite=Lax`; } catch (e) {}
};
const read = () => {
  try {
    const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + NAME + "=([^;]+)"));
    return m ? decodeURIComponent(m[1]) : "";
  } catch (e) { return ""; }
};
export const clearHandoff = () => write("", 0);

// Called on every auth change. Only the browser writes the cookie; the Home Screen app never does.
export function syncHandoff(session) {
  if (isStandalone()) return;
  if (!session || !session.access_token || !session.expires_at) { clearHandoff(); return; }
  const secs = Math.floor(session.expires_at - Date.now() / 1000) - 60;
  if (secs <= 0) { clearHandoff(); return; }
  write(encodeURIComponent(session.access_token), secs);
}

// Home Screen app with no session: redeem the copied cookie for a session of its own.
// Resolves true when signed in. Never throws; any failure falls back to the sign-in screen.
export async function tryHandoff() {
  if (!isStandalone()) return false;
  const token = read();
  if (!token) return false;
  clearHandoff(); // one attempt only, success or not
  try {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return false;
    // Give up after 8 seconds so a stalled network drops to the code screen
    // instead of leaving "Loading" on screen for ever.
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ac ? setTimeout(() => ac.abort(), 8000) : null;
    const r = await fetch(`${url}/functions/v1/session-handoff`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: key, "Content-Type": "application/json" },
      body: "{}",
      signal: ac ? ac.signal : undefined,
    }).finally(() => { if (timer) clearTimeout(timer); });
    if (!r.ok) return false;
    const { token_hash } = await r.json();
    if (!token_hash) return false;
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: "email" });
    return !error;
  } catch (e) { return false; }
}
