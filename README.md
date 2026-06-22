# Resident Portal — Production App (live, Supabase-backed)

A signed-in, multi-building app that reads/writes your Supabase backend. Buildings are isolated by Row-Level Security, so each person only ever sees their own building. This is separate from the no-backend demo file, which stays as-is for pitching.

Currently wired: **magic-link sign-in**, **building load**, **Announcements**, **Maintenance**. More modules to follow.

---

## 1. Run it locally (optional but recommended first)

You need Node.js 18+ installed.

```bash
npm install
cp .env.example .env        # then edit .env with your real values
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

Your `.env` needs:
```
VITE_SUPABASE_URL=https://lipwcsihcxndwwgzhiia.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...your key...
```
(Use the **Publishable** key from Supabase → Settings → API Keys. Never the secret key.)

> Add `http://localhost:5173` to Supabase → Authentication → URL Configuration → Redirect URLs, or the magic link won't return you to the app locally.

## 2. Put it on GitHub

```bash
git init
git add .
git commit -m "Resident Portal production app"
# create an empty repo on github.com, then:
git remote add origin https://github.com/YOUR_USER/resident-portal-app.git
git branch -M main
git push -u origin main
```

## 3. Connect to Netlify (Git-based, auto-deploys)

1. Netlify → **Add new site → Import an existing project** → pick GitHub → choose this repo.
2. Build settings are auto-detected from `netlify.toml` (build: `npm run build`, publish: `dist`). Leave as-is.
3. Before the first deploy, add **Environment variables** (Site configuration → Environment variables):
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your publishable key
4. Deploy. Netlify gives you a URL like `https://your-app.netlify.app`.
5. Add that URL to Supabase → Authentication → URL Configuration (Site URL **and** Redirect URLs).

From now on, every `git push` redeploys automatically.

## 4. Try it

1. Open the Netlify URL → enter the email you seeded as a committee member (e.g. your signup email, which is `bcc` of Salt on Kings) → click the magic link.
2. You'll land on the dashboard for your building, with live Announcements and Maintenance.
3. Post a notice and report a maintenance issue — refresh and they persist (they're in Supabase now). Sign in as a different building's member and you won't see them: RLS in action.

---

## What's here

```
src/
  App.jsx                  auth state, building load, nav, dashboard
  supabaseClient.js        reads VITE_ env vars
  theme.js                 Midnight Harbour palette
  components/
    AnimatedHeader.jsx     your wave header
    SignIn.jsx             magic-link sign-in
    ui.jsx                 Card, Btn, Field, Input, etc.
  modules/
    Announcements.jsx      live read/post (role-aware)
    Maintenance.jsx        live raise / triage / progress updates
```

## Next modules
Bookings, Events (+RSVP), Documents, Meetings & decisions, Action register, Directory, Key & fob register, Business directory — each follows the same pattern: query by `building_id`, write through the same RLS rules already enforced in your database.

## Notes
- This app loads each module's data on demand (not everything at once), so it scales as history grows.
- Styling is intentionally dependency-light (no Tailwind build step) to keep the build robust.
- Keep the demo file separate — it remains the no-login pitch tool.
