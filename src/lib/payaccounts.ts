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
// Rows live in `public.payment_accounts`. A member can read and write only
// their own; the GM can read all of them so they can be approved. A customer
// reads none of this — they call `payee_for(method)` instead, which hands back
// one approved account and nothing else.

import { useSyncExternalStore } from 'react';
import { activeMembers, memberOf, needOf, roomOf } from '@/lib/quota';
import { supabase, type PaymentAccountRow, type PayeeRow } from '@/lib/supabase';

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

/** The parts of an account a payer has to see, whoever it belongs to. */
export interface PayCode {
  label: string;
  accountName: string;
  accountNumber: string;
  qr: string | null;
}

export interface PayAccount extends PayCode {
  id: string;
  memberId: string;
  /** Method id — 'gcash', 'maribank', or a slug of a custom name. */
  method: string;
  /**
   * False until a person has looked at the code and confirmed it is really that
   * member's. Only approved codes are ever shown to a customer, because the one
   * thing an upload cannot prove is whose account it is.
   */
  approved: boolean;
  addedAt: string;
}

/** Who the money goes to, when the payer is a customer rather than staff. */
export interface Payee extends PayCode {
  memberId: string;
  memberName: string;
}

const STORAGE_KEY = 'skph.payaccounts';

/** No database configured → the local stand-in. Decided once, at load. */
const ONLINE = !!supabase;

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

let accounts: PayAccount[] = ONLINE ? [] : read();
const listeners = new Set<() => void>();

function publish(): void {
  listeners.forEach((fn) => fn());
}

function commitLocal(next: PayAccount[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Out of room (or private mode). The account still shows for this visit,
    // but it will not survive a reload — the caller reports that.
    accounts = next;
    publish();
    return false;
  }
  accounts = next;
  publish();
  return true;
}

function rowToAccount(r: PaymentAccountRow): PayAccount {
  return {
    id: r.id,
    memberId: r.member_slug,
    method: r.method,
    label: r.label,
    accountName: r.account_name,
    accountNumber: r.account_number,
    qr: r.qr,
    approved: r.approved,
    addedAt: r.created_at,
  };
}

const COLUMNS =
  'id, member_slug, method, label, account_name, account_number, qr, approved, created_at';

/**
 * Fill the cache. How much comes back depends on who is asking: a member gets
 * their own codes, the GM gets everyone's so they can be approved, and a
 * signed-out visitor gets nothing at all.
 *
 * Only the newest read lands — see the same note in `sales.ts`.
 */
let generation = 0;

export async function loadAccounts(): Promise<void> {
  if (!supabase) return;
  const mine = ++generation;

  const { data, error } = await supabase.from('payment_accounts').select(COLUMNS);
  if (mine !== generation) return;

  if (error) {
    console.error('[payaccounts] could not read the codes:', error.message);
    return;
  }
  accounts = (data as PaymentAccountRow[]).map(rowToAccount);
  publish();
}

export function subscribeAccounts(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getAccounts = (): PayAccount[] => accounts;

/** Re-renders the caller whenever any account is added, replaced or removed. */
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
 * Who should receive a customer's payment for this method, when there is no
 * database to ask.
 *
 * A customer ordering on their own has nobody at the counter, so the money has
 * to land in a member's account. Picking "whoever needs it most" is not enough:
 * that member may never have published a code, and then the customer is told
 * the method is unavailable while a teammate with an account goes unused.
 *
 * So the pool is the members who actually published a code for this method, and
 * the winner is whoever needs it most inside that pool — the same ranking
 * `creditRecipient` uses.
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

/**
 * The account a signed-out customer should pay into.
 *
 * With a database this is `payee_for(method)` — one approved account, chosen
 * server-side, with none of the table exposed. Without one it falls back to the
 * local pick above, so the flow can still be walked through offline.
 *
 * `null` means nobody can take this method, and the POS has to say so rather
 * than show a code that pays nobody.
 */
export async function findPayee(method: string): Promise<Payee | null> {
  if (!supabase) {
    const id = payeeFor(method);
    const local = id ? accountOf(id, method) : undefined;
    if (!id || !local) return null;
    return {
      memberId: id,
      memberName: memberOf(id)?.name ?? id,
      label: local.label,
      accountName: local.accountName,
      accountNumber: local.accountNumber,
      qr: local.qr,
    };
  }

  const { data, error } = await supabase.rpc('payee_for', { p_method: method });
  if (error) {
    console.error('[payaccounts] could not find a payee:', error.message);
    return null;
  }
  const row = (data as PayeeRow[] | null)?.[0];
  if (!row) return null;
  return {
    memberId: row.member_slug,
    memberName: row.member_name,
    label: row.label,
    accountName: row.account_name,
    accountNumber: row.account_number,
    qr: row.qr,
  };
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
 * duplicate.
 *
 * A replacement goes back to `approved = false`. That is deliberate: the thing
 * being approved is the picture, and a new picture has not been looked at yet.
 */
export async function saveAccount(input: NewAccount): Promise<boolean> {
  const cleanName = input.accountName.trim();
  const cleanNumber = input.accountNumber.trim();

  if (!supabase) {
    const existing = accountOf(input.memberId, input.method);
    const row: PayAccount = {
      id: existing?.id ?? `pa-${input.memberId}-${input.method}-${Date.now()}`,
      memberId: input.memberId,
      method: input.method,
      label: input.label,
      accountName: cleanName,
      accountNumber: cleanNumber,
      qr: input.qr,
      approved: true, // no database, nobody to ask
      addedAt: existing?.addedAt ?? new Date().toISOString(),
    };
    return commitLocal(
      existing ? accounts.map((a) => (a.id === existing.id ? row : a)) : [...accounts, row],
    );
  }

  const { data, error } = await supabase
    .from('payment_accounts')
    .upsert(
      {
        member_slug: input.memberId,
        method: input.method,
        label: input.label,
        account_name: cleanName,
        account_number: cleanNumber,
        qr: input.qr,
        approved: false,
        approved_by: null,
        approved_at: null,
      },
      { onConflict: 'member_slug,method' },
    )
    .select(COLUMNS)
    .single();

  if (error || !data) {
    console.error('[payaccounts] could not save the code:', error?.message);
    return false;
  }

  const saved = rowToAccount(data as PaymentAccountRow);
  const without = accounts.filter(
    (a) => !(a.memberId === saved.memberId && a.method === saved.method),
  );
  accounts = [...without, saved];
  publish();
  return true;
}

export async function removeAccount(id: string): Promise<boolean> {
  if (!supabase) return commitLocal(accounts.filter((a) => a.id !== id));

  const { error } = await supabase.from('payment_accounts').delete().eq('id', id);
  if (error) {
    console.error('[payaccounts] could not remove the code:', error.message);
    return false;
  }
  accounts = accounts.filter((a) => a.id !== id);
  publish();
  return true;
}

/**
 * The GM's check: this code really belongs to this member. Until it is set the
 * account is invisible to customers — a member can always use their own code at
 * the counter, but money cannot be sent to an account nobody has confirmed.
 */
export async function approveAccount(id: string, bySlug: string): Promise<boolean> {
  if (!supabase) {
    accounts = accounts.map((a) => (a.id === id ? { ...a, approved: true } : a));
    publish();
    return true;
  }

  const { error } = await supabase
    .from('payment_accounts')
    .update({ approved: true, approved_by: bySlug, approved_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[payaccounts] could not approve the code:', error.message);
    return false;
  }
  accounts = accounts.map((a) => (a.id === id ? { ...a, approved: true } : a));
  publish();
  return true;
}

// ── The QR picture ──────────────────────────────────────────────────────────
// A phone photo of a QR is 2–4 MB on its own, and the picture is stored in the
// row. Shrink it to 480 px on the long edge and re-encode as JPEG before it is
// ever sent — still perfectly scannable, ~40 KB.

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
