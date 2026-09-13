# Changelog

All notable changes to FlatSplit are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com); versions follow semver.

## [2.2.0] — 2026-09-05

### Added
- **Native iOS & Android apps (Capacitor)** — `android/` and `ios/` native
  projects, `capacitor.config.json`, and npm scripts (`cap:sync`,
  `cap:android`, `cap:ios`). Full build + store-submission guide in
  `docs/MOBILE_APPS.md` (signing, icons, listings, privacy forms, and the
  Google-OAuth-in-webview caveat).
- **Avatars** — every person gets an initials avatar with a stable
  per-person color (net balances, settle suggestions).
- **Category icon chips** — each expense row leads with its category's icon
  in a tinted chip (Activity + Personal), making lists scannable.
- `docs/DESIGN.md` — the design language, inspirations from Splitwise /
  Tricount / Settle Up research, and mobile-native rules.

### Changed
- **Activity rows redesigned for readability** — the meta line (date · payer
  · your share) sits in a small rounded pill box; description-to-category-tag
  font ratio is exactly 1.5:1 (1.05rem : 0.7rem) so the expense name clearly
  leads.
- **Tab bar active state, reimagined** — the active tab's icon gets a filled
  theme-color circle (pine with white icon in light mode; mint with dark icon
  in dark mode) that lifts off the bar with a springy 3D pop and shadow;
  pressing any tab pushes the button in under your finger. Respects
  prefers-reduced-motion.
- **Bounding sweep completed across every screen** — top bar, group
  settings (name/invite code), comments (bodies wrap, authors truncate),
  toasts, donut chart center (JS-truncated with auto-shrink for long values)
  and legend, add-expense split rows, select triggers, profile name/email,
  and a global no-horizontal-scroll guard.
- **App-wide bounding system ("text yields, numbers hold")** — every row and
  card bounds its content: names/descriptions flex and ellipsize (2-line
  clamp for expense descriptions), amounts never wrap and use tabular
  numerals so columns align; the hero amount scales fluidly; Insights
  overview stats use the compact lakh-proof format. No value, however long,
  can push or break neighbouring UI. Documented in docs/DESIGN.md.
- **Personal: month-by-month totals are now fixed-size boxes** — a grid of
  identical cards (label / combined total / personal · groups breakdown)
  instead of text rows. Amounts use a lakh-proof compact format
  (`fmtMoneyShort`): paise shown under ₹1,000, whole rupees above, Indian
  digit grouping — so even ₹1,23,45,679 fits without breaking the layout.
- **Home screen simplified** — the group spending totals card was removed
  from Balances; home is now: your balance → net balances (with avatars) →
  who pays whom. Totals live in Insights behind tap-to-reveal.
- Settle suggestions show payer → payee avatars, and amounts are colored
  green/red relative to you (owed / you pay).
- **Mobile-native hardening:** ≥52px tab targets and ≥40px buttons, 16px
  inputs on small screens (no iOS focus zoom), transparent tap highlight,
  `touch-action: manipulation`, no overscroll chaining, safe-area gutters
  on notched devices.

## [2.1.0] — 2026-09-05

### Added
- **Personal tab: true monthly total** — the hero now shows personal spend
  **plus your share of expenses across all your groups**, and a new
  "Month-by-month total" card breaks every month into personal · groups.

### Changed
- Profile updates now also refresh group data immediately.
- PWA: the on-demand pdf.js chunk is excluded from the service-worker precache
  (it exceeded Workbox's limit and shouldn't slow first visits); it loads from
  the network when a PDF is imported.
- Demo mock: `.in()` filter support so the combined-spend feature works in the
  offline preview.

## [2.0.0] — 2026-08-31

> **Upgrade note:** run `supabase/migration_v4.sql` once in the Supabase SQL Editor
> **before** deploying this version. The migration is purely additive — existing
> data is untouched and the old app keeps working during rollout.

### Added
- **App-start splash screen** — a branded ÷ splash while the session loads,
  easing into the app (motion respects `prefers-reduced-motion`).
- **Pay via GPay / PhonePe / Paytm on Settle** — add your UPI ID on your
  profile (optional) and flatmates who owe you get a **Pay** button with an
  app chooser (GPay, PhonePe, Paytm, or any UPI app) that opens the chosen
  app with payee, amount, and note pre-filled (₹ groups only). When you
  return to FlatSplit it asks "Did the payment go through?" — one tap records
  the settlement. Confirmation stays with the human because peer-to-peer UPI
  intents can't report success back to a web app.
- **Bank statement import + Money personality** (Personal tab) — export a CSV
  statement from netbanking and import it: parsing and categorisation happen
  entirely on your device (the file is never uploaded). Common Indian bank
  formats are auto-detected, merchants are auto-classified (Swiggy → Food,
  Uber → Transportation, Netflix → Subscriptions, …), every row is reviewable
  and editable before saving, credits/salary are ignored, and re-importing the
  same statement can't create duplicates. From all your personal expenses the
  app then computes a **money personality** — an archetype (The Foodie, The
  Weekend Warrior, The Steady Nester, …) with traits like top category,
  weekend share, busiest day, fixed-vs-flexible ratio, and biggest splurge.
  A built-in sample statement lets you try it without a real file.
  **PDF statements are supported too** — text-based bank PDFs are parsed by
  reconstructing the transaction table from the PDF's text layout (separate
  withdrawal/deposit columns, single-amount columns via running-balance
  deltas, Dr/Cr suffixes, and multi-line narrations all handled), including
  **password-protected PDFs** with an on-device unlock prompt. Scanned/image
  PDFs aren't supported. The PDF engine (pdf.js) loads lazily only when a
  PDF is picked, so the app itself stays light.
- **Recurring expenses** — set up rent, Wi-Fi, maid etc. once under Group settings
  and they're added automatically every month on the due day, split equally among
  the chosen members. Rules can be paused, resumed, and deleted; generation is
  idempotent and catches up on missed months.
- **Comments & reactions** — every expense in Activity now opens into a comment
  thread with emoji reactions (👍 ❤️ 😂 😮 👀 🔥), synced live across the group.
- **Personal expense tracker** — a new Personal tab for private daily spending,
  with monthly grouping and its own category donut. Privacy is enforced by
  Row Level Security at the database, not just hidden in the UI.
- **Profile page** — person icon in the top bar; edit your display name (updates
  everywhere), see your stats for the group and your group memberships.
- **Monthly splits** — Activity is organised into collapsible "August 2026 split"
  sections showing each month's total, your share, and settled amounts.
- **Interactive Insights** — the category breakdown is now a tappable SVG donut
  with drill-down into the underlying expenses; monthly bars are clickable to
  drill into a month.
- **Settlement history** — the Settle screen lists every payment ever recorded
  with a running total.
- **Undo delete** — deleting an expense or payment shows an Undo action in the
  toast for a few seconds.
- Friendly setup screen when Supabase env vars are missing (instead of a blank
  page crash).
- `npm run build:demo` — builds a self-contained, backend-mocked demo preview
  (`dist-demo/index.demo.html`) that runs from a local file for showcasing the UI.

### Changed
- **Login screen redesigned** — full-height pine scene with brand hero,
  mode-aware headline, floating card, and a password show/hide toggle. Same
  email/password and Google sign-in underneath.
- **Insights:** "Total spent" and "Average per month" are hidden behind a
  tap-to-reveal (eye icon) by default; the Monthly spending heading total obeys
  the same toggle.
- **Balances:** group spending totals ("Total group expenses" + per-person
  spending) are now a single collapsible "Spending summary" — tap to expand,
  hidden by default so balances stay front and centre.
- **Profile:** name editing is a small pencil icon next to the name; "Your
  numbers in this group" is a tap-to-expand section.
- **Bottom tab bar:** Personal replaced Settle. Settle is now reached from the
  button on the Balances screen (labelled "Record a payment" when balances are
  pending, "Settlement history" when square) and still supports the `?tab=settle`
  PWA shortcut.
- Page transitions and reaction micro-animations added, respecting
  `prefers-reduced-motion`.
- Toasts can now carry an action button (used for Undo).

### Database (migration_v6.sql)
- `personal_expenses.source` ('manual' | 'import') and `personal_expenses.import_hash`
  with a per-user unique index so statement re-imports are idempotent.

### Database (migration_v5.sql)
- `profiles.upi_id` (optional, format-checked) for the Settle pay buttons.

### Database (migration_v4.sql)
- New tables: `recurring_expenses`, `expense_comments`, `expense_reactions`,
  `personal_expenses` — all with Row Level Security.
- New RPC: `generate_due_recurring(gid)` (idempotent, safe to call on every load).
- Ensured `profiles` update policy so users can edit their own name.
- New tables added to the realtime publication.
- No changes to any existing table, row, policy, or RPC signature.

## [1.0.0]

- Initial release: groups with invite codes, expenses with four split types
  (equal / exact / percent / shares), balances with debt simplification,
  settlements, Activity with search & category filters, Insights with CSV
  export, per-group currency, dark mode, PWA install, realtime sync,
  edit/repeat expenses, admin roles with transfer/leave/soft-delete.
