import { useMemo, useState } from 'react';
import { peso, peso2 } from '@/lib/data';
import { COST_TOTAL } from '@/lib/materials';
import { allSales, inRange, payLabel, sortPay, useLedger } from '@/lib/sales';

export default function Finance() {
  const [counted, setCounted] = useState('');
  const ledger = useLedger();

  const rows = useMemo(() => allSales().filter((s) => inRange(s.ago, 'month')), [ledger]);

  const revenue = rows.reduce((sum, r) => sum + r.cents, 0);
  const pieces = rows.reduce((sum, r) => sum + r.qty, 0);
  const cogs = pieces * COST_TOTAL;
  const margin = revenue - cogs;
  const marginPct = revenue ? Math.round((margin / revenue) * 100) : 0;

  // Whatever methods the month actually used, cash first. A member can publish
  // an account for a method the app has never heard of, and the money still has
  // to be accounted for.
  const byPay = useMemo(() => {
    const ids = [...new Set(rows.map((r) => r.pay))].sort(sortPay);
    return ids.map((pay) => {
      const list = rows.filter((r) => r.pay === pay);
      return {
        pay,
        label: payLabel(pay),
        cents: list.reduce((sum, r) => sum + r.cents, 0),
        count: list.length,
      };
    });
  }, [rows]);

  const expectedCash = byPay.find((p) => p.pay === 'cash')?.cents ?? 0;
  const countedCents = Math.round(Number(counted || 0) * 100);
  const difference = counted === '' ? null : countedCents - expectedCash;

  const kpi = [
    { label: 'Revenue', value: peso(revenue), note: 'This month, all channels' },
    { label: 'Cost of goods', value: peso(cogs), note: `${pieces} pieces at ${peso2(COST_TOTAL)}` },
    { label: 'Gross margin', value: peso(margin), note: 'Revenue less materials' },
    { label: 'Margin', value: `${marginPct}%`, note: 'Of every peso collected' },
  ];

  return (
    <main className="mx-auto max-w-[1560px] px-7 pb-9 pt-[26px] max-md:px-4">
        <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3.5">
          <div>
            <h1 className="text-[clamp(26px,2.3vw,31px)]">The money, not the quota.</h1>
            <p className="mt-1.5 max-w-[62ch] text-[11.5px] text-ink-500">
              What came in, what it cost to make, and the cash that should be in the drawer.
            </p>
          </div>
          <button className="rounded-pill border border-blush-300 bg-white px-[15px] py-2 text-[11px] font-medium transition-colors hover:border-wine-800 hover:text-wine-800">
            Export
          </button>
        </div>

        <div className="mt-[22px] grid grid-cols-4 gap-3 max-lg:grid-cols-2">
          {kpi.map((k) => (
            <div key={k.label} className="rounded-[7px] border border-blush-300 bg-white px-4 pb-3.5 pt-[15px]">
              <p className="text-[8px] uppercase tracking-[0.17em] text-ink-300">{k.label}</p>
              <p className="num mt-[7px] text-[22px] font-medium leading-none text-ink-900">
                {k.value}
              </p>
              <p className="mt-1.5 text-[9px] text-ink-300">{k.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-[18px] grid grid-cols-2 gap-3 max-lg:grid-cols-1">
          {/* Payment methods */}
          <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
            <div className="border-b border-blush-300/60 px-4 py-3.5">
              <h2 className="text-[15px]">How they paid</h2>
            </div>
            <div className="px-4 pb-4 pt-1">
              {byPay.length === 0 && (
                <p className="py-8 text-center text-[10.5px] leading-[1.7] text-ink-300">
                  Nothing came in this month yet.
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
                        style={{ width: `${revenue ? Math.round((p.cents / revenue) * 100) : 0}%` }}
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

          {/* Cash reconciliation */}
          <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
            <div className="flex items-baseline justify-between gap-3 border-b border-blush-300/60 px-4 py-3.5">
              <h2 className="text-[15px]">Cash check</h2>
              <span className="text-[9px] uppercase tracking-[0.12em] text-ink-300">End of day</span>
            </div>
            <div className="px-4 py-3.5">
              <div className="flex items-baseline justify-between py-1.5 text-[11px]">
                <span className="text-ink-500">Expected in the drawer</span>
                <span className="num text-ink-900">{peso(expectedCash)}</span>
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
                  <span>{difference === 0 ? 'Balanced' : difference > 0 ? 'Over' : 'Short'}</span>
                  <b className="num text-[13px] font-medium">{peso(Math.abs(difference))}</b>
                </div>
              )}

              <p className="mt-3 text-[9px] leading-[1.6] text-ink-300">
                Cash sales only. E-money is settled by the provider, so it never touches the drawer.
              </p>
            </div>
          </section>
        </div>

        <p className="mt-4 text-[9px] leading-[1.6] text-ink-300">
          Draft — these figures come from the local ledger, not from the database yet.
        </p>
    </main>
  );
}
