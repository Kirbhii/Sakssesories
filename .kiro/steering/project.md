---
inclusion: always
---

# Saksesories PH — project rules

Marketing site, staff POS, marketing portal and production inventory in one Vite
+ React 19 + TypeScript app. Tailwind v4 tokens live in `src/index.css`.

## Non-negotiables

- **Money is centavos.** Every amount in state, props and data is an integer
  number of centavos. Format for display only, with `peso()` / `peso2()` from
  `src/lib/data.ts`. Never do arithmetic on formatted strings.
- **Two type voices.** Playfair Display for words, Inter for numbers and UI.
  Playfair has no `₱` glyph — wrap any peso inside a serif heading in
  `font-sans` or it silently falls back to another face.
- **Numerals get `num`** (tabular figures) whenever they sit in a column, card
  or total, so values don't wobble as they change.
- **Brand palette only.** wine `#4a111a`, blush `#f9eff1`, crimson `#890e13`.
  Use the Tailwind tokens (`wine-800`, `blush-100`, `crimson-600`), never raw
  hex in class names.
- **Engraving rule:** 2 letters free, ₱2 each after that, 6 letters maximum.
  Implemented once in `engravingFee()` — call it, don't reimplement it.

## Module split

`/`, `/pos` and `/portal` are one module (customer + marketing staff) and share
the top navbar from `components/SiteHeader.tsx`.

`/inventory` is the production module and keeps its own vertical rail. Do not
add the sales navbar to it without being asked.

## When changing a screen

Change one screen at a time. The user reviews each change visually before the
next one starts — do not batch unrelated redesigns into one edit.
