import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { peso } from '@/lib/data';
import {
  PLAN,
  activeMembers,
  barWidth,
  creditRecipient,
  departmentCredited,
  memberOf,
  passedOn,
  pct,
  planBalanced,
  quotaOf,
  roomOf,
  teamCredited,
  teamLeft,
} from '@/lib/quota';

import { PAY_LABEL, SALES, dateOf, inRange, orderCount, salesOf, type PayMethod, type Range } from '@/lib/sales';

const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

const KPI = [
  {
    key: 'orders',
    label: 'Orders',
    icon: 'M4 2h8v12l-2-1.4L8 14l-2-1.4L4 14V2ZM6 5.5h4M6 8.5h4',
  },
  {
    key: 'items',
    label: 'Items sold',
    icon: 'M8 2l6 3-6 3-6-3 6-3ZM2 8l6 3 6-3M2 11l6 3 6-3',
  },
  {
    key: 'sales',
    label: 'Sales',
    icon: 'M2.6 5.4c0 1.2 2.4 2.2 5.4 2.2s5.4-1 5.4-2.2S11 3.2 8 3.2 2.6 4.2 2.6 5.4ZM2.6 5.4v5.2c0 1.2 2.4 2.2 5.4 2.2s5.4-1 5.4-2.2V5.4',
  },
  {
    key: 'avg',
    label: 'Average order',
    icon: 'M2.4 2.4h5.2l6 6-5.2 5.2-6-6V2.4ZM5.6 5.6h.1',
  },
] as const;

export default function MySales() {
  const { member, role } = useAuth();

  const [range, setRange] = useState<Range>('today');
  const [query, setQuery] = useState('');
  const [pay, setPay] = useState<'all' | PayMethod>('all');

  // Finance and the GM are allowed to see the whole team's orders; Marketing
  // and Production only see their own. The blueprint draws that line, so the
  // filter lives here rather than in the table component.
  const seesAll = role === 'finance' || role === 'gm';

  // Rows before the payment filter — the range and search still apply, so the
  // payment chips always show totals for whatever range is on screen.
  const baseRows = useMemo(() => {
    if (!member) return [];
    const scope = seesAll ? SALES : salesOf(member.id);
    return scope.filter(
      (s) =>
        inRange(s.ago, range) &&
        (query === '' ||
          `${s.customer} ${s.variant} ${s.orNo}`.toLowerCase().includes(query.toLowerCase())),
    );
  }, [member, seesAll, range, query]);

  const rows = useMemo(
    () => (pay === 'all' ? baseRows : baseRows.filter((s) => s.pay === pay)),
    [baseRows, pay],
  );

  const total = useMemo(
    () => (member ? (seesAll ? SALES : salesOf(member.id)).length : 0),
    [member, seesAll],
  );

  // Totals per payment method. Counted in distinct OR numbers so a multi-variant
  // order counts once, not once per line.
  const byPay = useMemo(() => {
    const acc: Record<PayMethod, { cents: number; orders: Set<string> }> = {
      cash: { cents: 0, orders: new Set() },
      gcash: { cents: 0, orders: new Set() },
    };
    for (const s of baseRows) {
      acc[s.pay].cents += s.cents;
      acc[s.pay].orders.add(s.orNo);
    }
    return acc;
  }, [baseRows]);

  // The portal shell already guarantees a signed-in member, but keep the guard
  // so the screen never touches a null name if it is ever reached otherwise.
  if (!member) return null;

  const meQuota = quotaOf(member.id);
  const meRoom = roomOf(member.id);
  const nextTo = creditRecipient(member.id);

  const orders = orderCount(rows);
  const lines = rows.length;
  const items = rows.reduce((sum, s) => sum + s.qty, 0);
  const sales = rows.reduce((sum, s) => sum + s.cents, 0);
  const average = orders ? Math.round(sales / orders) : 0;

  const baseSales = baseRows.reduce((n, s) => n + s.cents, 0);
  const baseOrders = orderCount(baseRows);

  // One chip per payment method (plus "All"). Each chip doubles as the filter.
  const payChips = [
    { id: 'all' as const, label: 'All payments', dot: '#8a5a33', cents: baseSales, orders: baseOrders },
    { id: 'cash' as const, label: PAY_LABEL.cash, dot: '#2f7d4f', cents: byPay.cash.cents, orders: byPay.cash.orders.size },
    { id: 'gcash' as const, label: PAY_LABEL.gcash, dot: '#1f5fa8', cents: byPay.gcash.cents, orders: byPay.gcash.orders.size },
  ];

  const values: Record<string, string> = {
    orders: String(orders),
    items: String(items),
    sales: peso(sales),
    avg: peso(average),
  };

  // The Staff column only exists for the people allowed to see everyone's work.
  const COLS = seesAll
    ? ['OR No.', 'Date', 'Staff', 'Customer', 'Variant', 'Engraving', 'Qty', 'Amount']
    : ['OR No.', 'Date', 'Customer', 'Variant', 'Engraving', 'Qty', 'Amount'];
  const LAST = COLS.length - 1;

  return (
    <main className="mx-auto max-w-[1560px] px-7 pb-9 pt-[26px] max-md:px-4">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3.5">
        <div>
          <h1 className="text-[clamp(26px,2.3vw,31px)]">
            {seesAll ? 'All sales.' : 'Your sales.'}
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-[11.5px] text-ink-500">
            {seesAll
              ? `Every order the team recorded, with the staff member who rang it up. Signed in as ${member.name}.`
              : `Every piece ${member.name.split(' ')[0]} sold — with the customer, the variant, and the engraving attached.`}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-pill border border-blush-300 bg-white px-[15px] py-2 text-[11px] font-medium transition-colors hover:border-wine-800 hover:text-wine-800">
            Export
          </button>
          <Link
            to="/pos"
            className="rounded-pill bg-crimson-600 px-[15px] py-2 text-[11px] font-medium text-white transition-colors hover:bg-wine-800"
          >
            New sale
          </Link>
        </div>
      </div>

      <section className="mt-[18px] overflow-hidden rounded-[7px] border border-blush-300 bg-white">
        <div className="grid grid-cols-2 max-lg:grid-cols-1">
          {/* ── Your quota ──────────────────────────────────────────── */}
          <div className="border-b border-blush-300/60 px-[18px] py-4 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[8px] uppercase tracking-[0.17em] text-ink-300">
                  {seesAll ? 'Your quota' : `${member.name.split(' ')[0]}'s quota`} · {PLAN.label}
                </p>
                <p className="num mt-[7px] text-[26px] font-medium leading-none text-ink-900">
                  {member.credited}
                  <span className="text-[13px] font-normal text-ink-300"> / {meQuota} pcs</span>
                </p>
              </div>
              <span
                className={[
                  'flex-none rounded-pill px-2.5 py-1 text-[8.5px] uppercase tracking-[0.12em]',
                  meRoom === 0 ? 'bg-ok-100 text-ok-600' : 'bg-blush-100 text-ink-500',
                ].join(' ')}
              >
                {meRoom === 0 ? 'Full' : `${pct(member.credited, meQuota)}%`}
              </span>
            </div>

            <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-blush-100">
              <i
                className={[
                  'block h-full rounded-full',
                  meRoom === 0 ? 'bg-ok-600' : 'bg-crimson-600',
                ].join(' ')}
                style={{ width: `${barWidth(member.credited, meQuota)}%` }}
              />
            </div>

            <p className="mt-2 text-[10px] leading-[1.55] text-ink-500">
              {member.name.split(' ')[0]} rang up {member.rungUp} pieces
              {passedOn(member.id) > 0
                ? ` — ${passedOn(member.id)} were credited to teammates who still had room.`
                : '.'}
            </p>

            {meRoom === 0 && (
              <div className="mt-2.5 flex gap-2 rounded-[5px] bg-warn-100 px-2.5 py-2 text-[9.5px] leading-[1.5] text-warn-600">
                <span className="mt-[3px] h-2.5 w-2.5 flex-none rounded-full border border-warn-600" />
                <span>
                  {nextTo
                    ? `Quota full. Your next sale is credited to ${memberOf(nextTo)?.name} — they have ${roomOf(nextTo)} left.`
                    : 'Quota full, and so is the team — no more pieces can be recorded this month.'}
                </span>
              </div>
            )}
          </div>

          {/* ── Team total ──────────────────────────────────────────── */}
          <div className="px-[18px] py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[8px] uppercase tracking-[0.17em] text-ink-300">Team total</p>
                <p className="num mt-[7px] text-[26px] font-medium leading-none text-ink-900">
                  {teamCredited}
                  <span className="text-[13px] font-normal text-ink-300"> / {PLAN.team} pcs</span>
                </p>
              </div>
              <span className="num flex-none rounded-pill bg-blush-100 px-2.5 py-1 text-[8.5px] uppercase tracking-[0.12em] text-ink-500">
                {pct(teamCredited, PLAN.team)}%
              </span>
            </div>

            <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-blush-100">
              <i
                className="block h-full rounded-full bg-wine-800"
                style={{ width: `${barWidth(teamCredited, PLAN.team)}%` }}
              />
            </div>

            <p className="mt-2 text-[10px] leading-[1.55] text-ink-500">
              Set by the GM: {PLAN.team} pcs · {activeMembers.length} members in{' '}
              {PLAN.departments.length} departments.{' '}
              {teamLeft > 0 ? `${teamLeft} still to go.` : 'Target met.'}
            </p>

            {!planBalanced() && (
              <p className="mt-2 text-[9.5px] leading-[1.5] text-bad-600">
                The personal quotas do not add up to {PLAN.team}. Fix them in the GM settings.
              </p>
            )}
          </div>
        </div>

        {/* ── Departments ───────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-4 border-t border-blush-300/60 bg-blush-50 px-[18px] py-3.5 max-lg:grid-cols-1">
          {PLAN.departments.map((d) => {
            const members = activeMembers.filter((m) => m.department === d.id);
            const credited = departmentCredited(d.id);
            return (
              <div key={d.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[8px] uppercase tracking-[0.15em] text-ink-300">
                    {d.name}
                  </span>
                  <span className="num text-[10px] text-ink-500">
                    {credited} / {d.quota}
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-blush-300">
                  <i
                    className="block h-full rounded-full bg-wine-800"
                    style={{ width: `${barWidth(credited, d.quota)}%` }}
                  />
                </div>
                <div className="mt-2 space-y-[3px]">
                  {members.map((m) => {
                    const full = roomOf(m.id) === 0;
                    return (
                      <div key={m.id} className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[9.5px] text-ink-900">
                          {m.name}
                          {full && (
                            <span className="ml-1.5 text-[7.5px] uppercase tracking-[0.1em] text-ok-600">
                              Full
                            </span>
                          )}
                        </span>
                        <span className="num flex-none text-[9.5px] text-ink-500">
                          {m.credited}
                          <span className="text-ink-300">/{quotaOf(m.id)}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-[18px] flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={[
              'rounded-pill border px-[15px] py-[7px] text-[10.5px] transition-colors',
              range === r.id
                ? 'border-crimson-600 bg-crimson-600 text-white'
                : 'border-blush-300 bg-white text-ink-500 hover:border-blush-400 hover:text-ink-900',
            ].join(' ')}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-[22px] grid grid-cols-4 gap-3 max-lg:grid-cols-2">
        {KPI.map((k) => (
          <div key={k.key} className="relative rounded-[7px] border border-blush-300 bg-white px-4 pb-3.5 pt-[15px]">
            <p className="text-[8px] uppercase tracking-[0.17em] text-ink-300">{k.label}</p>
            <p className="num mt-[7px] text-[22px] font-medium leading-none text-ink-900">
              {values[k.key]}
            </p>
            <p className="mt-1.5 text-[9px] text-ink-300">
              {k.key === 'orders' && `Recorded ${RANGES.find((r) => r.id === range)?.label.toLowerCase()}`}
              {k.key === 'items' && 'Pieces out the door'}
              {k.key === 'sales' && (seesAll ? 'Recorded across the team' : 'Recorded under your name')}
              {k.key === 'avg' && 'Per completed sale'}
            </p>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              className="absolute right-3.5 top-3.5 h-3 w-3 text-ink-300"
            >
              <path d={k.icon} strokeLinejoin="round" />
            </svg>
          </div>
        ))}
      </div>

      <section className="mt-[18px] overflow-hidden rounded-[7px] border border-blush-300 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-blush-300/60 px-4 py-3">
          <h2 className="text-[15px]">Payments</h2>
          <span className="text-[9px] uppercase tracking-[0.12em] text-ink-300">Tap to filter</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5 px-4 py-3 max-md:grid-cols-1">
          {payChips.map((c) => {
            const active = pay === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setPay(c.id)}
                aria-pressed={active}
                className={[
                  'rounded-[6px] border px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border-crimson-600 bg-blush-50'
                    : 'border-blush-300 bg-white hover:border-wine-800',
                ].join(' ')}
              >
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
                  <span className="text-[8px] uppercase tracking-[0.14em] text-ink-300">
                    {c.label}
                  </span>
                </span>
                <span className="num mt-1 block text-[16px] font-medium leading-none text-ink-900">
                  {peso(c.cents)}
                </span>
                <span className="mt-1 block text-[8.5px] text-ink-300">
                  {c.orders} {c.orders === 1 ? 'order' : 'orders'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-[18px] overflow-hidden rounded-[7px] border border-blush-300 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-blush-300/60 px-4 py-3.5">
          <h2 className="text-[15px]">
            Sales records
            {pay !== 'all' && (
              <span className="ml-2 text-[10px] font-normal text-crimson-600">
                · {PAY_LABEL[pay]}
              </span>
            )}
          </h2>
          <label className="flex items-center gap-1.5 rounded-pill border border-blush-300 px-2.5 py-[5px]">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className="h-2.5 w-2.5 text-ink-300">
              <circle cx="7" cy="7" r="4.4" />
              <path d="m10.4 10.4 3 3" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer or variant"
              className="w-24 text-[10px] outline-none placeholder:text-ink-300"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blush-50">
                {COLS.map((h, i) => (
                  <th
                    key={h}
                    className={[
                      'border-b border-blush-300/60 px-4 py-[9px] text-left text-[7.5px] font-medium uppercase tracking-[0.16em] text-ink-300',
                      i === LAST ? 'text-right' : '',
                    ].join(' ')}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-[26px] text-[11px] text-ink-300">
                    {pay !== 'all'
                      ? `No ${PAY_LABEL[pay]} sales in this range.`
                      : seesAll
                        ? 'No sales in this range yet.'
                        : 'You have not rung up a sale in this range yet.'}
                  </td>
                </tr>
              )}
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-blush-300/60 last:border-0">
                  <td className="num px-4 py-[9px] text-[10.5px] tracking-[0.04em]">{s.orNo}</td>
                  <td className="px-4 py-[9px] text-[10.5px] text-ink-500">{dateOf(s.ago)}</td>
                  {seesAll && (
                    <td className="px-4 py-[9px] text-[10.5px] text-ink-500">
                      {memberOf(s.staffId)?.name ?? s.staffId}
                    </td>
                  )}
                  <td className="px-4 py-[9px] text-[10.5px]">{s.customer}</td>
                  <td className="px-4 py-[9px] text-[10.5px] text-ink-500">{s.variant}</td>
                  <td className="px-4 py-[9px] text-[10.5px] tracking-[0.08em] text-ink-500">{s.engraving}</td>
                  <td className="num px-4 py-[9px] text-[10.5px] text-ink-500">{s.qty}</td>
                  <td className="num px-4 py-[9px] text-right text-[10.5px]">{peso(s.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-blush-300/60 bg-blush-50 px-4 py-2.5 text-[9px] text-ink-300">
          Showing {lines} of {total} {seesAll ? 'team' : 'own'} lines · {peso(sales)} total
        </div>
      </section>

    </main>
  );
}
