// ─── Production log ─────────────────────────────────────────────────────────
// The manual production log that replaced the inventory screen. Production
// records how many pieces of each variant they finished on a given day; the
// Production page sums those into day/week/month totals and keeps a history.
//
// Same shape as the sales ledger: a Supabase table when the shop is connected,
// a localStorage stand-in otherwise, so the page still works on a fresh clone.
// One row is one ADDITION — a second batch on the same day is another row, so
// the history shows everything that went in, not just a running total.

import { useSyncExternalStore } from 'react';
import { supabase, type ProductionRow } from './supabase';
import { dateKey, WEEK_START_WEEKDAY } from './schedule';

export interface ProductionEntry {
  id: string;
  /** 'YYYY-MM-DD' — the day the pieces were finished. */
  producedOn: string;
  /** Matches a VARIANTS key from `data.ts`, e.g. 'heart-navy'. */
  variantKey: string;
  qty: number;
  /** Slug of whoever logged it, when known. */
  createdBy: string | null;
  createdAt: string;
}

export type Period = 'day' | 'week' | 'month';

const STORE_KEY = 'skph.production';
const ONLINE = !!supabase;

function readLocal(): ProductionEntry[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ProductionEntry =>
        !!e && typeof e === 'object' && typeof (e as ProductionEntry).id === 'string',
    );
  } catch {
    return [];
  }
}

let live: ProductionEntry[] = ONLINE ? [] : readLocal();
let version = 0;
let cache: ProductionEntry[] = live;
let cacheVersion = -1;
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
    .select('id, produced_on, variant_key, qty, created_by, created_at')
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
}

/** Every entry, newest first. Identity changes only when the log changes. */
export function allProduction(): ProductionEntry[] {
  if (cacheVersion !== version) {
    cache = live;
    cacheVersion = version;
  }
  return cache;
}

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
