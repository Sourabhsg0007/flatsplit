# FlatSplit — Project, Deployment, and Operations Guide

## Purpose

FlatSplit is a free, private alternative to Splitwise for a household or group of
roommates. It lets members add shared expenses, divide them in several ways, see
net balances, and record real-world repayments such as UPI or cash transfers.

It is designed as a personal, non-commercial application and can be hosted on
the free tiers of Vercel and Supabase for a small household.

## Current project locations

| Item | Location |
| --- | --- |
| Local project | `/Users/sourabhgarg/Downloads/flatsplit/flatsplit` |
| GitHub repository | `https://github.com/Sourabhsg0007/flatsplit` |
| Production site | `https://flatsplit-six.vercel.app` |
| Supabase project URL | `https://atxjnjfvfeourahrcezo.supabase.co` |
| Git branch | `main` |
| Initial Git commit | `b5d9c35` — `Initial FlatSplit app` |

## Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | React 18 | Screens, forms, group state, balance views |
| Build tool | Vite 5 | Development server and production build |
| Styling | Plain CSS | All UI styling in `src/styles.css` |
| Database | Supabase Postgres | Groups, memberships, expenses, splits, payments |
| Authentication | Supabase Auth | Email/password and optional Google login |
| Live updates | Supabase Realtime | Synchronizes changes across devices |
| Hosting | Vercel | Serves the static frontend via HTTPS/CDN |

There is no separate custom backend server. The browser talks directly to
Supabase through its JavaScript client. Supabase Row Level Security (RLS) is the
server-side boundary that controls which signed-in users can access data.

## Project layout

```text
flatsplit/
├── index.html                    # Page metadata and frontend entry page
├── package.json                  # Dependencies and npm scripts
├── vite.config.js                # Vite configuration
├── .env.example                  # Local environment-variable template
├── src/
│   ├── main.jsx                  # React bootstrap
│   ├── App.jsx                   # Auth, data loading, routing and realtime
│   ├── supabaseClient.js         # Supabase browser client
│   ├── styles.css                # Styling
│   ├── lib/balances.js           # Split and debt-simplification calculations
│   └── components/               # Auth, group, expense, balance and payment UI
└── supabase/schema.sql           # Database schema, RLS policies and SQL RPCs
```

## User-facing features

- Email/password authentication.
- Google authentication button (requires a separate Google OAuth configuration).
- Create a group and receive a six-character invite code.
- Join an existing group using its invite code.
- Record expenses split equally, by exact amount, percentage, or shares.
- Display net balances and suggested minimal settlement transfers.
- Record cash/UPI settlements.
- Live refreshes when group expenses, payments, or members change.
- Support for multiple groups per user.

## Database design and security

The schema lives in `supabase/schema.sql` and must be run once in Supabase SQL
Editor for a new Supabase project.

### Main tables

- `profiles`: name and email for an authenticated user.
- `groups`: group name, currency, creator, and invite code.
- `group_members`: the relationship between users and groups.
- `expenses`: high-level expense records.
- `expense_splits`: each person's share of an expense.
- `settlements`: recorded real-world repayments.

### Important database behaviour

- A trigger creates a `profiles` row when someone signs up.
- `create_group`, `join_group`, and `add_expense` are database functions (RPCs).
- The `add_expense` function validates that the payer is a member and that split
  amounts add up to the total.
- RLS prevents non-members from reading or writing another group's expenses,
  settlements, and memberships.
- Realtime is enabled for `expenses`, `settlements`, and `group_members`.

### Current limitations to be aware of

This is suitable for trusted roommates, but it is not a full financial audit
system:

- Any group member can currently delete any group expense or settlement.
- Any group member can record a payment involving any other two members.
- The current `profiles_select` policy permits any signed-in user to read profile
  rows, including email addresses. Normal UI screens only show group members,
  but the policy is broader than ideal for a public product.
- Invite codes are six characters; share them only with people who should join.
- There is no edit history, role system, CSV export, receipt upload, or backup UI.

## Environment variables

The frontend requires these variables in Vercel:

```text
VITE_SUPABASE_URL=https://atxjnjfvfeourahrcezo.supabase.co
VITE_SUPABASE_ANON_KEY=<Supabase publishable key>
```

The second variable name is legacy naming in this project. It should contain a
Supabase **publishable** key (`sb_publishable_...`), not a secret key.

Never add any of these to a frontend deployment, Git repository, or chat:

- `sb_secret_...` keys
- legacy `service_role` keys
- database password
- local `.env` files

The repository's `.gitignore` excludes `.env` and `.env.local`.

## Deployment steps completed so far

1. The source was committed locally.
2. A dedicated GitHub SSH authentication key was generated.
3. The repository was pushed to GitHub using SSH.
4. The app was deployed on Vercel at `https://flatsplit-six.vercel.app`.

## Required Supabase configuration check

In Supabase, go to **Authentication → URL Configuration** and ensure both are
set to the deployed site:

```text
Site URL:      https://flatsplit-six.vercel.app
Redirect URLs: https://flatsplit-six.vercel.app
```

This configuration is important for email confirmation links and OAuth redirects.

Also confirm that the complete `supabase/schema.sql` file was run in **SQL
Editor**. Without it, the deployed interface will load but login/group/expense
functions will fail.

## Vercel deployment configuration

Vercel should use:

```text
Repository:       Sourabhsg0007/flatsplit
Branch:           main
Framework:        Vite
Build command:    npm run build
Output directory: dist
```

For the two required variables, select Production, Preview, and Development if
Vercel offers environment choices. A push to `main` creates a new production
deployment automatically.

## First-use checklist

1. Open `https://flatsplit-six.vercel.app` in an incognito/private window.
2. Create an account using email and password.
3. Create a group, for example `Flat 402`.
4. Open the Group tab and copy the generated invite code.
5. Have each roommate create an account and choose **Join with code**.
6. Add a small test expense.
7. Verify that members see the expense and the calculated balances.
8. Record a small test settlement and verify balances change as expected.

## Optional Google sign-in setup

Email/password works without Google configuration. To make the existing
`Continue with Google` button work:

1. Create a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an OAuth client of type **Web application**.
4. Add `https://flatsplit-six.vercel.app` as an authorized JavaScript origin.
5. Add the callback URL shown by Supabase's Google provider page as an
   authorized redirect URI in Google.
6. Copy the Google Client ID and Client Secret into Supabase under
   **Authentication → Providers → Google** and enable the provider.
7. Keep the Vercel production URL configured in Supabase URL Configuration.

## Local development

Install Node.js first. Then, from the project directory:

```bash
cp .env.example .env
# Add the Supabase URL and publishable key to .env
npm install
npm run dev
```

Open `http://localhost:5173`. Add that URL under Supabase Authentication redirect
URLs if you test authentication locally.

To make a production build locally:

```bash
npm run build
```

The build output is created in `dist/` and is ignored by Git.

## Free-tier notes

- Vercel Hobby is free for personal, non-commercial use and is appropriate for a
  private roommate app.
- Supabase Free is enough for this scale. It currently includes a 500 MB database,
  50,000 monthly active users, realtime usage, and related free allowances.
- A free Supabase project can pause after roughly one week without activity; it
  can be restored from the Supabase dashboard.
- The free tiers and limits can change, so check provider pricing before relying
  on a limit for a larger project.

## Suggested next improvements

1. Restrict deletion to the expense/settlement creator or add admin roles.
2. Narrow `profiles` read access to people who share a group.
3. Add edit/undo and an audit trail instead of permanent deletion.
4. Add CSV export and monthly/category summaries.
5. Add recurring bills and reminders.
6. Add a PWA manifest and service worker for a more app-like phone experience.
7. Back up the Supabase database periodically before relying on it long term.
