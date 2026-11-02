// ─── Shared catalogue data ──────────────────────────────────────────────────
// One source of truth for shapes, colours, variants and money helpers.
// Everything is in centavos internally so arithmetic never drifts.

export type ShapeId = 'heart' | 'teardrop';

export interface Shape {
  id: ShapeId;
  name: string;
  sku: string;
  price: number; // centavos
}

export interface Colour {
  id: string;
  name: string;
  hex: string;
  sku: string;
}

export interface Variant {
  key: string;
  shape: ShapeId;
  shapeName: string;
  colour: string;
  hex: string;
  sku: string;
  price: number; // centavos
}

// ─── Prices ─────────────────────────────────────────────────────────────────
// These numbers are no longer the only copy. The database keeps its own price
// list (`public.variants`, see `supabase/price-guard.sql`) and refuses any sale
// that arrives cheaper than it, because a price that lives only in the browser
// is a price anybody can edit. The copy here is what the screen adds up.
//
// So: lowering a price means changing it in BOTH places. Raising it here alone
// is safe — the guard only ever refuses a number that is too low.
export const PRODUCT = {
  name: 'ClearChain',
  tagline: 'Sakses anytime, Style anytime',
  freeLetters: 2,
  extraLetterCents: 200, // ₱2
  maxLetters: 6,
} as const;

export const SHAPES: Shape[] = [
  { id: 'heart', name: 'Heart', sku: 'HT', price: 5900 },
  { id: 'teardrop', name: 'Teardrop', sku: 'DR', price: 5900 },
];

export const COLOURS: Colour[] = [
  { id: 'navy', name: 'Navy blue', hex: '#14233f', sku: 'NV' },
  { id: 'tan', name: 'Tan', hex: '#8a5a33', sku: 'TN' },
  { id: 'pink', name: 'Pink', hex: '#f4cfd6', sku: 'PK' },
  { id: 'maroon', name: 'Maroon', hex: '#6b1f2a', sku: 'MR' },
  { id: 'purple', name: 'Purple', hex: '#b9a6cc', sku: 'PL' },
  { id: 'black', name: 'Black', hex: '#1a1a1a', sku: 'BK' },
];

// No stock number lives here on purpose. How many pieces can actually be sold
// is a question only the production log can answer — what was made, minus what
// was already sold — and a constant in the browser would be a guess that goes
// stale the moment the first piece leaves the shelf. Until the POS reads the
// production log, it takes the cashier at their word.
export const VARIANTS: Variant[] = SHAPES.flatMap((shape) =>
  COLOURS.map((colour) => ({
    key: `${shape.id}-${colour.id}`,
    shape: shape.id,
    shapeName: shape.name,
    colour: colour.name,
    hex: colour.hex,
    sku: `CC-${shape.sku}-${colour.sku}`,
    price: shape.price,
  })),
);

// ─── Money ──────────────────────────────────────────────────────────────────

/** Centavos → "₱1,234" (no decimals when whole, two when not). */
export function peso(cents: number): string {
  const value = cents / 100;
  return (
    '₱' +
    value.toLocaleString('en-PH', {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Centavos → "₱1,234.00" — for cost tables where the decimals matter. */
export function peso2(cents: number): string {
  return '₱' + (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Engraving is free for the first 2 letters, ₱2 each after that. */
export function engravingFee(letters: number): number {
  return letters <= PRODUCT.freeLetters
    ? 0
    : (letters - PRODUCT.freeLetters) * PRODUCT.extraLetterCents;
}

/** Keep only A–Z, uppercase, capped at 6. */
export function cleanEngraving(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, PRODUCT.maxLetters);
}
