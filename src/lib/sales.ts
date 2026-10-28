// ─── Sales records ──────────────────────────────────────────────────────────
// The shop's ledger, in memory for now. Shared by My sales (one person's rows),
// Finance (every row, grouped by payment method) and the Summary tab (rows
// grouped by day, week or month) so the three screens can never disagree.
//
// It is empty until the Supabase read is wired up — see `SALES` below.
//
// One sale is a LINE, not an order. A customer can buy two pieces in different
// variants under one OR number, and that becomes two rows sharing `orNo` — the
// same way the shop's summary sheet lists them. `id` keeps each line unique so
// React can key the table.

import { engravingFee } from './data';

export type Range = 'today' | 'week' | 'month' | 'all';
export type PayMethod = 'cash' | 'gcash';
export type Sex = 'F' | 'M' | '—';

export interface Sale {
  /** Unique per line item — React key. */
  id: string;
  /** The OR / order number. Repeats across the lines of one multi-variant order. */
  orNo: string;
  /** Days before BASE (0 = today). Drives the date and the range filters. */
  ago: number;
  /** Time of day the sale was rung up, as shown on the summary sheet. */
  time: string;
  /** Who rang it up. This is the `rungUp` half of the record — it never moves. */
  staffId: string;
  customer: string;
  /** "Heart / Maroon" — split into shape + colour by shapeOf()/colourOf(). */
  variant: string;
  engraving: string;
  occupation: string;
  sex: Sex;
  location: string;
  qty: number;
  cents: number;
  pay: PayMethod;
}

/**
 * "Today" for the ledger, read off the machine's calendar instead of typed in.
 * A row with `ago: 0` is therefore always the day the shop is really open, and
 * "today / this week / this month" mean what they say. Pinned to local midnight
 * so the time of day can never push a sale across a day boundary.
 */
const NOW = new Date();
export const BASE = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

// The sample ledger is retired. The shop now has a real database, and nineteen
// invented sales sitting next to real ones is worse than an empty table — the
// team would be reconciling fiction. Every screen already handles the empty
// case (empty states, zeroed totals), so this is a data change, not a code one.
//
// The nineteen rows that used to live here are in git history at 4088d31 if
// they are ever wanted back for a demo.
//
// NAMING RULE, for when real rows arrive: a customer must never share a name
// with a team member. When the old sample rows reused the staff list as
// customer names, opening the summary on "Maria Santos" showed a sale to
// "Anna Sy" and it read as though her records had not been fetched at all.
export const SALES: Sale[] = [];

/** Just one person's rows. Used by My sales for Marketing and Production. */
export const salesOf = (staffId: string): Sale[] => SALES.filter((s) => s.staffId === staffId);

/** How many distinct orders (OR numbers) a set of lines covers. */
export const orderCount = (rows: Sale[]): number => new Set(rows.map((s) => s.orNo)).size;

/**
 * How many consecutive rows share this row's OR number — the height of the
 * merged cell. The ledger keeps the lines of one order next to each other, so
 * a scan forward is enough; a row whose neighbours differ gets 1.
 */
export function blockSpan(rows: Sale[], start: number): number {
  let n = 1;
  while (start + n < rows.length && rows[start + n].orNo === rows[start].orNo) n += 1;
  return n;
}

/** True when this row is the first line of its order (so it owns the merged cells). */
export const firstOfOrder = (rows: Sale[], i: number): boolean =>
  i === 0 || rows[i - 1].orNo !== rows[i].orNo;

export const PAY_LABEL: Record<PayMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
};

/**
 * What the engraving added to a line, in centavos. The catalogue gives the
 * first two letters free and charges ₱2 each after that — per piece, because
 * every piece in the order gets its own engraving.
 */
export function engravingCents(sale: Sale): number {
  if (sale.engraving === '—') return 0;
  const letters = sale.engraving.replace(/[^A-Za-z]/g, '').length;
  return engravingFee(letters) * sale.qty;
}

/** How much of a set of rows came from engraving rather than the pieces. */
export const engravingTotal = (rows: Sale[]): number =>
  rows.reduce((n, s) => n + engravingCents(s), 0);

/** The calendar day a row falls on (BASE minus `ago`). */
export function dateObj(ago: number): Date {
  const d = new Date(BASE);
  d.setDate(d.getDate() - ago);
  return d;
}

export function dateOf(ago: number): string {
  return dateObj(ago).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Tue, Oct 20, 2026" — the header for a day group on the summary. */
export function dayLabel(ago: number): string {
  return dateObj(ago).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "October 2026" — the header for a month group on the summary. */
export function monthOf(ago: number): string {
  return dateObj(ago).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

/**
 * The Monday that starts the week a row falls in. Weeks run Mon–Sun, which is
 * how a Philippine shop reads a week — Sunday belongs to the week that is
 * ending, not the one starting.
 */
export function weekStart(ago: number): Date {
  const d = dateObj(ago);
  const monday = (d.getDay() + 6) % 7; // Sunday is 0 → 6, Monday is 1 → 0
  d.setDate(d.getDate() - monday);
  return d;
}

/** Stable key for grouping, built from local parts so no timezone can shift it. */
export function weekKey(ago: number): string {
  const d = weekStart(ago);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Oct 19 – 25, 2026", or "Sep 28 – Oct 4, 2026" when the week straddles two. */
export function weekLabel(ago: number): string {
  const start = weekStart(ago);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const day = (d: Date) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  return `${day(start)} – ${day(end)}, ${end.getFullYear()}`;
}

/** "Heart / Maroon" → "Heart". */
export function shapeOf(sale: Sale): string {
  return sale.variant.split(' / ')[0] || sale.variant;
}

/** "Heart / Maroon" → "Maroon". */
export function colourOf(sale: Sale): string {
  return sale.variant.split(' / ')[1] ?? '—';
}

/**
 * Does a row fall inside a range? "This week" and "this month" now follow the
 * real calendar instead of a rolling window: a week starts on Monday and a
 * month on the 1st, so the pill means what it says. `ago` is a day count, so
 * each boundary is just the day count back to it.
 */
export function inRange(ago: number, range: Range): boolean {
  if (range === 'today') return ago === 0;
  if (range === 'week') return ago <= (BASE.getDay() + 6) % 7; // Sunday 0 → 6
  if (range === 'month') return ago <= BASE.getDate() - 1;
  return true;
}
