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
--    A row here means that login uses a different address from the one seeded
--    in `profiles`. Move the profile onto the login rather than the other way
--    round — the person already knows their password, and this is the only
--    thing that has to change:
--
--      update public.profiles
--         set email   = 'the.address@they.use',
--             auth_id = (select id from auth.users where email = 'the.address@they.use')
--       where slug = 'gabriel';
--
--    Then run steps 1 and 3 again to confirm the row is gone.
select u.email as login_with_no_profile
from auth.users u
left join public.profiles p on lower(p.email) = lower(u.email)
where p.slug is null;

-- 4. A login with no profile at all — someone who is not on the roster.
--    They need a row before they can do anything; every policy above answers
--    "no" until there is one. Fill in the real name, role and department:
--
--      insert into public.profiles (slug, email, full_name, role, department, auth_id)
--      values (
--        'newperson',
--        'newperson@gmail.com',
--        'Full Name',
--        'marketing',            -- marketing | production | finance | gm
--        'marketing',            -- marketing | production | finance
--        (select id from auth.users where email = 'newperson@gmail.com')
--      );
--
--    Adding a row here is only half the job: the app keeps its own roster in
--    `src/lib/quota.ts`, and a member missing from there reads as "already at
--    quota", so their sales get credited to a teammate. Add them to `MEMBERS`
--    too, or their quota share is zero.
