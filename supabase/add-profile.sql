-- ════════════════════════════════════════════════════════════════════════════
-- Let a member fill in their own profile
--
-- Paste this into the Supabase SQL Editor and run it once. It is safe to run
-- twice: every column and grant is guarded.
--
-- What it adds: a mobile number, an address, a birthday and a photo on each
-- staff row, plus the right for a member to edit those four things and their
-- own name.
--
-- The important part is the last section. Before this, `authenticated` could
-- UPDATE the whole `profiles` row — which means any member could have set their
-- own `role` to 'gm' and seen the whole shop's money. The update right is now
-- column by column, so the database refuses that even if the app were tricked
-- into sending it.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. The new fields ───────────────────────────────────────────────────────
alter table public.profiles add column if not exists phone    text;
alter table public.profiles add column if not exists address  text;
alter table public.profiles add column if not exists birthday date;

-- A downscaled JPEG data URL (~25 KB), the same way `payment_accounts.qr`
-- stores a code. Small enough to travel with the row, so there is no bucket to
-- create and no orphaned files to clean up.
alter table public.profiles add column if not exists avatar   text;

-- ── 2. What a member may change ─────────────────────────────────────────────
-- Drop the whole-row update first. Without this line the column grant below
-- would be meaningless — the old grant still allows `set role = 'gm'`.
revoke update on public.profiles from authenticated;

grant update (full_name, phone, address, birthday, avatar)
  on public.profiles to authenticated;

-- The policy that decides *which rows* may be written already exists in
-- schema.sql (`profiles_self_update`: auth_id = auth.uid()). It is re-stated
-- here so this file works on a database that predates it.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

-- ── Done ────────────────────────────────────────────────────────────────────
-- Open Profile in the rail, change your name, save, and the name in the corner
-- of the rail should change with it.
--
-- Check that the door is really shut — this should come back as an error
-- ("permission denied for column role"), not as a successful update:
--
--   update public.profiles set role = 'gm' where slug = 'carlo';
--
-- Run that as a signed-in member from the app, not here: the SQL Editor runs as
-- the owner and will happily do it.
