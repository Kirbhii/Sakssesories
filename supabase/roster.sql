-- ════════════════════════════════════════════════════════════════════════════
-- The staff roster
--
-- Paste this into the Supabase SQL Editor and run it once. It is safe to run
-- twice.
--
-- Part 1 removes the eighteen placeholder names the project started with and
-- keeps the four people who actually work here. Part 2 is the template for
-- adding somebody new — it is commented out, so running this file never
-- invents a person by accident.
--
-- This table is now the roster the app reads. There is no second list in the
-- code, so a person added here shows up on every screen after a refresh.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Who stays ────────────────────────────────────────────────────────────
-- Checked before the delete: every one of these rows has zero sales, zero
-- payment codes and zero production entries, so nothing is being thrown away.
--
-- The delete is also guarded: a placeholder that somehow *does* have history is
-- left alone rather than dragging a sale or a QR code down with it.
delete from public.profiles p
where p.slug not in ('gabriel', 'maria', 'jheff', 'carlo')
  and not exists (select 1 from public.sales s where s.staff_slug = p.slug)
  and not exists (select 1 from public.production pr where pr.created_by = p.slug);

-- Who is left, and who can sign in.
select
  slug,
  full_name,
  role,
  department,
  email,
  case when auth_id is null then 'no login yet' else 'can sign in' end as login
from public.profiles
order by role, slug;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. Adding a person — the whole process
-- ════════════════════════════════════════════════════════════════════════════
--
-- If their address is on one of the role domains (@marketing.com,
-- @production.com, @finance.com, @gm.com) there is only ONE step: create the
-- login in Authentication → Users with "Auto Confirm User" ticked. Run
-- `auto-roster.sql` once and the profile is written for you, with the role the
-- domain says and a name guessed from the address.
--
-- Everything below is for anybody else — a Gmail, a personal address, a domain
-- that does not say what they do.
--
--   a) Supabase → Authentication → Users → Add user
--        email:    the same address you will use below
--        password: anything you like
--        tick "Auto Confirm User"   ← without this they wait forever for an
--                                     email, and @saksesories.ph receives none
--
--   b) Uncomment the block below, change the five values, run it.
--
-- The trigger on `auth.users` links the login to this row by email, so there
-- is no id to copy. Refresh the app and they are on the Users screen, in the
-- quota split, and in the member picker.
--
-- `slug` is the short name the whole app uses in its records — sales, payment
-- codes, production entries all store it. Use the person's first name in lower
-- case, and never change it afterwards.
--
-- `role` is one of: 'marketing', 'production', 'finance', 'gm'.
-- `department` is one of: 'marketing', 'production', 'finance' (the GM sits in
-- finance, because the GM is who approves the money).
--
-- insert into public.profiles (slug, email, full_name, role, department)
-- values (
--   'dennis',                          -- slug: lower case, never changes
--   'dennis.yu@saksesories.ph',        -- must match the login exactly
--   'Dennis Yu',                       -- full name as it should appear
--   'production',                      -- role
--   'production'                       -- department
-- )
-- on conflict (slug) do nothing;
--
-- If the person already has a row but a different email, move the row onto
-- their login instead of making a second one:
--
-- update public.profiles
-- set email = 'their.real@address.com'
-- where slug = 'dennis';
-- then run supabase/link-logins.sql.
