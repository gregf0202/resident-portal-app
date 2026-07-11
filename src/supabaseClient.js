import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Expected in demo builds (VITE_DEMO_MODE=true) where Supabase is never
  // called; a real deployment missing these is a setup error.
  console.warn("Supabase env vars not set — running without a backend (demo mode?).");
}

// Placeholder values keep createClient from throwing in demo builds; the
// demo app never issues requests, and audit() no-ops without the real URL.
export const supabase = createClient(url || "https://placeholder.supabase.co", key || "public-placeholder-key");
