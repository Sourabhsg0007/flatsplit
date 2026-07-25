-- ============================================================
-- FlatSplit — Migration v3: Admin roles & soft-delete
-- Run after schema.sql in Supabase SQL Editor
-- ============================================================

-- ---------- SOFT-DELETE COLUMNS ----------

alter table public.group_members add column left_at timestamptz;
alter table public.groups add column deleted_at timestamptz;

-- ---------- UPDATE MEMBERSHIP HELPER ----------

create or replace function public.is_member(gid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and left_at is null
  );
$$;

-- ---------- UPDATE RLS ----------

drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select to authenticated using (public.is_member(id) and deleted_at is null);

-- ---------- UPDATE JOIN TO REACTIVATE LEFT MEMBERS ----------

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
  on conflict (group_id, user_id) do update set left_at = null;

  return gid;
end;
$$;

-- ---------- RPC: REMOVE MEMBER (ADMIN ONLY) ----------

create or replace function public.remove_member(gid uuid, target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_member(gid) then
    raise exception 'You are not a member of this group';
  end if;
  if not exists (select 1 from public.groups where id = gid and created_by = auth.uid()) then
    raise exception 'Only the group owner can remove members';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Use leave_group to remove yourself';
  end if;

  update public.group_members set left_at = now()
  where group_id = gid and user_id = target_user_id and left_at is null;
end;
$$;

grant execute on function public.remove_member(uuid, uuid) to authenticated;

-- ---------- RPC: LEAVE GROUP (ANY MEMBER) ----------

create or replace function public.leave_group(gid uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_member(gid) then
    raise exception 'You are not a member of this group';
  end if;

  update public.group_members set left_at = now()
  where group_id = gid and user_id = auth.uid() and left_at is null;
end;
$$;

grant execute on function public.leave_group(uuid) to authenticated;

-- ---------- RPC: TRANSFER OWNERSHIP & LEAVE (ADMIN ONLY) ----------

create or replace function public.transfer_and_leave(gid uuid, new_owner_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_member(gid) then
    raise exception 'You are not a member of this group';
  end if;
  if not exists (select 1 from public.groups where id = gid and created_by = auth.uid()) then
    raise exception 'Only the group owner can transfer ownership';
  end if;
  if not exists (select 1 from public.group_members where group_id = gid and user_id = new_owner_id and left_at is null) then
    raise exception 'New owner must be an active member';
  end if;

  update public.groups set created_by = new_owner_id where id = gid;
  update public.group_members set left_at = now()
  where group_id = gid and user_id = auth.uid() and left_at is null;
end;
$$;

grant execute on function public.transfer_and_leave(uuid, uuid) to authenticated;

-- ---------- RPC: SOFT-DELETE GROUP (ADMIN ONLY) ----------

create or replace function public.delete_group(gid uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_member(gid) then
    raise exception 'You are not a member of this group';
  end if;
  if not exists (select 1 from public.groups where id = gid and created_by = auth.uid()) then
    raise exception 'Only the group owner can delete the group';
  end if;

  update public.groups set deleted_at = now() where id = gid;
  update public.group_members set left_at = now() where group_id = gid and left_at is null;
end;
$$;

grant execute on function public.delete_group(uuid) to authenticated;
