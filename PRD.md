# FlatSplit Product Requirements Document

> Status: aspirational. Built today: quick entry (remembered payer/category/split, repeat expense),
> balance clarity, settlements, categories + search, Insights (monthly/category/person + CSV export),
> per-group currency, dark mode, PWA. Not yet built: recurring expenses, roles/permissions,
> audit trail, invite management.

## 1. Product Overview

FlatSplit helps roommates record shared expenses, understand who owes whom, and settle payments with minimal effort. The product should make the complete loop fast and trustworthy:

```text
Record expense → Understand balance → Settle payment → Track history
```

## 2. Goals

- Reduce the time needed to record a shared expense.
- Make balances understandable without manual calculation.
- Support recurring household bills.
- Make settlements easy to record and verify.
- Give groups confidence through permissions and an activity history.

## 3. Target Users

Small groups of roommates, couples, travelers, or friends sharing expenses. The primary group size is 2–10 people using one currency.

## 4. Scope and Requirements

### A. Quick Expense Entry

- Remember the last payer, category, and split pattern per user.
- Add a “Repeat expense” action from activity history.
- Provide common categories and recent expense suggestions.
- Preserve equal, exact, percentage, and shares splits.
- Validate the expense before saving and show the resulting per-person amounts.

Acceptance criteria: a returning user can record a typical expense in three or fewer interactions after opening the form; the saved split always equals the expense total.

### B. Balance Clarity

- Show the current user’s amount owed or amount to receive at the top.
- Show total paid versus total share for every member.
- Explain balances through expandable expense and settlement details.
- Show a simplified list of recommended transfers.
- Clearly distinguish unsettled, settled, and zero balances.

Acceptance criteria: a user can identify their next payment, recipient, and amount without inspecting every expense.

### C. Recurring Expenses

- Create weekly, monthly, or custom recurring expenses.
- Support start date, next due date, payer, category, and split rules.
- Allow recurring items to be paused, edited, or deleted.
- Generate a pending expense for user confirmation rather than silently charging users.

Acceptance criteria: a group can configure monthly rent or utilities and receive a clear prompt when the next instance is due.

### D. Settlements

- Add “Use suggestion” and “Mark as paid” actions from balance views.
- Record amount, sender, recipient, date, note, and optional payment method.
- Show settlement history and its effect on balances.
- Allow corrections with confirmation and an audit entry.

Acceptance criteria: recording a suggested payment updates the balance immediately and leaves a visible history entry.

### E. Group Management

- Add owner and member roles.
- Allow owners to revoke invite links, remove members, and archive groups.
- Allow members to leave a group after confirmation.
- Support invite-link expiration and regeneration.
- Prevent unauthorized edits or deletion of shared records.

Acceptance criteria: only authorized users can perform group administration or destructive actions.

### F. Insights and Export

- Add monthly totals and category breakdowns.
- Show per-member paid and owed summaries.
- Provide CSV export for expenses and settlements.
- Support date-range filtering.

Acceptance criteria: a user can export a selected period and reconcile the exported totals with the app.

### G. Trust and Transparency

- Record who created, edited, or deleted an expense or settlement.
- Show an activity timeline with timestamps and actors.
- Use confirmation dialogs for destructive actions.
- Display clear errors and retry options when synchronization fails.

Acceptance criteria: users can determine what changed, who changed it, and when.

## 5. Non-Functional Requirements

- Mobile-first responsive experience with keyboard and screen-reader support.
- No secret keys in the client; Supabase RLS remains the authorization boundary.
- Monetary calculations use two-decimal precision and must balance exactly.
- Existing authentication, PWA behavior, and realtime updates must continue working.
- Core screens should remain usable on slow connections and show loading states.

## 6. Delivery Plan

### Phase 1 — Trustworthy Core

Harden data validation and permissions, add balance/split tests, improve error states, add confirmation dialogs, and improve balance explanations.

### Phase 2 — Faster Daily Use

Add remembered form values, repeat expense, recent categories, one-tap settlement, and settlement history improvements.

### Phase 3 — Household Automation

Add recurring expenses, reminders, pending-instance confirmation, and group owner/member controls.

### Phase 4 — Insights and Scale

Add monthly analytics, CSV export, audit timeline, invite management, and broader accessibility improvements.

## 7. Success Metrics

- Median time to record a normal expense: under 30 seconds.
- At least 90% of users can identify their next settlement without assistance.
- Zero discrepancies between expense totals and split totals.
- Fewer than 1% failed save actions without a recoverable error message.
- Recurring expenses and repeat entry become the primary paths for repeat household bills.
