-- ════════════════════════════════════════════════════════════════════════════
-- Add the manual PRODUCTION SHEET
--
-- Paste this into the Supabase SQL Editor and run it once. It is safe to run
-- twice: every table, column, index, policy and function is guarded.
--
-- What it does: replaces the old inventory screen with the sheet the shop keeps
-- by hand —
--
--     Beg. Inventory + Produced − Sold − Rejects = Ending Inventory
--
-- Production types how many pieces of each variant they finished on a day and
-- how many had to be thrown away. "Sold" is never typed: the app asks for a
-- per-variant, per-day count through `production_sold()`, so a production
-- member sees stock moving without ever seeing a customer name or a price.
--
-- The app works without this (the Production tab shows empty and cannot save),
-- but you need it for the numbers to persist.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. The log ──────────────────────────────────────────────────────────────
-- One row per (day, variant) addition. `qty` is what came out good, `rejected`
-- is what was thrown away. A day can be all rejects, so qty is allowed to be 0
-- as long as something was recorded.
create table if not exists public.production (
  id          uuid primary key default gen_random_uuid(),
  produced_on date not null default current_date,
  variant_key text not null,
  qty         integer not null default 0 check (qty >= 0),
  rejected    integer not null default 0 check (rejected >= 0),
  created_by  text references public.profiles (slug),
  created_at  timestamptz not null default now()
);

-- ── 2. Columns added after the first draft ──────────────────────────────────
-- Safe to re-run; on a fresh database the table above already has them.
alter table public.production add column if not exists rejected integer not null default 0;

-- The first draft only allowed qty > 0, which would reject an all-waste day.
alter table public.production drop constraint if exists production_qty_check;
alter table public.production drop constraint if exists production_not_empty;
alter table public.production
  add constraint production_not_empty check (qty > 0 or rejected > 0);

create index if not exists production_day_idx
  on public.production (produced_on desc, variant_key);

-- ── 3. Who may read and write it ────────────────────────────────────────────
alter table public.production enable row level security;

-- Any signed-in staff member can read the log — it is stock, not customer data.
drop policy if exists production_read on public.production;
create policy production_read on public.production
  for select to authenticated using (true);

-- Only Production and the GM may add entries, and only under their own name.
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

-- ── 4. Sold counts ──────────────────────────────────────────────────────────
-- The "Sold" column has to come from the sales ledger, but a production member
-- may not read `sales` (customer names, prices, payment references). This
-- function returns only what the sheet needs: a count per variant per day, with
-- voided lines left out. SECURITY DEFINER lets it read the ledger on their
-- behalf; the role check inside stops anyone else calling it.
create or replace function public.production_sold(p_from date, p_to date)
returns table (variant text, sold_on date, qty bigint)
language sql
stable
security definer
set search_path = public
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

-- ── Done ────────────────────────────────────────────────────────────────────
-- Open the Production tab. Type a few pieces against a variant, save, and the
-- row should appear in the sheet with an Ending Inventory equal to what you
-- produced. Sold stays at zero until there are real sales for that day.
