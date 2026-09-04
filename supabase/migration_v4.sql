-- ============================================================
-- FlatSplit — Migration v4: Recurring expenses, comments &
-- reactions, personal expense tracker, profile editing
-- Run after migration_v3.sql in Supabase SQL Editor
-- ============================================================

-- ---------- RECURRING EXPENSES ----------
-- Splits are stored resolved (per-person amounts), computed in the
-- app when the rule is created. Generation copies them verbatim.

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_by uuid not null references public.profiles (id),
  category text not null default 'Rent',
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  splits jsonb not null,                -- [{ "user_id": uuid, "amount": 123.45 }]
  next_due date not null,
  active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_recurring_group on public.recurring_expenses (group_id, next_due);

alter table public.recurring_expenses enable row level security;

create policy "recurring_select" on public.recurring_expenses
  for select to authenticated using (public.is_member(group_id));
create policy "recurring_insert" on public.recurring_expenses
  for insert to authenticated with check (public.is_member(group_id) and created_by = auth.uid());
create policy "recurring_update" on public.recurring_expenses
  for update to authenticated using (public.is_member(group_id));
create policy "recurring_delete" on public.recurring_expenses
  for delete to authenticated using (public.is_member(group_id));

-- Generate any due recurring expenses for a group. Safe to call on
-- every app load: it advances next_due inside the same statement, so
-- concurrent calls can't double-insert (row lock via FOR UPDATE).
create or replace function public.generate_due_recurring(gid uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  eid uuid;
  made int := 0;
  guard int;
begin
  if not public.is_member(gid) then
    raise exception 'You are not a member of this group';
  end if;

  for r in
    select * from public.recurring_expenses
    where group_id = gid and active and next_due <= current_date
    for update skip locked
  loop
    guard := 0;
    while r.next_due <= current_date and guard < 24 loop
      insert into public.expenses
        (group_id, description, amount, paid_by, split_type, category, expense_date, created_by)
      values
        (gid, r.description, r.amount, r.paid_by, 'equal', r.category, r.next_due, r.created_by)
      returning id into eid;

      insert into public.expense_splits (expense_id, user_id, amount)
      select eid, (s ->> 'user_id')::uuid, round((s ->> 'amount')::numeric, 2)
      from jsonb_array_elements(r.splits) s
      where (s ->> 'amount')::numeric > 0;

      r.next_due := (date_trunc('month', r.next_due) + interval '1 month'
                     + (r.day_of_month - 1) * interval '1 day')::date;
      made := made + 1;
      guard := guard + 1;
    end loop;

    update public.recurring_expenses set next_due = r.next_due where id = r.id;
  end loop;

  return made;
end;
$$;

grant execute on function public.generate_due_recurring(uuid) to authenticated;

-- ---------- COMMENTS ON EXPENSES ----------

create table public.expense_comments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index idx_comments_expense on public.expense_comments (expense_id, created_at);

alter table public.expense_comments enable row level security;

create policy "comments_select" on public.expense_comments
  for select to authenticated using (
    public.is_member((select group_id from public.expenses where id = expense_id))
  );
create policy "comments_insert" on public.expense_comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_member((select group_id from public.expenses where id = expense_id))
  );
create policy "comments_delete_own" on public.expense_comments
  for delete to authenticated using (user_id = auth.uid());

-- ---------- EMOJI REACTIONS ON EXPENSES ----------

create table public.expense_reactions (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','😮','👀','🔥')),
  created_at timestamptz not null default now(),
  primary key (expense_id, user_id, emoji)
);

alter table public.expense_reactions enable row level security;

create policy "reactions_select" on public.expense_reactions
  for select to authenticated using (
    public.is_member((select group_id from public.expenses where id = expense_id))
  );
create policy "reactions_insert" on public.expense_reactions
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_member((select group_id from public.expenses where id = expense_id))
  );
create policy "reactions_delete_own" on public.expense_reactions
  for delete to authenticated using (user_id = auth.uid());

-- ---------- PERSONAL (PRIVATE) EXPENSE TRACKER ----------
-- Strictly per-user: nobody else can ever read these rows.

create table public.personal_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'Other',
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_personal_user on public.personal_expenses (user_id, expense_date desc);

alter table public.personal_expenses enable row level security;

create policy "personal_all_own" on public.personal_expenses
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- PROFILE EDITING ----------
-- Make sure users can update their own profile row (name).

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- REALTIME ----------

alter publication supabase_realtime add table public.expense_comments;
alter publication supabase_realtime add table public.expense_reactions;
alter publication supabase_realtime add table public.recurring_expenses;
