-- FlatSplit v2 migration
-- Run this in Supabase SQL Editor after the original schema.sql

-- 1. Add category column to expenses
alter table public.expenses add column if not exists category text;

-- 2. Add UPDATE RLS policies
drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update" on public.expenses
  for update to authenticated using (public.is_member(group_id))
  with check (public.is_member(group_id));

drop policy if exists "settlements_update" on public.settlements;
create policy "settlements_update" on public.settlements
  for update to authenticated using (public.is_member(group_id))
  with check (public.is_member(group_id));

-- 3. Add expense_splits to realtime
alter publication supabase_realtime add table public.expense_splits;

-- 4. Add update_expense RPC
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
  split_sum numeric;
begin
  select group_id into gid from public.expenses where id = eid;
  if gid is null then raise exception 'Expense not found'; end if;
  if not public.is_member(gid) then
    raise exception 'You are not a member of this group';
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

-- 5. Update add_expense RPC to accept optional category
create or replace function public.add_expense(
  gid uuid,
  descr text,
  total numeric,
  payer uuid,
  edate date,
  stype text,
  splits jsonb,
  cat text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  eid uuid;
  split_sum numeric;
begin
  if not public.is_member(gid) then
    raise exception 'You are not a member of this group';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = gid and user_id = payer
  ) then
    raise exception 'Payer is not a member of this group';
  end if;

  select coalesce(sum((s ->> 'amount')::numeric), 0)
  into split_sum
  from jsonb_array_elements(splits) s;

  if abs(split_sum - total) > 0.02 then
    raise exception 'Split amounts do not add up to the total';
  end if;

  insert into public.expenses
    (group_id, description, amount, paid_by, split_type, category, expense_date, created_by)
  values
    (gid, trim(descr), round(total, 2), payer, stype, nullif(trim(cat), ''), edate, auth.uid())
  returning id into eid;

  insert into public.expense_splits (expense_id, user_id, amount)
  select eid, (s ->> 'user_id')::uuid, round((s ->> 'amount')::numeric, 2)
  from jsonb_array_elements(splits) s
  where (s ->> 'amount')::numeric > 0;

  return eid;
end;
$$;
