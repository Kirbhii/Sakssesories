-- ════════════════════════════════════════════════════════════════════════════
-- Quotas, set by hand, one person at a time
-- ════════════════════════════════════════════════════════════════════════════
-- Paste this into the Supabase SQL Editor and run it once. Safe to run twice.
--
-- ── What changed, and why ───────────────────────────────────────────────────
-- The old way: the GM typed a number for each department, and the app divided
-- it among the people in that department. 250 ÷ 8 is 31.25, so the pieces were
-- handed out whole with the remainder to the first few — which meant nobody
-- ever actually chose a person's number. It was arithmetic, not a decision.
--
-- The new way: every person has their own number, typed by Marketing or the
-- GM. Nothing is divided. Two people in the same department can carry very
-- different targets, because that is how the shop really runs.
--
-- ── Two numbers per person, not one ─────────────────────────────────────────
-- Each person has a target for the WHOLE MONTH, and a target for each WEEK
-- inside it. The week targets are what the team actually works to day by day;
-- the month target is what the month is judged on. They are stored separately
-- because they are separate promises — a week can be missed while the month
-- still lands.
--
-- ── One row per person, per month, per week ─────────────────────────────────
-- `week = 0` is the whole month. Weeks 1..5 are the weeks inside that month.
--
-- A week here is a block of days counted from the 1st — 1–7, 8–14, 15–21,
-- 22–28, and 29 to the end. It is deliberately NOT the Saturday-to-Friday
-- remittance week used on the Summary screen: a target is set in "week 1 of
-- November", and cutting that into partial weeks at the edges of a month would
-- make the numbers impossible to compare. The screen labels each column with
-- its real dates so there is nothing to guess.
--
-- ── Every month is its own set of numbers ───────────────────────────────────
-- `month` is part of the key, so December is a fresh sheet. Nothing carries
-- over and nothing is copied: a month with no rows simply has no targets yet.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Who may set a quota ─────────────────────────────────────────────────────
-- Marketing owns the number and the GM signs off on it, so both of them may
-- write. Everyone else may read — a person has to be able to see their own
-- target.
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

grant execute on function public.is_quota_keeper() to authenticated;


-- ── The table ───────────────────────────────────────────────────────────────
create table if not exists public.member_quotas (
  member_slug text not null references public.profiles (slug) on delete cascade,
  -- Always the first day of the month, so '2026-11-01' and never a mid-month
  -- date: two rows for the same month must collide instead of sitting side by
  -- side.
  month       date not null,
  -- 0 = the whole month. 1..5 = that week inside it.
  week        smallint not null default 0,
  pieces      integer not null default 0,
  -- Who typed it, and when. Useful when a number is questioned later.
  set_by      text references public.profiles (slug) on delete set null,
  set_at      timestamptz not null default now(),

  primary key (member_slug, month, week),
  constraint member_quotas_week_range check (week between 0 and 5),
  constraint member_quotas_month_is_first check (extract(day from month) = 1),
  constraint member_quotas_pieces_sane check (pieces >= 0 and pieces <= 100000)
);

create index if not exists member_quotas_month_idx
  on public.member_quotas (month, member_slug);


-- ── Who may read and write ──────────────────────────────────────────────────
alter table public.member_quotas enable row level security;

-- Any signed-in member reads the whole sheet. It is a target, not a secret —
-- the team already sees each other's numbers on the quota strip.
drop policy if exists quotas_read on public.member_quotas;
create policy quotas_read on public.member_quotas
  for select to authenticated using (true);

-- Only Marketing and the GM may change one.
drop policy if exists quotas_write on public.member_quotas;
create policy quotas_write on public.member_quotas
  for all to authenticated
  using (public.is_quota_keeper())
  with check (public.is_quota_keeper());


-- ════════════════════════════════════════════════════════════════════════════
-- What it looks like now
-- ════════════════════════════════════════════════════════════════════════════
-- Empty on the first run. The numbers are typed on the "Set the month" screen,
-- by Marketing or the GM, and they start blank on purpose: a target nobody
-- chose is worse than no target at all.
select
  (select count(*) from public.profiles where active)          as people_on_the_roster,
  (select count(*) from public.member_quotas)                  as quotas_set_so_far,
  (select count(distinct month) from public.member_quotas)     as months_with_numbers;
