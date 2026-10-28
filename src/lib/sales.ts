// ─── Sales records ──────────────────────────────────────────────────────────
// The sample ledger. Shared by My sales (one person's rows), Finance (every
// row, grouped by payment method) and the Summary tab (rows grouped by day or
// month) so the three screens can never disagree.

export type Range = 'today' | 'week' | 'month' | 'all';
export type PayMethod = 'cash' | 'gcash' | 'card';
export type Sex = 'F' | 'M' | '—';

export interface Sale {
  no: string;
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
export const SALES: Sale[] = [
  { no: 'SK-261020-004', ago: 0, time: '11:03 AM', staffId: 'ana', customer: 'Maria Santos', variant: 'Heart / Maroon', engraving: 'JAM', occupation: 'Teacher', sex: 'F', location: 'Cebu City', qty: 1, cents: 6100, pay: 'cash' },
  { no: 'SK-261020-003', ago: 0, time: '10:48 AM', staffId: 'bea', customer: 'Juan Dela Cruz', variant: 'Teardrop / Tan', engraving: 'ANA', occupation: 'Engineer', sex: 'M', location: 'Davao City', qty: 1, cents: 6100, pay: 'gcash' },
  { no: 'SK-261020-002', ago: 0, time: '10:22 AM', staffId: 'ana', customer: 'Bea Lim', variant: 'Heart / Navy blue', engraving: '—', occupation: 'Student', sex: 'F', location: 'Quezon City', qty: 2, cents: 11800, pay: 'gcash' },
  { no: 'SK-261020-001', ago: 0, time: '10:05 AM', staffId: 'ana', customer: 'Walk-in', variant: 'Heart / Pink', engraving: '—', occupation: '—', sex: '—', location: 'Walk-in', qty: 1, cents: 5900, pay: 'cash' },
  { no: 'SK-261019-007', ago: 1, time: '4:31 PM', staffId: 'dennis', customer: 'Carlo Reyes', variant: 'Heart / Black', engraving: 'MIG', occupation: 'Driver', sex: 'M', location: 'Cebu City', qty: 1, cents: 6100, pay: 'cash' },
  { no: 'SK-261019-005', ago: 1, time: '3:58 PM', staffId: 'liza', customer: 'Sofia Cruz', variant: 'Teardrop / Purple', engraving: '—', occupation: 'Nurse', sex: 'F', location: 'Mandaue City', qty: 1, cents: 5900, pay: 'card' },
  { no: 'SK-261019-003', ago: 1, time: '2:12 PM', staffId: 'rica', customer: 'Ana Villar', variant: 'Heart / Tan', engraving: '—', occupation: 'Business owner', sex: 'F', location: 'Lapu-Lapu City', qty: 3, cents: 17700, pay: 'cash' },
  { no: 'SK-261018-009', ago: 2, time: '5:40 PM', staffId: 'paolo', customer: 'Mark Bautista', variant: 'Teardrop / Navy blue', engraving: 'JDC', occupation: 'Teacher', sex: 'M', location: 'Cebu City', qty: 1, cents: 6100, pay: 'gcash' },
  { no: 'SK-261018-006', ago: 2, time: '1:25 PM', staffId: 'noel', customer: 'Liza Mercado', variant: 'Heart / Maroon', engraving: '—', occupation: 'Accountant', sex: 'F', location: 'Talisay City', qty: 1, cents: 5900, pay: 'cash' },
  { no: 'SK-261017-004', ago: 3, time: '11:52 AM', staffId: 'carlo', customer: 'Paolo Garcia', variant: 'Heart / Purple', engraving: '—', occupation: 'Engineer', sex: 'M', location: 'Cebu City', qty: 2, cents: 11800, pay: 'gcash' },
  { no: 'SK-261015-011', ago: 5, time: '9:14 AM', staffId: 'kim', customer: 'Kim Tan', variant: 'Teardrop / Tan', engraving: 'KIM', occupation: 'Student', sex: 'F', location: 'Mandaue City', qty: 1, cents: 6100, pay: 'cash' },
  { no: 'SK-261014-008', ago: 6, time: '4:07 PM', staffId: 'grace', customer: 'Rica Flores', variant: 'Heart / Pink', engraving: '—', occupation: 'Nurse', sex: 'F', location: 'Cebu City', qty: 1, cents: 5900, pay: 'cash' },
  { no: 'SK-261012-002', ago: 8, time: '3:33 PM', staffId: 'sofia', customer: 'Noel Ramos', variant: 'Heart / Black', engraving: '—', occupation: 'Driver', sex: 'M', location: 'Danao City', qty: 2, cents: 11800, pay: 'card' },
  { no: 'SK-261008-005', ago: 12, time: '10:41 AM', staffId: 'miguel', customer: 'Grace Ong', variant: 'Teardrop / Maroon', engraving: '—', occupation: 'Teacher', sex: 'F', location: 'Cebu City', qty: 1, cents: 5900, pay: 'cash' },
  { no: 'SK-261003-010', ago: 17, time: '2:48 PM', staffId: 'gabriel', customer: 'Dennis Yu', variant: 'Heart / Navy blue', engraving: '—', occupation: 'Business owner', sex: 'M', location: 'Mandaue City', qty: 1, cents: 5900, pay: 'gcash' },
  { no: 'SK-260928-003', ago: 22, time: '1:06 PM', staffId: 'maria', customer: 'Anna Sy', variant: 'Teardrop / Black', engraving: '—', occupation: 'Accountant', sex: 'F', location: 'Cebu City', qty: 1, cents: 5900, pay: 'cash' },
];

/** Just one person's rows. Used by My sales for Marketing and Production. */
export const salesOf = (staffId: string): Sale[] => SALES.filter((s) => s.staffId === staffId);

export const PAY_LABEL: Record<PayMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  card: 'Card',
};

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
