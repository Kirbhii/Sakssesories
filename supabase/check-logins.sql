-- ════════════════════════════════════════════════════════════════════════════
-- Who can sign in yet?
-- ════════════════════════════════════════════════════════════════════════════
-- Paste this into the Supabase SQL Editor any time to see where things stand.
-- It only reads; it changes nothing.
--
-- You want every row to say "ok". Anything else tells you what is still to do.
--
--   no login        → the person has not been added in Authentication → Users
--   not confirmed   → added, but "Auto Confirm User" was left unticked
--   ok              → ready to sign in
--
-- The password is up to you. Any password works. There is no rule in this
-- project — use whatever the person can remember.
-- ════════════════════════════════════════════════════════════════════════════

select
  p.slug,
  p.full_name,
  p.role,
  p.email                                as roster_email,
  coalesce(u.email, '— no login —')      as login_email,
  case
    when u.id is null                  then 'no login'
    when u.email_confirmed_at is null  then 'not confirmed'
    else 'ok'
  end                                    as state
from public.profiles p
left join auth.users u on u.id = p.auth_id
order by
  case p.role when 'gm' then 0 when 'finance' then 1 when 'marketing' then 2 else 3 end,
  p.full_name;


-- ════════════════════════════════════════════════════════════════════════════
-- IF YOU LEFT "AUTO CONFIRM USER" UNTICKED
-- ════════════════════════════════════════════════════════════════════════════
-- The link between a login and a staff row is made by a trigger that only
-- fires when a login is CREATED and already confirmed. So a login that was
-- added without the tick, and confirmed afterwards, stays unlinked — and the
-- person can sign in but the app says "this login has no staff record linked
-- to it yet".
--
-- Run the block below and it re-links every login that matches a roster
-- address. It only fills in a link that is missing; it never touches a
-- working one, and it never creates or deletes a row.
--
-- After it runs, sign out and sign in again.
--
-- do $$
-- begin
--   update public.profiles p
--      set auth_id = u.id
--     from auth.users u
--    where lower(p.email) = lower(u.email)
--      and p.auth_id is null
--      and u.email_confirmed_at is not null;
--
--   raise notice 'linked: %',
--     (select count(*) from public.profiles where auth_id is not null);
-- end $$;
