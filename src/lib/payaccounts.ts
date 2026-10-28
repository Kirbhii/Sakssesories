// ─── Member payment accounts ────────────────────────────────────────────────
// Every member can publish the accounts they want to be paid into: GCash,
// MariBank, Maya, or anything else they type in. Each account carries the name
// on it, the number, and a picture of the QR the customer scans.
//
// Why this exists: when a customer orders from the website on their own, nobody
// is standing at the counter to take the money. The order is credited to the
// member who needs it most (see `creditRecipient` in quota.ts), so the QR the
// customer sees has to be *that member's* QR — otherwise the money lands in an
// account the shop cannot match to the order.
//
// The name on the account is the verification: the customer sees "Maria Santos
// · GCash · 0917…" next to the code before paying, and the member sees the same
// account on their own page. If the two disagree, the shop can tell.
//
// Stored in localStorage until Supabase is wired — the shape already matches a
// `payment_accounts` table (member_id, method, label, account_name,
// account_number, qr_data_url, created_at).

import { useSyncExternalStore } from 'react';
import { activeMembers, needOf, roomOf } from '@/lib/quota';

export interface PayMethodInfo {
  id: string;
  label: string;
  /** Built in, so it is offered even before anyone uploads a code. */
  preset: boolean;
}

/**
 * The methods the shop expects to see. Anything else a member types in joins
 * this list as a custom method, and only appears on the POS once at least one
 * member has an account for it — there is no point offering a customer a way
 * to pay that nobody can receive.
 */
export const PRESET_METHODS: PayMethodInfo[] = [
  { id: 'gcash', label: 'GCash', preset: true },
  { id: 'maribank', label: 'MariBank', preset: true },
  { id: 'maya', label: 'Maya', preset: true },
];

export interface PayAccount {
  id: string;
  memberId: string;
  /** Method id — 'gcash', 'maribank', or a slug of a custom name. */
  method: string;
  /** Shown to the customer. Stored so a custom method keeps its spelling. */
  label: string;
  /** The name on the account — the bit that proves whose code this is. */
  accountName: string;
  /** Mobile number or account number, whatever the customer types into. */
  accountNumber: string;
  /** Downscaled JPEG/PNG data URL of the QR, or null if none was uploaded. */
  qr: string | null;
  addedAt: string;
}

const STORAGE_KEY = 'skph.payaccounts';

// ── The store ───────────────────────────────────────────────────────────────
// Module-level and immutable: every change replaces the array, so
// `useSyncExternalStore` can compare by identity and re-render only on change.

function read(): PayAccount[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is PayAccount =>
        !!a && typeof a === 'object' && typeof (a as PayAccount).id === 'string',
    );
  } catch {
    return [];
  }
}

let accounts: PayAccount[] = read();
const listeners = new Set<() => void>();

function commit(next: PayAccount[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Out of room (or private mode). The account still shows for this visit,
    // but it will not survive a reload — the caller reports that.
    accounts = next;
    listeners.forEach((fn) => fn());
    return false;
  }
  accounts = next;
  listeners.forEach((fn) => fn());
  return true;
}

export function subscribeAccounts(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getAccounts = (): PayAccount[] => accounts;

/** Re-renders the caller whenever any account is added or removed. */
export function useAccounts(): PayAccount[] {
  return useSyncExternalStore(subscribeAccounts, getAccounts, getAccounts);
}

// ── Reads ───────────────────────────────────────────────────────────────────

export const accountsOf = (memberId: string): PayAccount[] =>
  accounts.filter((a) => a.memberId === memberId);

/** The account a customer should pay into for this member + method. */
export const accountOf = (memberId: string, method: string): PayAccount | undefined =>
  accounts.find((a) => a.memberId === memberId && a.method === method);

export const hasAccount = (memberId: string, method: string): boolean =>
  !!accountOf(memberId, method);

/**
 * Every method worth offering: the presets, plus any custom method some member
 * has actually published an account for. `cash` is not here — it has no QR.
 */
export function methodsInUse(list: PayAccount[] = accounts): PayMethodInfo[] {
  const custom = new Map<string, PayMethodInfo>();
  for (const a of list) {
    if (!PRESET_METHODS.some((p) => p.id === a.method)) {
      custom.set(a.method, { id: a.method, label: a.label, preset: false });
    }
  }
  return [...PRESET_METHODS, ...custom.values()];
}

/** 'MariBank' → 'maribank'. Custom names need a stable id too. */
export const slugMethod = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'other';

/** The label for a method id, falling back to the id itself. */
export function methodLabel(id: string): string {
  return PRESET_METHODS.find((m) => m.id === id)?.label ?? accounts.find((a) => a.method === id)?.label ?? id;
}

/**
 * Who should receive a customer's payment for this method.
 *
 * A customer ordering on their own has nobody at the counter, so the money has
 * to land in a member's account. Picking "whoever needs it most" is not enough:
 * that member may never have published a code, and then the customer is told
 * the method is unavailable while a teammate with an account goes unused.
 *
 * So the pool is the members who actually published a code for this method, and
 * the winner is whoever needs it most inside that pool — the same ranking
 * `creditRecipient` uses. Sorting by `needOf` also does the right thing when
 * everyone in the pool is at quota: they all score 0 and the first one still
 * takes the money, because the shop is not going to refuse a sale.
 *
 * `null` means nobody can take this method at all.
 */
export function payeeFor(method: string): string | null {
  const able = new Set(
    accounts.filter((a) => a.method === method && a.qr).map((a) => a.memberId),
  );
  const pool = activeMembers.filter((m) => able.has(m.id));
  if (!pool.length) return null;
  return [...pool].sort((a, b) => needOf(b.id) - needOf(a.id) || roomOf(b.id) - roomOf(a.id))[0].id;
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface NewAccount {
  memberId: string;
  method: string;
  label: string;
  accountName: string;
  accountNumber: string;
  qr: string | null;
}

/**
 * Add an account, or replace the one this member already has for that method —
 * a member has exactly one code per method, so adding twice is an edit, not a
 * duplicate. Returns `false` when the browser refused to store it.
 */
export function saveAccount(input: NewAccount): boolean {
  const existing = accountOf(input.memberId, input.method);
  const row: PayAccount = {
    id: existing?.id ?? `pa-${input.memberId}-${input.method}-${Date.now()}`,
    memberId: input.memberId,
    method: input.method,
    label: input.label,
    accountName: input.accountName.trim(),
    accountNumber: input.accountNumber.trim(),
    qr: input.qr,
    addedAt: existing?.addedAt ?? new Date().toISOString(),
  };
  const next = existing
    ? accounts.map((a) => (a.id === existing.id ? row : a))
    : [...accounts, row];
  return commit(next);
}

export function removeAccount(id: string): boolean {
  return commit(accounts.filter((a) => a.id !== id));
}

// ── The QR picture ──────────────────────────────────────────────────────────
// localStorage is a 5 MB shelf shared with everything else, and a phone photo of
// a QR is 2–4 MB on its own. Shrink it to 480 px on the long edge and re-encode
// as JPEG before it ever touches storage — still perfectly scannable, ~40 KB.

const MAX_EDGE = 480;

export async function readQrImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That file is not an image.'));
    image.src = dataUrl;
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  // White behind the code: a transparent PNG would otherwise come out black in
  // JPEG, and a QR on black does not scan.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.86);
}
