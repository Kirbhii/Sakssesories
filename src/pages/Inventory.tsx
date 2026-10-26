import { useMemo, useState } from 'react';
import { peso, peso2, SHAPES } from '@/lib/data';
import SideRail from '@/components/SideRail';
import {
  MATERIALS,
  COST_BREAKDOWN,
  COST_TOTAL,
  materialStatus,
  type Material,
} from '@/lib/materials';

// Both shapes sell for the same price, and it is the catalogue's number — not
// a second copy of it typed into this screen. If the price moves in data.ts,
// the cost card moves with it.
const SELL_AT = SHAPES[0].price;

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-ok-100 text-ok-600',
  low: 'bg-warn-100 text-warn-600',
  out: 'bg-bad-100 text-bad-600',
};

const STATUS_LABEL: Record<string, string> = {
  ok: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
};

function KpiCard({
  label,
  value,
  sub,
  icon,
  alert,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  alert?: boolean;
}) {
  return (
    <div
      className={[
        'relative rounded-[7px] border bg-white px-4 pb-3.5 pt-[15px]',
        alert ? 'border-[#f0dfe2] bg-[#fdf7f8]' : 'border-blush-300',
      ].join(' ')}
    >
      <p className="text-[8px] uppercase tracking-[0.17em] text-ink-300">{label}</p>
      <p className="num mt-[7px] text-[22px] font-medium leading-none text-ink-900">{value}</p>
      <p className="mt-1.5 text-[9px] text-ink-300">{sub}</p>
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        className={['absolute right-3.5 top-3.5 h-3 w-3', alert ? 'text-crimson-600' : 'text-ink-300'].join(' ')}
      >
        <path d={icon} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function Inventory() {
  const [selectedSku, setSelectedSku] = useState('LF-PL');
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () =>
      MATERIALS.filter((m) =>
        `${m.name} ${m.colour} ${m.sku}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  const selected: Material = MATERIALS.find((m) => m.sku === selectedSku) ?? MATERIALS[0];
  const status = materialStatus(selected);

  const lowCount = MATERIALS.filter((m) => materialStatus(m) !== 'ok').length;

  return (
    <div className="flex min-h-screen bg-blush-50 max-md:flex-col">
      <SideRail />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <header className="flex h-[52px] items-center justify-between gap-5 border-b border-blush-300 bg-white px-7 max-md:px-4">
          <span className="text-[8.5px] uppercase tracking-[0.19em] text-ink-300">
            <b className="font-medium text-ink-900">Inventory</b> / Materials
          </span>
          <span className="rounded-pill border border-blush-300 px-3 py-1 text-[9.5px] text-ink-500">
            Saksesories PH · Main
          </span>
        </header>

        <div className="px-7 pb-9 pt-[26px] max-md:px-4">
          <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3.5">
            <div>
              <h1 className="text-[clamp(26px,2.3vw,31px)]">The details behind every piece.</h1>
              <p className="mt-1.5 max-w-[62ch] text-[11.5px] text-ink-500">
                Stock on hand, reorder points, and what each piece actually costs to make.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-pill border border-blush-300 bg-white px-[15px] py-2 text-[11px] font-medium transition-colors hover:border-wine-800 hover:text-wine-800">
                Export
              </button>
              <button className="rounded-pill bg-crimson-600 px-[15px] py-2 text-[11px] font-medium text-white transition-colors hover:bg-wine-800">
                Add material
              </button>
            </div>
          </div>

          <div className="mt-[22px] grid grid-cols-4 gap-3 max-lg:grid-cols-2">
            <KpiCard label="Pieces in stock" value="10" sub="Ready to sell today" icon="M8 2l6 3-6 3-6-3 6-3ZM2 8l6 3 6-3M2 11l6 3 6-3" />
            <KpiCard label="Stock value" value="₱10,420" sub="Across all materials on hand" icon="M2.6 5.4c0 1.2 2.4 2.2 5.4 2.2s5.4-1 5.4-2.2S11 3.2 8 3.2 2.6 4.2 2.6 5.4ZM2.6 5.4v5.2c0 1.2 2.4 2.2 5.4 2.2s5.4-1 5.4-2.2V5.4" />
            <KpiCard label="Low stock" value={String(lowCount)} sub="Reorder before the weekend" icon="M8 2.2 14.4 13H1.6L8 2.2ZM8 6.4v3M8 11.2v.1" alert />
            <KpiCard label="Retail value" value="₱14,500" sub="If everything sells" icon="M2.4 2.4h5.2l6 6-5.2 5.2-6-6V2.4ZM5.6 5.6h.1" />
          </div>

          <div className="mt-3.5 flex items-center gap-2.5 rounded-md border border-[#f2e2c6] bg-warn-100 px-3.5 py-2.5 text-[10.5px] text-warn-600">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="h-3 w-3 flex-none">
              <path d="M8 2.2 14.4 13H1.6L8 2.2Z" strokeLinejoin="round" />
            </svg>
            <span>{lowCount} materials are running low — restock before the weekend rush.</span>
            <button className="ml-auto border-b border-current text-[9.5px]">View low stock</button>
          </div>

          <div className="mt-[18px] grid grid-cols-[1fr_320px] items-start gap-[18px] max-xl:grid-cols-1">
            {/* Materials table */}
            <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-blush-300/60 px-4 py-3.5">
                <h2 className="text-[15px]">Materials</h2>
                <label className="flex items-center gap-1.5 rounded-pill border border-blush-300 px-2.5 py-[5px]">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className="h-2.5 w-2.5 text-ink-300">
                    <circle cx="7" cy="7" r="4.4" />
                    <path d="m10.4 10.4 3 3" strokeLinecap="round" />
                  </svg>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search material"
                    className="w-24 text-[10px] outline-none placeholder:text-ink-300"
                  />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blush-50">
                      {['Material', 'On hand', 'Cost', 'Value'].map((h, i) => (
                        <th
                          key={h}
                          className={[
                            'border-b border-blush-300/60 px-4 py-[9px] text-left text-[7.5px] font-medium uppercase tracking-[0.16em] text-ink-300',
                            i === 3 ? 'text-right' : '',
                          ].join(' ')}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => (
                      <tr
                        key={m.sku}
                        onClick={() => setSelectedSku(m.sku)}
                        className={[
                          'cursor-pointer border-b border-blush-300/60 last:border-0 transition-colors',
                          m.sku === selectedSku ? 'bg-[#fdf4f5]' : 'hover:bg-blush-50',
                        ].join(' ')}
                      >
                        <td className="px-4 py-[9px]">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-[13px] w-[13px] flex-none rounded-[3px] border border-black/10"
                              style={{ background: m.hex }}
                            />
                            <div>
                              <div className="text-[10.5px] leading-tight">
                                {m.name} · {m.colour}
                              </div>
                              <div className="mt-0.5 text-[8px] tracking-[0.06em] text-ink-300">{m.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="num px-4 py-[9px] text-[10.5px] text-ink-500">
                          {m.onHand} {m.unit}
                        </td>
                        <td className="num px-4 py-[9px] text-[10.5px] text-ink-500">{peso2(m.costCents)}</td>
                        <td className="num px-4 py-[9px] text-right text-[10.5px]">
                          {peso2(m.onHand * m.costCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-blush-300/60 bg-blush-50 px-4 py-2.5 text-[9px] text-ink-300">
                Showing {rows.length} of {MATERIALS.length + 2} materials · 6 colours
              </div>
            </section>

            {/* Detail + cost */}
            <div>
              <section className="mb-4 rounded-[7px] border border-blush-300 bg-white">
                <div className="p-4">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="h-[30px] w-[30px] flex-none rounded-[5px] border border-black/10"
                      style={{ background: selected.hex }}
                    />
                    <div>
                      <div className="text-[11.5px] font-medium">
                        {selected.name} · {selected.colour}
                      </div>
                      <div className="mt-0.5 text-[8.5px] tracking-[0.07em] text-ink-300">
                        {selected.sku} · Per {selected.unit.replace(/s$/, '')}
                      </div>
                    </div>
                    <span className="ml-auto text-[12px] leading-none text-ink-300">×</span>
                  </div>

                  <div
                    className={[
                      'mt-3 rounded px-2.5 py-1.5 text-[9px]',
                      STATUS_STYLE[status],
                    ].join(' ')}
                  >
                    {status === 'ok'
                      ? 'Healthy stock — no action needed'
                      : `${STATUS_LABEL[status]} — reorder at ${selected.reorderAt} ${selected.unit}`}
                  </div>

                  <div className="mt-3">
                    {[
                      ['On hand', `${selected.onHand} ${selected.unit}`],
                      ['Reorder at', `${selected.reorderAt} ${selected.unit}`],
                      ['Cost per unit', peso2(selected.costCents)],
                      ['Stock value', peso2(selected.onHand * selected.costCents)],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between border-b border-blush-300/60 py-1.5 text-[10.5px] last:border-0"
                      >
                        <span className="text-ink-500">{k}</span>
                        <span className="num">{v}</span>
                      </div>
                    ))}
                  </div>

                  <label className="mt-2.5 block">
                    <span className="mb-1 block text-[8px] uppercase tracking-[0.14em] text-ink-300">
                      Supplier
                    </span>
                    <input
                      defaultValue={selected.supplier}
                      key={selected.sku}
                      className="w-full rounded-[5px] border border-blush-300 px-2.5 py-[7px] text-[10.5px] outline-none focus:border-crimson-600"
                    />
                  </label>

                  <button className="mt-3 w-full rounded-pill bg-crimson-600 px-[18px] py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-wine-800">
                    Save material
                  </button>

                  <div className="mt-2.5 flex items-center justify-between text-[8.5px] text-ink-300">
                    <span>Last updated today, 9:12 AM</span>
                    <button className="border-b border-current text-crimson-600">View movements</button>
                  </div>
                </div>
              </section>

              <section className="rounded-[7px] border border-blush-300 bg-white">
                <div className="p-4">
                  <h3 className="text-[14px]">
                    Inside the <span className="num font-sans font-medium">{peso2(COST_TOTAL)}</span>
                  </h3>
                  <p className="mt-1 text-[8.5px] uppercase tracking-[0.14em] text-ink-300">
                    Cost to make one piece
                  </p>

                  <div className="mt-3">
                    {COST_BREAKDOWN.map((row) => (
                      <div key={row.label} className="flex justify-between py-[5px] text-[10px] text-ink-500">
                        <span>{row.label}</span>
                        <span className="num text-ink-900">{peso2(row.cents)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-blush-300 pt-2.5 text-[10.5px] font-medium">
                    <span>Total cost</span>
                    <span className="num text-[15px]">{peso2(COST_TOTAL)}</span>
                  </div>

                  <div className="mt-2 flex justify-between rounded bg-ok-100 px-2.5 py-[7px] text-[9.5px] text-ok-600">
                    <span>Sells at {peso(SELL_AT)}</span>
                    <span className="num">
                      {peso2(SELL_AT - COST_TOTAL)} margin ·{' '}
                      {Math.round(((SELL_AT - COST_TOTAL) / SELL_AT) * 100)}%
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
