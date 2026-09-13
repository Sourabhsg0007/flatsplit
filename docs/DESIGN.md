# FlatSplit design language (v3)

This documents the UI decisions so future changes stay coherent. The v3
facelift studied Splitwise, Tricount, and Settle Up and adopted the patterns
those apps converged on — while keeping FlatSplit's own identity.

## What we learned from the category leaders

1. **Color is the fastest signifier for money direction.** Splitwise's single
   strongest pattern: green = you're owed, red = you owe. Users decode it with
   zero learning. → FlatSplit colors every directional amount: `.pos` green,
   `.neg` red/clay, including settle suggestions relative to *you*.
2. **People-first: show faces.** Tricount puts participant avatars in headers;
   Splitwise's redesigns emphasize per-person rows. → FlatSplit renders an
   initials avatar with a stable per-person color everywhere a person appears
   in a money context (net balances, settle suggestions).
3. **Category icons beat text labels.** Every redesign study replaces plain
   category text with icon chips — expenses become scannable. → Each of the
   9 categories has a fixed icon + tint (`src/lib/categoryMeta.js`), shown as
   a leading chip on Activity and Personal rows.
4. **The home screen is balances, not a dashboard.** Splitwise's own v5
   simplified home to "all your balances in one place". → FlatSplit's home is:
   your balance hero → net balances → who pays whom. Group spending totals
   were removed from home entirely (they live in Insights, behind
   tap-to-reveal, where analysis belongs).
5. **One-handed reach.** Floating central + button in the tab bar (kept),
   44px+ touch targets everywhere (added).

## FlatSplit's own identity (what we deliberately kept unique)

- **The ÷ mark** as logo, splash, and watermark — division as brand.
- **Pine + paper palette** (`#2E5E4E` on warm off-whites) instead of the
  teal/purple gradients common in fintech.
- **Space Grotesk for money** — amounts get their own typeface.
- **Privacy as a visible feature**: totals hidden behind tap-to-reveal,
  on-device statement parsing with the shield note, RLS-backed Personal tab.

## Primitives

| Primitive | File | Rule |
|---|---|---|
| Avatar | `src/components/Avatar.jsx` | Initials + deterministic color from name hash (8-color palette, WCAG-checked fg). Same person = same color everywhere, forever. |
| CategoryChip | `src/components/CategoryChip.jsx` | 34px rounded square, icon at 52% size, 14% tint background. |
| Money | `.money` class | Space Grotesk; `.pos` / `.neg` only when direction matters to *the viewer*. |

## Mobile-native rules (iOS/Android/web parity)

- `viewport-fit=cover` + `env(safe-area-inset-*)` on top bar, tab bar, content
  gutters, FAB — survives notches and gesture bars.
- Inputs are ≥16px on small screens (blocks iOS focus auto-zoom).
- `touch-action: manipulation` + transparent tap highlight on all controls
  (kills the 300ms delay feel and gray flash).
- `overscroll-behavior-y: none` (no rubber-band scroll chaining in the shell).
- Tab bar items ≥52px, all buttons ≥40px hit area (Apple HIG minimum is 44pt
  for primary controls; our tab targets exceed it).
- Layout uses `100dvh` (not `vh`) so mobile URL bars don't cause jumps.
- Animations respect `prefers-reduced-motion` globally.

## The bounding system — "text yields, numbers hold"

Every row and card is a bounded container. The invariant: **a change in any
value can never move, wrap, or break its siblings.**

- **Text cells** (names, descriptions, labels, meta) are the flexible part:
  `flex: 1; min-width: 0` with single-line ellipsis — except expense
  descriptions, which get a 2-line clamp before truncating.
- **Number cells** (`.money`) are the rigid part: `flex: none;
  white-space: nowrap; font-variant-numeric: tabular-nums`. Money is never
  truncated (you can't cut digits off an amount) — instead the text beside it
  yields. Tabular numerals make every digit equal-width so columns of amounts
  align perfectly.
- **Overview numbers** (Insights stats, month boxes, monthly headers) use
  `fmtMoneyShort`: paise under ₹1,000, whole rupees above, Indian grouping —
  bounded length even at crore scale (≤12 chars). Transaction-level amounts
  keep full paise precision everywhere money actually moves.
- **The hero amount** scales fluidly (`clamp(1.55rem, 8.5vw, 2.3rem)`)
  instead of overflowing.
- Fixed-footprint cards (`.month-box` 104px, `.insight-stat-card` ≥92px) hold
  their size regardless of content.

When adding any new UI: put text in a yielding cell, money in a holding cell,
and give the container `min-width: 0`. That's the whole rule.

### Sweep coverage (audited 2026-09-05)

Every surface was audited and bounded: top bar title · card title rows ·
group name + invite code · member lists · net balances · settle suggestions
& history · comments (author truncates, body wraps — long unbroken strings
break instead of overflowing) · toasts (message wraps, action buttons hold) ·
donut center (JS-truncated: SVG text has no CSS ellipsis; value auto-shrinks
past 10 chars) · donut legend · add-expense split rows · select triggers
(chosen value ellipsizes) · profile name/email · import preview rows ·
Insights stats · month boxes · hero amounts. Plus a global guard:
`.content { overflow-x: hidden }` — nothing can leak a horizontal scrollbar.

## Activity row anatomy & tab bar states (v3.1)

- Expense row: `[category chip] [description 1.05rem/550] → [meta pill] → money`.
  The description-to-tag ratio is fixed at **1.5 : 1** (1.05rem : 0.7rem) —
  keep this ratio if either size changes.
- The meta pill (date · payer · your share) is a bordered `999px` pill on
  `--paper`, self-start so it hugs its content, bounded by the row.
- Tab bar: inactive = soft ink; active = 40px filled circle behind the icon
  (`--pine` + white icon in light; `#7FB8A3` + near-black icon in dark),
  lifted `translateY(-7px) scale(1.06)` with a colored shadow — the "popped
  out" 3D state. `:active` presses the circle back in (`scale(0.9)`), spring
  curve `cubic-bezier(0.34, 1.56, 0.64, 1)`. All motion is disabled under
  `prefers-reduced-motion`.
