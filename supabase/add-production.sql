-- ════════════════════════════════════════════════════════════════════════════
-- Add the manual PRODUCTION LOG
--
-- Paste this into the Supabase SQL Editor and run it once. It is safe to run
-- twice: the table, index and policies are all guarded.
--
-- What it does: replaces the old inventory screen with a simple daily log.
-- Production types how many pieces of each variant they finished on a given
-- day; the app sums those for the day/week/month totals and keeps a history.
--
-- The app works without this (the Production tab just shows empty and cannot
-- save), but you need it for the numbers to persist.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.production (
  id          uuid primary key default gen_random_uuid(),
  produced_on date not null default current_date,
  variant_key text not null,
  qty         integer not null check (qty > 0),
  created_by  text references public.profiles (slug),
  created_at  timestamptz not null default now()
);

create index if not exists production_day_idx
  on public.production (produced_on desc, variant_key);

alter table public.production enable row level security;

-- Any signed-in staff member can read the log.
drop policy if exists production_read on public.production;
create policy production_read on public.production
  for select to authenticated using (true);

-- Only Production and the GM may add entries.
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
