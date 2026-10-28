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

// Progress starts at zero. The shop records real sales in its own database now,
// so there is no invented tally to show next to them. Only the "how many so
// far" numbers are empty — the GM's targets in PLAN are untouched.
export const MEMBERS: Member[] = [
  { id: 'ana', name: 'Ana Reyes', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'bea', name: 'Bea Lim', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'carla', name: 'Carla Domingo', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'rica', name: 'Rica Flores', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'paolo', name: 'Paolo Garcia', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'noel', name: 'Noel Ramos', role: 'marketing', department: 'marketing', active: true, rungUp: 0, credited: 0 },
  { id: 'carlo', name: 'Carlo Reyes', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'dennis', name: 'Dennis Yu', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'mark', name: 'Mark Bautista', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'liza', name: 'Liza Mercado', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'kim', name: 'Kim Tan', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'grace', name: 'Grace Ong', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'sofia', name: 'Sofia Cruz', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'miguel', name: 'Miguel Torres', role: 'production', department: 'production', active: true, rungUp: 0, credited: 0 },
  { id: 'gabriel', name: 'Gabriel Tan', role: 'gm', department: 'finance', active: true, rungUp: 0, credited: 0 },
  { id: 'maria', name: 'Maria Santos', role: 'finance', department: 'finance', active: true, rungUp: 0, credited: 0 },
  { id: 'anna', name: 'Anna Sy', role: 'finance', department: 'finance', active: true, rungUp: 0, credited: 0 },
];

/** Whoever is signed in. Pinned to the header chip until auth exists. */
export const ME = MEMBERS[0];

export const activeMembers = MEMBERS.filter((m) => m.active);

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

/** Derived once: each active member's whole-piece share of their department. */
const QUOTA_BY_MEMBER: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const dept of PLAN.departments) {
    const members = activeMembers.filter((m) => m.department === dept.id);
    splitEven(dept.quota, members.length).forEach((quota, i) => {
      map[members[i].id] = quota;
    });
  }
  return map;
})();

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
