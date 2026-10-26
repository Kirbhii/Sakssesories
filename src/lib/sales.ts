// ─── Sales records ──────────────────────────────────────────────────────────
// The sample ledger. Shared by My sales (one person's rows) and Finance (every
// row, grouped by payment method) so the two screens can never disagree.

export type Range = 'today' | 'week' | 'month' | 'all';
export type PayMethod = 'cash' | 'gcash' | 'card';

export interface Sale {
  no: string;
  ago: number;
  /** Who rang it up. This is the `rungUp` half of the record — it never moves. */
  staffId: string;
  customer: string;
  variant: string;
  engraving: string;
  qty: number;
  cents: number;
  pay: PayMethod;
}

export const BASE = new Date(2026, 9, 20);

export const SALES: Sale[] = [
  { no: 'SK-261020-004', ago: 0, staffId: 'ana', customer: 'Maria Santos', variant: 'Heart / Maroon', engraving: 'JAM', qty: 1, cents: 15100, pay: 'cash' },
  { no: 'SK-261020-003', ago: 0, staffId: 'bea', customer: 'Juan Dela Cruz', variant: 'Teardrop / Tan', engraving: 'ANA', qty: 1, cents: 16700, pay: 'gcash' },
  { no: 'SK-261020-002', ago: 0, staffId: 'ana', customer: 'Bea Lim', variant: 'Heart / Navy blue', engraving: '—', qty: 2, cents: 29800, pay: 'gcash' },
  { no: 'SK-261020-001', ago: 0, staffId: 'ana', customer: 'Walk-in', variant: 'Heart / Pink', engraving: '—', qty: 1, cents: 14900, pay: 'cash' },
  { no: 'SK-261019-007', ago: 1, staffId: 'dennis', customer: 'Carlo Reyes', variant: 'Heart / Black', engraving: 'MIG', qty: 1, cents: 15100, pay: 'cash' },
  { no: 'SK-261019-005', ago: 1, staffId: 'liza', customer: 'Sofia Cruz', variant: 'Teardrop / Purple', engraving: '—', qty: 1, cents: 16500, pay: 'card' },
  { no: 'SK-261019-003', ago: 1, staffId: 'rica', customer: 'Ana Villar', variant: 'Heart / Tan', engraving: '—', qty: 3, cents: 44700, pay: 'cash' },
  { no: 'SK-261018-009', ago: 2, staffId: 'paolo', customer: 'Mark Bautista', variant: 'Teardrop / Navy blue', engraving: 'JDC', qty: 1, cents: 16700, pay: 'gcash' },
  { no: 'SK-261018-006', ago: 2, staffId: 'noel', customer: 'Liza Mercado', variant: 'Heart / Maroon', engraving: '—', qty: 1, cents: 14900, pay: 'cash' },
  { no: 'SK-261017-004', ago: 3, staffId: 'carlo', customer: 'Paolo Garcia', variant: 'Heart / Purple', engraving: '—', qty: 2, cents: 29800, pay: 'gcash' },
  { no: 'SK-261015-011', ago: 5, staffId: 'kim', customer: 'Kim Tan', variant: 'Teardrop / Tan', engraving: 'KIM', qty: 1, cents: 16700, pay: 'cash' },
  { no: 'SK-261014-008', ago: 6, staffId: 'grace', customer: 'Rica Flores', variant: 'Heart / Pink', engraving: '—', qty: 1, cents: 14900, pay: 'cash' },
  { no: 'SK-261012-002', ago: 8, staffId: 'sofia', customer: 'Noel Ramos', variant: 'Heart / Black', engraving: '—', qty: 2, cents: 29800, pay: 'card' },
  { no: 'SK-261008-005', ago: 12, staffId: 'miguel', customer: 'Grace Ong', variant: 'Teardrop / Maroon', engraving: '—', qty: 1, cents: 16500, pay: 'cash' },
  { no: 'SK-261003-010', ago: 17, staffId: 'gabriel', customer: 'Dennis Yu', variant: 'Heart / Navy blue', engraving: '—', qty: 1, cents: 14900, pay: 'gcash' },
  { no: 'SK-260928-003', ago: 22, staffId: 'maria', customer: 'Anna Sy', variant: 'Teardrop / Black', engraving: '—', qty: 1, cents: 16500, pay: 'cash' },
];

/** Just one person's rows. Used by My sales for Marketing and Production. */
export const salesOf = (staffId: string): Sale[] => SALES.filter((s) => s.staffId === staffId);

export const PAY_LABEL: Record<PayMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  card: 'Card',
};

export function dateOf(ago: number): string {
  const d = new Date(BASE);
  d.setDate(d.getDate() - ago);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function inRange(ago: number, range: Range): boolean {
  if (range === 'today') return ago === 0;
  if (range === 'week') return ago <= 1;
  if (range === 'month') return ago <= 19;
  return true;
}
