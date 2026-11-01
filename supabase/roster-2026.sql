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
--   2. The three placeholder rows (Gabriel Tan, Maria Santos, Carlo Reyes)
--      are REMOVED, not switched off. They were stand-ins for people who are
--      not on the roster, and a stand-in has no history worth keeping.
--
--   3. The General Manager changes address. Gabriel Tan was the GM only as a
--      placeholder; the GM is John Paul Dupaya, and his login is
--      dupaya@gm.com. The old gm@gmail.com login goes away with him.
--
--   4. Two new questions the database can answer for a signed-out customer:
--      "who can I buy from?" and "show me that person's code".
--
-- And one change of habit:
--
--   The default answer used to be "the first name in the alphabet". It is now
--   "the person who has sold the fewest pieces this month" — which is the
--   rule the shop actually wants.
--
-- ── A NOTE ON HOW THIS FILE IS BUILT ───────────────────────────────────────
-- Every statement here stands on its own. Nothing is left over from one
-- statement for a later one to use.
--
-- That is deliberate. The SQL Editor can run each statement on a different
-- connection, and a table made for one statement is not there for the next —
-- which is exactly how the earlier version of this file died with
-- "relation _roster does not exist". The roster is written out in full every
-- time it is needed, so the file cannot fall over like that.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE ROSTER
-- ════════════════════════════════════════════════════════════════════════════
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
-- ── One person, one row ─────────────────────────────────────────────────────
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
    for t in
      select *
      from (values
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
      ) as v(slug, email, full_name, role, department)
      order by slug
    loop

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

    -- The people with no row yet.
    --
    -- `on conflict do nothing` covers both unique rules at once: a slug that
    -- is already taken, and an address that is already taken. Either way the
    -- row that is already there is the live one, and the loop above has
    -- already corrected its name and its role.
    insert into public.profiles (slug, email, full_name, role, department)
    select v.slug, v.email, v.full_name, v.role, v.department
    from (values
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
    ) as v(slug, email, full_name, role, department)
    where not exists (select 1 from public.profiles p where p.slug = v.slug)
    on conflict do nothing;

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


-- ════════════════════════════════════════════════════════════════════════════
-- 2. THE PLACEHOLDERS LEAVE
-- ════════════════════════════════════════════════════════════════════════════
-- Gabriel Tan, Maria Santos and Carlo Reyes were stand-ins for people who are
-- not on the roster. They are removed outright.
--
-- ── The GCash code moves first, or it is lost ──────────────────────────────
-- The one payment account in the database is parked on Gabriel's row, but it
-- is not his — it is the shop's own GCash (the number under CHARLES). A
-- payment account belongs to the row of the person it hangs off, and that row
-- is about to be deleted, so the code would go with it and the shop would be
-- left with no way to be paid at all.
--
-- So the code is moved to Jheff's row first and marked as approved, because
-- it has been looked at and confirmed. Then Gabriel's row can go.
--
-- ── Anything still pointing at the three ──────────────────────────────────
-- Two things hang off a person and would refuse to let the row be deleted:
-- an approval stamped with their name, and rows that say who made them.
--
--   · approvals  → the name is cleared, the approval itself stays
--   · production → Gabriel's row moves to the real GM (same person, new
--                  address); the other two are placeholders, so their rows
--                  keep the numbers but lose the name
--   · sales      → they all move to the real GM, because a sale is a promise
--                  about money. Throwing one away would leave the ledger
--                  short, and the ledger is what finance counts against.
--
-- The sales table is empty at the moment, so in practice nothing moves.
--
-- ── Which login becomes the GM's ────────────────────────────────────────────
-- Gabriel held the GM's seat as a stand-in, and the seat is not empty now:
-- it belongs to John Paul Dupaya. So the old GM's sales and his production
-- rows pass to the new GM rather than vanishing.
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
    -- The shop's GCash code → Jheff, if he does not have one yet.
    if exists (
      select 1 from public.payment_accounts
       where member_slug = 'gabriel' and method = 'gcash'
    ) and not exists (
      select 1 from public.payment_accounts
       where member_slug = 'jheff' and method = 'gcash'
    ) then
      update public.payment_accounts
         set member_slug = 'jheff',
             approved    = true,
             approved_by = 'dupaya',
             approved_at = coalesce(approved_at, now())
       where member_slug = 'gabriel' and method = 'gcash';

    elsif exists (
      select 1 from public.payment_accounts
       where member_slug = 'gabriel' and method = 'gcash'
    ) then
      -- He has one already, so his is the one that stands. Gabriel's goes.
      update public.payment_accounts
         set approved    = true,
             approved_by = 'dupaya',
             approved_at = coalesce(approved_at, now())
       where member_slug = 'jheff' and method = 'gcash';

      delete from public.payment_accounts
       where member_slug = 'gabriel' and method = 'gcash';
    end if;

    -- Nothing may point at a row that is about to go.
    update public.payment_accounts
       set approved_by = null
     where approved_by in ('gabriel', 'maria', 'carlo');

    -- The GM's old row becomes the GM's new row.
    update public.production set created_by = 'dupaya' where created_by = 'gabriel';
    update public.sales      set staff_slug = 'dupaya' where staff_slug = 'gabriel';

    -- The other two were placeholders. Their production rows keep the
    -- numbers, but the name on them goes.
    update public.production set created_by = null where created_by in ('maria', 'carlo');

    -- Their sales do NOT go. A sale is a promise about money, and the ledger
    -- is what finance counts against, so it stays whole — under the GM.
    update public.sales set staff_slug = 'dupaya' where staff_slug in ('maria', 'carlo');

    -- And the three rows themselves.
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


-- ════════════════════════════════════════════════════════════════════════════
-- 3. THE OLD LOGINS GO
-- ════════════════════════════════════════════════════════════════════════════
-- A login is a separate thing from a roster row. Gabriel's row is gone; his
-- login (gm@gmail.com) has to go with it, or he can still sign in to a shop
-- he no longer works at.
--
-- So the old logins are removed:
--
--   gm@gmail.com                 Gabriel Tan — the GM is now dupaya@gm.com
--   finance@gmail.com            Maria Santos — a placeholder
--   carlo.reyes@saksesories.ph   Carlo Reyes — a placeholder
--   jheff@marketing.com          Jheff — the first address tried for him; his
--                                 real one is reloba@marketing.com
--
-- Each one is removed on its own, so one that cannot be removed does not stop
-- the others. (Auth keeps its own bookkeeping tables; occasionally a login is
-- tangled up in them, and the message tells you which one.)
do $$
declare
  u record;
begin
  for u in
    select *
    from (values
      ('gm@gmail.com'),
      ('finance@gmail.com'),
      ('carlo.reyes@saksesories.ph'),
      ('jheff@marketing.com')
    ) as v(email)
  loop
    begin
      delete from auth.users where lower(email) = lower(u.email);
    exception when others then
      raise notice 'could not remove the login %: %', u.email, sqlerrm;
    end;
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. LOGINS THAT NO LONGER MATCH
-- ════════════════════════════════════════════════════════════════════════════
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
  coalesce(c.pieces, 0) as pieces_this_month,
  exists (
    select 1 from public.payment_accounts a
     where a.member_slug = p.slug and a.approved and a.qr is not null
  ) as has_code
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
-- the person can sign in. Do these two first:
--
--   reloba@marketing.com   — Jheff Cyril Reloba (Marketing)
--   dupaya@gm.com          — John Paul Dupaya (General Manager)
--
-- The GM is the one who approves a GCash code. Jheff's code is already in
-- place and already marked as approved, so once the GM is in, a customer can
-- pick Jheff at the counter and will be shown the shop's GCash.
