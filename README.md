# Resident Portal — Setup & Deploy (do this in order)

Your full app, signed-in and saving to Supabase, with a platform console to manage buildings. Follow the steps top to bottom. Each step says **where the file comes from** and **where it goes**. Don't skip the checkpoints.

---

## What you're working with

All of these are **downloaded from the Claude conversation** — each shows up as a file card you click to download. They are separate files (not zipped together):

| File | Where it comes from | Where it's used |
|------|--------------------|-----------------|
| `supabase-schema-v2.sql` | Claude chat (card: *supabase-schema-v2*) | Supabase → SQL Editor |
| `supabase-seed-v2.sql` | Claude chat (card: *supabase-seed-v2*) | Supabase → SQL Editor |
| `supabase-admin-console.sql` | Claude chat (card: *supabase-admin-console*) | Supabase → SQL Editor |
| `resident-portal-app.zip` | Claude chat (card: *resident-portal-app*) | Unzip → upload to GitHub |

Your two key values (you collected these earlier):
- **Project URL:** `https://lipwcsihcxndwwgzhiia.supabase.co`
- **Publishable key:** the `sb_publishable_…` string from Supabase → Settings → API Keys

---

## PART 1 — Database (in Supabase)

Go to **supabase.com**, open your project, click **SQL Editor** in the left sidebar. For each script: **+ New query → paste the whole file → Run.**

**Step 1.1 — Run the schema**
- File: **`supabase-schema-v2.sql`** (from the chat)
- Paste it into a new query and Run.
- **Check:** "Success." No red error. (It keeps your login/admin and rebuilds the data tables.)

**Step 1.2 — Seed your building and link your account**
- File: **`supabase-seed-v2.sql`** (from the chat)
- Before running: use the editor's find/replace to change every **`YOUR_SIGNUP_EMAIL`** (3 places) to the email you signed up with.
- Run.
- **Check:** the last result shows your building name + your `bcc` membership.

**Step 1.3 — Enable the platform console**
- File: **`supabase-admin-console.sql`** (from the chat)
- Paste into a new query and Run.
- **Check:** "Success." (This lets you, as platform admin, see all buildings.)

**Step 1.4 — Allow your website to sign people in**
- Supabase → **Authentication → URL Configuration**.
- **Site URL** and **Redirect URLs** must both include: `https://resident-portal-app.netlify.app`
- Save. *(Without this, the magic-link email won't return people to the app.)*

---

## PART 2 — The app code (in GitHub)

**Step 2.1 — Unzip the app**
- File: **`resident-portal-app.zip`** (from the chat).
- Mac: double-click. Windows: right-click → Extract All.
- You get a folder with `index.html`, `package.json`, `netlify.toml`, `vite.config.js`, `README.md`, and a `src` folder.

**Step 2.2 — Replace the old files in GitHub**
- Go to your repo at **github.com/gregf0202/resident-portal-app**.
- Click **Add file → Upload files**.
- Open the unzipped folder, select **everything inside it** (including the `src` folder) and drag it all onto the upload area.
- Wait until the list shows files like `src/ResidentPortal.jsx`, `src/db.js`, `src/components/PlatformConsole.jsx`.
- Scroll down → **Commit changes**. (Same-named files overwrite the old ones.)
- **Check:** refresh the repo — open `README.md`; it should be *this* file ("do this in order").

---

## PART 3 — Hosting (in Netlify)

**Step 3.1 — Confirm the environment variables**
- Netlify → your site (**resident-portal-app**) → **Site configuration → Environment variables**.
- You should see these two (you already added them — leave as-is, don't duplicate):
  - `VITE_SUPABASE_URL` = `https://lipwcsihcxndwwgzhiia.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = your `sb_publishable_…` key
- If either is missing, click **Add a variable** and add it.

**Step 3.2 — Let it deploy**
- Your GitHub commit auto-triggers a build. Netlify → **Deploys**.
- **Check:** newest deploy goes **Building → Published** (green). If it says **Failed**, open it, copy the red lines, and send them to me.

---

## PART 4 — Use it

1. Open **https://resident-portal-app.netlify.app**.
2. Enter your email → **Email me a sign-in link** → open the email → click the link.
3. Because you're the platform admin, you land on the **Platform console**:
   - **Create a building**, or **Open** the one the seed created.
   - **Members** → invite people by email with a role.
   - Inside a building, **All buildings** (sidebar) brings you back.
4. **Check it saves:** post a notice or report maintenance, then refresh — it's still there.

---

## If something goes wrong
- **Deploy "Failed":** Netlify → the deploy → Deploy log → copy the red lines → send to me.
- **Blank screen / "Missing VITE_…":** the two env variables aren't set or are misnamed. Fix, then re-deploy (Deploys → Trigger deploy).
- **Magic link does nothing:** the Netlify URL isn't in Supabase → Authentication → URL Configuration → Redirect URLs (Step 1.4).
- **Signed in but "no building":** your email isn't linked. Re-check Step 1.2 used your real email, or add yourself via the console.

## Notes
- Styling uses the Tailwind CDN (in `index.html`) for zero build config — robust now; can be compiled later for speed.
- The single-file demo (`nalohub.netlify.app`) is separate and untouched — keep using it for pitching.
