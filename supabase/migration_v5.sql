-- ============================================================
-- FlatSplit — Migration v5: UPI IDs for one-tap settle
-- Run after migration_v4.sql in Supabase SQL Editor
-- ============================================================

-- Optional UPI ID on each profile. Visible to signed-in users (same as
-- names/emails) so flatmates can pay each other directly. Users edit
-- their own via the existing profiles_update_own policy.
alter table public.profiles add column upi_id text
  check (upi_id is null or upi_id ~ '^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$');
