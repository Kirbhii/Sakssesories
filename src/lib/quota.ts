// ─── Quotas ─────────────────────────────────────────────────────────────────
// Every person has their own number, typed by Marketing or the GM. Nothing is
// divided and nothing is derived from a department total: two people in the
// same department can carry very different targets, because that is how the
// shop really runs.
//
// Each person carries TWO numbers:
//
//   the month   what the month is judged on
//   the week    what the team works to day by day — one target per week
//
// They are separate promises. A week can be missed while the month still
// lands, so the app never pretends one is the other.
//
// ── A week here is a block of days counted from the 1st ─────────────────────
// 1–7, 8–14, 15–21, 22–28, and 29 to the end. Deliberately NOT the
// Saturday-to-Friday remittance week used on the Summary screen: a target is
// set as "week 1 of November", and cutting that into partial weeks at the
// edges of a month would make two months impossible to compare. The screen
// prints the real dates on every column so there is nothing to guess.
//
// ── No target is not the same as a target of zero ──────────────────────────
// A month starts blank. A person with no number set has NO CAP — they can keep
// selling. The alternative would be to read "unset" as "zero" and quietly
// stop the whole shop on the first day of the month, which is the worst
// possible failure for a till.
//
// Nobody may go past their own number once it IS set. When a member is full,
// the sale still happens — but the credit goes to a teammate who still has
// room.
//
// That makes every sale TWO separate facts:
//   rungUp    who stood at the POS and rang it up — never changes
//   credited  whose quota it counts against — starts as the seller, and moves
//             to a teammate once the seller is full
//
// Keep both. If you only kept `credited`, the person who actually sold the
// piece would disappear from the record while someone else got the number, and
// nobody could ever prove who did the work.

export type MemberRole = 'marketing' | 'production' | 'finance' | 'gm';
export type DepartmentId = 'marketing' | 'production' | 'finance';

export interface Department {
  id: DepartmentId;
  name: string;
  /** The sum of this department's members' month targets. Read-only. */
  quota: number;
}

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  department: DepartmentId;
  active: boolean;
  /** Pieces this member rang up at the POS. Mock until Supabase is wired. */
  rungUp: number;
  /** Pieces counted against their quota — differs from rungUp after transfers. */
  credited: number;
  // ── Filled in from the Profile screen. Optional because the roster above is
  // a static fallback: without a database there is nobody to hold these.
  email?: string;
  phone?: string;
  address?: string;
  /** 'YYYY-MM-DD'. */
  birthday?: string;
  /** A downscaled JPEG data URL, not a link. */
  avatar?: string | null;
}

export interface QuotaPlan {
  /** 'YYYY-MM' — the month the screens are working to right now. */
  month: string;
  /** 'November'. */
  label: string;
  /** Team ceiling — the sum of every person's month target. */
  team: number;
  departments: Department[];
}

// ── The departments ─────────────────────────────────────────────────────────
// Only the names live here now. The quota on each one is filled in by
// `rebuild()` as the sum of its members, so it can never disagree with the
// people it is made of. The array identity never changes, because the Users
// screen builds its department labels once at load.
const DEPARTMENT_LIST: Department[] = [
  { id: 'marketing', name: 'Marketing', quota: 0 },
  { id: 'production', name: 'Production', quota: 0 },
  { id: 'finance', name: 'Finance + GM', quota: 0 },
];

/** 'YYYY-MM' for a date. Local, not UTC — the shop works in Manila time. */
export function monthKeyOf(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** '2026-11' → 'November'. */
export function monthLabel(month: string): string {
  const m = Number(month.slice(5, 7));
  return MONTH_NAMES[m - 1] ?? month;
}

/** '2026-11' → 'Nov'. */
export function monthShort(month: string): string {
  return monthLabel(month).slice(0, 3);
}

/** '2026-11' → '2026-11-01', which is what the database stores. */
export function monthStart(month: string): string {
  return `${month}-01`;
}

/** '2026-11-01' → '2026-11'. Tolerates a plain 'YYYY-MM' too. */
export function monthOf(value: string): string {
  return value.slice(0, 7);
}

/** The month the screens are working to. */
export const currentMonth = (): string => monthKeyOf(new Date());

export interface QuotaWeek {
  /** 1..5 — the number shown on the screen. */
  n: number;
  /** First day of the month it covers, 1-based. */
  from: number;
  /** Last day it covers, inclusive. */
  to: number;
  /** 'Nov 1–7'. */
  label: string;
}

/**
 * The weeks inside a month: 1–7, 8–14, 15–21, 22–28, then 29 to the end.
 * A 28-day February has four; a 31-day month has five.
 */
export function weeksOf(month: string): QuotaWeek[] {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const days = new Date(year, m, 0).getDate();
  const short = monthShort(month);

  const out: QuotaWeek[] = [];
  let n = 1;
  for (let from = 1; from <= days; from += 7) {
    const to = Math.min(from + 6, days);
    out.push({ n, from, to, label: `${short} ${from}–${to}` });
    n += 1;
  }
  return out;
}

// ── The roster ──────────────────────────────────────────────────────────────
// These are the people who work here, and they are also the fallback: on a
// fresh clone with no database the app still has somebody to show. Once the
// database answers, `setRoster` replaces this list wholesale with whatever is
// really in `public.profiles` — so adding a person is a row in that table, not
// an edit here and a redeploy.
//
// Keep this list identical to the seed in `supabase/schema.sql` and to
// `supabase/roster-2026.sql`. If the three drift, the offline build shows one
// thing and the live shop another.
//
// The slug is the last name, because that is what the sign-up trigger derives
// from the address. Jheff is the one exception — he already has a row called
// 'jheff' and his QR codes and his sales hang off it.
//
// The order is by department: the GM, then Finance, then Marketing, then
// Production. It is the order the Users screen lists them in.
export const MEMBERS: Member[] = [
  { id: 'dupaya', name: 'John Paul Dupaya', role: 'gm', department: 'finance', active: true, rungUp: 0, credited: 0 },
  { id: 'gapusan', name: 'Joseph Farrel Gapusan', role: 'finance', department: 'finance', active: true, rungUp: 0, credited: 0 },
  { id: 'nevero', name: 'John Vincent Nevero', role: 'finance', department: 'finance', active: true, rungUp: 0, credited: 0 },
  { id: 'jheff', name: 'Jheff Cyril Reloba', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'lenon', name: 'Crystler Lenon', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'carino', name: 'Richelle Cariño', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'evangelista', name: 'Juliana Evangelista', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'yu', name: 'Stephen Aaron Yu', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'nisnisan', name: 'Arian Nisnisan', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'pastor', name: 'Regine Pastor', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'branda', name: 'Angel Laila Branda', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'valdez', name: 'Hazel Ann Valdez', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'germones', name: 'Sean Matthew Germones', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'flores', name: 'Tom Christofer Flores', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'alnin', name: 'Ronnielyn Alnin', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'batalla', name: 'Janel Batalla', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'galicia', name: 'Maria Justine Galicia', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
];

/** Whoever is signed in. Pinned to the header chip until auth exists. */
export const ME = MEMBERS[0];

/**
 * The active members the screens read. Mutated in place by `setRoster` rather
 * than reassigned, so every `activeMembers.filter(...)` already in the app
 * keeps pointing at the live list instead of a stale copy.
 */
export const activeMembers: Member[] = [];

export const memberOf = (id: string): Member | undefined => MEMBERS.find((m) => m.id === id);

export const departmentOf = (id: string): Department | undefined =>
  PLAN.departments.find((d) => d.id === memberOf(id)?.department);

// ── The sheet of numbers ────────────────────────────────────────────────────
// Keyed by month first, so every month is its own sheet. A month that was
// never filled in is simply absent — not a sheet full of zeros, because a zero
// and "nobody has set this yet" are different things.
export interface MemberQuota {
  /** The target for the whole month. */
  month: number;
  /** Week 1..5 → target. Index 0 is week 1. */
  weeks: number[];
}

export type QuotaSheet = Record<string, MemberQuota>;

/** One row as it comes back from `public.member_quotas`. */
export interface QuotaRow {
  member_slug: string;
  /** 'YYYY-MM-DD'. */
  month: string;
  /** 0 = the whole month, 1..5 = that week. */
  week: number;
  pieces: number;
}

let SHEETS: Record<string, QuotaSheet> = {};

/** The numbers set for a month. Empty when nobody has filled it in yet. */
export function sheetFor(month: string): QuotaSheet {
  return SHEETS[month] ?? {};
}

export const PLAN: QuotaPlan = {
  month: currentMonth(),
  label: monthLabel(currentMonth()),
  team: 0,
  departments: DEPARTMENT_LIST,
};

/**
 * Rebuild everything derived from the roster and the numbers.
 *
 * `credited` is not part of this: it starts at zero and the screens read the
 * real total off the sales ledger, so a member with no entry here is not
 * treated as having sold nothing — they are simply not shown a quota ring.
 */
function rebuild(): void {
  activeMembers.splice(0, activeMembers.length, ...MEMBERS.filter((m) => m.active));

  PLAN.month = currentMonth();
  PLAN.label = monthLabel(PLAN.month);

  const sheet = SHEETS[PLAN.month] ?? {};

  let team = 0;
  for (const dept of DEPARTMENT_LIST) dept.quota = 0;

  for (const m of activeMembers) {
    const target = sheet[m.id]?.month ?? 0;
    team += target;
    const dept = DEPARTMENT_LIST.find((d) => d.id === m.department);
    if (dept) dept.quota += target;
  }

  PLAN.team = team;
}

rebuild();

/**
 * Adopt the roster the database just handed over.
 *
 * An empty list is ignored on purpose: a failed read or a half-finished
 * migration would otherwise blank the shop, and "everybody disappeared" is a
 * worse failure than "still showing yesterday's list".
 */
export function setRoster(list: Member[]): void {
  if (!list.length) return;
  MEMBERS.splice(0, MEMBERS.length, ...list);
  rebuild();
}

/**
 * Adopt the numbers the database just handed over.
 *
 * The rows are every month that has been filled in, not just this one, so the
 * screen can flip between months without another round trip.
 */
export function setQuotaPlan(rows: QuotaRow[]): void {
  const next: Record<string, QuotaSheet> = {};

  for (const r of rows) {
    const key = monthOf(r.month);
    const sheet = (next[key] ??= {});
    const entry = (sheet[r.member_slug] ??= { month: 0, weeks: [0, 0, 0, 0, 0] });

    if (r.week === 0) entry.month = r.pieces;
    else if (r.week >= 1 && r.week <= 5) entry.weeks[r.week - 1] = r.pieces;
  }

  SHEETS = next;
  rebuild();
}

/** Forget every loaded number. Used before a fresh read. */
export function clearQuotaPlan(): void {
  SHEETS = {};
  rebuild();
}

/**
 * Write this month's piece counts onto the roster.
 *
 * `credited` is how many pieces are counted against a person's quota this
 * month. It is not stored anywhere else — the counts come from the ledger, and
 * the roster only carries them so the screens can draw a ring.
 *
 * It has to be called AFTER `setRoster`, because that hands out fresh members
 * with the count back at zero.
 */
export function setCredited(counts: Record<string, number>): void {
  for (const m of MEMBERS) m.credited = counts[m.id] ?? 0;
}

// ── Reading one person's numbers ────────────────────────────────────────────

/** Has anybody set this person a target for the month we are working to? */
export function hasQuota(id: string): boolean {
  return quotaOf(id) > 0;
}

/** This person's target for the whole month. 0 means nobody has set one. */
export function quotaOf(id: string): number {
  return SHEETS[PLAN.month]?.[id]?.month ?? 0;
}

/** This person's target for week 1..5. 0 means nobody has set one. */
export function weekQuotaOf(id: string, week: number): number {
  if (week < 1 || week > 5) return 0;
  return SHEETS[PLAN.month]?.[id]?.weeks?.[week - 1] ?? 0;
}

/** Somebody, somewhere, has a number for this month. */
export function anyQuotaSet(month: string = PLAN.month): boolean {
  const sheet = SHEETS[month];
  if (!sheet) return false;
  return Object.values(sheet).some((q) => q.month > 0);
}

/**
 * Pieces still allowed before this person hits their cap.
 *
 * `Infinity` when no target is set — that is not a missing value, it is the
 * honest answer: no cap. Screens print it with `roomLabel`.
 */
export function roomOf(id: string): number {
  const quota = quotaOf(id);
  if (quota <= 0) return Infinity;
  const m = memberOf(id);
  return Math.max(0, quota - (m?.credited ?? 0));
}

/** A number a screen can print: "12", or "—" when no target is set. */
export function roomLabel(id: string): string {
  const room = roomOf(id);
  return Number.isFinite(room) ? String(room) : '—';
}

/** A target a screen can print: "40", or "—" when nobody has set one. */
export function quotaLabel(id: string): string {
  const quota = quotaOf(id);
  return quota > 0 ? String(quota) : '—';
}

/**
 * Credit minus rung up. Negative means this member passed pieces on, positive
 * means they received pieces from someone who was already full.
 */
export function netTransferred(id: string): number {
  const m = memberOf(id);
  return m ? m.credited - m.rungUp : 0;
}

export const passedOn = (id: string): number => Math.max(0, -netTransferred(id));

export const departmentCredited = (id: DepartmentId): number =>
  activeMembers.filter((m) => m.department === id).reduce((sum, m) => sum + m.credited, 0);

/** Team total is derived, never stored — it is just the sum of credited. */
export const teamCredited = activeMembers.reduce((sum, m) => sum + m.credited, 0);

/** Pieces the team still has to sell to hit the month. 0 when no target. */
export const teamLeft = Math.max(0, PLAN.team - teamCredited);

/**
 * How far behind a member still is, as a fraction of their own quota.
 * 1 = nothing sold yet, 0 = quota met. Scale-free, so a member with a small
 * quota is neither punished nor favoured by the size of the number.
 */
export function needOf(id: string): number {
  const quota = quotaOf(id);
  if (quota <= 0) return 0;
  return Math.max(0, (quota - (memberOf(id)?.credited ?? 0)) / quota);
}

/** Sorting needs a real number: an unset cap ranks as "plenty of room". */
const roomRank = (id: string): number => {
  const room = roomOf(id);
  return Number.isFinite(room) ? room : 1e9;
};

/**
 * Who gets the credit for the next piece.
 *
 * - A seller with room left keeps it — whoever is logged in owns what they ring
 *   up, full stop.
 * - A seller who is full passes it to whoever needs it most.
 * - No seller at all (a customer ordered from the website on their own) goes
 *   straight to whoever needs it most.
 *
 * "Needs it most" is the largest share of quota still outstanding — not the
 * lowest raw count. With uneven quotas those two disagree: someone on 11/31 is
 * further behind than someone on 30/50, even though they have sold fewer.
 *
 * With no quotas set at all, everybody has room and the tie-break falls to the
 * fewest pieces sold — the same "whoever needs it most" answer in spirit.
 *
 * `null` means the whole team is full and the sale cannot be recorded at all.
 */
export function creditRecipient(sellerId: string | null): string | null {
  if (sellerId && roomOf(sellerId) > 0) return sellerId;

  const open = activeMembers
    .filter((m) => m.id !== sellerId && roomOf(m.id) > 0)
    .sort(
      (a, b) =>
        needOf(b.id) - needOf(a.id) ||
        roomRank(b.id) - roomRank(a.id) ||
        a.credited - b.credited,
    );

  return open[0]?.id ?? null;
}

/**
 * Kept for the screens that ask. With hand-set numbers there is no department
 * total to balance against — the team total IS the sum of the people — so this
 * is always true. It stays so the callers do not need to change.
 */
export function planBalanced(): boolean {
  return true;
}

export function pct(credited: number, quota: number): number {
  if (quota <= 0) return 0;
  return Math.round((credited / quota) * 100);
}

/** Bar width, capped so the fill never spills out of its track. */
export function barWidth(credited: number, quota: number): number {
  return Math.min(100, pct(credited, quota));
}
