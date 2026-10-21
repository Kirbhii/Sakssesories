// ─── Inventory mock data ────────────────────────────────────────────────────
// Quantities and unit costs come from the Figma design. Swap this file for a
// Supabase query once the materials table is live — the shapes below match
// MaterialRow in lib/supabase.ts closely enough to make that a small change.

export interface Material {
  sku: string;
  name: string;
  colour: string;
  hex: string;
  onHand: number;
  unit: string;
  costCents: number;
  reorderAt: number;
  supplier: string;
}

export const MATERIALS: Material[] = [
  { sku: 'LF-NV', name: 'Leather', colour: 'Navy blue', hex: '#1f2f52', onHand: 42, unit: 'pieces', costCents: 1200, reorderAt: 20, supplier: 'ABC Leather Supply' },
  { sku: 'LF-TN', name: 'Leather', colour: 'Tan', hex: '#b9855a', onHand: 36, unit: 'pieces', costCents: 1200, reorderAt: 20, supplier: 'ABC Leather Supply' },
  { sku: 'LF-PK', name: 'Leather', colour: 'Pink', hex: '#e8b4bd', onHand: 28, unit: 'pieces', costCents: 1200, reorderAt: 20, supplier: 'ABC Leather Supply' },
  { sku: 'LF-MR', name: 'Leather', colour: 'Maroon', hex: '#6b1f2a', onHand: 51, unit: 'pieces', costCents: 1200, reorderAt: 20, supplier: 'ABC Leather Supply' },
  { sku: 'LF-PL', name: 'Leather', colour: 'Purple', hex: '#5b3f6e', onHand: 8, unit: 'pieces', costCents: 1200, reorderAt: 10, supplier: 'ABC Leather Supply' },
  { sku: 'LF-BK', name: 'Leather', colour: 'Black', hex: '#1a1a1a', onHand: 33, unit: 'pieces', costCents: 1200, reorderAt: 20, supplier: 'ABC Leather Supply' },
  { sku: 'MF-GY', name: 'Microfiber', colour: 'Grey', hex: '#b4b2a9', onHand: 214, unit: 'pads', costCents: 800, reorderAt: 80, supplier: 'SoftWipe Trading' },
  { sku: 'MF-TN', name: 'Microfiber', colour: 'Tan', hex: '#c9a06a', onHand: 96, unit: 'pads', costCents: 800, reorderAt: 80, supplier: 'SoftWipe Trading' },
  { sku: 'TH-WX', name: 'Thread', colour: 'Waxed', hex: '#8a6a45', onHand: 5, unit: 'rolls', costCents: 4500, reorderAt: 8, supplier: 'Stitch & Co.' },
  { sku: 'GL-PD', name: 'Glue', colour: 'Pandikit', hex: '#e6e2d6', onHand: 12, unit: 'bottles', costCents: 6500, reorderAt: 6, supplier: 'Prime Adhesives' },
];

/** Cost to make one piece — the "Inside the ₱49.50" card. */
export const COST_BREAKDOWN = [
  { label: 'Leather · 1.5 sq in', cents: 1200 },
  { label: 'Microfiber pad', cents: 800 },
  { label: 'Glue · pandikit', cents: 50 },
  { label: 'Thread & stitching', cents: 50 },
  { label: 'Packaging', cents: 150 },
  { label: 'Labour & overhead', cents: 2700 },
];

export const COST_TOTAL = COST_BREAKDOWN.reduce((sum, row) => sum + row.cents, 0); // ₱49.50

export function materialStatus(m: Material): 'ok' | 'low' | 'out' {
  if (m.onHand === 0) return 'out';
  if (m.onHand <= m.reorderAt) return 'low';
  return 'ok';
}
