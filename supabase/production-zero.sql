-- ════════════════════════════════════════════════════════════════════════════
-- Let production say "none of this one"
-- ════════════════════════════════════════════════════════════════════════════
-- Paste this whole file into the Supabase SQL Editor and press Run. It is one
-- statement, it is safe to run twice, and it touches no rows.
--
-- ── What this is for ────────────────────────────────────────────────────────
-- The POS stops selling a colour when production says there are none left. But
-- a colour that was NEVER made has no number at all, so the shop keeps selling
-- it — and because the POS is open to customers on the website, somebody can
-- order a colour that does not exist.
--
-- The way to close that hole is to log a row of 0: "I am confirming there are
-- none of this one." The table refused that, because of a rule written when an
-- empty row could only ever be a mistake:
--
--     constraint production_not_empty check (qty > 0 or rejected > 0)
--
-- That rule is now wrong. A 0/0 row is the only way to say "none", so the rule
-- has to go. The two checks that stop real nonsense — qty >= 0 and
-- rejected >= 0 — stay exactly where they are.


-- ── The change ──────────────────────────────────────────────────────────────
alter table public.production
  drop constraint if exists production_not_empty;


-- ════════════════════════════════════════════════════════════════════════════
-- What it looks like now
-- ════════════════════════════════════════════════════════════════════════════
-- `production_not_empty` should be gone from the list. Anything else starting
-- with `production_` is one of the two sanity checks and should stay.
select conname as rule
  from pg_constraint
 where conrelid = 'public.production'::regclass
   and contype = 'c'
 order by conname;
