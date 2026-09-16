-- ============================================================
-- FlatSplit — migration v8
-- Limit edits, deletes and payment records to the people involved.
--
-- Before this:
--   * any group member could edit or delete any expense in the group
--   * any group member could delete any settlement
--   * any group member could record a payment between two *other*
--     members, inventing a transfer they had no part in
--
-- After this:
--   * only the person who added an expense can edit or delete it
--   * only the person who recorded a payment can change or delete it
--   * a payment can only be recorded if you are the payer or the
--     receiver
--
-- There is deliberately no group-owner override.
--
-- Run this whole file once in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ---------- Expenses ----------

-- update_expense is SECURITY DEFINER, so it runs past the RLS policy
-- below. The ownership check has to live inside the function as well,
-- or the policy is decorative for every edit the app makes.
create or replace function public.update_expense(
  eid uuid,
  descr text,
  total numeric,
  payer uuid,
  edate date,
  stype text,
  cat text,
  splits jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  gid uuid;
  owner uuid;
  split_sum numeric;
begin
  select group_id, created_by into gid, owner
  from public.expenses where id = eid;
  if gid is null then raise exception 'Expense not found'; end if;
  if not public.is_member(gid) then
    raise exception 'You are not a member of this group';
  end if;
  if owner is distinct from auth.uid() then
    raise exception 'Only the person who added this expense can edit it';
  end if;

  select coalesce(sum((s ->> 'amount')::numeric), 0)
  into split_sum
  from jsonb_array_elements(splits) s;

  if abs(split_sum - total) > 0.02 then
    raise exception 'Split amounts do not add up to the total';
  end if;

  update public.expenses set
    description = trim(descr),
    amount = round(total, 2),
    paid_by = payer,
    split_type = stype,
    category = nullif(trim(cat), ''),
    expense_date = edate
  where id = eid;

  delete from public.expense_splits where expense_id = eid;

  insert into public.expense_splits (expense_id, user_id, amount)
  select eid, (s ->> 'user_id')::uuid, round((s ->> 'amount')::numeric, 2)
  from jsonb_array_elements(splits) s
  where (s ->> 'amount')::numeric > 0;
end;
$$;
grant execute on function public.update_expense(uuid, text, numeric, uuid, date, text, text, jsonb) to authenticated;

drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update" on public.expenses
  for update to authenticated
  using (public.is_member(group_id) and created_by = auth.uid())
  with check (public.is_member(group_id) and created_by = auth.uid());

drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_delete" on public.expenses
  for delete to authenticated
  using (public.is_member(group_id) and created_by = auth.uid());

-- ---------- Settlements ----------

-- You must be one end of the transfer. created_by = auth.uid() alone
-- was not enough: it recorded *who typed it*, not who paid.
drop policy if exists "settlements_insert" on public.settlements;
create policy "settlements_insert" on public.settlements
  for insert to authenticated
  with check (
    public.is_member(group_id)
    and created_by = auth.uid()
    and (from_user = auth.uid() or to_user = auth.uid())
  );

drop policy if exists "settlements_update" on public.settlements;
create policy "settlements_update" on public.settlements
  for update to authenticated
  using (public.is_member(group_id) and created_by = auth.uid())
  with check (
    public.is_member(group_id)
    and created_by = auth.uid()
    and (from_user = auth.uid() or to_user = auth.uid())
  );

drop policy if exists "settlements_delete" on public.settlements;
create policy "settlements_delete" on public.settlements
  for delete to authenticated
  using (public.is_member(group_id) and created_by = auth.uid());
