// ─── Sales records ──────────────────────────────────────────────────────────
// The shop's ledger. Shared by My sales (one person's rows), Finance (every
// row, grouped by payment method) and the Summary tab (rows grouped by day,
// week or month) so the three screens can never disagree.
//
// The rows live in Supabase (`public.sales`). This module is the only thing
// that knows that: screens keep reading `allSales()` / `salesOf()` and
// re-rendering off `useLedger()`, exactly as they did when the ledger was a
// localStorage array. `loadSales()` fills the cache, `recordSales()` writes a
// finished order back.
//
// One sale is a LINE, not an order. A customer can buy two pieces in different
// variants under one OR number, and that becomes two rows sharing `orNo` — the
// same way the shop's summary sheet lists them. `id` keeps each line unique so
// React can key the table.

import { useSyncExternalStore } from 'react';
import { engravingFee } from './data';
import { supabase, type SaleRow, type SaleStatus } from './supabase';

export type Range = 'today' | 'week' | 'month' | 'all';
/**
 * How the money came in. `cash` and the e-money ids are the common ones; a
 * member can publish an account for any method they like (MariBank, Maya, …),
 * so this stays open rather than a closed union.
 */
export type PayMethod = string;
export type Sex = 'F' | 'M' | '—';

/**
 * Where the order came from.
 *   counter   a member was signed in and rang it up — their own sale
 *   customer  the customer ordered on their own, so nobody was at the counter;
 *             the order was credited to whoever needed it most
 *
 * A member reading their own book needs to tell these apart, or a piece they
 * never sold shows up under their name with no explanation.
 */
export type Origin = 'counter' | 'customer';

export interface Sale {
  /** Unique per line item — React key. */
  id: string;
  /** The OR / order number. Repeats across the lines of one multi-variant order. */
  orNo: string;
  /** Days before BASE (0 = today). Drives the date and the range filters. */
  ago: number;
  /** Time of day the sale was rung up, as shown on the summary sheet. */
  time: string;
  /**
   * Whose book this row lives in. For a counter sale that is the member who
   * rang it up; for a customer order there is no ringer, so it is the member
   * the sale was credited to.
   */
  staffId: string;
  customer: string;
  /** The customer's mobile, when the POS collected one. Null on older rows. */
  mobile?: string | null;
  /** "Heart / Maroon" — split into shape + colour by shapeOf()/colourOf(). */
  variant: string;
  engraving: string;
  occupation: string;
  sex: Sex;
  location: string;
  qty: number;
  cents: number;
  pay: PayMethod;
  /** Counter sale or customer's own order. See `Origin`. */
  origin: Origin;
  /**
   * Where the money stands.
   *   paid     cash over the counter — the notes are in the drawer
   *   pending  e-money. The customer says they paid; nobody has checked that
   *            the exact amount landed in the account yet
   *   void     cancelled, kept for the audit trail rather than deleted
   *
   * Without this a GCash order that was never actually sent looks identical to
   * one that was, and the day's total is a guess.
   */
  status: SaleStatus;
  /** The reference number the payer's app showed, once someone has checked it. */
  payRef: string | null;
  /**
   * Set by Finance once this order's money has actually been turned in. Off by
   * default. It lives on every line of an order, but is always flipped together
   * (see `setRemitted`) so an order is "remitted" as a whole, never line by line.
   */
  remitted: boolean;
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

// ── The live ledger ─────────────────────────────────────────────────────────
// `live` is the cache every screen reads. With a database it is filled by
// `loadSales()` and appended to by `recordSales()`; without one it is the
// localStorage array the app used before, so a fresh clone still works.

const LEDGER_KEY = 'skph.ledger';

/** No database configured → the local stand-in. Decided once, at load. */
const ONLINE = !!supabase;

function readLedger(): Sale[] {
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Sale =>
        !!s && typeof s === 'object' && typeof (s as Sale).id === 'string',
    );
  } catch {
    return [];
  }
}

let live: Sale[] = ONLINE ? [] : readLedger();
let version = 0;
let cache: Sale[] = SALES;
let cacheVersion = -1;
const listeners = new Set<() => void>();

function publish(): void {
  version += 1;
  listeners.forEach((fn) => fn());
}

// ── Mapping between the row and the app's shape ─────────────────────────────
// The database stores a real date; the app filters on a "days ago" counter. The
// conversion lives here so no screen had to be rewritten when the ledger moved
// from memory to Postgres.

const pad = (n: number): string => String(n).padStart(2, '0');

/** A row's date, as the day counter the filters understand. */
export function agoFromDate(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const then = new Date(y, m - 1, d);
  return Math.round((BASE.getTime() - then.getTime()) / 86_400_000);
}

/** The day counter, as a 'YYYY-MM-DD' date in local time. */
export function isoOf(ago: number): string {
  const d = dateObj(ago);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** '14:05:00' → '2:05 PM', the way the summary sheet writes it. */
function clockLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function rowToSale(r: SaleRow): Sale {
  return {
    id: r.id,
    orNo: r.or_no,
    ago: agoFromDate(r.sold_on),
    time: clockLabel(r.sold_at),
    staffId: r.staff_slug,
    customer: r.customer,
    mobile: r.customer_mobile,
    variant: r.variant,
    engraving: r.engraving || '—',
    occupation: r.occupation || '—',
    sex: r.sex === 'F' || r.sex === 'M' ? r.sex : '—',
    location: r.location || '—',
    qty: r.qty,
    cents: r.cents,
    pay: r.pay,
    origin: r.origin === 'customer' ? 'customer' : 'counter',
    status: r.status,
    payRef: r.pay_ref,
    // Older rows (or a database where the migration has not run yet) have no
    // `remitted` value — treat their absence as "not yet remitted".
    remitted: r.remitted ?? false,
  };
}

/**
 * A finished order, as a row. The time is taken from the clock at the moment
 * of writing rather than parsed back out of the label — `recordSales` only ever
 * appends sales that are happening right now. `created_at` is left to the
 * database, which is the only clock that matters for an audit trail.
 */
/**
 * A finished order, as a row. `remitted` is deliberately left off the insert: a
 * freshly rung-up sale is never "remitted", and letting the database default
 * (`false`) apply means inserts still succeed on a database where the migration
 * has not been run yet. `created_at` is likewise left to Postgres.
 */
function saleToRow(s: Sale): Omit<SaleRow, 'created_at' | 'remitted'> {
  const now = new Date();
  return {
    id: s.id,
    or_no: s.orNo,
    sold_on: isoOf(s.ago),
    sold_at: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    staff_slug: s.staffId,
    customer: s.customer,
    customer_mobile: s.mobile ?? null,
    variant: s.variant,
    engraving: s.engraving,
    occupation: s.occupation,
    sex: s.sex,
    location: s.location,
    qty: s.qty,
    cents: s.cents,
    pay: s.pay,
    origin: s.origin,
    status: s.status,
    pay_ref: s.payRef,
  };
}

// `remitted` is the newest column. A database that has not had the
// `add-remitted.sql` migration run yet still has every other column, so we keep
// two lists: the full one (with `remitted`) and a base fallback (without it).
// `loadSales` tries the full list first and quietly drops back if the column is
// missing, so the app keeps working until the migration is applied — every row
// is then just treated as "not yet remitted".
const COLUMNS =
  'id, or_no, sold_on, sold_at, staff_slug, customer, customer_mobile, variant, engraving, occupation, sex, location, qty, cents, pay, origin, status, pay_ref, remitted';
const COLUMNS_BASE =
  'id, or_no, sold_on, sold_at, staff_slug, customer, customer_mobile, variant, engraving, occupation, sex, location, qty, cents, pay, origin, status, pay_ref';

/**
 * Fill the cache from the database.
 *
 * The row level security policy is what decides how much comes back: a member
 * gets their own book, Finance and the GM get the whole team, and a signed-out
 * visitor gets nothing. So this one query is correct for every role, and the
 * page never has to filter for privacy — it has already been done.
 *
 * Rows come back ordered so the lines of one OR number stay next to each other;
 * `blockSpan` and `firstOfOrder` merge those cells and would break on a jumbled
 * order.
 *
 * Only the newest read is allowed to land. On first load this runs once as a
 * visitor (before the session is restored) and again as the member; without the
 * counter the slower of the two would win, and a signed-in member could end up
 * looking at an empty ledger.
 */
let generation = 0;

export async function loadSales(): Promise<void> {
  if (!supabase) return;
  const mine = ++generation;

  const read = async (columns: string): Promise<SaleRow[] | null> => {
    const { data, error } = await supabase!
      .from('sales')
      .select(columns)
      .order('sold_on', { ascending: false })
      .order('or_no', { ascending: false })
      .order('id', { ascending: true });
    if (error) return null;
    return (data as unknown) as SaleRow[];
  };

  // Try the full column list; if the `remitted` migration has not been applied
  // the query fails and we retry without that one column. Rows read this way
  // just show up as "not yet remitted".
  let data = await read(COLUMNS);
  if (data === null) data = await read(COLUMNS_BASE);

  if (mine !== generation) return;
  if (data === null) {
    // A member with no rows is not an error — RLS simply returns an empty set.
    // Getting here means even the fallback failed, so log it.
    console.error('[sales] could not read the ledger (both column sets failed)');
    return;
  }

  live = data.map(rowToSale);
  publish();
}

/**
 * Every row, newest first. The array identity only changes when the ledger
 * does, so `useMemo` consumers are not invalidated on every render.
 */
export function allSales(): Sale[] {
  if (cacheVersion !== version) {
    cache = live.length ? [...live, ...SALES] : SALES;
    cacheVersion = version;
  }
  return cache;
}

/**
 * Append a finished order. Resolves `false` when the rows did not reach the
 * database — the caller has to say so, because a sale the shop believes in and
 * the server never received is worse than a visible error.
 */
export async function recordSales(rows: Sale[]): Promise<boolean> {
  if (!rows.length) return false;

  // Offline: keep the old localStorage behaviour so the POS still works.
  if (!supabase) {
    const next = [...rows, ...live];
    let stored = true;
    try {
      window.localStorage.setItem(LEDGER_KEY, JSON.stringify(next));
    } catch {
      stored = false; // private mode, or the shelf is full — keep it in memory
    }
    live = next;
    publish();
    return stored;
  }

  // Show it straight away — the person at the counter is waiting for a receipt.
  live = [...rows, ...live];
  publish();

  const { error } = await supabase.from('sales').insert(rows.map(saleToRow));
  if (error) {
    // Take the rows back out. A phantom sale in the ledger would be counted in
    // the day's total and never paid for.
    const failed = new Set(rows.map((r) => r.id));
    live = live.filter((s) => !failed.has(s.id));
    publish();
    console.error('[sales] could not record the sale:', error.message);
    return false;
  }
  return true;
}

/**
 * Mark every line of an order "remitted" (or un-remit it). Finance and the GM
 * flip this once the order's money has been turned in.
 *
 * The order is keyed by OR number, never by row id, because an order is several
 * lines and all of them must turn green together — flipping one line of a
 * two-piece order would leave the summary half-remitted and the counts wrong.
 *
 * Resolves `false` when the write did not reach the database, so the caller can
 * surface it rather than leave the UI showing a state the server rejected.
 */
export async function setRemitted(orNo: string, value: boolean): Promise<boolean> {
  // Update the local cache first so the checkbox responds instantly.
  live = live.map((s) => (s.orNo === orNo ? { ...s, remitted: value } : s));
  publish();

  if (!supabase) return true; // offline stand-in: the cache is the source of truth

  const { error } = await supabase
    .from('sales')
    .update({ remitted: value })
    .eq('or_no', orNo);

  if (error) {
    // Roll the cache back so it never disagrees with the server.
    live = live.map((s) => (s.orNo === orNo ? { ...s, remitted: !value } : s));
    publish();
    console.error('[sales] could not mark the order remitted:', error.message);
    return false;
  }
  return true;
}

/** Wipe the locally recorded orders. Used by the dev reset, not by the shop. */
export function clearLedger(): void {
  try {
    window.localStorage.removeItem(LEDGER_KEY);
  } catch {
    /* nothing to clean up */
  }
  live = [];
  publish();
}

export function subscribeLedger(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Subscribe a screen to the ledger. Returns the version number — put it in the
 * dependency list of any `useMemo` that reads `allSales()` or `salesOf()`, or
 * the table will keep showing the rows it had before the sale was recorded.
 */
export function useLedger(): number {
  return useSyncExternalStore(
    subscribeLedger,
    () => version,
    () => version,
  );
}

/** Just one person's rows. */
export const salesOf = (staffId: string): Sale[] =>
  allSales().filter((s) => s.staffId === staffId);

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

// ── Payment labels ──────────────────────────────────────────────────────────
// A member can publish an account for a method the app has never heard of, so
// the label is looked up rather than indexed — an unknown id falls back to
// itself instead of printing "undefined" in the table.

const PAY_LABELS: Record<string, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maribank: 'MariBank',
  maya: 'Maya',
};

export const payLabel = (pay: string): string => PAY_LABELS[pay] ?? pay;

/** Cash first, then the e-money methods in a stable order. */
export function sortPay(a: string, b: string): number {
  if (a === b) return 0;
  if (a === 'cash') return -1;
  if (b === 'cash') return 1;
  return a.localeCompare(b);
}

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
