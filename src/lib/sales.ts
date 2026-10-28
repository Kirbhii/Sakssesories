// ─── Sales records ──────────────────────────────────────────────────────────
// The sample ledger. Shared by My sales (one person's rows), Finance (every
// row, grouped by payment method) and the Summary tab (rows grouped by day or
// month) so the three screens can never disagree.
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

export const BASE = new Date(2026, 9, 20);

// Every row is priced off the catalogue: qty × ₱59, plus ₱2 for each letter
// past the two that come free. If the price in data.ts moves, these move with
// it — a ledger that quotes a price the shop does not charge is worse than no
// ledger at all.
//
// NAMING RULE: a customer must never share a name with a team member. When the
// sample rows reused the staff list as customer names, opening the summary on
// "Maria Santos" showed a sale to "Anna Sy" and it read as though her records
// had not been fetched at all. The two name pools are separate on purpose.
export const SALES: Sale[] = [
  // ── Oct 20 ──────────────────────────────────────────────────────────────
  { id: 'L01', orNo: '990341', ago: 0, time: '11:03 AM', staffId: 'ana', customer: 'Maricel Dizon', variant: 'Heart / Maroon', engraving: 'JAM', occupation: 'Teacher', sex: 'F', location: 'Cebu City', qty: 1, cents: 6100, pay: 'cash' },
  { id: 'L02', orNo: '990340', ago: 0, time: '10:48 AM', staffId: 'bea', customer: 'Juan Dela Cruz', variant: 'Teardrop / Tan', engraving: 'ANA', occupation: 'Engineer', sex: 'M', location: 'Davao City', qty: 1, cents: 6100, pay: 'gcash' },
  // One order, two variants — the case the sheet needs to show.
  { id: 'L03', orNo: '990338', ago: 0, time: '10:22 AM', staffId: 'ana', customer: 'Jhonelyn Patilla', variant: 'Heart / Black', engraving: '—', occupation: 'Student', sex: 'F', location: 'Quezon City', qty: 1, cents: 5900, pay: 'gcash' },
  { id: 'L04', orNo: '990338', ago: 0, time: '10:22 AM', staffId: 'ana', customer: 'Jhonelyn Patilla', variant: 'Heart / Pink', engraving: '—', occupation: 'Student', sex: 'F', location: 'Quezon City', qty: 1, cents: 5900, pay: 'gcash' },
  // One order, three variants.
  { id: 'L05', orNo: '990332', ago: 0, time: '10:05 AM', staffId: 'ana', customer: 'Alexandra Parilla', variant: 'Heart / Maroon', engraving: '—', occupation: 'Teacher', sex: 'F', location: 'Cebu City', qty: 1, cents: 5900, pay: 'cash' },
  { id: 'L06', orNo: '990332', ago: 0, time: '10:05 AM', staffId: 'ana', customer: 'Alexandra Parilla', variant: 'Heart / Navy blue', engraving: '—', occupation: 'Teacher', sex: 'F', location: 'Cebu City', qty: 1, cents: 5900, pay: 'cash' },
  { id: 'L07', orNo: '990332', ago: 0, time: '10:05 AM', staffId: 'ana', customer: 'Alexandra Parilla', variant: 'Teardrop / Tan', engraving: '—', occupation: 'Teacher', sex: 'F', location: 'Cebu City', qty: 1, cents: 5900, pay: 'cash' },

  // ── Oct 19 ──────────────────────────────────────────────────────────────
  { id: 'L08', orNo: '990326', ago: 1, time: '4:31 PM', staffId: 'dennis', customer: 'Rey Sarmiento', variant: 'Heart / Black', engraving: 'MIG', occupation: 'Driver', sex: 'M', location: 'Cebu City', qty: 1, cents: 6100, pay: 'cash' },
  { id: 'L09', orNo: '990324', ago: 1, time: '3:58 PM', staffId: 'liza', customer: 'Cristina Uy', variant: 'Teardrop / Purple', engraving: '—', occupation: 'Nurse', sex: 'F', location: 'Mandaue City', qty: 1, cents: 5900, pay: 'gcash' },
  { id: 'L10', orNo: '990321', ago: 1, time: '2:12 PM', staffId: 'rica', customer: 'Vilma Bacalso', variant: 'Heart / Tan', engraving: '—', occupation: 'Business owner', sex: 'F', location: 'Lapu-Lapu City', qty: 3, cents: 17700, pay: 'cash' },

  // ── Oct 18 ──────────────────────────────────────────────────────────────
  { id: 'L11', orNo: '990318', ago: 2, time: '5:40 PM', staffId: 'paolo', customer: 'Jomar Abella', variant: 'Teardrop / Navy blue', engraving: 'JDC', occupation: 'Teacher', sex: 'M', location: 'Cebu City', qty: 1, cents: 6100, pay: 'gcash' },
  { id: 'L12', orNo: '990315', ago: 2, time: '1:25 PM', staffId: 'noel', customer: 'Marites Cabahug', variant: 'Heart / Maroon', engraving: '—', occupation: 'Accountant', sex: 'F', location: 'Talisay City', qty: 1, cents: 5900, pay: 'cash' },

  // ── Oct 17 ──────────────────────────────────────────────────────────────
  { id: 'L13', orNo: '990310', ago: 3, time: '11:52 AM', staffId: 'carlo', customer: 'Efren Villamor', variant: 'Heart / Purple', engraving: '—', occupation: 'Engineer', sex: 'M', location: 'Cebu City', qty: 2, cents: 11800, pay: 'gcash' },

  // ── Oct 15 ──────────────────────────────────────────────────────────────
  { id: 'L14', orNo: '990304', ago: 5, time: '9:14 AM', staffId: 'kim', customer: 'Shiela Marie Go', variant: 'Teardrop / Tan', engraving: 'KIM', occupation: 'Student', sex: 'F', location: 'Mandaue City', qty: 1, cents: 6100, pay: 'cash' },

  // ── Oct 14 ──────────────────────────────────────────────────────────────
  { id: 'L15', orNo: '990299', ago: 6, time: '4:07 PM', staffId: 'grace', customer: 'Trisha Salazar', variant: 'Heart / Pink', engraving: '—', occupation: 'Nurse', sex: 'F', location: 'Cebu City', qty: 1, cents: 5900, pay: 'cash' },

  // ── Oct 12 ──────────────────────────────────────────────────────────────
  { id: 'L16', orNo: '990287', ago: 8, time: '3:33 PM', staffId: 'sofia', customer: 'Alvin Rosales', variant: 'Heart / Black', engraving: '—', occupation: 'Driver', sex: 'M', location: 'Danao City', qty: 2, cents: 11800, pay: 'cash' },

  // ── Oct 8 ───────────────────────────────────────────────────────────────
  { id: 'L17', orNo: '990265', ago: 12, time: '10:41 AM', staffId: 'miguel', customer: 'Bernadette Chua', variant: 'Teardrop / Maroon', engraving: '—', occupation: 'Teacher', sex: 'F', location: 'Cebu City', qty: 1, cents: 5900, pay: 'cash' },

  // ── Oct 3 ───────────────────────────────────────────────────────────────
  { id: 'L18', orNo: '990241', ago: 17, time: '2:48 PM', staffId: 'gabriel', customer: 'Roldan Amistad', variant: 'Heart / Navy blue', engraving: '—', occupation: 'Business owner', sex: 'M', location: 'Mandaue City', qty: 1, cents: 5900, pay: 'gcash' },

  // ── Sep 28 ──────────────────────────────────────────────────────────────
  { id: 'L19', orNo: '990198', ago: 22, time: '1:06 PM', staffId: 'maria', customer: 'Clarissa Yap', variant: 'Teardrop / Black', engraving: '—', occupation: 'Accountant', sex: 'F', location: 'Cebu City', qty: 1, cents: 5900, pay: 'cash' },
];

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

/** "Heart / Maroon" → "Heart". */
export function shapeOf(sale: Sale): string {
  return sale.variant.split(' / ')[0] || sale.variant;
}

/** "Heart / Maroon" → "Maroon". */
export function colourOf(sale: Sale): string {
  return sale.variant.split(' / ')[1] ?? '—';
}

export function inRange(ago: number, range: Range): boolean {
  if (range === 'today') return ago === 0;
  if (range === 'week') return ago <= 1;
  if (range === 'month') return ago <= 19;
  return true;
}
