# Resident Portal — Production App (your full app, live on Supabase)

This is your **complete** Resident Portal — every module, the wave header, the themes — now behind a magic-link login, loading and saving to your Supabase backend, with each building isolated by Row-Level Security. The single-file demo stays separate for pitching; this is the real product.

How it works: your whole app is `src/ResidentPortal.jsx` (unchanged). `src/App.jsx` wraps it — it signs the user in, loads their building from Supabase, and routes every change (your app's single `update()`) through `src/db.js` so everything persists.

---

## A. Update the database (one time)

Your earlier schema used typed columns; the full app stores each record whole, so run the v2 schema once.

1. Supabase → **SQL Editor** → paste **`supabase-schema-v2.sql`** → Run. (Keeps your profile + platform-admin; rebuilds the data tables.)
2. New query → paste **`supabase-seed-v2.sql`**, replace `YOUR_SIGNUP_EMAIL` (3 spots) with your email → Run. It creates your building and links you as committee.
3. The last query should show your building name + your `bcc` membership.

## B. Set environment variables

Local (`.env`) and Netlify both need:
```
VITE_SUPABASE_URL=https://lipwcsihcxndwwgzhiia.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...your key...
```

## C. Run locally (optional)

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev
```
Add `http://localhost:5173` to Supabase → Authentication → URL Configuration → Redirect URLs.

## D. Deploy (Git + Netlify)

Follow **Deploy-Guide-Beginner.md** (unchanged): push to GitHub, import on Netlify, add the two env vars, add the Netlify URL to Supabase Redirect URLs. Every `git push` re-deploys.

## E. Try it

Open the site → enter your email → click the magic link → you land in **your building** with the full app, live. Post a notice, report maintenance, edit settings — refresh and it's all still there (saved in Supabase). Sign in as a member of a different building and you won't see any of it.

---

## What's wired
- Magic-link sign-in; loads the signed-in user's building (RLS-isolated).
- All modules from your app, reading and saving to Supabase via one sync engine.
- Building isolation + the important role limits enforced in the database (committee-only registers; owners-only notices hidden from tenants; documents committee-only until released).

## Known v1 notes (things to refine after it's running)
- **Styling uses the Tailwind CDN** (in `index.html`) so there's zero build config. Rock-solid, but for top performance we can switch to a compiled Tailwind build later.
- **Resident self-edit of own contact details** needs the `update_my_contact` function wired in (committee edits work now). Easy follow-up.
- **Newly added people** get their real id on the next page refresh (the insert is immediate; the local id reconciles on reload).
- Member-write modules (maintenance, bookings, events, etc.) allow any member to write within their own building; the finer "only the organiser can edit" rules are enforced in the UI. Can be tightened in the database later.

## Files
```
src/
  App.jsx            sign-in + load + the saving engine wrapper
  ResidentPortal.jsx YOUR full app (unchanged except a few exports)
  db.js              load from / save to Supabase
  supabaseClient.js  reads the env vars
  components/SignIn.jsx, AnimatedHeader.jsx, ui.jsx   (sign-in screen)
```
