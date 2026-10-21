// ─── Sales records ──────────────────────────────────────────────────────────
// The sample ledger. Shared by My sales (one person's rows) and Finance (every
// row, grouped by payment method) so the two screens can never disagree.

export type Range = 'today' | 'week' | 'month' | 'all';
export type PayMethod = 'cash' | 'gcash' | 'card';

export interface Sale {
  no: string;
  ago: number;
  customer: string;
  variant: string;
  engraving: string;
  qty: number;
  cents: number;
  pay: PayMethod;
}

export const BASE = new Date(2026, 9, 20);

export const SALES: Sale[] = [
  { no: 'SK-261020-004', ago: 0, customer: 'Maria Santos', variant: 'Heart / Maroon', engraving: 'JAM', qty: 1, cents: 15100, pay: 'cash' },
  { no: 'SK-261020-003', ago: 0, customer: 'Juan Dela Cruz', variant: 'Teardrop / Tan', engraving: 'ANA', qty: 1, cents: 16700, pay: 'gcash' },
  { no: 'SK-261020-002', ago: 0, customer: 'Bea Lim', variant: 'Heart / Navy blue', engraving: '—', qty: 2, cents: 29800, pay: 'gcash' },
  { no: 'SK-261020-001', ago: 0, customer: 'Walk-in', variant: 'Heart / Pink', engraving: '—', qty: 1, cents: 14900, pay: 'cash' },
  { no: 'SK-261019-007', ago: 1, customer: 'Carlo Reyes', variant: 'Heart / Black', engraving: 'MIG', qty: 1, cents: 15100, pay: 'cash' },
  { no: 'SK-261019-005', ago: 1, customer: 'Sofia Cruz', variant: 'Teardrop / Purple', engraving: '—', qty: 1, cents: 16500, pay: 'card' },
  { no: 'SK-261019-003', ago: 1, customer: 'Ana Villar', variant: 'Heart / Tan', engraving: '—', qty: 3, cents: 44700, pay: 'cash' },
  { no: 'SK-261018-009', ago: 2, customer: 'Mark Bautista', variant: 'Teardrop / Navy blue', engraving: 'JDC', qty: 1, cents: 16700, pay: 'gcash' },
  { no: 'SK-261018-006', ago: 2, customer: 'Liza Mercado', variant: 'Heart / Maroon', engraving: '—', qty: 1, cents: 14900, pay: 'cash' },
  { no: 'SK-261017-004', ago: 3, customer: 'Paolo Garcia', variant: 'Heart / Purple', engraving: '—', qty: 2, cents: 29800, pay: 'gcash' },
  { no: 'SK-261015-011', ago: 5, customer: 'Kim Tan', variant: 'Teardrop / Tan', engraving: 'KIM', qty: 1, cents: 16700, pay: 'cash' },
  { no: 'SK-261014-008', ago: 6, customer: 'Rica Flores', variant: 'Heart / Pink', engraving: '—', qty: 1, cents: 14900, pay: 'cash' },
  { no: 'SK-261012-002', ago: 8, customer: 'Noel Ramos', variant: 'Heart / Black', engraving: '—', qty: 2, cents: 29800, pay: 'card' },
  { no: 'SK-261008-005', ago: 12, customer: 'Grace Ong', variant: 'Teardrop / Maroon', engraving: '—', qty: 1, cents: 16500, pay: 'cash' },
  { no: 'SK-261003-010', ago: 17, customer: 'Dennis Yu', variant: 'Heart / Navy blue', engraving: '—', qty: 1, cents: 14900, pay: 'gcash' },
  { no: 'SK-260928-003', ago: 22, customer: 'Anna Sy', variant: 'Teardrop / Black', engraving: '—', qty: 1, cents: 16500, pay: 'cash' },
];

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
