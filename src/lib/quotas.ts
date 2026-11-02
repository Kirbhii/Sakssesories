// ─── Quotas, loaded and saved ───────────────────────────────────────────────
// The numbers themselves live in `public.member_quotas`, one row per person
// per month per week, with `week = 0` holding the whole-month target.
//
// This file is the only place that talks to that table. `quota.ts` holds the
// numbers in memory for the screens to read; this hands them over and takes
// the edits back.
//
// ── Why a zero is stored rather than deleted ────────────────────────────────
// "Nobody has set a number" and "the number is zero" behave the same way
// everywhere in the app — both mean no cap — so clearing a box simply writes a
// zero. That keeps saving a single upsert instead of a delete-then-insert,
// which matters because the browser has no transaction to fall back on: a
// delete that succeeded followed by an insert that failed would lose the whole
// month's numbers.

import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { monthOf, setQuotaPlan, type QuotaRow } from '@/lib/quota';

const STORAGE_KEY = 'skph.quotas';

/** No database configured → the local stand-in. Decided once, at load. */
const ONLINE = !!supabase;

export interface QuotaEntry {
  memberId: string;
  /** 'YYYY-MM'. */
  month: string;
  /** 0 = the whole month, 1..5 = that week inside it. */
  week: number;
  pieces: number;
}

function isEntry(v: unknown): v is QuotaEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as QuotaEntry;
  return (
    typeof e.memberId === 'string' &&
    typeof e.month === 'string' &&
    typeof e.week === 'number' &&
    typeof e.pieces === 'number'
  );
}

function read(): QuotaEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

// ── The store ───────────────────────────────────────────────────────────────
// Module-level and immutable: every change replaces the array, so
// `useSyncExternalStore` can compare by identity and re-render only on change.

let entries: QuotaEntry[] = ONLINE ? [] : read();
const listeners = new Set<() => void>();

/** Push the current entries into the engine the screens read. */
function sync(): void {
  const rows: QuotaRow[] = entries.map((e) => ({
    member_slug: e.memberId,
    month: e.month,
    week: e.week,
    pieces: e.pieces,
  }));
  setQuotaPlan(rows);
}

function publish(): void {
  sync();
  listeners.forEach((fn) => fn());
}

function commitLocal(next: QuotaEntry[]): void {
  entries = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Out of room or private mode. The numbers still work for this visit.
  }
  publish();
}

// Offline the local stand-in is the source of truth, so seed the engine once.
if (!ONLINE) sync();

/**
 * Fill the cache from the database.
 *
 * Every month is read at once — there are only a few dozen rows in a year, and
 * the screen flips between months without another round trip.
 */
let generation = 0;

export async function loadQuotas(): Promise<void> {
  if (!supabase) return;
  const mine = ++generation;

  const { data, error } = await supabase
    .from('member_quotas')
    .select('member_slug, month, week, pieces');

  if (mine !== generation) return;

  if (error) {
    // A missing table means `supabase/quota-2026.sql` has not been run yet.
    // Say so plainly instead of pretending everybody has no target.
    console.error('[quotas] could not read the numbers:', error.message);
    return;
  }

  entries = (data as { member_slug: string; month: string; week: number; pieces: number }[]).map(
    (r) => ({
      memberId: r.member_slug,
      month: monthOf(r.month),
      week: r.week,
      pieces: r.pieces,
    }),
  );
  publish();
}

export function subscribeQuotas(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getQuotaEntries = (): QuotaEntry[] => entries;

/** Re-renders the caller whenever a number is changed. */
export function useQuotaEntries(): QuotaEntry[] {
  return useSyncExternalStore(subscribeQuotas, getQuotaEntries, getQuotaEntries);
}

/** The numbers set for one month, keyed by member. */
export function entriesFor(month: string): Record<string, QuotaEntry[]> {
  const out: Record<string, QuotaEntry[]> = {};
  for (const e of entries) {
    if (e.month !== month) continue;
    (out[e.memberId] ??= []).push(e);
  }
  return out;
}

/** One person's number for one week (0 = the whole month). */
export function piecesOf(month: string, memberId: string, week: number): number {
  const hit = entries.find((e) => e.month === month && e.memberId === memberId && e.week === week);
  return hit?.pieces ?? 0;
}

/**
 * Save one month's numbers.
 *
 * `next` is the whole month as the screen sees it — every person, every week —
 * so a cleared box arrives as a zero and is written as one. Nothing is
 * deleted, and nothing outside this month is touched.
 *
 * Returns false when the write did not land, so the screen can say so instead
 * of showing numbers that are not really saved.
 */
export async function saveMonth(month: string, next: QuotaEntry[]): Promise<boolean> {
  // Keep every other month exactly as it was.
  const others = entries.filter((e) => e.month !== month);
  const mine = next.map((e) => ({ ...e, month }));

  if (!supabase) {
    commitLocal([...others, ...mine]);
    return true;
  }

  const rows = mine.map((e) => ({
    member_slug: e.memberId,
    month: `${month}-01`,
    week: e.week,
    pieces: Math.max(0, Math.round(e.pieces)),
  }));

  const { error } = await supabase
    .from('member_quotas')
    .upsert(rows, { onConflict: 'member_slug,month,week' });

  if (error) {
    console.error('[quotas] could not save the numbers:', error.message);
    return false;
  }

  entries = [...others, ...mine];
  publish();
  return true;
}
