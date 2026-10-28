import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { peso } from '@/lib/data';
import { MEMBERS } from '@/lib/quota';
import {
  PAY_LABEL,
  SALES,
  blockSpan,
  colourOf,
  dateOf,
  dayLabel,
  engravingCents,
  engravingTotal,
  firstOfOrder,
  monthOf,
  orderCount,
  salesOf,
  shapeOf,
  weekKey,
  weekLabel,
  type PayMethod,
  type Sale,
} from '@/lib/sales';

// ─── Sales summary ──────────────────────────────────────────────────────────
// The tabular view of the ledger, grouped the way the shop keeps its sheet:
// one group per day (or per month), each row a sale. Two scopes sit on top:
// "Per member" (one person's rows) and "Overall" (everyone's) — and the overall
// view is open to every staff member, not just Finance and the GM.
//
// This screen is deliberately just the summary: no quota bars, no best sellers.
// The numbers it shows are the ones a shopkeeper needs to reconcile a day.

type Scope = 'member' | 'overall';
type GroupBy = 'day' | 'week' | 'month';
type PayFilter = 'all' | PayMethod;

interface Group {
  key: string;
  label: string;
  rows: Sale[];
  qty: number;
  cents: number;
}

const COLS: { label: string; align?: 'right' }[] = [
  { label: 'Time' },
  { label: 'Date' },
  { label: 'Customer' },
  { label: 'OR No.' },
  { label: 'Shape' },
  { label: 'Color' },
  { label: 'Engraving' },
  { label: 'Occupation' },
  { label: 'Sex' },
  { label: 'Location' },
  { label: 'Qty', align: 'right' },
  { label: 'Amount', align: 'right' },
];

/** "1 pc" / "3 pcs" — the sheet is read by people, so say it properly. */
const pcs = (n: number): string => `${n} ${n === 1 ? 'pc' : 'pcs'}`;

/** A small two-option pill, used for both scope and grouping. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-pill border border-blush-300 bg-white p-[3px]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={[
            'rounded-pill px-3 py-[5px] text-[10.5px] transition-colors',
            value === o.id ? 'bg-crimson-600 text-white' : 'text-ink-500 hover:text-ink-900',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Summary() {
  const { member } = useAuth();

  const [scope, setScope] = useState<Scope>('member');
  const [memberId, setMemberId] = useState(member?.id ?? MEMBERS[0].id);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [pay, setPay] = useState<PayFilter>('all');

  // The scoped lines. A multi-variant order appears as several rows sharing one
  // orNo, so "orders" is always counted from distinct OR numbers — not rows.
  const rows = useMemo(() => {
    const scoped = scope === 'member' ? salesOf(memberId) : SALES;
    return pay === 'all' ? scoped : scoped.filter((s) => s.pay === pay);
  }, [scope, memberId, pay]);

  // Group the scoped rows. The ledger is already ordered newest-first, and a
  // Map keeps insertion order, so the newest day/week/month lands at the top.
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const s of rows) {
      const key =
        groupBy === 'day'
          ? `d-${s.ago}`
          : groupBy === 'week'
            ? `w-${weekKey(s.ago)}`
            : `m-${monthOf(s.ago)}`;
      const label =
        groupBy === 'day' ? dayLabel(s.ago) : groupBy === 'week' ? weekLabel(s.ago) : monthOf(s.ago);
      let g = map.get(key);
      if (!g) {
        g = { key, label, rows: [], qty: 0, cents: 0 };
        map.set(key, g);
      }
      g.rows.push(s);
      g.qty += s.qty;
      g.cents += s.cents;
    }
    return [...map.values()];
  }, [rows, groupBy]);

  const orders = useMemo(() => orderCount(rows), [rows]);
  const pieces = rows.reduce((n, s) => n + s.qty, 0);
  const total = rows.reduce((n, s) => n + s.cents, 0);
  // The slice of that total that came from the extra letters, not the pieces.
  const engraved = engravingTotal(rows);

  const selected = MEMBERS.find((m) => m.id === memberId);
  const unit = groupBy === 'day' ? 'day' : groupBy === 'week' ? 'week' : 'month';

  return (
    <main className="mx-auto max-w-[1560px] px-7 pb-9 pt-[26px] max-md:px-4">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3.5">
        <div>
          <h1 className="text-[clamp(26px,2.3vw,31px)]">Sales summary.</h1>
          <p className="mt-1.5 max-w-[64ch] text-[11.5px] text-ink-500">
            {scope === 'member'
              ? `${selected?.name ?? 'This member'}'s orders, grouped by ${unit}.`
              : `Every order the team recorded, grouped by ${unit} — visible to the whole team.`}
          </p>
        </div>
        <button className="rounded-pill border border-blush-300 bg-white px-[15px] py-2 text-[11px] font-medium transition-colors hover:border-wine-800 hover:text-wine-800">
          Export
        </button>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { id: 'member', label: 'Per member' },
            { id: 'overall', label: 'Overall' },
          ]}
        />

        {scope === 'member' && (
          <label className="flex items-center gap-2 rounded-pill border border-blush-300 bg-white px-3 py-[6px]">
            <span className="text-[7.5px] uppercase tracking-[0.14em] text-ink-300">Member</span>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="max-w-[230px] bg-transparent text-[10.5px] text-ink-900 outline-none"
            >
              {/* The record count rides along, so nobody has to guess whether a
                  member with a blank table has no sales or was not fetched. */}
              {MEMBERS.map((m) => {
                const n = salesOf(m.id).length;
                return (
                  <option key={m.id} value={m.id}>
                    {m.name} · {n === 0 ? 'no sales' : `${n} ${n === 1 ? 'sale' : 'sales'}`}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        <Segmented
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { id: 'day', label: 'By day' },
            { id: 'week', label: 'By week' },
            { id: 'month', label: 'By month' },
          ]}
        />

        <Segmented
          value={pay}
          onChange={setPay}
          options={[
            { id: 'all', label: 'All payments' },
            { id: 'cash', label: 'Cash' },
            { id: 'gcash', label: 'GCash' },
          ]}
        />
      </div>

      {/* ── Totals ───────────────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-3 gap-3 max-md:grid-cols-1">
        {[
          { label: 'Orders', value: String(orders) },
          { label: 'Pieces', value: String(pieces) },
          { label: 'Total sales', value: peso(total) },
        ].map((k) => (
          <div key={k.label} className="rounded-[7px] border border-blush-300 bg-white px-4 py-3">
            <p className="text-[8px] uppercase tracking-[0.17em] text-ink-300">{k.label}</p>
            <p className="num mt-1 text-[20px] font-medium leading-none text-ink-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Grouped rows ─────────────────────────────────────────────────── */}
      {groups.length === 0 && (
        <div className="mt-4 rounded-[7px] border border-blush-300 bg-white px-4 py-6 text-[11px] text-ink-300">
          {pay === 'all'
            ? 'No sales in this view yet.'
            : `No ${PAY_LABEL[pay]} sales in this view yet.`}
        </div>
      )}

      {groups.map((g) => {
        const oc = orderCount(g.rows);
        const lines = g.rows.length;
        return (
          <section
            key={g.key}
            className="mt-4 overflow-hidden rounded-[7px] border border-blush-300 bg-white"
          >
            <div className="flex items-center justify-between gap-3 border-b border-blush-300/60 px-4 py-3">
              <h2 className="text-[14px]">{g.label}</h2>
              <span className="num text-[10px] text-ink-500">
                {oc} {oc === 1 ? 'order' : 'orders'}
                {lines > oc ? ` · ${lines} lines` : ''} · {pcs(g.qty)} · {peso(g.cents)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] border-collapse [&_td]:align-top">
                <thead>
                  <tr className="bg-blush-50">
                    {COLS.map((c) => (
                      <th
                        key={c.label}
                        className={[
                          'border-b border-blush-300/60 px-3 py-[8px] text-[7.5px] font-medium uppercase tracking-[0.16em] text-ink-300',
                          c.align === 'right' ? 'text-right' : 'text-left',
                        ].join(' ')}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((s, i) => {
                    // Same OR as the line above → the same order. Render its
                    // per-order cells once, merged across the block, exactly
                    // like the merged TIME / NAME / OR cells in the sheet.
                    const first = firstOfOrder(g.rows, i);
                    const span = first ? blockSpan(g.rows, i) : 0;
                    return (
                      <tr key={s.id}>
                        {first && (
                          <>
                            <td
                              rowSpan={span}
                              className="num whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px] tracking-[0.02em]"
                            >
                              {s.time}
                            </td>
                            <td
                              rowSpan={span}
                              className="whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px] text-ink-500"
                            >
                              {dateOf(s.ago)}
                            </td>
                            <td
                              rowSpan={span}
                              className="whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px]"
                            >
                              {s.customer}
                            </td>
                            <td
                              rowSpan={span}
                              className="num whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px] tracking-[0.04em] text-ink-500"
                            >
                              {s.orNo}
                            </td>
                          </>
                        )}

                        <td className="whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px] text-ink-500">
                          {shapeOf(s)}
                        </td>
                        <td className="whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px] text-ink-500">
                          {colourOf(s)}
                        </td>
                        <td className="whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px] tracking-[0.08em] text-ink-500">
                          {s.engraving}
                          {engravingCents(s) > 0 && (
                            <span className="num ml-1.5 text-[9.5px] font-medium tracking-normal text-ok-600">
                              +{peso(engravingCents(s))}
                            </span>
                          )}
                        </td>

                        {first && (
                          <>
                            <td
                              rowSpan={span}
                              className="whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px] text-ink-500"
                            >
                              {s.occupation}
                            </td>
                            <td
                              rowSpan={span}
                              className="whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px] text-ink-500"
                            >
                              {s.sex}
                            </td>
                            <td
                              rowSpan={span}
                              className="whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-[10.5px] text-ink-500"
                            >
                              {s.location}
                            </td>
                          </>
                        )}

                        <td className="num border-b border-blush-300/50 px-3 py-[8px] text-right text-[10.5px] text-ink-500">
                          {s.qty}
                        </td>
                        <td className="num whitespace-nowrap border-b border-blush-300/50 px-3 py-[8px] text-right text-[10.5px]">
                          {peso(s.cents)}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="bg-blush-50">
                    <td
                      colSpan={10}
                      className="px-3 py-2 text-right text-[8px] uppercase tracking-[0.14em] text-ink-300"
                    >
                      Subtotal · {oc} {oc === 1 ? 'order' : 'orders'}
                      {lines > oc ? ` · ${lines} lines` : ''}
                    </td>
                    <td className="num px-3 py-2 text-right text-[10.5px] font-medium text-ink-900">
                      {g.qty}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2 text-right text-[10.5px] font-medium text-ink-900">
                      {peso(g.cents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {groups.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[7px] border border-blush-300 bg-white px-4 py-3">
          <span className="text-[8px] uppercase tracking-[0.14em] text-ink-300">Grand total</span>
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="num text-[12px] font-medium text-ink-900">
              {orders} {orders === 1 ? 'order' : 'orders'} · {pcs(pieces)} · {peso(total)}
            </span>
            {engraved > 0 && (
              <span className="num text-[10px] text-ok-600">{peso(engraved)} from engraving</span>
            )}
          </span>
        </div>
      )}
    </main>
  );
}
