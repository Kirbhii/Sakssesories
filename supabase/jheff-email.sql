-- ── Jheff: move his roster entry to his shop address ───────────────────────
--
-- Run this AFTER you have changed his email in Authentication → Users.
--
-- Two separate things hold his address:
--   auth.users.email     the login — only the dashboard can change this
--   public.profiles.email what the app shows on his Profile screen
--
-- Change only one and the app tells a small lie: either it shows an address
-- nobody can sign in with, or he signs in with an address the roster has never
-- heard of. This file fixes the second one.
--
-- Do NOT skip straight to "Add user" with jheff@marketing.com while the row
-- below still says jheff@gmail.com. The auto-roster trigger links by email, so
-- a different address looks like a different person and it will happily create
-- a SECOND Jheff — the new one empty, the old one holding all the history.
-- Changing the existing user's email keeps the same user id, so nothing splits.

-- ── Guard: refuse if a second Jheff already exists ─────────────────────────
do $$
declare
  n int;
begin
  select count(*) into n
    from public.profiles
   where lower(full_name) like '%jheff%';

  if n > 1 then
    raise exception
      'There are % Jheff rows. Delete the empty duplicate before running this.', n;
  end if;
end $$;

-- ── The change ─────────────────────────────────────────────────────────────
-- Safe to run twice: the second run matches nothing and updates nothing.
update public.profiles
   set email = 'jheff@marketing.com'
 where slug  = 'jheff'
   and lower(coalesce(email, '')) <> 'jheff@marketing.com';

-- ── Check: one Jheff, marketing, on the shop domain, with a login ──────────
select slug,
       full_name,
       email,
       role,
       department,
       case when auth_id is null then 'no login' else 'can sign in' end as login
  from public.profiles
 where lower(full_name) like '%jheff%'
 order by slug;
