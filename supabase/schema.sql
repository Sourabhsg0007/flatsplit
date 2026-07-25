-- ============================================================
-- FlatSplit — Supabase schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ---------- TABLES ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Someone',
  email text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default '₹',
  invite_code text not null unique,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_by uuid not null references public.profiles (id),
  split_type text not null default 'equal'
    check (split_type in ('equal', 'exact', 'percent', 'shares')),
  category text not null default 'Food & Groceries',
  expense_date date not null default current_date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.expense_splits (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  amount numeric(12,2) not null check (amount >= 0),
  primary key (expense_id, user_id)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null references public.profiles (id),
  to_user uuid not null references public.profiles (id),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_expenses_group on public.expenses (group_id, expense_date desc);
create index idx_settlements_group on public.settlements (group_id, created_at desc);
create index idx_members_user on public.group_members (user_id);

-- ---------- AUTO-CREATE A PROFILE ON SIGNUP ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'someone'), '@', 1)
    ),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- MEMBERSHIP HELPER (avoids recursive RLS) ----------

create or replace function public.is_member(gid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- ---------- ROW LEVEL SECURITY ----------

alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements    enable row level security;

-- Profiles: any signed-in user can read names (needed to show members);
-- you can only edit your own.
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Groups: visible only to members. Creation/joining happens via RPCs below.
create policy "groups_select_member" on public.groups
  for select to authenticated using (public.is_member(id));
create policy "groups_update_member" on public.groups
  for update to authenticated using (public.is_member(id));

-- Group members: members can see who's in their groups.
create policy "members_select" on public.group_members
  for select to authenticated using (public.is_member(group_id));

-- Expenses: members can read and write within their group.
create policy "expenses_select" on public.expenses
  for select to authenticated using (public.is_member(group_id));
create policy "expenses_insert" on public.expenses
  for insert to authenticated
  with check (public.is_member(group_id) and created_by = auth.uid());
create policy "expenses_update" on public.expenses
  for update to authenticated using (public.is_member(group_id))
  with check (public.is_member(group_id));
create policy "expenses_delete" on public.expenses
  for delete to authenticated using (public.is_member(group_id));

-- Expense splits: tied to the parent expense's group.
create policy "splits_select" on public.expense_splits
  for select to authenticated
  using (public.is_member((select group_id from public.expenses e where e.id = expense_id)));
create policy "splits_insert" on public.expense_splits
  for insert to authenticated
  with check (public.is_member((select group_id from public.expenses e where e.id = expense_id)));
create policy "splits_delete" on public.expense_splits
  for delete to authenticated
  using (public.is_member((select group_id from public.expenses e where e.id = expense_id)));

-- Settlements: members can record and delete payments in their group.
create policy "settlements_select" on public.settlements
  for select to authenticated using (public.is_member(group_id));
create policy "settlements_insert" on public.settlements
  for insert to authenticated
  with check (public.is_member(group_id) and created_by = auth.uid());
create policy "settlements_update" on public.settlements
  for update to authenticated using (public.is_member(group_id))
  with check (public.is_member(group_id));
create policy "settlements_delete" on public.settlements
  for delete to authenticated using (public.is_member(group_id));

-- ---------- RPC: create a group ----------

create or replace function public.create_group(group_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  gid uuid;
  code text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if nullif(trim(group_name), '') is null then
    raise exception 'Group name is required';
  end if;

  loop
    code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;

  insert into public.groups (name, invite_code, created_by)
  values (trim(group_name), code, auth.uid())
  returning id into gid;

  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid());

  return gid;
end;
$$;

-- ---------- RPC: join a group with an invite code ----------

create or replace function public.join_group(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into gid
  from public.groups
  where invite_code = upper(trim(code));

  if gid is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing;

  return gid;
end;
$$;

-- ---------- RPC: add an expense with its splits, atomically ----------

create or replace function public.add_expense(
  gid uuid,
  descr text,
  total numeric,
  payer uuid,
  edate date,
  stype text,
  splits jsonb,  -- e.g. [{"user_id":"...","amount":120.50}, ...]
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
    raise exception 'Split amounts (%.2f) do not add up to the total (%.2f)', split_sum, total;
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

grant execute on function public.add_expense(uuid, text, numeric, uuid, date, text, jsonb) to authenticated;
grant execute on function public.add_expense(uuid, text, numeric, uuid, date, text, jsonb, text) to authenticated;

-- ---------- RPC: update an expense with its splits ----------

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
    raise exception 'Split amounts (%.2f) do not add up to the total (%.2f)', split_sum, total;
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

-- ---------- REALTIME (live sync across devices) ----------

alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.expense_splits;
alter publication supabase_realtime add table public.settlements;
alter publication supabase_realtime add table public.group_members;
