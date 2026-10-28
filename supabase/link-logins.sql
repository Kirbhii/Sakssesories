-- ════════════════════════════════════════════════════════════════════════════
-- Link the logins to their staff records
--
-- RUN THIS IF: signing in works, but the app answers "this login has no staff
-- record linked to it yet".
--
-- Why it happens: `schema.sql` links a login to a member with a trigger that
-- fires when a user is CREATED. If the users were added in
-- Authentication → Users before that file was pasted, the trigger never saw
-- them — the login is real, but nothing points at it.
--
-- Safe to run as often as you like. It only fills in blanks, never overwrites.
-- Paste the whole file and run it; the two SELECTs at the bottom print the
-- answer.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Join every login to the profile with the same email.
update public.profiles p
set auth_id = u.id
from auth.users u
where lower(p.email) = lower(u.email)
  and p.auth_id is null;

-- 2. Who can sign in now?
select
  slug,
  full_name,
  role,
  email,
  auth_id is not null as can_log_in
from public.profiles
order by can_log_in desc, slug;

-- 3. Any login that still matches nobody.
--
--    An empty result here means every login has a home — you are done.
--
--    A row here means that login uses a different email from the one seeded in
--    `profiles`. Either sign in with the address shown, or move the profile
--    onto it:
--
--      update public.profiles set email = 'the.address@you.used'
--       where slug = 'gabriel';
--
--    then run step 1 again.
select u.email as login_with_no_profile
from auth.users u
left join public.profiles p on lower(p.email) = lower(u.email)
where p.slug is null;
