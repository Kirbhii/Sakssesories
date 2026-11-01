-- ════════════════════════════════════════════════════════════════════════════
-- Hardening pass 1 — the QR code and the cash
-- ════════════════════════════════════════════════════════════════════════════
-- Run the whole file once in the SQL Editor. Every statement is idempotent, so
-- running it twice is harmless.
--
-- The app was already doing the right thing. These rules put the same behaviour
-- in the database, because the app is not the only thing that can talk to it:
-- anybody holding a login and the public key can call the API directly and skip
-- every screen we wrote. A rule that lives only in a React component is a rule
-- that can be walked around with one `curl`.
--
--   A. Only the GM may approve a payment code, and any edit sends it back
--   B. A code must be a picture, not a link somebody else controls
--   C. A sale may not be born already "remitted"
--   D. Nothing needs to insert roster rows from the browser
--
-- ════════════════════════════════════════════════════════════════════════════


-- ── A. Only the GM may approve a payment code ──────────────────────────────
-- THE HOLE: `accounts_own` lets a member write their own row, and it only ever
-- checked *whose* row it was — never what was being written. So a member could
-- set approved = true on their own GCash and start being paid without the GM
-- ever seeing the code. The approval was decoration.
--
-- THE WORSE HOLE: approve a real code, then swap the picture. The approval
-- stays, the customer pays the new picture, the money goes somewhere else.
--
-- ONE RULE CLOSES BOTH: if the writer is not the GM, the row always lands
-- unapproved. Any edit — a new picture, a new number, even a new label — sends
-- it back for review, because the thing that was approved is the picture that
-- was there at the time. The app already behaved this way; now it cannot be
-- skipped.
--
-- Note: with no logged-in person (the SQL Editor, a service-role script) the
-- check fails closed and the row lands unapproved. That is deliberate — approve
-- through the app, as the GM, so the record says who did it.
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


-- ── B. A code must be a picture, not a link ────────────────────────────────
-- The QR is stored as a data URL — the picture itself, carried inside the row.
-- If a link were allowed instead, a member could point at a picture on their
-- own server, get it approved, and then replace the file behind that address
-- whenever they liked. The approval would still say yes; the money would go
-- somewhere else. Carrying the bytes means the only way to change the picture
-- is to write a new row, which rule A catches.
--
-- NOT VALID on purpose: it applies to every new write from this moment, but it
-- does not refuse to install because of a row written before the rule existed.
-- To check the old rows and then tighten it, run:
--     select id, member_slug from public.payment_accounts
--      where qr is not null and qr not like 'data:image/%';
--     alter table public.payment_accounts validate constraint payment_accounts_qr_is_image;
alter table public.payment_accounts
  drop constraint if exists payment_accounts_qr_is_image;
alter table public.payment_accounts
  add constraint payment_accounts_qr_is_image
  check (qr is null or qr like 'data:image/%') not valid;


-- ── C. A sale may not be born already "remitted" ───────────────────────────
-- "Remitted" means the cash has been handed to Finance. The app never sets it
-- on insert — a freshly rung-up sale cannot already have been turned in — and
-- lets the column default do the work.
--
-- The database did not insist. A staff member could insert a sale with
-- remitted = true and it would never appear on the list of cash still owed,
-- while the customer walked away with the keychain and the money stayed in the
-- staff member's pocket.
--
-- Now the row must arrive un-remitted. Finance and the GM can still mark it
-- afterwards; that is a separate, recorded act.
drop policy if exists sales_staff_insert on public.sales;
create policy sales_staff_insert on public.sales
  for insert to authenticated
  with check (
    (staff_slug = my_slug() or is_money())
    and remitted = false
  );


-- ── D. Nothing inserts roster rows from the browser ────────────────────────
-- There is no INSERT policy on `profiles`, so row level security already
-- refuses every attempt. Removing the grant as well means the attempt never
-- even reaches that check — one less thing that has to be right.
--
-- Roster rows are created by the auto-roster trigger (`auto-roster.sql`) or by
-- hand in the SQL Editor, never by a signed-in member.
revoke insert on public.profiles from authenticated;


-- ── Check ──────────────────────────────────────────────────────────────────
-- Expect: one trigger, one constraint, one policy, and no INSERT grant.
select 'trigger' as what, tgname as name
  from pg_trigger
 where tgrelid = 'public.payment_accounts'::regclass
   and not tgisinternal
union all
select 'constraint', conname
  from pg_constraint
 where conrelid = 'public.payment_accounts'::regclass
   and conname = 'payment_accounts_qr_is_image'
union all
select 'policy', polname
  from pg_policy
 where polrelid = 'public.sales'::regclass
   and polname = 'sales_staff_insert'
union all
select 'grant-insert-profiles',
       coalesce(string_agg(privilege_type, ','), 'none')
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name = 'profiles'
   and grantee = 'authenticated'
   and privilege_type = 'INSERT';
