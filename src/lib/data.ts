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
  stock: number;
}

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
  { id: 'navy', name: 'Navy blue', hex: '#1f2f52', sku: 'NV' },
  { id: 'tan', name: 'Tan', hex: '#b9855a', sku: 'TN' },
  { id: 'pink', name: 'Pink', hex: '#e8b4bd', sku: 'PK' },
  { id: 'maroon', name: 'Maroon', hex: '#6b1f2a', sku: 'MR' },
  { id: 'purple', name: 'Purple', hex: '#5b3f6e', sku: 'PL' },
  { id: 'black', name: 'Black', hex: '#1a1a1a', sku: 'BK' },
];

/** Mock stock until Supabase is wired — index matches COLOURS order. */
const STOCK: Record<ShapeId, number[]> = {
  heart: [6, 4, 0, 9, 3, 12],
  teardrop: [2, 7, 5, 1, 8, 0],
};

export const VARIANTS: Variant[] = SHAPES.flatMap((shape) =>
  COLOURS.map((colour, i) => ({
    key: `${shape.id}-${colour.id}`,
    shape: shape.id,
    shapeName: shape.name,
    colour: colour.name,
    hex: colour.hex,
    sku: `CC-${shape.sku}-${colour.sku}`,
    price: shape.price,
    stock: STOCK[shape.id][i],
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
