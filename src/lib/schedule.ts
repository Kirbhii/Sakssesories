// ─── Operating schedule ─────────────────────────────────────────────────────
// The shop does not run seven days a week. The site is reachable only on the
// days the shop actually operates:
//
//   open         Saturday · Monday · Tuesday · Thursday
//   closed       Wednesday · Friday · Sunday
//
// Friday is the remittance day — no selling, and the site is closed. Wednesday
// and Sunday are rest days, also closed.
//
// One-time exceptions are allowed: a specific date can stay open even if its
// weekday is normally closed. That is how the transition Friday (the last
// Friday they still sell) is handled without changing the weekly rule.
//
// Two things read from this file:
//   1. the gate in `App.tsx` that closes the whole site on a closed day, and
//   2. the week grouping in `sales.ts`, which runs Saturday→Friday so a
//      "week" lines up with the Friday remittance.
//
// Change the days here and both follow. `getDay()` numbering: Sun=0 … Sat=6.

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Days the shop is completely closed — the site shows a "closed" screen. */
export const CLOSED_WEEKDAYS: readonly number[] = [0, 3, 5]; // Sun, Wed, Fri

/**
 * Escape hatch: specific dates that stay open even though their weekday is
 * normally closed. `YYYY-MM-DD`, local time. Empty by default — every Friday,
 * Wednesday and Sunday is closed. Add a date here only if the shop needs the
 * site on a normally-closed day (e.g. a one-off make-up selling day).
 */
export const OPEN_EXCEPTIONS: readonly string[] = [];

/** The day a reporting week starts on (Saturday), so each week ends on Friday. */
export const WEEK_START_WEEKDAY = 6; // Saturday

const pad = (n: number): string => String(n).padStart(2, '0');

/** A local-time `YYYY-MM-DD` key, so an exception matches the right calendar day. */
export const dateKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const isClosed = (d: Date = new Date()): boolean =>
  !OPEN_EXCEPTIONS.includes(dateKey(d)) && CLOSED_WEEKDAYS.includes(d.getDay());

export const isOpen = (d: Date = new Date()): boolean => !isClosed(d);

/** "Wednesday" — the friendly name of a `getDay()` number. */
export const weekdayName = (n: number): string => WEEKDAY_NAMES[n] ?? '';

/** The next day the shop is open, as a friendly label — for the closed screen. */
export function nextOpenLabel(from: Date = new Date()): string {
  for (let i = 1; i <= 7; i += 1) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    if (!isClosed(d)) return WEEKDAY_NAMES[d.getDay()];
  }
  return WEEKDAY_NAMES[from.getDay()];
}
