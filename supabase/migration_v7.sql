-- ============================================================
-- FlatSplit — migration v7
-- Restrict profile reads to yourself + people you share a group with.
--
-- Before this, "profiles_select" was `using (true)`, so any signed-in
-- user could read every profile row in the database, including email
-- addresses. Signups are open and the publishable key ships in the
-- client bundle, so anyone could register and enumerate all users.
--
-- Run this whole file once in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Shares-a-group helper. SECURITY DEFINER so it bypasses RLS on
-- group_members and cannot recurse back into this policy — same
-- pattern as public.is_member.
--
-- Asymmetric on purpose: *your* membership must be active
-- (left_at is null), but the target's may have ended. That keeps
-- flatmates who left the group readable, so their names still render
-- on the expenses they were part of.
create or replace function public.shares_group(target uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = auth.uid()
      and me.left_at is null
      and them.user_id = target
  );
$$;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_group(id));
