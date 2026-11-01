-- ════════════════════════════════════════════════════════════════════════════
-- The roster, and the payee picker
--
-- Paste this into the Supabase SQL Editor and run it once. It is safe to run
-- twice: every statement checks before it writes.
--
-- Four things:
--
--   1. The seventeen people who work here, with an address of the form
--      Lastname@role.com. The address says what the person does, so a login
--      created with it is linked to the right row on its own.
--
--   2. The three placeholder rows (Gabriel Tan, Maria Santos, Carlo Reyes) are
--      switched OFF, not deleted. Their history stays where it is; they simply
--      drop off the roster. Deleting would drag their sales and their QR codes
--      down with them, and a placeholder is not worth a real record.
--
--   3. Two new questions the database can answer for a signed-out customer:
--      "who can I buy from?" and "show me that person's code".
--
--   4. The default answer changed. It used to be "the first name in the
--      alphabet". It is now "the person who has sold the fewest pieces this
--      month" — which is the rule the shop actually wants.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. The seventeen ────────────────────────────────────────────────────────
-- `slug` is the short id the app stores in sales, codes and production rows.
-- It is the last name, because that is what the sign-up trigger derives from
-- the address — so the row written by hand and the row written by signing up
-- are the same row, not two.
--
-- Jheff is the one exception. He already has a row called 'jheff' and his QR
-- codes and his sales hang off it. Changing a slug would drag them out from
-- under him, so his row keeps its name and only its address and full name
-- change.
--
-- The table is dropped and made again every run, so pasting this file twice is
-- safe. It is NOT dropped on commit, because the SQL editor may run each
-- statement on its own — and a table that vanished half way through the file
-- would take the rest of it with it.
drop table if exists pg_temp._roster;

create temp table _roster (
  slug       text primary key,
  email      text not null unique,
  full_name  text not null,
  role       text not null,
  department text not null
);

insert into _roster (slug, email, full_name, role, department) values
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
  ('dupaya',      'dupaya@gm.com',            'John Paul Dupaya',      'gm',         'finance');


-- ── 2. One person, one row ─────────────────────────────────────────────────
-- A login is linked to a profile by ADDRESS. That address can already be on a
-- row for a different reason: the sign-up trigger names a profile after the
-- address, so 'reloba@marketing.com' makes a row called 'reloba'. If that
-- person then also has a row under the name we want, there are two rows for
-- one person and the roster splits in half.
--
-- So: the row we want is kept, and the other one is folded into it — its
-- login, its sales and its codes all move across.
--
-- The approval guard is switched off for the move. That guard exists to stop
-- a member approving their own code, and it works by wiping the approval on
-- any write that is not from the GM. We ARE the GM here, but the guard cannot
-- tell — it asks who is signed in, and in the SQL editor nobody is — so it
-- would wipe the approvals we are trying to move.
--
-- The guard goes back on before this block ends, even if something below
-- fails. A guard left switched off would let any member approve their own
-- code, which is the one thing it is there to stop.
do $$
declare
  t         record;
  by_slug   text;
  by_email  text;
  held_id   uuid;
  guard_off boolean := false;
begin
  begin
    execute 'alter table public.payment_accounts disable trigger guard_payment_account';
    guard_off := true;
  exception when undefined_object then
    null;  -- the guard is not installed; there is nothing to switch off
  end;

  begin
    for t in select slug, email, full_name, role, department from _roster order by slug loop

      select p.slug into by_slug  from public.profiles p where p.slug = t.slug;
      select p.slug into by_email from public.profiles p where lower(p.email) = lower(t.email);

      if by_email is not null and by_email <> t.slug then
        select auth_id into held_id from public.profiles where slug = by_email;

        if by_slug is null then
          -- Nothing under the slug yet, so the row that owns the address is the
          -- one to keep — it may already have a login on it. Correct its name
          -- and its role and leave its slug alone.
          update public.profiles
             set full_name  = t.full_name,
                 role       = t.role,
                 department = t.department,
                 active     = true
           where slug = by_email;
          continue;
        end if;

        -- Let go of the login and the address before the move, so neither one
        -- trips its unique rule on the way across.
        update public.profiles set auth_id = null where slug = by_email;
        update public.profiles
           set email = 'moved-' || t.slug || '@saksesories.ph'
         where slug = by_email;

        update public.sales      set staff_slug = t.slug where staff_slug = by_email;
        update public.production set created_by = t.slug where created_by = by_email;

        update public.payment_accounts a
           set member_slug = t.slug
         where a.member_slug = by_email
           and not exists (
             select 1 from public.payment_accounts b
             where b.member_slug = t.slug and b.method = a.method);

        -- What is left is the same person's account for a method they already
        -- have on the row we kept. The row we kept wins.
        delete from public.payment_accounts where member_slug = by_email;

        update public.profiles
           set email      = t.email,
               full_name  = t.full_name,
               role       = t.role,
               department = t.department,
               active     = true,
               -- The login that owns the address we just took wins. The one
               -- that was on this row belonged to the old address.
               auth_id    = coalesce(held_id, auth_id)
         where slug = t.slug;

        -- Nothing may point at a row that is about to go.
        update public.payment_accounts set approved_by = null where approved_by = by_email;
        delete from public.profiles where slug = by_email;

      elsif by_email is not null then
        update public.profiles
           set full_name  = t.full_name,
               role       = t.role,
               department = t.department,
               active     = true
         where slug = by_email;

      else
        update public.profiles
           set email      = t.email,
               full_name  = t.full_name,
               role       = t.role,
               department = t.department,
               active     = true
         where slug = t.slug;
      end if;
    end loop;
  exception when others then
    -- Put the guard back before the error leaves. The transaction rolls back
    -- the work either way; the guard is not part of the transaction.
    if guard_off then
      execute 'alter table public.payment_accounts enable trigger guard_payment_account';
    end if;
    raise;
  end;

  if guard_off then
    execute 'alter table public.payment_accounts enable trigger guard_payment_account';
  end if;
end $$;


-- ── 3. The people with no row yet ───────────────────────────────────────────
-- `on conflict do nothing` covers both unique rules at once: a slug that is
-- already taken, and an address that is already taken. Either way the row that
-- is already there is the live one, and the block above has already corrected
-- its name and its role.
insert into public.profiles (slug, email, full_name, role, department)
select t.slug, t.email, t.full_name, t.role, t.department
from _roster t
where not exists (select 1 from public.profiles p where p.slug = t.slug)
on conflict do nothing;


-- ── 4. Retire the placeholders ─────────────────────────────────────────────
-- Gabriel Tan, Maria Santos and Carlo Reyes were stand-ins. They are switched
-- off rather than deleted: a sale or a QR code hanging off one of them would
-- be destroyed with it, and the honest reason to switch a person off is that
-- they are no longer on the roster — not that their record should vanish.
--
-- Their rows stay, so anything that points at them still resolves. Their old
-- sign-in addresses go with them: the GM is John Paul Dupaya now, and the
-- GM's login is dupaya@gm.com, so gm@gmail.com stops working.
update public.profiles
set active = false
where slug in ('gabriel', 'maria', 'carlo');


-- ── 5. Logins that no longer match ─────────────────────────────────────────
-- A login is linked to a profile by address. When the address changes, the old
-- link points at nothing — and worse, it stops the new address from being
-- linked at all, because the sign-up trigger sees a row that is already
-- taken and leaves it alone.
--
-- So a link whose address no longer agrees is cleared here, and made again
-- below for everybody whose address still agrees.
update public.profiles p
set auth_id = null
where p.auth_id is not null
  and not exists (
    select 1 from auth.users u
    where u.id = p.auth_id
      and lower(u.email) = lower(p.email)
  );

update public.profiles p
set auth_id = u.id
from auth.users u
where lower(p.email) = lower(u.email)
  and p.auth_id is null;

drop table if exists pg_temp._roster;


-- ════════════════════════════════════════════════════════════════════════════
-- What a customer is allowed to ask
-- ════════════════════════════════════════════════════════════════════════════
-- A signed-out customer can buy from anybody on the roster. They get to pick
-- a name they know, and the order goes to that person — and the code they are
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
-- What it looks like now
-- ════════════════════════════════════════════════════════════════════════════
select
  p.slug,
  p.full_name,
  p.role,
  p.department,
  p.email,
  case when p.auth_id is null then 'no login yet' else 'can sign in' end as login,
  coalesce(c.pieces, 0) as pieces_this_month
from public.profiles p
left join public.credited_this_month() c on c.member_slug = p.slug
where p.active
order by
  case p.role when 'gm' then 0 when 'finance' then 1 when 'marketing' then 2 else 3 end,
  p.full_name;

-- ── One thing left to do by hand ────────────────────────────────────────────
-- The addresses above are not real mailboxes, so nobody can click a
-- confirmation link. Every login has to be created in Supabase:
--
--   Authentication → Users → Add user
--     email:     exactly as it appears above
--     password:  anything you like
--     tick "Auto Confirm User"   ← without this they wait forever, because
--                                   @marketing.com receives no mail
--
-- The row is already there, so the moment the login exists it is linked and
-- the person can sign in. Do this one first if you want to test:
--
--   reloba@marketing.com   — Jheff Cyril Reloba (Marketing)
