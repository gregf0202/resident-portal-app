import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// session-handoff: gives a Home Screen app its OWN sign-in, from the sign-in Safari already has.
//
// On iPhone a Home Screen app and Safari keep separate storage. Supabase keeps the session in
// localStorage, which iOS does not copy when a site is added to the Home Screen, so the icon
// always opened on the sign-in screen. iOS 17.2+ DOES copy cookies at that moment, so Safari
// keeps its current access token in a short-lived first-party cookie (nh_handoff, src/handoff.js)
// and the Home Screen app, finding no session but that cookie, calls this function once.
//
// Why not simply copy the whole session into the cookie: both apps would then hold the same
// refresh token. This project has "Detect and revoke potentially compromised refresh tokens" on
// (reuse interval 10s), so whichever app refreshed second would present a spent token and Supabase
// would revoke the session, signing BOTH out. Minting a fresh, independent session here avoids that:
// the two apps never share a refresh token.
//
// Input: Authorization: Bearer <access token>. The gateway verifies the JWT (verify_jwt on) and
// getUser() confirms the session behind it still exists. Output: { token_hash }, a one-time magic
// link hash for that user, which the app redeems with verifyOtp({ token_hash, type: "email" }).
// generateLink sends no email. It does replace any sign-in code the person has pending, which is
// harmless here: they are already signed in.

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing token" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user?.email) return json({ error: "not signed in" }, 401);

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  const token_hash = data?.properties?.hashed_token;
  if (error || !token_hash) return json({ error: "could not hand off" }, 500);

  return json({ token_hash });
});
