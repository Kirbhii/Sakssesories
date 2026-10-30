// ─── Production log ─────────────────────────────────────────────────────────
// The manual production log that replaced the inventory screen. Production
// records how many pieces of each variant they finished on a given day, and how
// many had to be thrown away; the page turns those into the same sheet the shop
// keeps by hand:
//
//   Beg. Inventory + Produced − Sold − Rejects = Ending Inventory
//
// "Sold" is not typed by anyone — it comes from the sales ledger. Production is
// not allowed to read customer names or money, so it arrives as a per-variant,
// per-day count through `production_sold()`. The shop never sees a buyer.
//
// Same shape as the sales ledger: a Supabase table when the shop is connected,
// a localStorage stand-in otherwise, so the page still works on a fresh clone.
// One row is one ADDITION — a second batch on the same day is another row, so
// the history shows everything that went in, not just a running total.

import { useSyncExternalStore } from 'react';
import { supabase, type ProductionRow, type SoldRow } from './supabase';
import { dateKey, WEEK_START_WEEKDAY } from './schedule';
import { VARIANTS } from './data';
import { allSales, isoOf } from './sales';

export interface ProductionEntry {
  id: string;
  /** 'YYYY-MM-DD' — the day the pieces were finished. */
  producedOn: string;
  /** Matches a VARIANTS key from `data.ts`, e.g. 'heart-navy'. */
  variantKey: string;
  /** Pieces that came out good. */
  qty: number;
  /** Pieces thrown away that day. */
  rejected: number;
  /** Slug of whoever logged it, when known. */
  createdBy: string | null;
  createdAt: string;
}

/** A day's sales count for one variant, already reduced to a number. */
export interface SoldEntry {
  variantKey: string;
  soldOn: string;
  qty: number;
}

export type Period = 'day' | 'week' | 'month';

const STORE_KEY = 'skph.production';
const ONLINE = !!supabase;

// ── Variant labels ──────────────────────────────────────────────────────────
// The POS writes a human label ('Heart / Maroon') into `sales.variant`; the
// production log keys off the slug ('heart-maroon'). This is the one bridge
// between the two, so a renamed colour only has to be fixed in `data.ts`.

const LABEL_TO_KEY = new Map<string, string>(
  VARIANTS.map((v) => [`${v.shapeName} / ${v.colour}`.toLowerCase(), v.key]),
);

/** 'Heart / Maroon' → 'heart-maroon'. Null when the label is not a variant. */
export function variantKeyOf(label: string): string | null {
  return LABEL_TO_KEY.get(label.trim().toLowerCase()) ?? null;
}

// ── Local stand-in ──────────────────────────────────────────────────────────

function readLocal(): ProductionEntry[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is ProductionEntry =>
          !!e && typeof e === 'object' && typeof (e as ProductionEntry).id === 'string',
      )
      .map((e) => ({ ...e, rejected: typeof e.rejected === 'number' ? e.rejected : 0 }));
  } catch {
    return [];
  }
}

let live: ProductionEntry[] = ONLINE ? [] : readLocal();
let sold: SoldEntry[] = ONLINE ? [] : [];

let version = 0;
let cache: ProductionEntry[] = live;
let cacheVersion = -1;
let soldCache: SoldEntry[] = sold;
let soldCacheVersion = -1;
const listeners = new Set<() => void>();

function publish(): void {
  version += 1;
  listeners.forEach((fn) => fn());
}

const rowToEntry = (r: ProductionRow): ProductionEntry => ({
  id: r.id,
  producedOn: r.produced_on,
  variantKey: r.variant_key,
  qty: r.qty,
  rejected: r.rejected ?? 0,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

let generation = 0;

/**
 * Fill the cache from the database. RLS decides what comes back: any signed-in
 * staff member may read the log. Only the newest read is allowed to land.
 */
export async function loadProduction(): Promise<void> {
  if (!supabase) return;
  const mine = ++generation;

  const { data, error } = await supabase
    .from('production')
    .select('id, produced_on, variant_key, qty, rejected, created_by, created_at')
    .order('produced_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (mine !== generation) return;

  if (error) {
    // The migration may not have been run yet — the page still renders empty.
    console.error('[production] could not read the log:', error.message);
    return;
  }

  live = ((data as unknown) as ProductionRow[]).map(rowToEntry);
  publish();
  void fetchSold();
}

/** Every entry, newest first. Identity changes only when the log changes. */
export function allProduction(): ProductionEntry[] {
  if (cacheVersion !== version) {
    cache = live;
    cacheVersion = version;
  }
  return cache;
}

// ── Sold counts ─────────────────────────────────────────────────────────────

/** Offline, the ledger is already in memory — just tally it. */
function soldFromLedger(): SoldEntry[] {
  const out: SoldEntry[] = [];
  for (const s of allSales()) {
    if (s.status === 'void') continue;
    const key = variantKeyOf(s.variant);
    if (!key) continue;
    out.push({ variantKey: key, soldOn: isoOf(s.ago), qty: s.qty });
  }
  return out;
}

const daysAgoIso = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKey(d);
};

/** The oldest day anybody logged, or null when the log is empty. */
function earliestProduced(): string | null {
  let min: string | null = null;
  for (const e of live) if (!min || e.producedOn < min) min = e.producedOn;
  return min;
}

let soldGeneration = 0;

async function fetchSold(): Promise<void> {
  if (!supabase) return;
  const mine = ++soldGeneration;

  // Cover everything the sheet can look back on. If nothing has been logged
  // yet there is no start date, so fall back to a quarter — enough to fill the
  // "Beginning inventory" of the first logged day.
  const from = earliestProduced() ?? daysAgoIso(90);
  const to = todayIso();

  const { data, error } = await supabase.rpc('production_sold', { p_from: from, p_to: to });
  if (mine !== soldGeneration) return;

  if (error) {
    // Function not deployed yet — the Sold column simply stays empty.
    console.error('[production] could not read sold counts:', error.message);
    return;
  }

  const rows = (data as unknown) as SoldRow[];
  sold = rows.flatMap((r) => {
    const key = variantKeyOf(r.variant);
    return key ? [{ variantKey: key, soldOn: r.sold_on, qty: Number(r.qty) || 0 }] : [];
  });
  publish();
}

/** Re-read the sold column. Cheap, and the page calls it when it opens. */
export function refreshSold(): void {
  if (!supabase) {
    sold = soldFromLedger();
    publish();
    return;
  }
  void fetchSold();
}

/** Every sold count the page knows about. Pair with `useProduction()`. */
export function allSold(): SoldEntry[] {
  if (soldCacheVersion !== version) {
    soldCache = sold;
    soldCacheVersion = version;
  }
  return soldCache;
}

// ── Writing ─────────────────────────────────────────────────────────────────

/** Append a batch of finished pieces. Resolves false if the write failed. */
export async function addProduction(entries: ProductionEntry[]): Promise<boolean> {
  if (!entries.length) return false;

  if (!supabase) {
    live = [...entries, ...live];
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(live));
    } catch {
      /* private mode — keep it in memory */
    }
    publish();
    return true;
  }

  // Show it straight away, then roll back if the server rejects it.
  live = [...entries, ...live];
  publish();

  const rows = entries.map((e) => ({
    id: e.id,
    produced_on: e.producedOn,
    variant_key: e.variantKey,
    qty: e.qty,
    rejected: e.rejected,
    created_by: e.createdBy,
  }));

  const { error } = await supabase.from('production').insert(rows);
  if (error) {
    const failed = new Set(entries.map((e) => e.id));
    live = live.filter((e) => !failed.has(e.id));
    publish();
    console.error('[production] could not save:', error.message);
    return false;
  }
  return true;
}

export function subscribeProduction(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Subscribe a screen to the log. Put the number in the deps of any memo. */
export function useProduction(): number {
  return useSyncExternalStore(subscribeProduction, () => version, () => version);
}

// ── Date helpers ────────────────────────────────────────────────────────────
// Dates are 'YYYY-MM-DD' strings, which sort correctly as plain strings, so the
// range checks are simple comparisons against today / the week's Saturday / the
// 1st of the month.

export const todayIso = (d: Date = new Date()): string => dateKey(d);

/** The Saturday that starts the current reporting week (matches the ledger). */
export function weekStartIso(d: Date = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const since = (x.getDay() - WEEK_START_WEEKDAY + 7) % 7;
  x.setDate(x.getDate() - since);
  return dateKey(x);
}

/** The 1st of the current month. */
export function monthStartIso(d: Date = new Date()): string {
  return dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Does an entry's date fall in the current day / week / month? */
export function inPeriod(iso: string, period: Period): boolean {
  const today = todayIso();
  if (iso > today) return false; // never count a future day
  if (period === 'day') return iso === today;
  if (period === 'week') return iso >= weekStartIso();
  return iso >= monthStartIso();
}

/** Shift a 'YYYY-MM-DD' by n days, without any timezone drift. */
export function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}
