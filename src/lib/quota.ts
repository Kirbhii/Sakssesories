// ─── Monthly quota ──────────────────────────────────────────────────────────
// The GM sets a quota per department and the team total. Pieces (pcs), not
// pesos. Per-member quotas are derived from the department quota — they are
// never typed, because 250 ÷ 8 is 31.25 and you cannot sell a quarter of a
// keychain. `splitEven` hands out whole pieces and gives the remainder to the
// first few, so a department always adds up to its own target exactly.
//
// Nobody may go past their own quota. When a member is full, the sale still
// happens — but the credit goes to a teammate who still has room.
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
  /** The GM's number for the whole department. */
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
  month: string;
  label: string;
  /** Team ceiling — the sum of every department quota. */
  team: number;
  departments: Department[];
}

export const PLAN: QuotaPlan = {
  month: '2026-10',
  label: 'October',
  team: 650,
  departments: [
    { id: 'marketing', name: 'Marketing', quota: 300 },
    { id: 'production', name: 'Production', quota: 250 },
    { id: 'finance', name: 'Finance + GM', quota: 100 },
  ],
};

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

/**
 * Split `total` into `n` whole pieces. The remainder goes one piece each to the
 * first few, so the parts always add back up to `total`.
 *   250 ÷ 8 → [32, 32, 31, 31, 31, 31, 31, 31]
 */
export function splitEven(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Each active member's whole-piece share of their department. */
let QUOTA_BY_MEMBER: Record<string, number> = {};

/**
 * Rebuild everything derived from the roster. Runs once at load and again
 * whenever the database hands over a different list.
 *
 * `credited` is not part of this: it starts at zero and the screens read the
 * real total off the sales ledger, so a member with no entry here is not
 * treated as having sold nothing — they are simply not shown a quota ring.
 */
function rebuild(): void {
  activeMembers.splice(0, activeMembers.length, ...MEMBERS.filter((m) => m.active));

  QUOTA_BY_MEMBER = {};
  for (const dept of PLAN.departments) {
    const members = activeMembers.filter((m) => m.department === dept.id);
    splitEven(dept.quota, members.length).forEach((quota, i) => {
      QUOTA_BY_MEMBER[members[i].id] = quota;
    });
  }
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

/** This member's share. Derived from the department, never stored. */
export function quotaOf(id: string): number {
  return QUOTA_BY_MEMBER[id] ?? 0;
}

/** Pieces still allowed before this member hits their cap. Never negative. */
export function roomOf(id: string): number {
  const m = memberOf(id);
  return m ? Math.max(0, quotaOf(id) - m.credited) : 0;
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
 * `null` means the whole team is full and the sale cannot be recorded at all.
 */
export function creditRecipient(sellerId: string | null): string | null {
  if (sellerId && roomOf(sellerId) > 0) return sellerId;

  const open = activeMembers
    .filter((m) => m.id !== sellerId && roomOf(m.id) > 0)
    .sort((a, b) => needOf(b.id) - needOf(a.id) || roomOf(b.id) - roomOf(a.id));

  return open[0]?.id ?? null;
}

/** GM check: do the department quotas actually add up to the team ceiling? */
export function planBalanced(plan: QuotaPlan = PLAN): boolean {
  return plan.departments.reduce((sum, d) => sum + d.quota, 0) === plan.team;
}

export function pct(credited: number, quota: number): number {
  if (quota <= 0) return 0;
  return Math.round((credited / quota) * 100);
}

/** Bar width, capped so the fill never spills out of its track. */
export function barWidth(credited: number, quota: number): number {
  return Math.min(100, pct(credited, quota));
}
