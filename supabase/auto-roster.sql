-- ════════════════════════════════════════════════════════════════════════════
-- Make the email domain decide the role
--
-- Paste this into the Supabase SQL Editor and run it once. It is safe to run
-- twice.
--
-- After this, creating a login is the WHOLE job. No INSERT, no profile row to
-- write by hand, no id to copy:
--
--   juan@marketing.com     → marketing,  marketing
--   ana@production.com     → production, production
--   mia@finance.com        → finance,    finance
--   boss@gm.com            → gm,         finance
--
-- The name is guessed from the address too (juan.dela.cruz@marketing.com
-- becomes "Juan Dela Cruz"), and the person can correct it on their own Profile
-- screen the first time they sign in.
--
-- ─── READ THIS BEFORE YOU RUN IT ───────────────────────────────────────────
--
-- This trusts the DOMAIN, and a domain is not a password. If anybody on the
-- internet can sign up, then anybody can type finance.com and read the shop's
-- money. Two things keep that shut, and both are already true here:
--
--   1. Only a CONFIRMED address creates a profile. A stranger who signs up as
--      someone@finance.com cannot confirm it — the mail goes to whoever really
--      owns finance.com, not to them. No profile, no access.
--
--   2. Turn OFF public sign-up anyway:
--      Authentication → Sign In / Providers → Email → "Allow new users to sign
--      up" OFF. Then only you can create accounts, from Authentication → Users.
--
-- With (2) done, the domain is just a shortcut for you, and the risk is gone.
--
-- ─── WHAT IT REFUSES TO DO ─────────────────────────────────────────────────
--
--   • An unknown domain creates nothing. @gmail.com, @yahoo.com, anything not
--     on the list below is left alone — that is what stops a stranger.
--   • An unconfirmed address creates nothing.
--   • It never changes an existing row's role or department. Re-running this
--     cannot demote or promote anybody.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.link_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_local  text;
  mail_domain text;
  role_guess text;
  dept_guess text;
  base_slug  text;
  new_slug   text;
  n          int := 1;
begin
  if new.email is null then
    return new;
  end if;

  -- Only a confirmed address is trusted. A public sign-up is unconfirmed until
  -- the person proves they own the inbox, and that proof is the whole point.
  if new.email_confirmed_at is null then
    return new;
  end if;

  -- A row already carries this email — link it and stop. This is the path the
  -- four seeded people take, and the path `roster.sql` still uses for anyone
  -- whose address is not on a domain below.
  update public.profiles
     set auth_id = new.id
   where lower(email) = lower(new.email)
     and auth_id is null;
  if found then
    return new;
  end if;

  -- Already linked to somebody else? Not ours to touch.
  if exists (select 1 from public.profiles where auth_id = new.id) then
    return new;
  end if;

  -- The domain decides. Anything not listed creates nothing at all.
  mail_domain := lower(split_part(new.email, '@', 2));
  role_guess := case mail_domain
    when 'marketing.com'      then 'marketing'
    when 'production.com'     then 'production'
    when 'prod.com'           then 'production'
    when 'finance.com'        then 'finance'
    when 'gm.com'             then 'gm'
    when 'generalmanager.com' then 'gm'
  end;

  if role_guess is null then
    return new;
  end if;

  -- The GM sits in finance: that is who approves the money.
  dept_guess := case when role_guess = 'gm' then 'finance' else role_guess end;

  -- A slug from the local part, nudged until it is free. Two people called
  -- juan become juan and juan2 rather than colliding.
  raw_local := split_part(new.email, '@', 1);
  base_slug := lower(regexp_replace(raw_local, '[^a-zA-Z0-9]', '', 'g'));
  if base_slug = '' then
    base_slug := 'member';
  end if;

  new_slug := base_slug;
  while exists (select 1 from public.profiles where slug = new_slug) loop
    n := n + 1;
    new_slug := base_slug || n::text;
  end loop;

  insert into public.profiles (slug, email, full_name, role, department, auth_id)
  values (
    new_slug,
    lower(new.email),
    initcap(regexp_replace(raw_local, '[._-]+', ' ', 'g')),
    role_guess,
    dept_guess,
    new.id
  );

  return new;
end;
$$;

-- Re-attach the trigger, in case this database predates it.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_profile();

-- ── Check ──────────────────────────────────────────────────────────────────
-- Everybody who can sign in, and where their role came from.
select
  slug,
  full_name,
  role,
  department,
  email,
  case when auth_id is null then 'no login' else 'can sign in' end as login
from public.profiles
order by role, slug;

-- ── To try it ──────────────────────────────────────────────────────────────
-- Authentication → Users → Add user
--   email:    juan@marketing.com
--   password: anything
--   tick "Auto Confirm User"          ← required, or nothing is created
--
-- Then look at the table above. Juan is already there, already marketing.
-- Sign in as him and the Profile screen will ask him to fix his name.
--
-- A person whose address is NOT on a domain above (a Gmail, say) still gets
-- nothing — add them with the INSERT template in `roster.sql` instead.
