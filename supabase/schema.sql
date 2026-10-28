-- ════════════════════════════════════════════════════════════════════════════
-- Saksesories PH — database
--
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- It is safe to run twice: every object is guarded with IF NOT EXISTS, and the
-- seed at the bottom only inserts a profile if that slug is not there yet.
--
-- What this does NOT do: create logins. You add those in
-- Authentication → Users (see the notes at the very bottom). A login only
-- becomes useful once its email matches a row in `profiles` — the trigger at
-- the end links the two the moment the account is created.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Members ────────────────────────────────────────────────────────────────
-- `slug` is the short id the app already uses everywhere ('ana', 'gabriel').
-- Keeping it as the primary key means no mapping layer: a sale stores
-- staff_slug = 'ana' exactly like the localStorage version did.
--
-- `auth_id` is filled in when that person signs up with the matching email.
-- Until then the row exists (so quotas and old sales still resolve) but nobody
-- can log in as it.
create table if not exists public.profiles (
  slug        text primary key,
  email       text not null unique,
  full_name   text not null,
  role        text not null check (role in ('marketing', 'production', 'finance', 'gm')),
  department  text not null check (department in ('marketing', 'production', 'finance')),
  active      boolean not null default true,
  auth_id     uuid unique references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ─── Payment accounts ───────────────────────────────────────────────────────
-- One row per member per method. `approved` is the bit that makes it usable:
-- an account nobody has checked is not offered to a customer, because the only
-- proof that the code belongs to that member is a person looking at it.
create table if not exists public.payment_accounts (
  id             uuid primary key default gen_random_uuid(),
  member_slug    text not null references public.profiles (slug) on delete cascade,
  method         text not null,
  label          text not null,
  account_name   text not null,
  account_number text not null,
  -- A downscaled JPEG data URL for now. Move to a Storage bucket when the
  -- images start to matter; the column can stay as the fallback.
  qr             text,
  approved       boolean not null default false,
  approved_by    text references public.profiles (slug),
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (member_slug, method)
);

create index if not exists payment_accounts_method_idx
  on public.payment_accounts (method) where approved;

-- ─── Sales ──────────────────────────────────────────────────────────────────
-- One row per LINE, not per order: a customer buying two variants under one OR
-- number is two rows sharing `or_no`, exactly how the shop's sheet lists it.
--
-- `sold_on` is a real date, not the app's "days ago" counter. The app derives
-- the counter from the date when it loads, so every existing filter keeps
-- working without being rewritten.
--
-- `status`: a counter cash sale is paid the moment it is rung up. An e-money
-- order is not — the money has not landed yet — so it starts `pending` until
-- someone checks the reference against the member's app.
create table if not exists public.sales (
  id              text primary key,
  or_no           text not null,
  sold_on         date not null default current_date,
  sold_at         time not null default localtime,
  staff_slug      text not null references public.profiles (slug),
  customer        text not null,
  customer_mobile text,
  variant         text not null,
  engraving       text not null default '—',
  occupation      text not null default '—',
  sex             text not null default '—',
  location        text not null default '—',
  qty             integer not null check (qty > 0),
  cents           integer not null check (cents >= 0),
  pay             text not null,
  origin          text not null check (origin in ('counter', 'customer')),
  status          text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  pay_ref         text,
  created_at      timestamptz not null default now()
);

create index if not exists sales_staff_idx on public.sales (staff_slug, sold_on desc);
create index if not exists sales_or_idx on public.sales (or_no);

-- ════════════════════════════════════════════════════════════════════════════
-- Who is asking
-- ════════════════════════════════════════════════════════════════════════════
-- These are SECURITY DEFINER on purpose. A policy on `profiles` that reads
-- `profiles` would recurse forever; a function that runs as the owner does not.

create or replace function public.my_slug()
returns text
language sql stable security definer set search_path = public
as $$ select slug from profiles where auth_id = auth.uid() and active $$;

create or replace function public.is_gm()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where auth_id = auth.uid() and role = 'gm') $$;

create or replace function public.is_money()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from profiles where auth_id = auth.uid() and role in ('gm', 'finance')) $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Row level security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles         enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.sales            enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
-- A member sees the team roster (needed for the quota strip and the summary's
-- member picker). Nobody sees it without a login.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- ── payment_accounts ────────────────────────────────────────────────────────
-- A member reads and writes only their own codes. The GM reads all of them so
-- they can be approved. A customer never reads this table at all — they call
-- payee_for() instead, which hands back one approved row and nothing else.
drop policy if exists accounts_own on public.payment_accounts;
create policy accounts_own on public.payment_accounts
  for all to authenticated
  using (member_slug = my_slug()) with check (member_slug = my_slug());

drop policy if exists accounts_gm_read on public.payment_accounts;
create policy accounts_gm_read on public.payment_accounts
  for select to authenticated using (is_gm());

drop policy if exists accounts_gm_approve on public.payment_accounts;
create policy accounts_gm_approve on public.payment_accounts
  for update to authenticated using (is_gm()) with check (is_gm());

-- ── sales ───────────────────────────────────────────────────────────────────
-- Own book for a member; the whole team for Finance and the GM. That is the
-- same split the screens already make, so the database enforces it rather than
-- trusting the page to hide a column.
drop policy if exists sales_read on public.sales;
create policy sales_read on public.sales
  for select to authenticated
  using (staff_slug = my_slug() or is_money());

-- A guest checkout has no login, so anon may insert — but only as a customer
-- order, and only as pending. It can never insert a paid counter sale, and it
-- can never read anything back.
drop policy if exists sales_guest_insert on public.sales;
create policy sales_guest_insert on public.sales
  for insert to anon
  with check (origin = 'customer' and status = 'pending');

drop policy if exists sales_staff_insert on public.sales;
create policy sales_staff_insert on public.sales
  for insert to authenticated
  with check (staff_slug = my_slug() or is_money());

-- Only Finance and the GM may change a row after the fact — that is how a
-- pending payment becomes paid, or a mistake becomes void.
drop policy if exists sales_money_update on public.sales;
create policy sales_money_update on public.sales
  for update to authenticated using (is_money()) with check (is_money());

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.payment_accounts to authenticated;
grant select, insert, update on public.sales to authenticated;
grant insert on public.sales to anon;

-- ════════════════════════════════════════════════════════════════════════════
-- The one thing a customer is allowed to ask
-- ════════════════════════════════════════════════════════════════════════════
-- Given a payment method, hand back the single account the customer should pay:
-- among members who published an APPROVED code for it, one row, nothing else.
-- Only the fields the payer has to see are returned — no listing, no other
-- members' accounts, no sales figures.
--
-- NOTE ON THE PICK: the real rule is "whoever needs it most", which needs the
-- quota and the credited count — neither is in the database yet. Until they are,
-- this returns the first approved account in slug order, which is the same
-- answer today because every member is on zero. When the quota moves server-side
-- this ORDER BY becomes the needOf ranking and the app stops choosing at all.
create or replace function public.payee_for(p_method text)
returns table (
  member_slug  text,
  member_name  text,
  method       text,
  label        text,
  account_name text,
  account_number text,
  qr           text
)
language sql stable security definer set search_path = public
as $$
  select p.slug, p.full_name, a.method, a.label, a.account_name, a.account_number, a.qr
  from payment_accounts a
  join profiles p on p.slug = a.member_slug
  where a.method = p_method
    and a.approved
    and a.qr is not null
    and p.active
  order by p.slug
  limit 1;
$$;

grant execute on function public.payee_for(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Linking a login to a member
-- ════════════════════════════════════════════════════════════════════════════
-- The moment a login is created, if its email matches a seeded profile, the two
-- are joined. A login whose email is not on the list links to nothing, and with
-- no profile every policy above denies it — the account exists but can do
-- nothing, which is the right outcome for a stranger who signed up.
create or replace function public.link_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update profiles
     set auth_id = new.id
   where lower(email) = lower(new.email)
     and auth_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_profile();

-- ════════════════════════════════════════════════════════════════════════════
-- The seventeen members
-- ════════════════════════════════════════════════════════════════════════════
-- Emails follow firstname.lastname@saksesories.ph, which is what the sign-in
-- form already generates. Change an email here before creating the login if you
-- want a different one — the two must match exactly or the link never happens.
insert into public.profiles (slug, email, full_name, role, department) values
  ('ana',     'ana.reyes@saksesories.ph',       'Ana Reyes',       'marketing',  'marketing'),
  ('bea',     'bea.lim@saksesories.ph',         'Bea Lim',         'marketing',  'marketing'),
  ('carla',   'carla.domingo@saksesories.ph',   'Carla Domingo',   'marketing',  'marketing'),
  ('rica',    'rica.flores@saksesories.ph',     'Rica Flores',     'marketing',  'marketing'),
  ('paolo',   'paolo.garcia@saksesories.ph',    'Paolo Garcia',    'marketing',  'marketing'),
  ('noel',    'noel.ramos@saksesories.ph',      'Noel Ramos',      'marketing',  'marketing'),
  ('carlo',   'carlo.reyes@saksesories.ph',     'Carlo Reyes',     'production', 'production'),
  ('dennis',  'dennis.yu@saksesories.ph',       'Dennis Yu',       'production', 'production'),
  ('mark',    'mark.bautista@saksesories.ph',   'Mark Bautista',   'production', 'production'),
  ('liza',    'liza.mercado@saksesories.ph',    'Liza Mercado',    'production', 'production'),
  ('kim',     'kim.tan@saksesories.ph',         'Kim Tan',         'production', 'production'),
  ('grace',   'grace.ong@saksesories.ph',       'Grace Ong',       'production', 'production'),
  ('sofia',   'sofia.cruz@saksesories.ph',      'Sofia Cruz',      'production', 'production'),
  ('miguel',  'miguel.torres@saksesories.ph',   'Miguel Torres',   'production', 'production'),
  ('gabriel', 'gabriel.tan@saksesories.ph',     'Gabriel Tan',     'gm',         'finance'),
  ('maria',   'maria.santos@saksesories.ph',    'Maria Santos',    'finance',    'finance'),
  ('anna',    'anna.sy@saksesories.ph',         'Anna Sy',         'finance',    'finance')
on conflict (slug) do nothing;

-- ─── Link the logins that were already there ────────────────────────────────
-- The trigger above only fires for a user created AFTER it exists. If the
-- logins were added in Authentication → Users before this file was pasted, the
-- trigger never saw them, and every one of them signs in successfully and is
-- then told "no staff record linked to this login".
--
-- This is the backfill for exactly that, and it is why the file is safe to
-- paste on a project that already has users. It only fills blanks, so running
-- it again changes nothing.
update public.profiles p
set auth_id = u.id
from auth.users u
where lower(p.email) = lower(u.email)
  and p.auth_id is null;


-- ════════════════════════════════════════════════════════════════════════════
-- Next: create the logins
-- ════════════════════════════════════════════════════════════════════════════
-- Authentication → Users → Add user, one per member you want to be able to sign
-- in. Use the same email as above and tick "Auto Confirm User" so there is no
-- confirmation mail to chase. Start with the three you will demo with:
--
--   gabriel.tan@saksesories.ph     (GM — sees everything)
--   maria.santos@saksesories.ph    (Finance — sees the money)
--   ana.reyes@saksesories.ph       (Marketing — sees her own book only)
--
-- The rest can wait: their profile rows already exist, so their quotas and any
-- old sales still resolve. They simply cannot log in until you add them.
--
-- Then check it worked:
--   select slug, full_name, role, auth_id is not null as can_log_in from profiles;
-- ════════════════════════════════════════════════════════════════════════════
