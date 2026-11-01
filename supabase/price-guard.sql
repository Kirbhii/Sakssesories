-- ════════════════════════════════════════════════════════════════════════════
-- Hardening pass 2 — the price
-- ════════════════════════════════════════════════════════════════════════════
-- Run the whole file once in the SQL Editor. Safe to run twice.
--
-- THE HOLE: the price lived only in the browser (`src/lib/data.ts`). The screen
-- adds it up and sends the total along with the order, and the database wrote
-- down whatever it was told. So the price was a suggestion: anybody who can
-- open developer tools — or just call the API with `curl` — could ring a ₱59
-- keychain at ₱5. A guest checkout had the same freedom, with no login at all.
--
-- THE FIX: the shop's price list moves into the database, and a trigger works
-- out the true minimum for every incoming row. A sale that arrives cheaper than
-- the price list is refused, whoever sent it.
--
-- It only ever refuses a price that is TOO LOW. A higher number is let through,
-- so raising a price in the app can never break the till.
--
-- ⚠  If you ever LOWER a price, change it here as well — otherwise every sale
--    of that variant is refused. That is deliberate: a till that stops is
--    better than a till that quietly sells at the wrong price.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Housekeeping first ─────────────────────────────────────────────────────
-- A probe row from an earlier check is still here: sales have no DELETE policy
-- (a sale is voided, never erased), so the API could not clean up after itself.
-- Nothing else matches `zz-%`.
delete from public.sales where id like 'zz-%';


-- ── The price list ─────────────────────────────────────────────────────────
-- `label` is exactly what `sales.variant` holds — 'Heart / Maroon' — so the
-- trigger needs no mapping layer and no guessing.
--
-- These twelve rows must agree with `SHAPES` and `COLOURS` in src/lib/data.ts.
-- Prices are centavos, the same unit the sales table uses.
create table if not exists public.variants (
  label   text primary key,
  shape   text not null,
  colour  text not null,
  price   integer not null check (price >= 0)
);

-- No direct access. The trigger reads this table as its owner, so the app and
-- the public never need a grant on it — prices are shown on the shop page from
-- the app, not read out of here.
revoke all on public.variants from anon, authenticated;

insert into public.variants (label, shape, colour, price) values
  ('Heart / Navy blue',  'Heart',    'Navy blue',  5900),
  ('Heart / Tan',        'Heart',    'Tan',        5900),
  ('Heart / Pink',       'Heart',    'Pink',       5900),
  ('Heart / Maroon',     'Heart',    'Maroon',     5900),
  ('Heart / Purple',     'Heart',    'Purple',     5900),
  ('Heart / Black',      'Heart',    'Black',      5900),
  ('Teardrop / Navy blue','Teardrop','Navy blue',  5900),
  ('Teardrop / Tan',     'Teardrop', 'Tan',        5900),
  ('Teardrop / Pink',    'Teardrop', 'Pink',       5900),
  ('Teardrop / Maroon',  'Teardrop', 'Maroon',     5900),
  ('Teardrop / Purple',  'Teardrop', 'Purple',     5900),
  ('Teardrop / Black',   'Teardrop', 'Black',      5900)
on conflict (label) do nothing;


-- ── The cheapest a row may honestly be ─────────────────────────────────────
-- price list + engraving, times the pieces. The first two letters are free and
-- each one after that is ₱2 — the same rule as `engravingFee` in data.ts.
--
-- SECURITY DEFINER because a guest ringing up an order has no rights on
-- `variants`, and it must still be possible to check their price. It returns
-- only a number, never the table.
--
-- Returns null when the variant is not on the list, which the trigger treats as
-- a refusal — an order for something the shop does not sell is not an order.
create or replace function public.sale_min_cents(p_variant text, p_engraving text, p_qty integer)
returns integer
language sql
stable
security definer
set search_path = public
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


-- ── The guard ──────────────────────────────────────────────────────────────
-- Before the row is written, work out what it should cost and compare. Only
-- INSERT: changing a sale afterwards is already limited to Finance and the GM.
create or replace function public.guard_sale_price()
returns trigger
language plpgsql
security definer
set search_path = public
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


-- ── Check ──────────────────────────────────────────────────────────────────
select count(*) as variants_on_the_price_list from public.variants;

select label,
       price,
       public.sale_min_cents(label, '—', 1)          as one_plain,
       public.sale_min_cents(label, 'ABC', 2)        as two_with_three_letters
  from public.variants
 order by label
 limit 3;
