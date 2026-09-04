-- ============================================================
-- FlatSplit — Migration v6: bank statement import
-- Run after migration_v5.sql in Supabase SQL Editor
-- ============================================================

-- Track where a personal expense came from, and a content hash for
-- imported rows so re-uploading the same statement can't duplicate them.
alter table public.personal_expenses add column source text not null default 'manual';
alter table public.personal_expenses add column import_hash text;

-- NULLs don't collide in a unique index, so manual rows are unaffected;
-- imported rows are unique per user by (date|amount|description) hash.
create unique index personal_expenses_import_unique
  on public.personal_expenses (user_id, import_hash);
