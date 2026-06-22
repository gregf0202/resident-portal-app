import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Surfaced clearly so a missing env var is obvious during setup.
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env (local) or Netlify env vars.");
}

export const supabase = createClient(url, key);
