# FlatSplit

A Splitwise-style web app for you and your flatmates. Add daily expenses, split them
equally / by exact amounts / by percentages / by shares, see who owes whom, and settle
up whenever you like. Works in any browser on any device, syncs live, and runs entirely
on free tiers.

**Stack:** React (Vite) frontend · Supabase (Postgres database + authentication) · Vercel hosting.

---

## What you'll set up (≈ 25 minutes, all free)

1. A Supabase project — your database and login system
2. Google sign-in (optional but you asked for it)
3. Deploy to Vercel — your public URL

---

## Step 1 — Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New project**.
2. Pick any name (e.g. `flatsplit`), set a strong database password (you won't need it
   day-to-day, but save it), choose a region close to you (e.g. Mumbai), and create.
3. Wait ~2 minutes for the project to provision.

### Run the database schema

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. Open `supabase/schema.sql` from this project, copy the **entire file**, paste it into
   the editor, and click **Run**.
3. You should see "Success. No rows returned." That created all tables, security rules,
   and helper functions.

### Get your API keys

1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon / public** key. You'll need both in Step 3.
   (The anon key is safe to expose in the browser — Row Level Security protects the data.)

### Email confirmation (recommended tweak)

By default Supabase emails a confirmation link on signup. For a private flatmates app
it's simpler to turn this off:

- **Authentication → Sign In / Providers → Email** → toggle **Confirm email** off → Save.

Skip this if you prefer confirmed emails — the app handles both.

---

## Step 2 — Enable Google sign-in

Email/password works out of the box. For the "Continue with Google" button:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project
   (e.g. `flatsplit`).
2. **APIs & Services → OAuth consent screen** → External → fill in the app name and your
   email → save. (You can stay in "Testing" mode and add your flatmates' Gmail addresses
   as test users, or click **Publish app** — either works.)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   Application type: **Web application**.
4. Under **Authorized redirect URIs**, add the callback URL shown in
   Supabase → **Authentication → Sign In / Providers → Google** (it looks like
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`). Create, then copy the
   **Client ID** and **Client secret**.
5. Back in Supabase → **Authentication → Sign In / Providers → Google** → enable it,
   paste the Client ID and secret, save.

Later, after you deploy (Step 3), also do this in Supabase:

- **Authentication → URL Configuration** → set **Site URL** to your Vercel URL
  (e.g. `https://flatsplit.vercel.app`) and add it under **Redirect URLs**.
  This makes Google sign-in return to your live app instead of localhost.

---

## Step 3 — Deploy to Vercel (free)

The easiest path is via GitHub:

1. Push this folder to a new GitHub repository:
   ```bash
   cd flatsplit
   git init && git add . && git commit -m "FlatSplit v1"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/flatsplit.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → sign up with GitHub → **Add New → Project** →
   import the `flatsplit` repo. Vercel auto-detects Vite; keep the defaults.
3. Before deploying, expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Project URL from Step 1
   - `VITE_SUPABASE_ANON_KEY` → your anon key from Step 1
4. Click **Deploy**. In a minute you'll have a URL like `https://flatsplit.vercel.app`.
5. Go back and finish the **Site URL / Redirect URLs** step at the end of Step 2.

> Netlify and Cloudflare Pages work identically if you prefer them — same build command
> (`npm run build`), same env variables, output directory `dist`.

---

## Step 4 — Use it with your flatmates

1. Open your URL, create an account (or sign in with Google).
2. Create a group (your flat) — you'll get a **6-character invite code** on the Group tab.
3. Flatmates open the same URL, sign up, choose **Join with code**, and enter it.
4. Add expenses with the **+** button, check **Balances** anytime, and use **Settle** to
   record payments when money actually changes hands (UPI, cash, etc.).

**Tip:** on your phone, open the site and use "Add to Home Screen" — it behaves like an app.

---

## Running locally (for development)

```bash
cp .env.example .env    # fill in your Supabase URL + anon key
npm install
npm run dev             # opens on http://localhost:5173
```

For Google sign-in to work locally, add `http://localhost:5173` to Supabase's
**Authentication → URL Configuration → Redirect URLs**.

---

## How the security works

- **HTTPS** everywhere — Vercel and Supabase both enforce it.
- **Passwords** are hashed and managed by Supabase Auth (never stored by the app).
- **Row Level Security (RLS)** on every table: the database itself refuses to return or
  accept rows for groups you're not a member of, even if someone tampers with the client.
- Group **creation/joining and expense writes** go through server-side SQL functions that
  re-check membership and validate that splits add up to the total.
- The **anon key** in the frontend is designed to be public; RLS is the actual gate.

## Free-tier limits (you will not hit these)

- **Supabase free:** 500 MB database, 50k monthly active users, 5 GB bandwidth. A flat of
  five logging 20 expenses a day uses well under 1% of this.
  One note: free projects **pause after ~7 days of no activity** — just open the dashboard
  and click Restore if that ever happens (data is kept).
- **Vercel free (Hobby):** 100 GB bandwidth/month — effectively unlimited for this.

## Ideas for v2

- Edit expenses (currently delete + re-add)
- Monthly summaries and category tags
- Export to CSV
- Push/WhatsApp reminders for pending balances

---

## Project structure

```
flatsplit/
├── index.html                  # entry, fonts, meta
├── supabase/schema.sql         # run once in Supabase SQL Editor
├── src/
│   ├── main.jsx                # React entry
│   ├── App.jsx                 # session, data loading, realtime, tabs
│   ├── supabaseClient.js       # Supabase connection
│   ├── styles.css              # all styling
│   ├── lib/balances.js         # split math, net balances, debt simplification
│   └── components/
│       ├── Auth.jsx            # sign in / sign up / Google
│       ├── GroupSetup.jsx      # create or join a group
│       ├── Balances.jsx        # who owes whom
│       ├── AddExpense.jsx      # expense form with 4 split types
│       ├── Activity.jsx        # history + delete
│       ├── Settle.jsx          # record payments
│       └── GroupInfo.jsx       # invite code, members, sign out
└── .env.example
```
