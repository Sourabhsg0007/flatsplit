# Repository Guidelines

FlatSplit is a React 18 single-page app (Vite + `vite-plugin-pwa`) backed directly by Supabase
(Postgres, Auth, Realtime, RLS). There is no backend server; the browser talks to Supabase.

## Project Structure

- `src/main.jsx` bootstraps the app; `src/App.jsx` owns session/auth, group data loading, realtime subscriptions, and tab routing.
- `src/components/` contains feature UI (`Auth`, `GroupSetup`, `AddExpense`, `Balances`, `Activity`, `Settle`, `GroupInfo`).
- `src/lib/balances.js` is the single home for money math: split computation, net balances, debt simplification, currency formatting. Keep balance math there, not in components.
- `src/supabaseClient.js` builds the client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- `supabase/schema.sql` is the baseline schema, RLS policies, and RPC functions. Later `.sql` files (`migration_v2.sql`, `fix_policies.sql`, `migration_mandatory_category.sql`) are manual one-off migrations.
- `src/styles.css` holds all styling; `public/icons/` holds PWA assets. `.env.example` documents env config.

## Commands

Run from the repository root:

```bash
npm install       # install dependencies
npm run dev       # start Vite at http://localhost:5173
npm run build     # production bundle in dist/ — the only automated check
npm run preview   # serve the built bundle locally
npm run test      # vitest unit tests (src/lib/balances.test.js)
npm run lint      # eslint (src/**)
```

After changes, run `npm run build`, `npm run test`, and `npm run lint`, then manually exercise the
affected auth / group-join / split / balance / settlement / insights flows.

## Data access model (read this before changing writes)

- Expense writes go through `security definer` RPCs `add_expense` and `update_expense`, which
  re-check membership and validate that split amounts sum to the total (tolerance 0.02). Split
  amounts are computed client-side in `src/lib/balances.js` and re-validated server-side —
  change both together.
- Settlements and deletes are direct `supabase.from(...)` writes gated only by RLS. RLS is the
  security boundary: never add a write path that bypasses membership checks.
- Tables that need live sync must be added to the `supabase_realtime` publication (see the end
  of `supabase/schema.sql`). `App.jsx` refetches all group data on any change event — updates
  are not payload-driven.
- Invite links: a `?join=CODE` URL param is stored in `localStorage.pendingInviteCode` and
  consumed via the `join_group` RPC after authentication.

## Schema changes

There is no migration tooling — SQL is pasted into the Supabase SQL Editor manually. Do not edit
`supabase/schema.sql` in place; add a new migration file and call out that it must be run.

## Coding Style

Two-space indentation, no semicolons, single quotes in JavaScript, trailing commas in multiline
literals. PascalCase for component files/names, camelCase for functions and variables, lowercase
names for utility files. Match the existing CSS classes in `src/styles.css` rather than
introducing a new framework.

## Docs accuracy

README and PRD are aspirational and partly stale: recurring expenses, member roles, and CSV export
from `PRD.md` are NOT built (insights/analytics ARE built, in the Insights tab). Expense editing IS
implemented. Trust the code over the docs.

## Gotchas

- Missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env` (copy from `.env.example`)
  only logs a console error — the app breaks at runtime, not build time.
- For Google sign-in locally, add `http://localhost:5173` to Supabase → Authentication → URL
  Configuration → Redirect URLs. After deploying, update Site URL / Redirect URLs in Supabase.
- The PWA uses `registerType: 'autoUpdate'`; service worker changes may require clearing caches.
  `dist/` is gitignored.
- Money is `numeric(12,2)` formatted `en-IN` (default currency `₹`). Splits must always sum
  exactly to the total; the client allocates cents via largest-remainder.
- `expenses.category` is `not null default 'Food & Groceries'`. The allowed category list is a
  hardcoded array in `AddExpense.jsx` (no DB enum/check) — keep UI and any SQL defaults in sync.
