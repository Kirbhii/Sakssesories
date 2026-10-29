import { useMemo, useState } from 'react';
import { peso, peso2 } from '@/lib/data';
import { COST_TOTAL } from '@/lib/materials';
import {
  allSales,
  inRange,
  payLabel,
  sortPay,
  useLedger,
  type Range,
} from '@/lib/sales';

// ─── Finance dashboard ───────────────────────────────────────────────────────
// The money side of the shop, for Finance and the GM only (the route gates it).
//
// The figures Finance asked for, in one place:
//   units sold · total sales · net sales · gross profit margin · remittance ·
//   net profit · net profit margin · ROI · total cash
//
// "Net sales" = total sales less voids (the base every margin is divided by).
// Gross profit margin = gross profit ÷ net sales. Net profit margin = net profit
// ÷ net sales. ROI = net profit ÷ initial investment. The last three of those
// (gross margin, net profit, ROI) need numbers the app does not have yet — a
// unit cost, a remit rule, operating expenses and the initial investment. Those
// live in the "Assumptions" panel below and are saved in the browser, so the
// figures update the moment Finance types a real number in. Every card that
// depends on an assumption wears a small "assumption" tag, so it is obvious
// which numbers are real and which are waiting on the client.

const ASSETS_KEY = 'skph.finance.assumptions';

interface Expense {
  id: string;
  label: string;
  cents: number;
}

interface Assumptions {
  /** Cost to make one piece, in centavos. Mock default until Finance confirms. */
  unitCostCents: number;
  /** Share of collections the sellers turn in to the company, in percent. */
  remitRate: number;
  /** Operating expenses subtracted to reach net profit (rent, wages, …). */
  expenses: Expense[];
  /** Money put in at the start — the denominator for ROI. */
  initialInvestmentCents: number;
}

const DEFAULTS: Assumptions = {
  unitCostCents: COST_TOTAL, // ₱49.50 per piece
  remitRate: 100, // sellers hand everything over by default
  expenses: [],
  initialInvestmentCents: 0, // enter the real amount to get a ROI
};

function loadAssumptions(): Assumptions {
  try {
    const raw = window.localStorage.getItem(ASSETS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Assumptions>) };
  } catch {
    /* first run, or the shelf is full */
  }
  return DEFAULTS;
}

export default function Finance() {
  const ledger = useLedger();
  const [range, setRange] = useState<Range>('all');
  const [counted, setCounted] = useState('');
  const [showAssumptions, setShowAssumptions] = useState(true);

  const [assumptions, setAssumptions] = useState<Assumptions>(loadAssumptions);

  function patch(p: Partial<Assumptions>): void {
    setAssumptions((prev) => {
      const next = { ...prev, ...p };
      try {
        window.localStorage.setItem(ASSETS_KEY, JSON.stringify(next));
      } catch {
        /* ignore — the numbers still work in memory */
      }
      return next;
    });
  }

  function setUnitCost(pesos: string): void {
    patch({ unitCostCents: Math.round(Number(pesos || 0) * 100) });
  }
  function setRemitRate(pct: string): void {
    const n = Number(pct || 0);
    patch({ remitRate: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0 });
  }
  function addExpense(): void {
    patch({
      expenses: [
        ...assumptions.expenses,
        { id: `e${Date.now()}`, label: '', cents: 0 },
      ],
    });
  }
  function editExpense(id: string, p: Partial<Expense>): void {
    patch({
      expenses: assumptions.expenses.map((e) => (e.id === id ? { ...e, ...p } : e)),
    });
  }
  function removeExpense(id: string): void {
    patch({ expenses: assumptions.expenses.filter((e) => e.id !== id) });
  }
  function setInitialInvestment(pesos: string): void {
    patch({ initialInvestmentCents: Math.round(Number(pesos || 0) * 100) });
  }

  // ── The numbers, scoped to the chosen period ──────────────────────────────
  const rows = useMemo(
    () => allSales().filter((s) => inRange(s.ago, range)),
    [ledger, range],
  );

  // A void sale never happened, so it leaves both the count and the money.
  const live = useMemo(() => rows.filter((s) => s.status !== 'void'), [rows]);

  // "Units sold" and "Remittance" follow the finance team's definition: they
  // count only money that has actually been turned in — the `remitted` flag
  // Finance sets from the Summary tab. Net sales, the margins, profit and the
  // cash in the drawer still measure everything the shop earned, voids excluded.
  const remittedRows = useMemo(() => live.filter((s) => s.remitted), [live]);

  const gross = rows.reduce((n, s) => n + s.cents, 0); // total sales (gross)
  const revenue = live.reduce((n, s) => n + s.cents, 0); // net of voids
  const earnedPieces = live.reduce((n, s) => n + s.qty, 0); // all pieces earned
  const pieces = remittedRows.reduce((n, s) => n + s.qty, 0); // units sold = remitted
  // COGS is the cost of every piece the shop actually earned, not just the ones
  // already remitted — the margin is over the whole period's trade.
  const cogs = earnedPieces * assumptions.unitCostCents;
  const grossMargin = revenue - cogs;
  const marginPct = revenue ? Math.round((grossMargin / revenue) * 100) : 0;
  const expenseTotal = assumptions.expenses.reduce((n, e) => n + e.cents, 0);
  const netProfit = grossMargin - expenseTotal;
  const netProfitMarginPct = revenue ? Math.round((netProfit / revenue) * 100) : 0;
  // ROI = net profit ÷ initial investment. Undefined (0) until Finance enters it.
  const roiPct = assumptions.initialInvestmentCents
    ? Math.round((netProfit / assumptions.initialInvestmentCents) * 100)
    : 0;
  const cashCents = live
    .filter((s) => s.pay === 'cash')
    .reduce((n, s) => n + s.cents, 0); // total cash in the drawer
  // Remittance = the share of remitted collections the sellers turn in.
  const remittedNet = remittedRows.reduce((n, s) => n + s.cents, 0);
  const remittance = Math.round((remittedNet * assumptions.remitRate) / 100);

  // Methods used in the period, cash first.
  const byPay = useMemo(() => {
    const ids = [...new Set(live.map((r) => r.pay))].sort(sortPay);
    return ids.map((pay) => {
      const list = live.filter((r) => r.pay === pay);
      return {
        pay,
        label: payLabel(pay),
        cents: list.reduce((sum, r) => sum + r.cents, 0),
        count: list.length,
      };
    });
  }, [live]);

  const countedCents = Math.round(Number(counted || 0) * 100);
  const difference = counted === '' ? null : countedCents - cashCents;

  const periodLabel =
    range === 'today'
      ? 'today'
      : range === 'week'
        ? 'this week'
        : range === 'month'
          ? 'this month'
          : 'all time';

  const kpi = [
    {
      label: 'Units sold',
      value: `${pieces} pcs`,
      note: 'Remitted pieces only — voids excluded. Toggle in Summary.',
    },
    {
      label: 'Total sales',
      value: peso(gross),
      note: 'Gross of every sale recorded',
    },
    {
      label: 'Net sales',
      value: peso(revenue),
      note: 'Total sales less voids — the base for every margin',
    },
    {
      label: 'Gross margin',
      value: peso(grossMargin),
      note: `Gross profit margin ${marginPct}% · ${peso2(assumptions.unitCostCents)}/pc × ${earnedPieces} pcs`,
      assumption: true,
    },
    {
      label: 'Remittance',
      value: peso(remittance),
      note: `${assumptions.remitRate}% of remitted sales turned in`,
      assumption: true,
    },
    {
      label: 'Net profit',
      value: peso(netProfit),
      note: `Net profit margin ${netProfitMarginPct}% · after ${peso(expenseTotal)} expenses`,
      assumption: true,
    },
    {
      label: 'ROI',
      value: roiPct ? `${roiPct}%` : '—',
      note: 'Net profit ÷ initial investment',
      assumption: true,
    },
    {
      label: 'Total cash',
      value: peso(cashCents),
      note: 'Cash sales only',
    },
  ];

  return (
    <main className="mx-auto max-w-[1560px] px-7 pb-9 pt-[26px] max-md:px-4">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3.5">
        <div>
          <h1 className="text-[clamp(26px,2.3vw,31px)]">The money, not the quota.</h1>
          <p className="mt-1.5 max-w-[62ch] text-[11.5px] text-ink-500">
            Units, sales, revenue, margin, remittance, profit and the cash in the
            drawer — for {periodLabel}.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-pill border border-blush-300 bg-white px-[15px] py-2 text-[11px] font-medium transition-colors hover:border-wine-800 hover:text-wine-800"
        >
          Export
        </button>
      </div>

      {/* Period switch — same control the Summary tab uses. */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <div className="inline-flex rounded-pill border border-blush-300 bg-white p-[3px]">
          {(
            [
              { id: 'all', label: 'All time' },
              { id: 'month', label: 'This month' },
              { id: 'week', label: 'This week' },
              { id: 'today', label: 'Today' },
            ] as { id: Range; label: string }[]
          ).map((o) => (
            <button
              key={o.id}
              onClick={() => setRange(o.id)}
              className={[
                'rounded-pill px-3 py-[5px] text-[10.5px] transition-colors',
                range === o.id
                  ? 'bg-crimson-600 text-white'
                  : 'text-ink-500 hover:text-ink-900',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reminder that some figures are placeholders until the client answers. */}
      <div className="mt-3 flex items-center gap-2 rounded-[7px] border border-blush-300 bg-blush-50 px-3.5 py-2 text-[10px] text-ink-500">
        <i className="h-[5px] w-[5px] flex-none rounded-full bg-crimson-600" />
        Four figures wear an “assumption” tag — they use the numbers set in the
        panel below. Confirm those with the client, then type them in.
      </div>

      {/* ── The seven KPIs ─────────────────────────────────────────────────── */}
      <div className="mt-[18px] grid grid-cols-4 gap-3 max-lg:grid-cols-2">
        {kpi.map((k) => (
          <div
            key={k.label}
            className="rounded-[7px] border border-blush-300 bg-white px-4 pb-3.5 pt-[15px]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[8px] uppercase tracking-[0.17em] text-ink-300">
                {k.label}
              </p>
              {k.assumption && (
                <span className="rounded-pill bg-blush-100 px-1.5 py-[1px] text-[6.5px] uppercase tracking-[0.1em] text-ink-500">
                  assumption
                </span>
              )}
            </div>
            <p className="num mt-[7px] text-[22px] font-medium leading-none text-ink-900">
              {k.value}
            </p>
            <p className="mt-1.5 text-[9px] text-ink-300">{k.note}</p>
          </div>
        ))}
      </div>

      {/* ── Assumptions ────────────────────────────────────────────────────── */}
      <section className="mt-[18px] overflow-hidden rounded-[7px] border border-blush-300 bg-white">
        <button
          onClick={() => setShowAssumptions((v) => !v)}
          className="flex w-full items-center justify-between gap-3 border-b border-blush-300/60 px-4 py-3.5 text-left"
        >
          <h2 className="text-[15px]">Assumptions — set these with the client</h2>
          <span className="text-[10px] text-ink-400">{showAssumptions ? 'Hide' : 'Show'}</span>
        </button>

        {showAssumptions && (
          <div className="grid gap-5 px-4 pb-5 pt-4 md:grid-cols-2">
            {/* Unit cost → gross margin */}
            <div>
              <label className="block">
                <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                  Cost to make 1 piece (₱)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={(assumptions.unitCostCents / 100).toFixed(2)}
                  onChange={(e) => setUnitCost(e.target.value)}
                  className="w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[11px] outline-none focus:border-crimson-600"
                />
              </label>
              <p className="mt-2 text-[9px] leading-[1.6] text-ink-300">
                Drives <b>gross margin</b>. Mock says ₱49.50 (leather, pad, glue,
                thread, pack, labour). Ask if it differs by variant.
              </p>
            </div>

            {/* Remit rate → remittance */}
            <div>
              <label className="block">
                <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                  Remittance rate (%)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1"
                  value={assumptions.remitRate}
                  onChange={(e) => setRemitRate(e.target.value)}
                  className="w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[11px] outline-none focus:border-crimson-600"
                />
              </label>
              <p className="mt-2 text-[9px] leading-[1.6] text-ink-300">
                Drives <b>remittance</b>. 100% = sellers hand everything over. If
                they keep a commission, put the share turned in here.
              </p>
            </div>

            {/* Initial investment → ROI */}
            <div>
              <label className="block">
                <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                  Initial investment (₱)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={(assumptions.initialInvestmentCents / 100).toFixed(2)}
                  onChange={(e) => setInitialInvestment(e.target.value)}
                  className="w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[11px] outline-none focus:border-crimson-600"
                />
              </label>
              <p className="mt-2 text-[9px] leading-[1.6] text-ink-300">
                Drives <b>ROI</b>. The money put in at the start — net profit is
                divided by this. Leave 0 (or blank) and ROI shows “—”.
              </p>
            </div>

            {/* Expenses → net profit */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[8px] uppercase tracking-[0.15em] text-ink-300">
                  Operating expenses
                </span>
                <button
                  onClick={addExpense}
                  className="rounded-pill border border-blush-300 px-2 py-[2px] text-[9px] text-ink-500 hover:border-wine-800 hover:text-wine-800"
                >
                  + Add
                </button>
              </div>
              {assumptions.expenses.length === 0 && (
                <p className="text-[9px] leading-[1.6] text-ink-300">
                  None yet — <b>net profit</b> equals gross margin until you add
                  rent, wages, fees, …
                </p>
              )}
              <div className="space-y-2">
                {assumptions.expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={e.label}
                      placeholder="e.g. Stall rent"
                      onChange={(ev) => editExpense(e.id, { label: ev.target.value })}
                      className="min-w-0 flex-1 rounded-[5px] border border-blush-300 px-2 py-[6px] text-[10.5px] outline-none focus:border-crimson-600"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={(e.cents / 100).toFixed(2)}
                      onChange={(ev) =>
                        editExpense(e.id, {
                          cents: Math.round(Number(ev.target.value || 0) * 100),
                        })
                      }
                      className="w-[92px] rounded-[5px] border border-blush-300 px-2 py-[6px] text-[10.5px] outline-none focus:border-crimson-600"
                    />
                    <button
                      onClick={() => removeExpense(e.id)}
                      className="flex-none rounded-[5px] px-1.5 py-[6px] text-[11px] text-bad-600 hover:bg-bad-100"
                      aria-label="Remove expense"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Payment mix + cash check ───────────────────────────────────────── */}
      <div className="mt-[18px] grid grid-cols-2 gap-3 max-lg:grid-cols-1">
        <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
          <div className="border-b border-blush-300/60 px-4 py-3.5">
            <h2 className="text-[15px]">How they paid</h2>
          </div>
          <div className="px-4 pb-4 pt-1">
            {byPay.length === 0 && (
              <p className="py-8 text-center text-[10.5px] leading-[1.7] text-ink-300">
                Nothing came in {periodLabel} yet.
                <br />
                A method shows up here the first time it is paid.
              </p>
            )}
            {byPay.map((p) => (
              <div
                key={p.pay}
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-blush-300/60 py-3 last:border-0"
              >
                <div>
                  <p className="text-[10.5px]">{p.label}</p>
                  <div className="mt-1.5 h-1 max-w-[280px] overflow-hidden rounded-full bg-blush-200">
                    <i
                      className="block h-full rounded-full bg-crimson-600"
                      style={{
                        width: `${revenue ? Math.round((p.cents / revenue) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="num text-right text-[11px]">
                  {peso(p.cents)}
                  <small className="mt-0.5 block text-[8.5px] text-ink-300">
                    {p.count} {p.count === 1 ? 'order' : 'orders'}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
          <div className="flex items-baseline justify-between gap-3 border-b border-blush-300/60 px-4 py-3.5">
            <h2 className="text-[15px]">Cash check</h2>
            <span className="text-[9px] uppercase tracking-[0.12em] text-ink-300">
              {periodLabel}
            </span>
          </div>
          <div className="px-4 py-3.5">
            <div className="flex items-baseline justify-between py-1.5 text-[11px]">
              <span className="text-ink-500">Expected in the drawer</span>
              <span className="num text-ink-900">{peso(cashCents)}</span>
            </div>

            <label className="mt-2 block">
              <span className="mb-1 block text-[8px] uppercase tracking-[0.15em] text-ink-300">
                Counted cash
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0"
                className="w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[11px] outline-none focus:border-crimson-600"
              />
            </label>

            {difference !== null && (
              <div
                className={[
                  'mt-2.5 flex items-center justify-between rounded-[5px] px-3 py-2 text-[10.5px]',
                  difference === 0 ? 'bg-ok-100 text-ok-600' : 'bg-bad-100 text-bad-600',
                ].join(' ')}
              >
                <span>
                  {difference === 0 ? 'Balanced' : difference > 0 ? 'Over' : 'Short'}
                </span>
                <b className="num text-[13px] font-medium">{peso(Math.abs(difference))}</b>
              </div>
            )}

            <p className="mt-3 text-[9px] leading-[1.6] text-ink-300">
              Cash sales only. E-money is settled by the provider, so it never
              touches the drawer.
            </p>
          </div>
        </section>
      </div>

      <p className="mt-4 text-[9px] leading-[1.6] text-ink-300">
        Live from the database. Cost, remittance rate and expenses are saved in
        this browser — set them once on the finance machine.
      </p>
    </main>
  );
}
