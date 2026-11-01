-- ── Jheff: bring his roster row back and hook it to his login ──────────────
--
-- Two separate things hold a person:
--   auth.users       the login — created in Authentication → Users
--   public.profiles  the roster row the app actually reads
--
-- His roster row was deleted, so the app has nobody to sign in as even though
-- the login exists. This file rebuilds the row and links it.
--
-- Run it AFTER "Add user" in Authentication → Users. Safe to run twice: every
-- step is a no-op the second time.
--
-- If step (C) at the bottom comes back empty, the auto-roster trigger is not
-- installed — that is why "Add user" created no profile at all. Run
-- supabase/auto-roster.sql once, then this file again for anyone else.

-- ── (0) What logins exist for Jheff, and are they confirmed? ───────────────
-- If this comes back empty, the login was never created (or was created under
-- a different address). Note the exact address before going further.
select email,
       email_confirmed_at is not null as confirmed,
       created_at
  from auth.users
 where lower(email) like 'reloba%'
    or lower(email) like 'jheff%'
 order by created_at;

-- ── (A) Confirm the address ────────────────────────────────────────────────
-- The auto-roster trigger deliberately ignores an unconfirmed user: the whole
-- point of confirmation is that somebody proved they own the inbox. "Add user"
-- without ticking "Auto Confirm User" therefore creates a login that can never
-- sign in AND never produces a roster row. These domains are not real inboxes,
-- so the confirmation can never arrive on its own — it has to be set here.
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where lower(email) = 'reloba@marketing.com';

-- ── (B) Rebuild the roster row and link it to that login ───────────────────
-- The slug is 'jheff' on purpose: it is the row his QR codes and his sales
-- already hang off, and changing it would drag them out from under him.
insert into public.profiles (slug, full_name, email, role, department, auth_id)
select 'jheff', 'Jheff Cyril Reloba', 'reloba@marketing.com', 'marketing', 'marketing', u.id
  from auth.users u
 where lower(u.email) = 'reloba@marketing.com'
   and not exists (select 1 from public.profiles p where p.slug = 'jheff');

-- If the row came back some other way (the trigger got there first) but is not
-- linked yet, link it now.
update public.profiles p
   set auth_id = u.id
  from auth.users u
 where lower(u.email) = 'reloba@marketing.com'
   and p.slug = 'jheff'
   and p.auth_id is null;

-- ── (C) Is the auto-roster trigger installed? ──────────────────────────────
-- Empty result = not installed. Run supabase/auto-roster.sql.
select tgname as trigger_name, tgenabled as enabled
  from pg_trigger
 where tgrelid = 'auth.users'::regclass
   and not tgisinternal;

-- ── (D) The result ─────────────────────────────────────────────────────────
-- Want exactly one row: marketing / marketing / can sign in.
select slug,
       full_name,
       email,
       role,
       department,
       case when auth_id is null then 'no login' else 'can sign in' end as login
  from public.profiles
 order by slug;
