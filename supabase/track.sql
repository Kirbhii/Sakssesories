-- ─── Order tracking ─────────────────────────────────────────────────────────
-- The customer has no account. The order number is the only handle they have
-- on their purchase, and until now the shop had no way to tell them where it
-- was. This adds the two pieces that fix that:
--
--   public.sales.stage     where the order is in the shop, not where the money is
--   track_order()          the one door a stranger may knock on
--   set_order_stage()      how the team moves an order along
--
-- Run the whole file in the SQL Editor. Safe to run twice.
--
-- ── Why a function and not a policy ─────────────────────────────────────────
-- `sales` is readable only by the member who sold the item, or by Finance and
-- the GM (`sales_read`). A tracking page has no login at all, so it cannot be
-- given SELECT on that table: the table carries the customer's name, their
-- mobile, their address note, and the whole team's takings. A function that
-- takes two keys and returns one order is the only way to answer "where is my
-- order" without handing out the shop's books.
--
-- The second key is the mobile number. Order numbers run in sequence
-- (990342, 990343, …), so the number alone would let anyone walk the whole
-- ledger one guess at a time. Mobile + OR together is a key only the buyer has.


-- ── 1. Where the order is ───────────────────────────────────────────────────
-- Deliberately separate from `status`, which is about money. An order can be
-- paid and still be sitting on the table, and it can be unpaid while the piece
-- is already wrapped. Mixing the two would make one column answer two
-- questions and answer neither.
alter table public.sales
  add column if not exists stage text not null default 'placed';

alter table public.sales drop constraint if exists sales_stage_check;
alter table public.sales add constraint sales_stage_check
  check (stage in ('placed', 'preparing', 'ready', 'shipped', 'claimed', 'delivered', 'cancelled'));

create index if not exists sales_stage_idx on public.sales (stage);


-- ── 2. What the customer is allowed to see ──────────────────────────────────
-- One row per order, not per line: a two-piece order is one thing to the
-- customer, and returning it twice would read like two orders.
--
-- Nothing here is a free-text field the customer typed. The address note never
-- comes back, and the mobile is masked — the page is public, so anything it
-- prints could be read over a shoulder or in a screenshot.
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
  -- Both keys are required. An empty mobile would otherwise match every order
  -- that has no mobile recorded.
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
    -- Compared on digits so "0917 123 4567" and "09171234567" both work, and
    -- so a leading +63 does not lock the buyer out of their own order.
    and regexp_replace(coalesce(s.customer_mobile, ''), '\D', '', 'g') = v_digits
    -- A voided order is not something to report progress on.
    and s.status <> 'void'
  group by s.or_no;
end;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;


-- ── 3. How the team moves an order along ────────────────────────────────────
-- The member who sold it, or anyone who handles money. Enforced here rather
-- than by a policy, because a policy permissive enough to let a seller touch
-- `stage` would also let them touch `cents` and `status` — and a seller who can
-- mark their own sale paid is the exact hole we spent the week closing.
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


-- ── 4. Check it worked ──────────────────────────────────────────────────────
-- Should print one row: stage | placed
select 'stage column ready' as check, count(*) filter (where stage = 'placed') as placed_rows
from public.sales;
