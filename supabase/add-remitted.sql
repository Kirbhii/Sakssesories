-- ════════════════════════════════════════════════════════════════════════════
-- Add a "remitted" flag to each sale
-- ════════════════════════════════════════════════════════════════════════════
-- Finance marks an order "remitted" once its money has been turned in to the
-- company. Off by default: a fresh sale is not remitted until someone confirms
-- it. Only Finance and the GM may flip it — they are the ones reconciling the
-- money, and the RLS policy `sales_money_update` (in schema.sql) already allows
-- exactly that role to UPDATE sales. No new policy is needed.
--
-- The app degrades gracefully if this has not been run yet: its SELECT falls
-- back to reading every column except `remitted`, and every sale simply reads
-- as "not remitted" until the column exists. Run this once, then the toggle in
-- the Summary tab goes live.

alter table public.sales add column if not exists remitted boolean not null default false;
