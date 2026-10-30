import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { SHAPES, VARIANTS } from '@/lib/data';
import {
  addProduction,
  allProduction,
  inPeriod,
  todayIso,
  useProduction,
  type ProductionEntry,
} from '@/lib/production';

// ─── Production log ─────────────────────────────────────────────────────────
// The manual log that replaced the inventory screen. Production types how many
// pieces of each variant they finished on a day; the page keeps every batch in
// the history and adds up the day, week and month totals per variant.
//
// The shop's paper sheet is kept here as a reference (the photo at the top) so
// the team can see what this replaces without losing the format they know.

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** 'YYYY-MM-DD' → "Mon, Oct 26, 2026". Parsed at local midnight, no drift. */
function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Production() {
  const { member } = useAuth();
  const version = useProduction();
  const entries = allProduction();

  const [date, setDate] = useState(todayIso());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  function setOne(key: string, value: string): void {
    setQty((prev) => ({ ...prev, [key]: value.replace(/[^0-9]/g, '') }));
  }

  async function save(): Promise<void> {
    setMsg(null);
    const rows: ProductionEntry[] = [];
    for (const v of VARIANTS) {
      const n = Math.floor(Number(qty[v.key] || 0));
      if (n > 0) {
        rows.push({
          id: uid(),
          producedOn: date,
          variantKey: v.key,
          qty: n,
          createdBy: member?.id ?? null,
          createdAt: new Date().toISOString(),
        });
      }
    }
    if (!rows.length) {
      setMsg({ ok: false, text: 'Enter at least one quantity before saving.' });
      return;
    }
    setSaving(true);
    const ok = await addProduction(rows);
    setSaving(false);
    if (ok) {
      setQty({});
      const total = rows.reduce((n, r) => n + r.qty, 0);
      setMsg({
        ok: true,
        text: `Logged ${total} pcs across ${rows.length} ${rows.length === 1 ? 'variant' : 'variants'}.`,
      });
    } else {
      setMsg({ ok: false, text: 'Could not save — check your connection and try again.' });
    }
  }

  // Per-variant totals for the current day, week (Sat→Fri) and month.
  const totals = useMemo(() => {
    const t: Record<string, { day: number; week: number; month: number }> = {};
    for (const e of entries) {
      const row = t[e.variantKey] ?? { day: 0, week: 0, month: 0 };
      if (inPeriod(e.producedOn, 'day')) row.day += e.qty;
      if (inPeriod(e.producedOn, 'week')) row.week += e.qty;
      if (inPeriod(e.producedOn, 'month')) row.month += e.qty;
      t[e.variantKey] = row;
    }
    return t;
  }, [version]);

  // Every entry grouped by the day it was produced, newest day first.
  const history = useMemo(() => {
    const map = new Map<string, { iso: string; variants: Map<string, number>; total: number }>();
    for (const e of entries) {
      let d = map.get(e.producedOn);
      if (!d) {
        d = { iso: e.producedOn, variants: new Map(), total: 0 };
        map.set(e.producedOn, d);
      }
      d.variants.set(e.variantKey, (d.variants.get(e.variantKey) ?? 0) + e.qty);
      d.total += e.qty;
    }
    return [...map.values()].sort((a, b) => (a.iso < b.iso ? 1 : -1));
  }, [version]);

  const grand = {
    day: Object.values(totals).reduce((n, t) => n + t.day, 0),
    week: Object.values(totals).reduce((n, t) => n + t.week, 0),
    month: Object.values(totals).reduce((n, t) => n + t.month, 0),
  };

  const variantOf = (key: string) => VARIANTS.find((v) => v.key === key);

  return (
    <>
      <header className="flex h-[52px] items-center justify-between gap-5 border-b border-blush-300 bg-white px-7 max-md:px-4">
        <span className="text-[8.5px] uppercase tracking-[0.19em] text-ink-300">
          <b className="font-medium text-ink-900">Production</b> / Log
        </span>
        <span className="rounded-pill border border-blush-300 px-3 py-1 text-[9.5px] text-ink-500">
          Saksesories PH · Main
        </span>
      </header>

      <div className="px-7 pb-9 pt-[26px] max-md:px-4">
        <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3.5">
          <div>
            <h1 className="text-[clamp(26px,2.3vw,31px)]">What the shop made.</h1>
            <p className="mt-1.5 max-w-[64ch] text-[11.5px] text-ink-500">
              Type how many pieces of each variant you finished on a day. The
              history keeps every batch, and the totals add up the day, week and
              month.
            </p>
          </div>
          <button
            onClick={() => setShowSheet((v) => !v)}
            className="rounded-pill border border-blush-300 bg-white px-[15px] py-2 text-[11px] font-medium transition-colors hover:border-wine-800 hover:text-wine-800"
          >
            {showSheet ? 'Hide' : 'View'} reference sheet
          </button>
        </div>

        {/* The manual sheet this replaces — kept as a reference. */}
        {showSheet && (
          <div className="mt-4 overflow-hidden rounded-[7px] border border-blush-300 bg-white">
            <div className="border-b border-blush-300/60 px-4 py-2.5 text-[10px] text-ink-500">
              The shop's manual daily inventory sheet — same idea, now typed in.
            </div>
            <img
              src="/img/production-sheet.jpg"
              alt="The shop's manual daily production sheet"
              className="max-h-[560px] w-full bg-blush-50 object-contain"
            />
          </div>
        )}

        <div className="mt-[18px] grid grid-cols-[1fr_360px] items-start gap-[18px] max-xl:grid-cols-1">
          {/* ── Log form ─────────────────────────────────────────────────── */}
          <section className="rounded-[7px] border border-blush-300 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blush-300/60 px-4 py-3.5">
              <h2 className="text-[15px]">Log production</h2>
              <label className="flex items-center gap-2 rounded-pill border border-blush-300 px-3 py-[5px]">
                <span className="text-[7.5px] uppercase tracking-[0.14em] text-ink-300">Date</span>
                <input
                  type="date"
                  value={date}
                  max={todayIso()}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-[10.5px] text-ink-900 outline-none"
                />
              </label>
            </div>

            <div className="px-4 pb-4 pt-3">
              {SHAPES.map((shape) => (
                <div key={shape.id} className="mb-3 last:mb-0">
                  <p className="mb-2 text-[8px] uppercase tracking-[0.16em] text-ink-300">
                    {shape.name}
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
                    {VARIANTS.filter((v) => v.shape === shape.id).map((v) => (
                      <label
                        key={v.key}
                        className="flex items-center gap-2 rounded-[5px] border border-blush-300 px-2.5 py-[6px]"
                      >
                        <span
                          className="h-[12px] w-[12px] flex-none rounded-[3px] border border-black/10"
                          style={{ background: v.hex }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-900">
                          {v.colour}
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={qty[v.key] ?? ''}
                          placeholder="0"
                          onChange={(e) => setOne(v.key, e.target.value)}
                          className="w-14 rounded-[4px] border border-blush-300 px-1.5 py-[3px] text-right text-[10.5px] outline-none focus:border-crimson-600"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-pill bg-crimson-600 px-[18px] py-2.5 text-[11px] font-medium text-white transition-colors hover:bg-wine-800 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Log production'}
                </button>
                {msg && (
                  <span
                    className={['text-[10px]', msg.ok ? 'text-ok-600' : 'text-bad-600'].join(' ')}
                  >
                    {msg.text}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ── Totals ───────────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-[7px] border border-blush-300 bg-white">
            <div className="border-b border-blush-300/60 px-4 py-3.5">
              <h2 className="text-[15px]">Totals by variant</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blush-50">
                    {['Variant', 'Today', 'Week', 'Month'].map((h, i) => (
                      <th
                        key={h}
                        className={[
                          'border-b border-blush-300/60 px-3 py-[8px] text-[7.5px] font-medium uppercase tracking-[0.14em] text-ink-300',
                          i === 0 ? 'text-left' : 'text-right',
                        ].join(' ')}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VARIANTS.map((v) => {
                    const t = totals[v.key] ?? { day: 0, week: 0, month: 0 };
                    const cell = (n: number) =>
                      ['num px-3 py-[7px] text-right text-[10.5px]', n ? 'font-medium text-ink-900' : 'text-ink-300'].join(' ');
                    return (
                      <tr key={v.key} className="border-b border-blush-300/60 last:border-0">
                        <td className="px-3 py-[7px]">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-[10px] w-[10px] flex-none rounded-[2px] border border-black/10"
                              style={{ background: v.hex }}
                            />
                            <span className="text-[10px] text-ink-900">
                              {v.shapeName} · {v.colour}
                            </span>
                          </div>
                        </td>
                        <td className={cell(t.day)}>{t.day || '—'}</td>
                        <td className={cell(t.week)}>{t.week || '—'}</td>
                        <td className={cell(t.month)}>{t.month || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blush-50">
                    <td className="px-3 py-2 text-[8px] uppercase tracking-[0.14em] text-ink-300">
                      Total
                    </td>
                    <td className="num px-3 py-2 text-right text-[10.5px] font-medium text-ink-900">
                      {grand.day}
                    </td>
                    <td className="num px-3 py-2 text-right text-[10.5px] font-medium text-ink-900">
                      {grand.week}
                    </td>
                    <td className="num px-3 py-2 text-right text-[10.5px] font-medium text-ink-900">
                      {grand.month}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        {/* ── History ────────────────────────────────────────────────────── */}
        <section className="mt-[18px] overflow-hidden rounded-[7px] border border-blush-300 bg-white">
          <div className="border-b border-blush-300/60 px-4 py-3.5">
            <h2 className="text-[15px]">History</h2>
          </div>
          {history.length === 0 ? (
            <p className="px-4 py-8 text-center text-[10.5px] leading-[1.7] text-ink-300">
              Nothing logged yet. Type the pieces you finished above and save —
              every batch shows up here, grouped by day.
            </p>
          ) : (
            <div className="divide-y divide-blush-300/60">
              {history.map((day) => (
                <div key={day.iso} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium text-ink-900">{dateLabel(day.iso)}</p>
                    <span className="num text-[10px] text-ink-500">{day.total} pcs</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[...day.variants.entries()].map(([key, n]) => {
                      const v = variantOf(key);
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1.5 rounded-pill border border-blush-300 bg-white px-2 py-[3px] text-[9px] text-ink-500"
                        >
                          <span
                            className="h-[8px] w-[8px] flex-none rounded-[2px] border border-black/10"
                            style={{ background: v?.hex ?? '#cccccc' }}
                          />
                          {v ? `${v.shapeName} · ${v.colour}` : key}
                          <b className="num text-ink-900">{n}</b>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
