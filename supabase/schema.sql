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
  -- The member's own details, filled in on the Profile screen.
  phone       text,
  address     text,
  birthday    date,
  -- A downscaled JPEG data URL (~25 KB), the same way `payment_accounts.qr`
  -- stores a code: small enough to travel with the row, so there is no bucket
  -- to create and no orphaned files to clean up.
  avatar      text,
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
  unique (member_slug, method),
  -- The picture itself, never a link. A link can be re-pointed at a different
  -- picture after the code has been approved, and the approval would not know.
  constraint payment_accounts_qr_is_image
    check (qr is null or qr like 'data:image/%')
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
  -- Finance marks an order "remitted" once its money has been turned in. Off by
  -- default; only Finance and the GM may flip it (policy sales_money_update).
  remitted        boolean not null default false,
  -- Where the order is in the shop, as opposed to where the money is. Kept
  -- separate from `status` because an order can be paid and still on the table.
  stage           text not null default 'placed'
                  check (stage in ('placed', 'preparing', 'ready', 'shipped',
                                   'claimed', 'delivered', 'cancelled')),
  created_at      timestamptz not null default now()
);

create index if not exists sales_staff_idx on public.sales (staff_slug, sold_on desc);
create index if not exists sales_or_idx on public.sales (or_no);

-- ─── Production ─────────────────────────────────────────────────────────────
-- The manual production log that replaced the old inventory screen, and the
-- numbers behind the sheet the shop keeps by hand:
--
--   Beg. Inventory + Produced − Sold − Rejects = Ending Inventory
--
-- Production types `qty` (pieces that came out good) and `rejected` (pieces
-- thrown away). One row per (day, variant) addition; the app sums them for the
-- day. Append-only — a second batch on the same day is simply another row, so
-- the history shows everything that was added.
--
-- `qty` may be 0: a day can be all rejects, and that still has to be recorded.
-- The check keeps an empty row from ever being written.
create table if not exists public.production (
  id          uuid primary key default gen_random_uuid(),
  produced_on date not null default current_date,
  variant_key text not null,
  qty         integer not null default 0 check (qty >= 0),
  rejected    integer not null default 0 check (rejected >= 0),
  created_by  text references public.profiles (slug),
  created_at  timestamptz not null default now(),
  constraint production_not_empty check (qty > 0 or rejected > 0)
);

create index if not exists production_day_idx
  on public.production (produced_on desc, variant_key);

-- ─── Quotas, set by hand ────────────────────────────────────────────────────
-- Each person has a target for the whole month AND a target for each week
-- inside it. Nothing is divided: Marketing or the GM types every number.
--
-- `week = 0` is the whole month; 1..5 are the weeks inside it. A week here is
-- a block of days counted from the 1st (1–7, 8–14, 15–21, 22–28, 29–end) —
-- deliberately not the Saturday-to-Friday remittance week on the Summary
-- screen, because a target is set as "week 1 of November" and partial weeks at
-- the edges would make two months impossible to compare.
--
-- `month` is part of the key, so December is a fresh sheet. Nothing carries
-- over, and a month with no rows simply has no targets yet.
create table if not exists public.member_quotas (
  member_slug text not null references public.profiles (slug) on delete cascade,
  month       date not null,
  week        smallint not null default 0,
  pieces      integer not null default 0,
  set_by      text references public.profiles (slug) on delete set null,
  set_at      timestamptz not null default now(),

  primary key (member_slug, month, week),
  constraint member_quotas_week_range check (week between 0 and 5),
  constraint member_quotas_month_is_first check (extract(day from month) = 1),
  constraint member_quotas_pieces_sane check (pieces >= 0 and pieces <= 100000)
);

create index if not exists member_quotas_month_idx
  on public.member_quotas (month, member_slug);

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

-- Marketing owns the monthly number and the GM signs off on it, so both of
-- them may write a quota. Everyone else may only read one.
create or replace function public.is_quota_keeper()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles
    where auth_id = auth.uid()
      and active
      and role in ('marketing', 'gm')
  )
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Row level security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles         enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.sales            enable row level security;
alter table public.production       enable row level security;

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

-- ── payment_accounts: who may approve ───────────────────────────────────────
-- `accounts_own` checks *whose* row is being written, never what is being
-- written — so on its own it would let a member approve their own code. And an
-- approval that survives an edit is worse: approve a real code, swap the
-- picture, keep the approval.
--
-- So: if the writer is not the GM, the row always lands unapproved, whatever
-- they sent. Any edit goes back for review, because the thing that was approved
-- is the picture that was there at the time.
--
-- Runs as the owner because `is_gm()` reads `profiles`, and a policy on
-- `profiles` that reads `profiles` would recurse.
create or replace function public.guard_payment_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_gm() then
    new.approved    := false;
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_payment_account on public.payment_accounts;
create trigger guard_payment_account
  before insert or update on public.payment_accounts
  for each row execute function public.guard_payment_account();

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
  with check (
    (staff_slug = my_slug() or is_money())
    -- A sale cannot arrive already handed in. Otherwise the cash it represents
    -- never shows up on the list of money still owed. Finance marks it later.
    and remitted = false
  );

-- Only Finance and the GM may change a row after the fact — that is how a
-- pending payment becomes paid, or a mistake becomes void.
drop policy if exists sales_money_update on public.sales;
create policy sales_money_update on public.sales
  for update to authenticated using (is_money()) with check (is_money());

-- ── member_quotas ───────────────────────────────────────────────────────────
-- Every signed-in member reads the whole sheet: a target is not a secret, and
-- the quota strip already shows everyone's number. Only Marketing and the GM
-- may change one.
alter table public.member_quotas enable row level security;

drop policy if exists quotas_read on public.member_quotas;
create policy quotas_read on public.member_quotas
  for select to authenticated using (true);

drop policy if exists quotas_write on public.member_quotas;
create policy quotas_write on public.member_quotas
  for all to authenticated
  using (public.is_quota_keeper())
  with check (public.is_quota_keeper());


-- ─── The price list ─────────────────────────────────────────────────────────
-- The price lived only in the browser, so the browser decided what a sale cost
-- and the database wrote down whatever it was told. Anybody with developer
-- tools — or `curl` — could ring a ₱59 keychain at ₱5.
--
-- The list lives here now, and `guard_sale_price` refuses any row that arrives
-- cheaper than it. `label` is exactly what `sales.variant` holds, so there is
-- no mapping to keep in step. These rows must agree with `SHAPES` and `COLOURS`
-- in src/lib/data.ts; lowering a price here is a deliberate act, and lowering
-- one only in the app makes the till refuse that variant.
create table if not exists public.variants (
  label   text primary key,
  shape   text not null,
  colour  text not null,
  price   integer not null check (price >= 0)
);

-- No grants, and row level security on with no policy: the table is shut twice
-- over. Only the guard reads it, and an owner is not subject to RLS.
alter table public.variants enable row level security;
revoke all on public.variants from anon, authenticated;

insert into public.variants (label, shape, colour, price) values
  ('Heart / Navy blue',   'Heart',    'Navy blue', 5900),
  ('Heart / Tan',         'Heart',    'Tan',       5900),
  ('Heart / Pink',        'Heart',    'Pink',      5900),
  ('Heart / Maroon',      'Heart',    'Maroon',    5900),
  ('Heart / Purple',      'Heart',    'Purple',    5900),
  ('Heart / Black',       'Heart',    'Black',     5900),
  ('Teardrop / Navy blue','Teardrop', 'Navy blue', 5900),
  ('Teardrop / Tan',      'Teardrop', 'Tan',       5900),
  ('Teardrop / Pink',     'Teardrop', 'Pink',      5900),
  ('Teardrop / Maroon',   'Teardrop', 'Maroon',    5900),
  ('Teardrop / Purple',   'Teardrop', 'Purple',    5900),
  ('Teardrop / Black',    'Teardrop', 'Black',     5900)
on conflict (label) do nothing;

-- The cheapest an honest row can be: the price list plus engraving, times the
-- pieces. First two letters free, ₱2 each after that — the same rule as
-- `engravingFee` in data.ts. SECURITY DEFINER so a guest with no rights on
-- `variants` can still have their price checked; it returns a number, never the
-- table. Null means the variant is not on the list.
create or replace function public.sale_min_cents(p_variant text, p_engraving text, p_qty integer)
returns integer
language sql stable security definer set search_path = public
as $$
  select (
           v.price
           + greatest(
               0,
               (case
                  when p_engraving is null or btrim(p_engraving) = '—' then 0
                  else char_length(p_engraving)
                end) - 2
             ) * 200
         ) * greatest(p_qty, 0)
  from public.variants v
  where v.label = p_variant;
$$;

create or replace function public.guard_sale_price()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  expected integer;
begin
  expected := public.sale_min_cents(new.variant, new.engraving, new.qty);

  if expected is null then
    raise exception 'That variant is not on the price list: "%".', new.variant
      using errcode = '23514';
  end if;

  if new.cents < expected then
    raise exception 'Underpriced: % × % comes to at least % centavos, not %.',
      new.qty, new.variant, expected, new.cents
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_sale_price on public.sales;
create trigger guard_sale_price
  before insert on public.sales
  for each row execute function public.guard_sale_price();

-- Select only. Roster rows are made by the auto-roster trigger or by hand in
-- the SQL Editor; a signed-in member has no business inserting one, and there
-- is no INSERT policy to allow it anyway.
grant select on public.profiles to authenticated;
-- Column by column on purpose. A whole-row update would let any member set
-- their own `role` to 'gm' and see the whole shop's money.
grant update (full_name, phone, address, birthday, avatar)
  on public.profiles to authenticated;
grant select, insert, update on public.payment_accounts to authenticated;
grant select, insert, update on public.sales to authenticated;
grant insert on public.sales to anon;

-- ── production ──────────────────────────────────────────────────────────────
-- Any signed-in staff member may read the log (Finance may want the totals);
-- only Production and the GM may add to it.
drop policy if exists production_read on public.production;
create policy production_read on public.production
  for select to authenticated using (true);

drop policy if exists production_insert on public.production;
create policy production_insert on public.production
  for insert to authenticated
  with check (
    created_by = my_slug()
    and exists (
      select 1 from public.profiles
      where auth_id = auth.uid() and role in ('production', 'gm')
    )
  );

grant select, insert on public.production to authenticated;

-- ── production: sold counts ─────────────────────────────────────────────────
-- The Production page shows "Sold" next to "Produced" (the shop's sheet does),
-- but a production member may not read the sales table (that is customer data).
-- This returns only the AGGREGATE — pieces sold per variant per day — and only
-- to Production and the GM, so the monitoring numbers work without exposing any
-- customer or money detail.
create or replace function public.production_sold(p_from date, p_to date)
returns table (variant text, sold_on date, qty bigint)
language sql stable security definer set search_path = public
as $$
  select s.variant, s.sold_on, sum(s.qty)::bigint
  from public.sales s
  where s.status <> 'void'
    and s.sold_on between p_from and p_to
    and exists (
      select 1 from public.profiles p
      where p.auth_id = auth.uid() and p.role in ('production', 'gm')
    )
  group by s.variant, s.sold_on;
$$;

grant execute on function public.production_sold(date, date) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- The one thing a customer is allowed to ask
-- ════════════════════════════════════════════════════════════════════════════
-- A signed-out customer can buy from anybody on the roster. They get to pick a
-- name they know, and the order goes to that person — and the code they are
-- shown is that person's own code, because the database is the one that hands
-- it over. The browser cannot swap it for somebody else's.
--
-- Three functions do the work:
--
--   payees_for(method)     the names on the roster, and who has a code
--   payee_of(method, who)  one person's code, and nothing else
--   payee_for(method)      the default: the fewest sales this month
--
-- All three are SECURITY DEFINER — they are the only door open to a customer,
-- and they give back exactly one thing: a name, or a code.

-- ── Who can I buy from? ─────────────────────────────────────────────────────
-- Names only. No account numbers, no codes, no sales figures — a customer
-- gets to say WHO, not to go through the list of accounts.
--
-- The order is the fewest pieces sold this month, so the top of the list is
-- the person who needs the sale most — the same answer the default gives.
create or replace function public.payees_for(p_method text)
returns table (
  member_slug text,
  member_name text,
  has_code    boolean
)
language sql stable security definer set search_path = public
as $$
  with sold as (
    select s.staff_slug, sum(s.qty)::bigint as pieces
    from public.sales s
    where s.status <> 'void'
      and s.sold_on >= date_trunc('month', current_date)::date
    group by s.staff_slug
  )
  select p.slug as member_slug,
         p.full_name as member_name,
         exists (
           select 1
           from public.payment_accounts a
           where a.member_slug = p.slug
             and a.method = p_method
             and a.approved
             and a.qr is not null
         ) as has_code
  from public.profiles p
  left join sold on sold.staff_slug = p.slug
  where p.active
  order by coalesce(sold.pieces, 0), p.full_name, p.slug;
$$;

grant execute on function public.payees_for(text) to anon, authenticated;

-- ── That person's code ──────────────────────────────────────────────────────
-- Exactly one account, and only if that person has an APPROVED code with a
-- picture of it for that method. No rows means they cannot take that method,
-- and the page says so in words rather than showing a code that pays nobody.
create or replace function public.payee_of(p_method text, p_member text)
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
  select p.slug as member_slug,
         p.full_name as member_name,
         a.method as method,
         a.label as label,
         a.account_name as account_name,
         a.account_number as account_number,
         a.qr as qr
  from public.payment_accounts a
  join public.profiles p on p.slug = a.member_slug
  where a.method = p_method
    and p.slug = p_member
    and a.approved
    and a.qr is not null
    and p.active
  limit 1;
$$;

grant execute on function public.payee_of(text, text) to anon, authenticated;

-- ── The default: whoever has sold the fewest pieces this month ─────────────
-- The pool is the people who can actually take this method — a customer must
-- never be pointed at an account that does not exist — and inside that pool
-- the one with the fewest sales this month wins.
--
-- `sales.staff_slug` is whose book the sale is in, and for a customer order
-- that IS the person it was credited to, so this count is the credited count.
-- Voided sales do not count: they are mistakes, not business.
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
  with sold as (
    select s.staff_slug, sum(s.qty)::bigint as pieces
    from public.sales s
    where s.status <> 'void'
      and s.sold_on >= date_trunc('month', current_date)::date
    group by s.staff_slug
  )
  select p.slug as member_slug,
         p.full_name as member_name,
         a.method as method,
         a.label as label,
         a.account_name as account_name,
         a.account_number as account_number,
         a.qr as qr
  from public.payment_accounts a
  join public.profiles p on p.slug = a.member_slug
  left join sold on sold.staff_slug = p.slug
  where a.method = p_method
    and a.approved
    and a.qr is not null
    and p.active
  order by coalesce(sold.pieces, 0), p.slug
  limit 1;
$$;

grant execute on function public.payee_for(text) to anon, authenticated;

-- ── How much each person has sold this month ────────────────────────────────
-- The screens show a quota ring per person, and they used to show nothing at
-- all: the roster carried no counts and every person read as zero. This is
-- the count the ring is drawn from.
--
-- Staff only. A customer never sees anybody's numbers.
create or replace function public.credited_this_month()
returns table (
  member_slug text,
  pieces      bigint
)
language sql stable security definer set search_path = public
as $$
  select p.slug as member_slug,
         coalesce(sum(s.qty), 0)::bigint as pieces
  from public.profiles p
  left join public.sales s
    on s.staff_slug = p.slug
   and s.status <> 'void'
   and s.sold_on >= date_trunc('month', current_date)::date
  where p.active
  group by p.slug;
$$;

grant execute on function public.credited_this_month() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Linking a login to a member
-- ════════════════════════════════════════════════════════════════════════════
-- The moment a login is created, one of two things happens:
--
--   • Its email matches a seeded profile → the two are joined.
--   • Its domain says what the person does (@marketing.com, @production.com,
--     @finance.com, @gm.com) → a profile is created for them on the spot.
--
-- Everything else links to nothing. With no profile, every policy above denies
-- the account: it exists but can do nothing, which is the right outcome for a
-- stranger who signed up.
--
-- The domain is not a password, so two guards sit in front of it: the address
-- has to be CONFIRMED (a stranger cannot confirm someone@finance.com — that
-- mail goes to whoever really owns finance.com), and public sign-up should be
-- switched off in Authentication → Sign In / Providers so only the shop can
-- create accounts at all.
--
-- See `auto-roster.sql` for the same function with the full explanation.
create or replace function public.link_profile()
returns trigger
language plpgsql security definer set search_path = public
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
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;

  update public.profiles
     set auth_id = new.id
   where lower(email) = lower(new.email)
     and auth_id is null;
  if found then
    return new;
  end if;

  if exists (select 1 from public.profiles where auth_id = new.id) then
    return new;
  end if;

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

  dept_guess := case when role_guess = 'gm' then 'finance' else role_guess end;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_profile();

-- ════════════════════════════════════════════════════════════════════════════
-- The seventeen people who actually work here
-- ════════════════════════════════════════════════════════════════════════════
-- `email` is the join key between a login and this row: it has to be exactly
-- the address the person signs in with, or the link never happens. The address
-- also says what they do — @marketing.com, @production.com, @finance.com,
-- @gm.com — so the role on the row and the role the trigger would guess are
-- the same thing.
--
-- `slug` is the short id the app stores in sales, codes and production rows.
-- It is the last name, because that is what the sign-up trigger derives from
-- the address. Jheff is the one exception: he already has a row called 'jheff'
-- and his QR codes and his sales hang off it, so changing the slug would drag
-- them out from under him.
--
-- The app reads this table, so there is no list in the code to keep in step.
-- To add somebody, add their row here (or with the INSERT in `add-person.sql`)
-- and give them a login in Authentication → Users with the same address.
insert into public.profiles (slug, email, full_name, role, department) values
  ('jheff',       'reloba@marketing.com',     'Jheff Cyril Reloba',    'marketing',  'marketing'),
  ('lenon',       'lenon@marketing.com',      'Crystler Lenon',        'marketing',  'marketing'),
  ('carino',      'carino@marketing.com',     'Richelle Cariño',       'marketing',  'marketing'),
  ('evangelista', 'evangelista@marketing.com', 'Juliana Evangelista',    'marketing',  'marketing'),
  ('yu',          'yu@marketing.com',         'Stephen Aaron Yu',      'marketing',  'marketing'),
  ('nisnisan',    'nisnisan@marketing.com',   'Arian Nisnisan',         'marketing',  'marketing'),
  ('pastor',      'pastor@production.com',    'Regine Pastor',         'production', 'production'),
  ('branda',      'branda@production.com',    'Angel Laila Branda',    'production', 'production'),
  ('valdez',      'valdez@production.com',    'Hazel Ann Valdez',      'production', 'production'),
  ('germones',    'germones@production.com',  'Sean Matthew Germones', 'production', 'production'),
  ('flores',      'flores@production.com',    'Tom Christofer Flores', 'production', 'production'),
  ('alnin',       'alnin@production.com',     'Ronnielyn Alnin',       'production', 'production'),
  ('batalla',     'batalla@production.com',   'Janel Batalla',         'production', 'production'),
  ('galicia',     'galicia@production.com',   'Maria Justine Galicia', 'production', 'production'),
  ('gapusan',     'gapusan@finance.com',      'Joseph Farrel Gapusan', 'finance',    'finance'),
  ('nevero',      'nevero@finance.com',       'John Vincent Nevero',   'finance',    'finance'),
  ('dupaya',      'dupaya@gm.com',            'John Paul Dupaya',      'gm',         'finance')
on conflict (slug) do nothing;

-- ─── The placeholders leave ─────────────────────────────────────────────────
-- The project started with four stand-ins: Gabriel Tan (the GM, on a Gmail
-- address), Maria Santos, Carlo Reyes and a plain 'jheff' row. The seventeen
-- above are the real roster, so the stand-ins have no place on it.
--
-- The General Manager changes seat. Gabriel Tan was the GM only as a
-- placeholder; the GM is John Paul Dupaya, and his login is dupaya@gm.com.
-- The old gm@gmail.com login goes with him.
--
-- The GCash code that sat on Gabriel's row is the shop's own, so it is moved
-- to Jheff before Gabriel goes — otherwise the shop would be left with no way
-- to be paid. Sales and production rows are handed to the real GM rather than
-- deleted: a sale is a promise about money, and the ledger must stay whole.
--
-- The approval guard is switched off for the move. It wipes the approval on
-- any write that is not from the GM, and in the SQL editor nobody is signed
-- in, so it would undo exactly what we are doing here. It goes back on before
-- the block ends.
do $$
declare
  guard_off boolean := false;
begin
  begin
    execute 'alter table public.payment_accounts disable trigger guard_payment_account';
    guard_off := true;
  exception when undefined_object then
    null;
  end;

  begin
    update public.production set created_by = null where created_by in ('maria', 'carlo');
    update public.sales      set staff_slug = 'dupaya' where staff_slug in ('gabriel', 'maria', 'carlo');
    update public.production set created_by = 'dupaya' where created_by = 'gabriel';
    update public.payment_accounts set approved_by = null where approved_by in ('gabriel', 'maria', 'carlo');

    update public.payment_accounts
    set member_slug = 'jheff'
    where member_slug = 'gabriel'
      and method = 'gcash'
      and not exists (
        select 1 from public.payment_accounts b
        where b.member_slug = 'jheff' and b.method = 'gcash'
      );

    update public.payment_accounts
    set approved    = true,
        approved_by = 'dupaya',
        approved_at = coalesce(approved_at, now())
    where member_slug = 'jheff' and method = 'gcash' and qr is not null;

    delete from public.profiles where slug in ('gabriel', 'maria', 'carlo');

  exception when others then
    if guard_off then
      execute 'alter table public.payment_accounts enable trigger guard_payment_account';
    end if;
    raise;
  end;

  if guard_off then
    execute 'alter table public.payment_accounts enable trigger guard_payment_account';
  end if;
end $$;

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


-- ─── Order tracking ─────────────────────────────────────────────────────────
-- The customer has no account, so the order number plus the mobile they gave is
-- the only way back to their order. `sales` is readable only by the member who
-- sold the item or by money roles, so a public tracking page cannot be given
-- SELECT on it — the table carries names, mobiles and the whole team's takings.
-- These two functions are the door instead.
--
-- Both keys are required. Order numbers run in sequence, so the number alone
-- would let anyone walk the ledger one guess at a time.

create or replace function public.track_order(p_or text, p_mobile text)
returns table (
  or_no        text,
  placed_on    date,
  placed_at    timestamptz,
  customer     text,
  mobile_last4 text,
  fulfilment   text,
  payment      text,
  pay_status   text,
  stage        text,
  pieces       int,
  cents        int,
  items        text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_or     text := btrim(coalesce(p_or, ''));
  v_digits text := regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g');
begin
  if v_or = '' or v_digits = '' then
    return;
  end if;

  return query
  select
    s.or_no,
    min(s.sold_on),
    min(s.created_at),
    min(s.customer),
    right(regexp_replace(coalesce(min(s.customer_mobile), ''), '\D', '', 'g'), 4),
    min(s.location),
    min(s.pay),
    min(s.status::text),
    min(s.stage),
    sum(s.qty)::int,
    sum(s.cents)::int,
    string_agg(s.variant || ' × ' || s.qty, ', ' order by s.id)
  from public.sales s
  where s.or_no = v_or
    and regexp_replace(coalesce(s.customer_mobile, ''), '\D', '', 'g') = v_digits
    and s.status <> 'void'
  group by s.or_no;
end;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- The seller who rang it up, or anyone who handles money. A policy permissive
-- enough to let a seller touch `stage` would also let them touch `cents` and
-- `status`, and a seller who can mark their own sale paid is the hole the rest
-- of this file is built to close.
create or replace function public.set_order_stage(p_or text, p_stage text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_or text := btrim(coalesce(p_or, ''));
begin
  if v_or = '' then
    return false;
  end if;

  if p_stage not in ('placed', 'preparing', 'ready', 'shipped', 'claimed', 'delivered', 'cancelled') then
    return false;
  end if;

  update public.sales
     set stage = p_stage
   where or_no = v_or
     and (public.is_money() or staff_slug = public.my_slug());

  return found;
end;
$$;

revoke all on function public.set_order_stage(text, text) from public;
grant execute on function public.set_order_stage(text, text) to authenticated;


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
