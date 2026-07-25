-- Run this if migration_v2.sql gave errors on the policy lines
drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update" on public.expenses
  for update to authenticated using (public.is_member(group_id))
  with check (public.is_member(group_id));

drop policy if exists "settlements_update" on public.settlements;
create policy "settlements_update" on public.settlements
  for update to authenticated using (public.is_member(group_id))
  with check (public.is_member(group_id));
